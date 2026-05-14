const axios = require('axios');
const https = require('https');
const Competitor = require('../models/Competitor');
const logger = require('../utils/logger');

// Algunos sitios usan certificados con cadenas incompletas que Node rechaza.
// Para scraping read-only (no mandamos credentials) tolerar es aceptable.
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Scraping liviano del sitio del competidor — sin dependencias externas (cheerio,
 * puppeteer). Extrae con regex los campos visibles más útiles:
 *  - title, meta description, og:title, og:description
 *  - h1, h2 (primeros)
 *  - precios visibles ($X)
 *  - texto del hero (primer párrafo significativo)
 *
 * No interpreta JavaScript ni navega — sirve para sitios con SSR (TiendaNube,
 * VTEX, Shopify). Si el sitio es 100% SPA sin contenido server-rendered, devuelve
 * poco. En ese caso el endpoint igual no falla, el usuario puede completar a mano.
 */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 800_000; // ~800kb es más que suficiente

function normalizeUrl(input) {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function stripTags(s) {
  if (!s) return '';
  return String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const HTML_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü',
  iexcl: '¡', iquest: '¿', ordf: 'ª', ordm: 'º', deg: '°',
  hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', laquo: '«', raquo: '»',
};

function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => (HTML_ENTITIES[name] != null ? HTML_ENTITIES[name] : match));
}

function cleanText(s, maxLen = null) {
  const out = decodeEntities(stripTags(s));
  if (!out) return '';
  return maxLen ? out.slice(0, maxLen) : out;
}

function extractAll(html, regex, group = 1, max = 10) {
  const out = [];
  let match;
  let safety = 0;
  while ((match = regex.exec(html)) !== null && out.length < max && safety < 500) {
    const value = cleanText(match[group]);
    if (value && value.length > 1) out.push(value);
    safety += 1;
  }
  return out;
}

function uniqueTrim(items, maxLen = 280) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const cleaned = (it || '').trim();
    if (!cleaned) continue;
    const truncated = cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
    const key = truncated.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(truncated);
  }
  return out;
}

function parseHtml(html) {
  // Limitar tamaño para regex
  const truncated = html.length > MAX_HTML_BYTES ? html.slice(0, MAX_HTML_BYTES) : html;

  // Meta tags
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(truncated);
  const title = titleMatch ? cleanText(titleMatch[1], 200) : '';

  const metaDescMatch = /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i.exec(truncated)
    || /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i.exec(truncated);
  const metaDescription = metaDescMatch ? cleanText(metaDescMatch[1], 320) : '';

  const ogTitleMatch = /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i.exec(truncated);
  const ogTitle = ogTitleMatch ? cleanText(ogTitleMatch[1], 200) : '';

  const ogDescMatch = /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i.exec(truncated);
  const ogDescription = ogDescMatch ? cleanText(ogDescMatch[1], 320) : '';

  const ogSiteMatch = /<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i.exec(truncated);
  const siteName = ogSiteMatch ? cleanText(ogSiteMatch[1], 120) : '';

  // Headings
  const h1 = uniqueTrim(extractAll(truncated, /<h1[^>]*>([\s\S]*?)<\/h1>/gi, 1, 8), 240);
  const h2 = uniqueTrim(extractAll(truncated, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, 1, 12), 240);
  const h3 = uniqueTrim(extractAll(truncated, /<h3[^>]*>([\s\S]*?)<\/h3>/gi, 1, 10), 240);

  // Texto destacado: párrafos con > 60 chars (probable copy real, no nav/footer)
  const allParagraphs = extractAll(truncated, /<p[^>]*>([\s\S]*?)<\/p>/gi, 1, 100);
  const richParagraphs = uniqueTrim(
    allParagraphs.filter((p) => p.length >= 60 && p.length <= 600),
    400,
  ).slice(0, 8);

  // Buttons / CTAs (text)
  const buttonsRaw = extractAll(truncated, /<button[^>]*>([\s\S]*?)<\/button>/gi, 1, 30);
  const linkCtasRaw = extractAll(
    truncated,
    /<a[^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    1,
    30,
  );
  const ctas = uniqueTrim(
    [...buttonsRaw, ...linkCtasRaw].filter((c) => c.length >= 3 && c.length <= 60),
    60,
  ).slice(0, 12);

  // Precios visibles
  const priceMatches = truncated.match(/\$\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?(?!\d)/g) || [];
  const uniquePrices = Array.from(new Set(priceMatches.map((p) => p.replace(/\s+/g, '')))).slice(0, 20);

  // Idioma del HTML (lang attr)
  const langMatch = /<html[^>]*\blang=["']([^"']+)["']/i.exec(truncated);
  const lang = langMatch ? langMatch[1].slice(0, 8) : '';

  return {
    siteName,
    title,
    metaDescription,
    ogTitle,
    ogDescription,
    h1,
    h2,
    h3,
    richParagraphs,
    ctas,
    prices: uniquePrices,
    lang,
    htmlBytes: html.length,
  };
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: TIMEOUT_MS,
    maxContentLength: MAX_HTML_BYTES * 2,
    maxBodyLength: MAX_HTML_BYTES * 2,
    httpsAgent: insecureHttpsAgent,
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
    },
    validateStatus: (status) => status >= 200 && status < 400,
    responseType: 'text',
    maxRedirects: 5,
  });
  return typeof response.data === 'string' ? response.data : String(response.data || '');
}

/**
 * Sugerencias derivadas del parseo HTML para pre-llenar campos del competidor.
 * Sin AI — son reglas heurísticas. El usuario revisa antes de aplicar.
 */
function deriveSuggestions(parsed) {
  const suggestions = {};

  // Posicionamiento: og:description o meta description corta
  const pos = parsed.ogDescription || parsed.metaDescription;
  if (pos && pos.length <= 200) suggestions.positioning = pos;

  // Oferta principal: primer H1 con buena longitud o primer párrafo grande
  if (parsed.h1.length > 0) suggestions.mainOffer = parsed.h1[0];
  else if (parsed.richParagraphs.length > 0) suggestions.mainOffer = parsed.richParagraphs[0];

  return suggestions;
}

async function scrapeCompetitor(competitorId, storeId) {
  const competitor = await Competitor.findOne({ _id: competitorId, storeId }).lean();
  if (!competitor) {
    const err = new Error('Competidor no encontrado');
    err.status = 404;
    throw err;
  }

  const url = normalizeUrl(competitor.url);
  if (!url) {
    const err = new Error('El competidor no tiene URL cargada');
    err.status = 400;
    throw err;
  }

  let html;
  try {
    html = await fetchHtml(url);
  } catch (error) {
    logger.warn(`Scrape falló para ${competitor.nombre} (${url}): ${error.message}`);
    const err = new Error(`No pudimos acceder al sitio: ${error.message}`);
    err.status = 502;
    err.cause = error;
    throw err;
  }

  const parsed = parseHtml(html);
  const suggestions = deriveSuggestions(parsed);

  return {
    competitorId: competitor._id,
    url,
    fetchedAt: new Date(),
    parsed,
    suggestions,
  };
}

module.exports = {
  scrapeCompetitor,
  parseHtml,
  normalizeUrl,
};
