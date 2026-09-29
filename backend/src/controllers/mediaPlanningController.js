const mongoose = require('mongoose');
const MetaProductInsight = require('../models/MetaProductInsight');
const Product = require('../models/Product');
const { buildBusinessDateKeyMatch } = require('../utils/businessDate');

/**
 * Capa accionable: cruza gasto/exposición de Meta por producto × salud de
 * inventario (stock + curva de talles + rotación) para responder
 * "¿estoy pagando por mostrar cosas que no se pueden comprar?".
 *
 * Nota sobre la métrica de gasto: MetaProductInsight tiene una fila por
 * (ad, producto, día). Un producto aparece en varios ads → al sumar, el spend
 * se SOLAPA entre productos (la suma total supera el gasto real de la cuenta).
 * Por eso lo tratamos/etiquetamos como "exposición DPA" (peso relativo), NO
 * como pesos exactos de presupuesto.
 */

function buildDateMatch(from, to) {
  if (!from || !to) return null;
  return buildBusinessDateKeyMatch(from, to, true);
}

function sizesInStock(p) {
  if (!Array.isArray(p?.variantes)) return 0;
  return p.variantes.filter((v) => (v?.stock || 0) > 0).length;
}
function totalSizes(p) {
  return Array.isArray(p?.variantes) ? p.variantes.length : 0;
}
// Curva sana: 4+ talles con stock, o (pocos talles) 2+ con stock alto.
function curveOK(p) {
  const s = sizesInStock(p);
  const t = totalSizes(p);
  const stock = p?.stock || 0;
  return s >= 4 || (t <= 3 && s >= 2 && stock >= 12);
}

// Veredicto de vendibilidad de un producto.
function classify(p) {
  if (!p) return { verdict: 'sin-match', reason: 'sin match en catálogo', sellable: false };
  const stock = p.stock || 0;
  const selling = (p.ventas30dias || 0) >= 1;
  const healthy = stock >= 8;
  const curve = curveOK(p);
  if (healthy && curve) {
    return { verdict: 'sano', reason: selling ? 'sano · vende' : 'sano · sin venta reciente', sellable: true };
  }
  if (selling) {
    return { verdict: 'reponer', reason: 'vende pero stock crítico → reponer', sellable: false };
  }
  const reason = stock <= 0 ? 'sin stock' : (!curve ? 'curva de talles rota' : 'stock bajo');
  return { verdict: 'no-vendible', reason, sellable: false };
}

// Marca parseada del nombre (el modelo Product no tiene campo marca).
const BRANDS = [
  'NEW BALANCE', 'UNDER ARMOUR', 'JOHN FOOS', 'VIA MARTE', 'A NATION', 'TOPPER',
  'SALOMON', 'REEBOK', 'KAPPA', 'PUMA', 'CROCS', 'FILA', 'OLYMPIKUS', 'DIADORA',
  'UMBRO', 'KDY', 'VANS', 'NIKE', 'ADIDAS', 'HAVAIANAS', 'RIDER', 'BANDO',
  'TAVERNITI', 'DRIBBLING', 'GILBERT', 'FLASH', 'NASSAU', 'SIMBRA', 'GRECO', 'KESWICK',
];
function brandOf(nombre) {
  const u = String(nombre || '').toUpperCase();
  return BRANDS.find((b) => u.includes(b)) || 'OTRA';
}
function isPublished(p) {
  return p?.activo === true || /publi|activ/i.test(p?.estadoPublicacion || '');
}

/**
 * GET /stores/:id/media-planning/spend-vs-sellability
 * Query: from, to (YYYY-MM-DD, opcional) · limit (def 100, max 500)
 */
exports.spendVsSellability = async (req, res, next) => {
  try {
    const storeId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ error: 'invalid store id' });
    }
    const storeObjectId = new mongoose.Types.ObjectId(storeId);
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);

    const match = { storeId: storeObjectId, tnProductId: { $nin: [null, ''] } };
    const dateMatch = buildDateMatch(req.query.from, req.query.to);
    if (dateMatch) match.date = dateMatch;

    const agg = await MetaProductInsight.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$tnProductId',
          spend: { $sum: '$spend' },
          clicks: { $sum: '$clicks' },
          purchases: { $sum: '$purchases' },
          productName: { $first: '$productName' },
        },
      },
      { $sort: { spend: -1 } },
    ]);

    const ids = agg.map((r) => String(r._id));
    const products = await Product.find({ storeId: storeObjectId, tnProductId: { $in: ids } })
      .select('tnProductId nombre precio stock variantes ventas30dias categoria subcategoria')
      .lean();
    const pmap = new Map(products.map((p) => [String(p.tnProductId), p]));

    let totalExposure = 0;
    let exposureNonSellable = 0;
    let nonSellableCount = 0;

    const rows = agg.map((r) => {
      const p = pmap.get(String(r._id));
      const c = classify(p);
      const spend = r.spend || 0;
      totalExposure += spend;
      if (!c.sellable) {
        exposureNonSellable += spend;
        nonSellableCount += 1;
      }
      return {
        tnProductId: r._id,
        nombre: (p && p.nombre) || r.productName || '(sin nombre)',
        spend: Math.round(spend),
        stock: p ? (p.stock || 0) : null,
        sizesInStock: p ? sizesInStock(p) : null,
        totalSizes: p ? totalSizes(p) : null,
        ventas30dias: p ? (p.ventas30dias || 0) : null,
        precio: (p && p.precio) || null,
        categoria: (p && p.categoria) || null,
        subcategoria: (p && p.subcategoria) || null,
        verdict: c.verdict,
        verdictReason: c.reason,
      };
    });

    const summary = {
      totalExposure: Math.round(totalExposure),
      exposureNonSellable: Math.round(exposureNonSellable),
      pctNonSellable: totalExposure > 0 ? +((100 * exposureNonSellable) / totalExposure).toFixed(1) : 0,
      productCount: rows.length,
      nonSellableCount,
    };

    res.json({ summary, rows: rows.slice(0, limit) });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /stores/:id/media-planning/push-segments
 * Segmenta el catálogo vendible para pauta:
 *   - listos: sano (stock + curva) + venta reciente → empujar
 *   - reponer: vende pero stock crítico / curva rota → reponer o pausar
 * Devuelve filas livianas con marca/género/tipo para filtrar y exportar en el front.
 */
exports.pushSegments = async (req, res, next) => {
  try {
    const storeId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ error: 'invalid store id' });
    }
    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    const products = await Product.find({ storeId: storeObjectId })
      .select('tnProductId nombre precio stock variantes ventas30dias categoria subcategoria activo estadoPublicacion')
      .lean();

    const listos = [];
    const reponer = [];
    for (const p of products) {
      if (!isPublished(p)) continue;
      const stock = p.stock || 0;
      const selling = (p.ventas30dias || 0) >= 1;
      const healthy = stock >= 8 && curveOK(p);
      const row = {
        tnProductId: p.tnProductId,
        nombre: p.nombre,
        marca: brandOf(p.nombre),
        genero: p.categoria || '',
        tipo: p.subcategoria || '',
        stock,
        sizesInStock: sizesInStock(p),
        totalSizes: totalSizes(p),
        ventas30dias: p.ventas30dias || 0,
        precio: p.precio || 0,
      };
      if (healthy && selling) listos.push(row);
      else if (selling) reponer.push(row); // vende pero no está sano
    }
    listos.sort((a, b) => b.ventas30dias - a.ventas30dias || b.stock - a.stock);
    reponer.sort((a, b) => b.ventas30dias - a.ventas30dias || a.stock - b.stock);

    res.json({ counts: { listos: listos.length, reponer: reponer.length }, listos, reponer });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /stores/:id/media-planning/feed-health
 * Composición de salud del catálogo publicado para alimentar el feed/DPA.
 */
exports.feedHealth = async (req, res, next) => {
  try {
    const storeId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ error: 'invalid store id' });
    }
    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    const products = await Product.find({ storeId: storeObjectId })
      .select('stock variantes activo estadoPublicacion')
      .lean();

    let published = 0;
    let healthy = 0;
    let brokenCurve = 0;
    let stockZero = 0;
    let lowStock = 0;
    for (const p of products) {
      if (!isPublished(p)) continue;
      published += 1;
      const stock = p.stock || 0;
      if (stock <= 0) {
        stockZero += 1;
      } else if (stock >= 8 && curveOK(p)) {
        healthy += 1;
      } else if (!curveOK(p)) {
        brokenCurve += 1;
      } else {
        lowStock += 1;
      }
    }
    const nonSellable = published - healthy;
    res.json({
      published,
      healthy,
      nonSellable,
      stockZero,
      brokenCurve,
      lowStock,
      pctHealthy: published > 0 ? +((100 * healthy) / published).toFixed(1) : 0,
    });
  } catch (error) {
    next(error);
  }
};
