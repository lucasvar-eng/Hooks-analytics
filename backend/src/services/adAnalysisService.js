const crypto = require('crypto');
const mongoose = require('mongoose');
const AdAnalysis = require('../models/AdAnalysis');
const MetaCampaign = require('../models/MetaCampaign');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const { getProvider } = require('./aiProviders');
const User = require('../models/User');
const { decrypt } = require('../utils/encryption');
const { ai } = require('../config/environment');

/**
 * Resuelve las credenciales de Anthropic para un usuario.
 * Replica la lógica de aiService.resolveCredentials para no acoplar este
 * servicio a esa export (que está en flux con cambios previos del repo).
 */
async function resolveAnthropicCredentials(userId) {
  if (userId) {
    const user = await User.findById(userId)
      .select('+aiConfig.apiKeyEncrypted +aiConfig.apiKeyIV +aiConfig.apiKeyAuthTag aiConfig.provider');
    if (user?.aiConfig?.apiKeyEncrypted && user.aiConfig.provider === 'anthropic') {
      const apiKey = decrypt(user.aiConfig.apiKeyEncrypted, user.aiConfig.apiKeyIV, user.aiConfig.apiKeyAuthTag);
      return { apiKey, source: 'user' };
    }
  }
  if (ai.anthropicApiKey) {
    return { apiKey: ai.anthropicApiKey, source: 'env' };
  }
  throw new Error('Falta API key de Anthropic. Configurala en Settings o en .env');
}

const ANGLE_OPTIONS = [
  { key: 'producto-urgencia', label: 'Producto + urgencia' },
  { key: 'social-proof', label: 'Social proof / autoridad' },
  { key: 'descuento-general', label: 'Descuento general' },
  { key: 'educativo', label: 'Educativo / comparativa' },
  { key: 'transformacion', label: 'Transformación / aspiracional' },
  { key: 'generico-marca', label: 'Mensaje genérico de marca' },
  { key: 'otro', label: 'Otro' },
];

const ANGLE_BY_KEY = ANGLE_OPTIONS.reduce((acc, a) => { acc[a.key] = a.label; return acc; }, {});

function copyHash(title, body) {
  const text = `${title || ''}\n${body || ''}`.trim();
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 16);
}

const SYSTEM_PROMPT = `Sos un experto en copywriting de Meta Ads para e-commerce hispanoparlante. Analizás creativos en castellano rioplatense, con foco en marcas argentinas. Tu trabajo es clasificar el ÁNGULO comercial de un anuncio según una taxonomía cerrada y extraer los componentes clave del mensaje.

Tipos de ángulo (elegí uno):
- "producto-urgencia": producto específico + escasez / oferta temporal real (no genérica)
- "social-proof": autoridad, recomendación, "los que usa X equipo", "elegida por miles"
- "descuento-general": % off de marca o categoría sin producto específico
- "educativo": cómo elegir, comparativas, guías, contenido
- "transformacion": resultado aspiracional, "convertite en", "el corredor que querés"
- "generico-marca": mensajes amplios sobre la marca sin propuesta clara ("más de 500 modelos te esperan")
- "otro": no encaja en ninguno de los anteriores

Devolvé SOLO JSON válido (sin markdown, sin texto antes/después) con esta forma exacta:
{
  "angle": "uno-de-los-keys-del-enum",
  "hook": "el primer gancho en 6 palabras max",
  "tone": "directo / aspiracional / informativo / urgente / cálido (max 3 palabras)",
  "cta": "explícito o inferido en 4 palabras max (ej: 'Comprar ahora', 'Saber más')",
  "target": "a quién le habla en 5 palabras max",
  "valueProposition": "la promesa principal en 12 palabras max",
  "rationale": "1-2 oraciones explicando POR QUÉ funciona o no funciona basado en el copy. Sé directo, sin diplomacia."
}`;

async function analyzeAd({ provider, model, ad }) {
  const userPrompt = `Anuncio:
- Headline: ${ad.creativeTitle || '(sin headline)'}
- Body: ${ad.creativeBody || '(sin body)'}
${ad.nombre ? `- Nombre interno: ${ad.nombre}` : ''}`;

  const result = await provider.createMessage({
    model,
    maxTokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('La AI no devolvió JSON interpretable');
  const parsed = JSON.parse(jsonMatch[0]);

  const angleKey = ANGLE_BY_KEY[parsed.angle] ? parsed.angle : 'otro';

  return {
    angle: angleKey,
    angleLabel: ANGLE_BY_KEY[angleKey],
    hook: String(parsed.hook || '').slice(0, 100),
    tone: String(parsed.tone || '').slice(0, 60),
    cta: String(parsed.cta || '').slice(0, 60),
    target: String(parsed.target || '').slice(0, 100),
    valueProposition: String(parsed.valueProposition || '').slice(0, 200),
    rationale: String(parsed.rationale || '').slice(0, 600),
    model,
    tokensUsed: (result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0),
  };
}

/**
 * Analiza una lista de ads. Si ya hay análisis cacheado y el copy no cambió,
 * lo devuelve sin re-llamar a Claude. Para ads sin copy, omite el análisis.
 *
 * Devuelve un map { metaId: AdAnalysis | null }.
 */
async function analyzeAdsBatch({ storeId, metaIds, userId, force = false }) {
  if (!Array.isArray(metaIds) || metaIds.length === 0) return { analyses: {}, stats: { analyzed: 0, cached: 0, skipped: 0, failed: 0 } };

  const ads = await MetaCampaign.find({
    storeId: new mongoose.Types.ObjectId(storeId),
    metaId: { $in: metaIds },
    level: 'ad',
  }).lean();

  const credentials = await resolveAnthropicCredentials(userId);
  const provider = getProvider('anthropic', credentials.apiKey);
  const model = 'claude-haiku-4-5-20251001'; // rápido y barato para clasificación

  const existing = await AdAnalysis.find({
    storeId: new mongoose.Types.ObjectId(storeId),
    metaId: { $in: metaIds },
  }).lean();
  const existingMap = new Map(existing.map((e) => [e.metaId, e]));

  const analyses = {};
  let analyzed = 0, cached = 0, skipped = 0, failed = 0;

  for (const ad of ads) {
    if (!ad.creativeBody && !ad.creativeTitle) {
      analyses[ad.metaId] = null;
      skipped++;
      continue;
    }
    const hash = copyHash(ad.creativeTitle, ad.creativeBody);
    const cachedAnalysis = existingMap.get(ad.metaId);
    if (!force && cachedAnalysis && cachedAnalysis.copyHash === hash) {
      analyses[ad.metaId] = cachedAnalysis;
      cached++;
      continue;
    }

    try {
      const result = await analyzeAd({ provider, model, ad });
      const saved = await AdAnalysis.findOneAndUpdate(
        { storeId, metaId: ad.metaId },
        {
          ...result,
          storeId,
          metaId: ad.metaId,
          copyHash: hash,
          analyzedAt: new Date(),
        },
        { upsert: true, new: true }
      ).lean();
      analyses[ad.metaId] = saved;
      analyzed++;
    } catch (err) {
      analyses[ad.metaId] = null;
      failed++;
      // eslint-disable-next-line no-console
      console.error(`Failed to analyze ad ${ad.metaId}: ${err.message}`);
    }
  }

  return { analyses, stats: { analyzed, cached, skipped, failed, total: metaIds.length } };
}

/**
 * Estadísticas agrupadas por ángulo. Combina los AdAnalysis con las métricas
 * agregadas de MetaDailyInsight para devolver performance promedio por ángulo.
 */
async function getAngleStats({ storeId, from, to }) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const analyses = await AdAnalysis.find({ storeId: storeObjectId }).lean();
  if (analyses.length === 0) {
    return { angles: [], totalAnalyzed: 0 };
  }

  const metaIds = analyses.map((a) => a.metaId);

  const dateMatch = from && to
    ? { $gte: new Date(from), $lte: new Date(to + 'T23:59:59.999Z') }
    : null;

  const insightMatch = {
    storeId: storeObjectId,
    metaId: { $in: metaIds },
    granularity: 'ad',
  };
  if (dateMatch) insightMatch.date = dateMatch;

  const insightsAgg = await MetaDailyInsight.aggregate([
    { $match: insightMatch },
    {
      $group: {
        _id: '$metaId',
        spend: { $sum: '$spend' },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        purchases: { $sum: '$purchases' },
        purchaseValue: { $sum: '$purchaseValue' },
      },
    },
  ]);

  const insightMap = new Map(insightsAgg.map((i) => [i._id, i]));

  // Agrupar por ángulo
  const byAngle = {};
  for (const an of analyses) {
    const ins = insightMap.get(an.metaId) || { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchaseValue: 0 };
    if (!byAngle[an.angle]) {
      byAngle[an.angle] = {
        angle: an.angle,
        label: an.angleLabel,
        ads: 0,
        spend: 0,
        revenue: 0,
        purchases: 0,
        impressions: 0,
        clicks: 0,
        sampleHook: an.hook,
      };
    }
    byAngle[an.angle].ads += 1;
    byAngle[an.angle].spend += Number(ins.spend || 0);
    byAngle[an.angle].revenue += Number(ins.purchaseValue || 0);
    byAngle[an.angle].purchases += Number(ins.purchases || 0);
    byAngle[an.angle].impressions += Number(ins.impressions || 0);
    byAngle[an.angle].clicks += Number(ins.clicks || 0);
  }

  const angles = Object.values(byAngle).map((g) => ({
    ...g,
    roas: g.spend > 0 ? g.revenue / g.spend : 0,
    ctr: g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0,
    cpa: g.purchases > 0 ? g.spend / g.purchases : null,
  }));

  angles.sort((a, b) => b.roas - a.roas);

  return { angles, totalAnalyzed: analyses.length };
}

/**
 * Devuelve todos los análisis del store indexados por metaId.
 * Liviano — sólo los tags y rationale, sin métricas.
 */
async function getAllAnalyses(storeId) {
  const items = await AdAnalysis.find({ storeId: new mongoose.Types.ObjectId(storeId) }).lean();
  const byMetaId = {};
  for (const item of items) {
    byMetaId[item.metaId] = item;
  }
  return byMetaId;
}

module.exports = {
  analyzeAdsBatch,
  getAngleStats,
  getAllAnalyses,
  ANGLE_OPTIONS,
};
