const mongoose = require('mongoose');
const DailyMetric = require('../models/DailyMetric');
const Alert = require('../models/Alert');
const StoreAccess = require('../models/StoreAccess');
const User = require('../models/User');
const { sendEmailForUser, buildAlertEmail } = require('./emailService');
const { email: emailConfig } = require('../config/environment');
const logger = require('../utils/logger');

const SEVERITY_RANK = { info: 0, warning: 1, critical: 2 };

const safeDiv = (a, b) => (b && b > 0 ? a / b : 0);

/**
 * Aggregate DailyMetrics for a date range.
 */
async function aggregatePeriod(storeId, from, to) {
  const [agg] = await DailyMetric.aggregate([
    {
      $match: {
        storeId: new mongoose.Types.ObjectId(storeId),
        date: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: null,
        days: { $sum: 1 },
        ordenes: { $sum: '$ordenes' },
        ordenesPositivas: { $sum: '$ordenesPositivas' },
        revenue: { $sum: '$revenue' },
        netRevenue: { $sum: '$netRevenue' },
        adSpend: { $sum: '$adSpend' },
        profit: { $sum: '$profit' },
        ncOrdenes: { $sum: '$ncOrdenes' },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        metaPurchases: { $sum: '$metaPurchases' },
      },
    },
  ]);
  if (!agg) return null;

  return {
    ...agg,
    roas: safeDiv(agg.revenue, agg.adSpend),
    trueRoas: safeDiv(agg.netRevenue, agg.adSpend),
    cpa: safeDiv(agg.adSpend, agg.metaPurchases),
    profitMargin: safeDiv(agg.profit, agg.revenue) * 100,
    ncPct: safeDiv(agg.ncOrdenes, agg.ordenes) * 100,
    ctr: safeDiv(agg.clicks, agg.impressions) * 100,
  };
}

/**
 * Check for duplicate active alert of same tipo for store in last 24h.
 */
async function isDuplicate(storeId, tipo) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await Alert.findOne({
    storeId,
    tipo,
    estado: { $in: ['active', 'acknowledged'] },
    fechaDetectada: { $gte: since },
  });
  return !!existing;
}

/**
 * Create an alert if not duplicate.
 */
async function createAlert(storeId, data) {
  if (await isDuplicate(storeId, data.tipo)) return null;
  return Alert.create({ storeId, ...data });
}

/**
 * Devuelve los users que deben recibir email para esta alerta:
 *   - tienen StoreAccess a la tienda (cualquier rol)
 *   - notificationPreferences.alerts.enabled = true
 *   - severidad de la alerta >= minSeverity del user
 *
 * Devuelve docs de User con los campos sensibles cargados para que
 * sendEmailForUser pueda descifrar la API key.
 */
async function getAlertRecipients(storeId, severity) {
  const accesses = await StoreAccess.find({ storeId }).select('userId').lean();
  const userIds = accesses.map((a) => a.userId);
  if (!userIds.length) return [];

  const users = await User.find({ _id: { $in: userIds }, isActive: true })
    .select('+resendApiKeyEncrypted +resendApiKeyIV +resendApiKeyAuthTag email notificationEmail notificationPreferences resendFromEmail');

  const sevRank = SEVERITY_RANK[severity] ?? 0;
  return users.filter((u) => {
    const prefs = u.notificationPreferences?.alerts;
    if (!prefs || prefs.enabled === false) return false;
    const minRank = SEVERITY_RANK[prefs.minSeverity || 'warning'] ?? 1;
    return sevRank >= minRank;
  });
}

async function notifyAlertRecipients(store, alert) {
  const recipients = await getAlertRecipients(store._id, alert.severidad);
  if (!recipients.length) return { sent: 0, total: 0 };

  const storeUrl = `${emailConfig.appUrl}/store/${store._id}/alertas`;
  const template = buildAlertEmail({
    storeName: store.nombre,
    alertTitle: alert.titulo,
    alertMessage: alert.descripcion,
    severity: alert.severidad,
    storeUrl,
  });

  let sent = 0;
  for (const user of recipients) {
    const to = user.notificationEmail || user.email;
    const result = await sendEmailForUser(user, {
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
    if (result.ok) {
      sent++;
      logger.info(`Alert email sent: ${alert.titulo} → ${to} (resend id: ${result.id})`);
    } else if (result.skipped) {
      logger.warn(`Alert email NOT sent to ${to} — user sin Resend configurado.`);
    } else {
      logger.error(`Alert email failed to ${to}: ${result.error}`);
    }
  }
  return { sent, total: recipients.length };
}

/**
 * Run diagnostics for a single store.
 * Rule-based checks — no AI key required.
 */
async function runDiagnostics(store) {
  const storeId = store._id;
  const objetivos = store.objetivos?.kpis;
  const thresholds = store.objetivos?.alertThresholds || { warningPct: 10, criticalPct: 25 };

  // Calculate date ranges: last 7 days vs previous 7 days
  const now = new Date();
  const currentTo = new Date(now);
  currentTo.setHours(23, 59, 59, 999);
  const currentFrom = new Date(now);
  currentFrom.setDate(currentFrom.getDate() - 7);
  currentFrom.setHours(0, 0, 0, 0);

  const prevTo = new Date(currentFrom);
  prevTo.setDate(prevTo.getDate() - 1);
  prevTo.setHours(23, 59, 59, 999);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - 6);
  prevFrom.setHours(0, 0, 0, 0);

  const current = await aggregatePeriod(storeId, currentFrom, currentTo);
  const previous = await aggregatePeriod(storeId, prevFrom, prevTo);

  if (!current || current.days < 2) return; // Not enough data

  const alerts = [];

  // --- Threshold-based checks (require objetivos configured) ---
  if (objetivos) {
    // ROAS vs target
    if (objetivos.roasTarget && current.roas > 0) {
      const pctBelow = ((objetivos.roasTarget - current.roas) / objetivos.roasTarget) * 100;
      if (pctBelow >= thresholds.criticalPct) {
        alerts.push({
          tipo: 'threshold',
          titulo: `ROAS crítico: ${current.roas.toFixed(2)}x (target: ${objetivos.roasTarget}x)`,
          descripcion: `El ROAS de los últimos 7 días está ${pctBelow.toFixed(0)}% por debajo del objetivo. Revenue: $${Math.round(current.revenue).toLocaleString()}, Ad Spend: $${Math.round(current.adSpend).toLocaleString()}.`,
          severidad: 'critical',
          metricas: { roas: current.roas, target: objetivos.roasTarget, pctBelow },
        });
      } else if (pctBelow >= thresholds.warningPct) {
        alerts.push({
          tipo: 'threshold',
          titulo: `ROAS por debajo del target: ${current.roas.toFixed(2)}x (target: ${objetivos.roasTarget}x)`,
          descripcion: `El ROAS está ${pctBelow.toFixed(0)}% por debajo del objetivo en los últimos 7 días.`,
          severidad: 'warning',
          metricas: { roas: current.roas, target: objetivos.roasTarget, pctBelow },
        });
      }
    }

    // CPA vs max
    if (objetivos.cpaMaximo && current.cpa > 0) {
      const pctAbove = ((current.cpa - objetivos.cpaMaximo) / objetivos.cpaMaximo) * 100;
      if (pctAbove >= thresholds.criticalPct) {
        alerts.push({
          tipo: 'threshold',
          titulo: `CPA crítico: $${Math.round(current.cpa)} (máx: $${objetivos.cpaMaximo})`,
          descripcion: `El CPA está ${pctAbove.toFixed(0)}% por encima del máximo permitido.`,
          severidad: 'critical',
          metricas: { cpa: current.cpa, max: objetivos.cpaMaximo, pctAbove },
        });
      } else if (pctAbove >= thresholds.warningPct) {
        alerts.push({
          tipo: 'threshold',
          titulo: `CPA elevado: $${Math.round(current.cpa)} (máx: $${objetivos.cpaMaximo})`,
          descripcion: `El CPA está ${pctAbove.toFixed(0)}% por encima del máximo.`,
          severidad: 'warning',
          metricas: { cpa: current.cpa, max: objetivos.cpaMaximo, pctAbove },
        });
      }
    }

    // Profit margin vs min
    if (objetivos.profitMarginMin && current.profitMargin > 0) {
      if (current.profitMargin < objetivos.profitMarginMin) {
        const diff = objetivos.profitMarginMin - current.profitMargin;
        alerts.push({
          tipo: 'threshold',
          titulo: `Margen bajo: ${current.profitMargin.toFixed(1)}% (mín: ${objetivos.profitMarginMin}%)`,
          descripcion: `El margen de profit está ${diff.toFixed(1)} puntos por debajo del mínimo.`,
          severidad: diff > 10 ? 'critical' : 'warning',
          metricas: { profitMargin: current.profitMargin, min: objetivos.profitMarginMin },
        });
      }
    }
  }

  // --- Anomaly detection (period-over-period comparison) ---
  if (previous && previous.days >= 2) {
    // Revenue drop > 30%
    if (previous.revenue > 0 && current.revenue > 0) {
      const revDrop = ((previous.revenue - current.revenue) / previous.revenue) * 100;
      if (revDrop >= 30) {
        alerts.push({
          tipo: 'anomaly',
          titulo: `Revenue cayó ${revDrop.toFixed(0)}% vs semana anterior`,
          descripcion: `Revenue actual: $${Math.round(current.revenue).toLocaleString()} vs anterior: $${Math.round(previous.revenue).toLocaleString()}.`,
          severidad: revDrop >= 50 ? 'critical' : 'warning',
          metricas: { current: current.revenue, previous: previous.revenue, dropPct: revDrop },
        });
      }
    }

    // Ad spend spike > 50% with ROAS declining
    if (previous.adSpend > 0 && current.adSpend > 0) {
      const spendIncrease = ((current.adSpend - previous.adSpend) / previous.adSpend) * 100;
      const roasDecline = previous.roas > 0 ? ((previous.roas - current.roas) / previous.roas) * 100 : 0;

      if (spendIncrease >= 50 && roasDecline >= 10) {
        alerts.push({
          tipo: 'anomaly',
          titulo: `Ad spend subió ${spendIncrease.toFixed(0)}% pero ROAS bajó ${roasDecline.toFixed(0)}%`,
          descripcion: `Spend: $${Math.round(current.adSpend)} (+${spendIncrease.toFixed(0)}%). ROAS: ${current.roas.toFixed(2)}x (antes: ${previous.roas.toFixed(2)}x). Revisá las campañas activas.`,
          severidad: 'warning',
          metricas: { spendIncrease, roasDecline, currentSpend: current.adSpend, currentRoas: current.roas },
        });
      }
    }

    // Orders dropped > 40%
    if (previous.ordenes > 5 && current.ordenes > 0) {
      const orderDrop = ((previous.ordenes - current.ordenes) / previous.ordenes) * 100;
      if (orderDrop >= 40) {
        alerts.push({
          tipo: 'anomaly',
          titulo: `Órdenes cayeron ${orderDrop.toFixed(0)}% vs semana anterior`,
          descripcion: `Órdenes actuales: ${current.ordenes} vs anteriores: ${previous.ordenes}.`,
          severidad: orderDrop >= 60 ? 'critical' : 'warning',
          metricas: { current: current.ordenes, previous: previous.ordenes, dropPct: orderDrop },
        });
      }
    }
  }

  // --- Performance checks (always) ---
  if (current.adSpend > 0 && current.roas < 1) {
    alerts.push({
      tipo: 'performance',
      titulo: `ROAS negativo: ${current.roas.toFixed(2)}x — estás perdiendo plata en ads`,
      descripcion: `Gastaste $${Math.round(current.adSpend)} en ads y generaste $${Math.round(current.revenue)} en revenue. Cada peso invertido retorna ${current.roas.toFixed(2)} pesos.`,
      severidad: 'critical',
      metricas: { roas: current.roas, adSpend: current.adSpend, revenue: current.revenue },
    });
  }

  // Create alerts (with dedup) + notificar por email a los recipients que correspondan.
  let created = 0;
  for (const alertData of alerts) {
    const alert = await createAlert(storeId, alertData);
    if (!alert) continue;
    created++;
    try {
      const result = await notifyAlertRecipients(store, alert);
      if (result.total > 0 && result.sent === 0) {
        logger.warn(`Alert "${alert.titulo}" creada pero no se notificó a ningún recipient (${result.total} candidatos).`);
      }
    } catch (err) {
      logger.error(`Falló la notificación de alerta "${alert.titulo}": ${err.message}`);
    }
  }

  if (created > 0) {
    logger.info(`Diagnostics: ${created} new alert(s) for ${store.nombre}`);
  }
  return { created, total: alerts.length };
}

module.exports = { runDiagnostics, getAlertRecipients, notifyAlertRecipients };
