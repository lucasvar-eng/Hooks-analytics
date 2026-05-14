/**
 * autoInsightsService — genera insights determinísticos (Wins / Problemas /
 * Recordatorios) para la página `/insights` del sidebar.
 *
 * NO usa IA. Son reglas sobre los datos que ya tenemos.
 * La IA externa via MCP arma reportes narrados que enriquecen esto, pero
 * los insights base salen siempre y rápido.
 *
 * Cada item tiene:
 *   - kind: 'win' | 'problem' | 'reminder'
 *   - severity: 'info' | 'warn' | 'critical' | 'good'
 *   - title: string corto
 *   - detail: explicación de 1-2 oraciones
 *   - metric?: { label, value } — el número crudo
 *   - link?: '/store/X/seccion' — adónde ir para profundizar
 *   - cta?: 'Configurar', 'Pausar', 'Escalar', 'Revisar', etc.
 *   - id: string estable (para que el front pueda hacer "ocultar")
 */

const mongoose = require('mongoose');
const Store = require('../models/Store');
const Order = require('../models/Order');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { aggregateRange } = require('./metricCalculator');
const { buildBusinessSourceDateMatch } = require('../utils/businessDate');

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Math.round(Number(v));
  return `$${n.toLocaleString('es-AR')}`;
}
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
function fmtPct(v, d = 1) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(d)}%`;
}

async function buildAutoInsights(storeId, from, to) {
  const store = await Store.findById(storeId).lean();
  if (!store) return null;

  const objetivos = store.objetivos?.kpis || {};
  const hasKpis = Object.values(objetivos).some((v) => v != null && v !== 0);

  // Reusar agregaciones existentes
  const current = await aggregateRange(storeId, from, to);

  const wins = [];
  const problems = [];
  const reminders = [];

  // === REGLAS ===

  // 1. Cuello de botella del funnel (ATC → Compras)
  if (current.addToCart > 0 && current.metaPurchases >= 0) {
    const cvrATCtoCompras = current.addToCart > 0
      ? (current.metaPurchases / current.addToCart) * 100
      : 0;
    if (cvrATCtoCompras < 25 && current.addToCart >= 10) {
      const lostCarts = current.addToCart - current.metaPurchases;
      const avgTicket = current.metaPurchases > 0
        ? (current.metaPurchaseValue || 0) / current.metaPurchases
        : 0;
      const lostRevenue = lostCarts * avgTicket;
      problems.push({
        id: 'funnel-atc-checkout',
        kind: 'problem',
        severity: cvrATCtoCompras < 15 ? 'critical' : 'warn',
        title: `Cuello de botella en el checkout`,
        detail: `Sólo ${fmtPct(cvrATCtoCompras)} de los carritos terminan en compra. Estás perdiendo ~${lostCarts} carritos = ${fmtMoneyShort(lostRevenue)} de revenue potencial.`,
        metric: { label: 'CVR carrito→compra', value: fmtPct(cvrATCtoCompras) },
        link: `/store/${storeId}/meta-ads`,
        cta: 'Ver embudo',
      });
    } else if (cvrATCtoCompras >= 60 && current.addToCart >= 10) {
      wins.push({
        id: 'funnel-atc-good',
        kind: 'win',
        severity: 'good',
        title: `Checkout convierte muy bien`,
        detail: `${fmtPct(cvrATCtoCompras)} de los carritos terminan en compra. Eso es excelente.`,
        metric: { label: 'CVR carrito→compra', value: fmtPct(cvrATCtoCompras) },
      });
    }
  }

  // 2. ROAS negativo (estás perdiendo plata en ads)
  if (current.adSpend > 0 && current.roas > 0) {
    if (current.roas < 1) {
      problems.push({
        id: 'roas-negative',
        kind: 'problem',
        severity: 'critical',
        title: `ROAS por debajo de 1× — perdiendo plata`,
        detail: `Gastaste ${fmtMoney(current.adSpend)} y generaste ${fmtMoney(current.revenue)} con esos ads. Cada peso retorna ${current.roas.toFixed(2)}. Revisá qué pausar.`,
        metric: { label: 'ROAS', value: `${current.roas.toFixed(2)}×` },
        link: `/store/${storeId}/creativos`,
        cta: 'Ver creativos',
      });
    } else if (current.roas >= 3) {
      wins.push({
        id: 'roas-strong',
        kind: 'win',
        severity: 'good',
        title: `ROAS sólido del período`,
        detail: `${current.roas.toFixed(2)}× — por cada peso invertido en ads volvieron ${(current.roas).toFixed(1)}. Buen momento para escalar lo que funciona.`,
        metric: { label: 'ROAS', value: `${current.roas.toFixed(2)}×` },
      });
    }
  }

  // 3. Profit margin
  if (current.revenue > 0 && objetivos.profitMarginMin) {
    const margin = (current.profit / current.revenue) * 100;
    if (margin < objetivos.profitMarginMin) {
      problems.push({
        id: 'margin-below-target',
        kind: 'problem',
        severity: margin < objetivos.profitMarginMin * 0.5 ? 'critical' : 'warn',
        title: `Margen ${fmtPct(margin)} — debajo del objetivo ${fmtPct(objetivos.profitMarginMin)}`,
        detail: `Tu objetivo de margen es ${fmtPct(objetivos.profitMarginMin)} pero estás en ${fmtPct(margin)}. Revisá costos variables y comisiones.`,
        metric: { label: 'Margen', value: fmtPct(margin) },
        link: `/store/${storeId}/costos`,
        cta: 'Ver costos',
      });
    }
  }

  // 4. % del spend en ads con ROAS bajo (concentración de gasto desperdiciado)
  if (current.adSpend > 0) {
    const lowRoasInsights = await MetaDailyInsight.aggregate([
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(storeId),
          granularity: 'campaign',
          ...(from && to ? { date: { $gte: new Date(from), $lte: new Date(`${to}T23:59:59.999Z`) } } : {}),
        },
      },
      {
        $group: {
          _id: '$metaId',
          spend: { $sum: '$spend' },
          revenue: { $sum: '$purchaseValue' },
        },
      },
      { $match: { spend: { $gt: 0 } } },
    ]);
    const totalCampaignSpend = lowRoasInsights.reduce((s, c) => s + c.spend, 0);
    const lowRoasSpend = lowRoasInsights
      .filter((c) => (c.revenue / c.spend) < 1.5)
      .reduce((s, c) => s + c.spend, 0);
    const wastedPct = totalCampaignSpend > 0 ? (lowRoasSpend / totalCampaignSpend) * 100 : 0;
    if (wastedPct >= 20 && lowRoasSpend >= 5000) {
      problems.push({
        id: 'wasted-spend',
        kind: 'problem',
        severity: wastedPct >= 40 ? 'critical' : 'warn',
        title: `${fmtPct(wastedPct, 0)} del spend en campañas con ROAS < 1.5×`,
        detail: `${fmtMoneyShort(lowRoasSpend)} de los ${fmtMoneyShort(totalCampaignSpend)} gastados fueron a campañas que no recuperaron el costo del ad. Candidatas a pausa.`,
        metric: { label: 'Spend desperdiciado', value: fmtPct(wastedPct, 0) },
        link: `/store/${storeId}/meta-ads`,
        cta: 'Revisar campañas',
      });
    }
  }

  // 5. Frecuencia promedio alta (fatiga creativa global)
  if (current.adSpend > 0) {
    const freqAgg = await MetaDailyInsight.aggregate([
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(storeId),
          granularity: 'campaign',
          impressions: { $gt: 0 },
          reach: { $gt: 0 },
          ...(from && to ? { date: { $gte: new Date(from), $lte: new Date(`${to}T23:59:59.999Z`) } } : {}),
        },
      },
      {
        $group: {
          _id: null,
          impressions: { $sum: '$impressions' },
          reach: { $sum: '$reach' },
        },
      },
    ]);
    const avgFreq = freqAgg[0]
      ? freqAgg[0].impressions / Math.max(freqAgg[0].reach, 1)
      : 0;
    if (avgFreq >= 2.5) {
      problems.push({
        id: 'high-frequency',
        kind: 'problem',
        severity: avgFreq >= 3.5 ? 'critical' : 'warn',
        title: `Frecuencia promedio ${avgFreq.toFixed(2)} — empieza fatiga creativa`,
        detail: `Tus ads están impactando ${avgFreq.toFixed(1)} veces por persona en promedio. Por encima de 2.5 el CTR cae y el CPM sube. Refrescá creativos.`,
        metric: { label: 'Frecuencia', value: avgFreq.toFixed(2) },
        link: `/store/${storeId}/creativos`,
        cta: 'Revisar creativos',
      });
    }
  }

  // 6. Recurrencia baja
  const recurrenceAgg = await Order.aggregate([
    {
      $match: {
        storeId: new mongoose.Types.ObjectId(storeId),
        estado: { $nin: ['cancelled'] },
        paymentStatus: { $in: ['paid'] },
        customerEmail: { $exists: true, $ne: null, $ne: '' },
        ...(from && to ? { fechaCreacion: buildBusinessSourceDateMatch(from, to) } : {}),
      },
    },
    {
      $group: {
        _id: '$customerEmail',
        ordenes: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        totalUnique: { $sum: 1 },
        recurrent: { $sum: { $cond: [{ $gt: ['$ordenes', 1] }, 1, 0] } },
      },
    },
  ]);
  if (recurrenceAgg[0] && recurrenceAgg[0].totalUnique >= 30) {
    const pct = (recurrenceAgg[0].recurrent / recurrenceAgg[0].totalUnique) * 100;
    if (pct < 8) {
      problems.push({
        id: 'low-recurrence',
        kind: 'problem',
        severity: 'warn',
        title: `Recurrencia ${fmtPct(pct)} — muy baja`,
        detail: `Sólo ${recurrenceAgg[0].recurrent} de ${recurrenceAgg[0].totalUnique} compradores del período compraron más de una vez. Diseñá un flujo de retención (email post-compra, cross-sell, recompra programada).`,
        metric: { label: 'Recurrencia', value: fmtPct(pct) },
        link: `/store/${storeId}/clientes`,
        cta: 'Ver clientes',
      });
    } else if (pct >= 25) {
      wins.push({
        id: 'good-recurrence',
        kind: 'win',
        severity: 'good',
        title: `Recurrencia ${fmtPct(pct)} — clientes vuelven`,
        detail: `${recurrenceAgg[0].recurrent} de ${recurrenceAgg[0].totalUnique} compradores compraron más de una vez. Bandera alta.`,
        metric: { label: 'Recurrencia', value: fmtPct(pct) },
      });
    }
  }

  // 7. Capital atrapado (dead stock significativo)
  const products = await Product.find({ storeId }).lean();
  const deadStock = products.filter((p) =>
    (p.stock || 0) > 0 && !p.ultimaVenta || (p.ultimaVenta && (Date.now() - new Date(p.ultimaVenta).getTime()) / 86400000 > 90)
  );
  const deadStockValue = deadStock.reduce(
    (s, p) => s + (p.stock || 0) * ((p.costoUnitario || 0) || (p.precio || 0) * 0.5),
    0
  );
  if (deadStock.length >= 5 && deadStockValue >= 50000) {
    problems.push({
      id: 'dead-stock',
      kind: 'problem',
      severity: 'warn',
      title: `${deadStock.length} productos sin movimiento (capital atrapado ~${fmtMoneyShort(deadStockValue)})`,
      detail: `Hay productos con stock pero sin ventas en los últimos 90 días. Considerá liquidación o devolución a proveedor.`,
      metric: { label: 'Capital atrapado', value: fmtMoneyShort(deadStockValue) },
      link: `/store/${storeId}/productos`,
      cta: 'Ver productos',
    });
  }

  // 8. Caída de revenue vs período anterior
  if (from && to && current.revenue > 0) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const periodDays = Math.ceil((toDate - fromDate) / 86400000) + 1;
    const prevTo = new Date(fromDate.getTime() - 86400000);
    const prevFrom = new Date(prevTo.getTime() - (periodDays - 1) * 86400000);

    const previous = await aggregateRange(
      storeId,
      prevFrom.toISOString().slice(0, 10),
      prevTo.toISOString().slice(0, 10)
    );
    if (previous?.revenue > 0) {
      const deltaPct = ((current.revenue - previous.revenue) / previous.revenue) * 100;
      const ticketActual = current.ordenesPositivas > 0 ? current.revenue / current.ordenesPositivas : 0;
      const ticketPrev = previous.ordenesPositivas > 0 ? previous.revenue / previous.ordenesPositivas : 0;
      const ticketDeltaPct = ticketPrev > 0 ? ((ticketActual - ticketPrev) / ticketPrev) * 100 : 0;

      if (deltaPct <= -15) {
        problems.push({
          id: 'revenue-drop',
          kind: 'problem',
          severity: deltaPct <= -30 ? 'critical' : 'warn',
          title: `Revenue cayó ${Math.abs(deltaPct).toFixed(0)}% vs período anterior`,
          detail: Math.abs(ticketDeltaPct) < 5
            ? `${fmtMoney(current.revenue)} vs ${fmtMoney(previous.revenue)}. El ticket promedio se mantuvo estable — el problema es de volumen/tráfico, no de pricing.`
            : ticketDeltaPct < 0
              ? `${fmtMoney(current.revenue)} vs ${fmtMoney(previous.revenue)}. El ticket también bajó ${Math.abs(ticketDeltaPct).toFixed(0)}% — combinación de menos órdenes y tickets más chicos.`
              : `${fmtMoney(current.revenue)} vs ${fmtMoney(previous.revenue)}. El ticket subió ${ticketDeltaPct.toFixed(0)}% pero hubo menos órdenes — caída de volumen.`,
          metric: { label: 'Δ Revenue', value: `${deltaPct.toFixed(1)}%` },
          link: `/store/${storeId}/dashboard`,
          cta: 'Ver dashboard',
        });
      } else if (deltaPct >= 15) {
        wins.push({
          id: 'revenue-growth',
          kind: 'win',
          severity: 'good',
          title: `Revenue +${deltaPct.toFixed(0)}% vs período anterior`,
          detail: `${fmtMoney(current.revenue)} vs ${fmtMoney(previous.revenue)}. ¿Qué cambió? Replicalo.`,
          metric: { label: 'Δ Revenue', value: `+${deltaPct.toFixed(1)}%` },
        });
      }
    }
  }

  // === REMINDERS de configuración faltante ===

  if (!hasKpis) {
    reminders.push({
      id: 'missing-kpis',
      kind: 'reminder',
      severity: 'info',
      title: 'Sin objetivos cargados',
      detail: 'Las alertas contra target (ROAS, CPA, margen) sólo disparan si configurás los KPIs objetivo. Las anomalías y caídas se detectan igual.',
      link: `/store/${storeId}/settings`,
      cta: 'Configurar objetivos',
    });
  }

  const productsWithCost = products.filter((p) => (p.costoUnitario || 0) > 0).length;
  const productsCovPct = products.length > 0 ? (productsWithCost / products.length) * 100 : 0;
  if (productsCovPct < 50 && products.length > 5) {
    reminders.push({
      id: 'missing-costs',
      kind: 'reminder',
      severity: 'info',
      title: `${(100 - productsCovPct).toFixed(0)}% de productos sin costo cargado`,
      detail: 'Margen, breakeven y capital atrapado se calculan con costos reales. Cargá los top sellers primero.',
      link: `/store/${storeId}/costos`,
      cta: 'Cargar costos',
    });
  }

  // Ordenar por severidad
  const sevRank = { critical: 0, warn: 1, info: 2, good: 3 };
  problems.sort((a, b) => (sevRank[a.severity] - sevRank[b.severity]));

  return {
    generatedAt: new Date().toISOString(),
    period: { from, to },
    hasKpis,
    counts: { wins: wins.length, problems: problems.length, reminders: reminders.length },
    wins,
    problems,
    reminders,
  };
}

module.exports = { buildAutoInsights };
