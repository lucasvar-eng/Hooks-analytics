/**
 * Estado de resultados visual: barras horizontales proporcionales sobre la facturación.
 * Reemplaza la tabla plana anterior. Las líneas de costo con valor 0 cuando deberían tener
 * costo cargado (COGS, comisiones, fijos) se renderizan con patrón rayado amber para
 * marcar "esto no se está midiendo".
 *
 * Props:
 *   pnl: shape de `services/costosService.getPnL`
 *   coverage: costCoverage del store para decidir qué líneas marcar como faltantes
 *   period: { from, to, label }
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '$0';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}

function fmtPct(v) {
  if (v == null || isNaN(v)) return '0%';
  return `${Number(v).toFixed(1).replace('.', ',')}%`;
}

// Líneas de costo que esperamos ver con valor > 0 cuando los costos están bien cargados.
// Si están en 0 y la cobertura del componente correspondiente es false, marcamos como
// "faltantes" para que se vea con patrón rayado en vez de barra roja diminuta.
// `coverageKeys` matchea los keys de `coverage.components` que devuelve costCoverage.js.
const COST_GROUPS = [
  {
    label: 'Costo de productos',
    keys: ['Costo de Productos (COGS)'],
    coverageKeys: ['cogs'],
  },
  {
    label: 'Comisiones y fees',
    keys: ['Comisión de Pago', 'Comisión de Cuotas', 'Impuestos IBB', 'Fee Plataforma'],
    coverageKeys: ['paymentCommission', 'installmentCommission', 'ibb', 'platformFee'],
  },
  {
    label: 'Envío',
    keys: ['Costo de Envío'],
    coverageKeys: ['shippingCost'],
  },
  {
    label: 'Inversión publicitaria',
    keys: ['Ad Spend'],
    coverageKeys: [],
  },
  {
    label: 'Costos fijos',
    keys: ['Costos Fijos'],
    coverageKeys: ['fixedCosts'],
  },
];

function aggregateGroup(pnl, keys) {
  if (!pnl?.lines) return 0;
  return pnl.lines.reduce((sum, line) => keys.includes(line.label) ? sum + (line.value || 0) : sum, 0);
}

function isMissing(group, value, coverage) {
  if (!group.coverageKeys || group.coverageKeys.length === 0) return false;
  if (value > 0) return false;
  // Sin signal de coverage asumimos faltante si valor es 0.
  if (!coverage?.components) return true;
  // El grupo se considera faltante si todos sus coverageKeys están ausentes.
  return group.coverageKeys.every((key) => {
    const c = coverage.components[key];
    return !c || c.present === false;
  });
}

export default function PnLBreakdown({ pnl, coverage, period }) {
  if (!pnl) return null;

  const revenue = pnl.revenue || 0;
  const profit = pnl.profit || 0;
  const profitMargin = pnl.profitMargin || 0;
  const ordenes = pnl.ordenes || 0;
  const aov = ordenes > 0 ? revenue / ordenes : 0;
  const profitIsEstimate = COST_GROUPS.some((g) => isMissing(g, aggregateGroup(pnl, g.keys), coverage));

  const rows = COST_GROUPS.map((group) => {
    const value = aggregateGroup(pnl, group.keys);
    const pct = revenue > 0 ? (value / revenue) * 100 : 0;
    const missing = isMissing(group, value, coverage);
    return { ...group, value, pct, missing };
  });

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Estado de resultados</p>
          <p className="text-[12.5px] text-gray-200 mt-1">Cómo se descompone tu facturación</p>
        </div>
        {period?.label && (
          <p className="text-[11px] text-gray-300">{period.label}</p>
        )}
      </div>

      {/* Facturación */}
      <PnLRow
        label="Facturación"
        labelStrong
        value={fmtMoney(revenue)}
        valueClassName="text-white text-[14px] font-bold"
        pctText="100%"
        barClassName="bg-gradient-to-r from-blue-400 to-blue-600"
        barWidthPct={100}
      />

      {/* Costos */}
      {rows.map((row) => (
        <PnLRow
          key={row.label}
          label={`– ${row.label}`}
          value={fmtMoney(row.value)}
          valueClassName="text-red-400 text-[13.5px] font-semibold"
          pctText={fmtPct(row.pct)}
          barClassName={row.missing
            ? 'is-missing'
            : 'bg-gradient-to-r from-red-400 to-red-500'}
          barWidthPct={row.missing ? 100 : Math.max(row.pct, 0.5)}
          flag={row.missing ? (
            <FlagBadge title={`Sin ${row.label.toLowerCase()} cargado`} />
          ) : null}
        />
      ))}

      {/* Profit */}
      <div className="border-t border-white/[0.08] mt-2 pt-4">
        <PnLRow
          label="Profit estimado"
          labelStrong
          value={fmtMoney(profit)}
          valueClassName="text-emerald-400 text-[16px] font-bold"
          pctText={fmtPct(profitMargin)}
          pctClassName="text-emerald-400"
          barClassName="bg-gradient-to-r from-emerald-400 to-emerald-500"
          barWidthPct={Math.max(Math.min(profitMargin, 100), 0)}
          flag={profitIsEstimate ? (
            <FlagBadge title="Profit estimado: faltan costos por cargar" />
          ) : null}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12px] text-gray-300">
          {ordenes.toLocaleString('es-AR')} órdenes pagas
          {aov > 0 && <> · ticket promedio {fmtMoney(aov)}</>}
        </p>
        <DataHealthChip pnl={pnl} />
      </div>
    </div>
  );
}

function PnLRow({ label, labelStrong, value, valueClassName, pctText, pctClassName, barClassName, barWidthPct, flag }) {
  return (
    <div className="grid items-center gap-4 py-2.5 border-b border-white/[0.03]"
         style={{ gridTemplateColumns: '1.4fr minmax(140px, 220px) 140px 56px 22px' }}>
      <div className={`text-[13px] ${labelStrong ? 'text-white font-semibold text-[14px]' : 'text-gray-200'}`}>
        {label}
      </div>
      <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
        {barClassName === 'is-missing' ? (
          <div className="h-full rounded-full border border-dashed border-amber-400/40"
               style={{
                 width: `${barWidthPct}%`,
                 background: 'repeating-linear-gradient(45deg, rgba(251,191,36,0.25) 0 4px, transparent 4px 8px)',
               }} />
        ) : (
          <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${barWidthPct}%` }} />
        )}
      </div>
      <div className={`text-right tabular-nums ${valueClassName || 'text-white'}`}>{value}</div>
      <div className={`text-right tabular-nums text-[11.5px] ${pctClassName || 'text-gray-300'}`}>{pctText}</div>
      <div className="flex justify-end">{flag}</div>
    </div>
  );
}

function FlagBadge({ title }) {
  return (
    <span
      title={title}
      className="w-4 h-4 rounded-full bg-amber-500/15 text-amber-400 inline-flex items-center justify-center text-[10px] font-bold cursor-help"
    >
      !
    </span>
  );
}

function DataHealthChip({ pnl }) {
  // El componente FinancialConsistency reporta ordersBackedPct, pero acá llega como dataSource.
  // Mostramos un chip simple "Datos respaldados" cuando dataSource === 'orders'.
  const ok = pnl?.dataSource === 'orders';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold
      ${ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {ok ? 'Datos respaldados por órdenes' : 'Respaldo parcial (daily metrics)'}
    </span>
  );
}
