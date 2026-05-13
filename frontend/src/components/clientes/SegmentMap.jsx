import { useState, useMemo } from 'react';
import { SEGMENTS, SEGMENT_ORDER, getSegment } from './segmentsCatalog';

/**
 * Mapa visual de segmentos RFM:
 *  - Barra apilada horizontal con toggle "Por cantidad / Por facturación".
 *  - Grid 4×2 con cards de cada segmento (count, revenue, descripción).
 *  - Click en un segmento (barra o card) emite onSegmentSelect.
 *
 * Props:
 *   segments: array del backend [{ _id, count, totalRevenue, avgOrders, avgSpent }]
 *   selected: id del segmento seleccionado o null
 *   onSegmentSelect: (id|null) => void  · null para deseleccionar
 *   totalCustomers: number  · para el subtítulo
 */
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}

export default function SegmentMap({ segments, selected, onSegmentSelect, totalCustomers }) {
  const [mode, setMode] = useState('revenue'); // 'count' | 'revenue'

  const segmentById = useMemo(() => {
    const m = new Map();
    (segments || []).forEach((s) => m.set(s._id, s));
    return m;
  }, [segments]);

  const totals = useMemo(() => {
    const data = (segments || []);
    return {
      count: data.reduce((acc, s) => acc + (s.count || 0), 0),
      revenue: data.reduce((acc, s) => acc + (s.totalRevenue || 0), 0),
    };
  }, [segments]);

  const totalForBar = mode === 'revenue' ? totals.revenue : totals.count;

  // Para la barra: orden de mayor a menor según el modo
  const orderedForBar = useMemo(() => {
    return [...(segments || [])].sort((a, b) => {
      const va = mode === 'revenue' ? (b.totalRevenue || 0) - (a.totalRevenue || 0) : (b.count || 0) - (a.count || 0);
      return va;
    });
  }, [segments, mode]);

  const handleSelect = (id) => {
    onSegmentSelect?.(selected === id ? null : id);
  };

  return (
    <div className="card p-6">
      <div className="flex justify-between items-baseline mb-5 gap-3 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">
            Mapa de segmentos · Modelo RFM
            <span
              title="Modelo de segmentación por Recencia, Frecuencia y Monto. Ver glosario para detalle."
              className="ml-1.5 inline-flex items-center justify-center w-[14px] h-[14px] rounded-full bg-white/[0.08] text-gray-300 text-[9px] font-bold cursor-help align-middle"
            >i</span>
          </p>
          <p className="text-[12.5px] text-gray-200 mt-1">
            Distribución de los {fmtNum(totalCustomers || totals.count)} clientes — toca un segmento para filtrar la tabla
          </p>
        </div>
        <div className="inline-flex gap-1 bg-white/[0.04] border border-white/[0.08] rounded-full p-1">
          {[
            { id: 'count', label: 'Por cantidad' },
            { id: 'revenue', label: 'Por facturación' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={`px-3 py-1 text-[11px] rounded-full font-medium transition
                ${mode === opt.id ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:text-white'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Barra apilada */}
      <div className="flex h-9 rounded-lg overflow-hidden border border-white/[0.04] mb-4">
        {orderedForBar.map((s) => {
          const seg = getSegment(s._id);
          const value = mode === 'revenue' ? (s.totalRevenue || 0) : (s.count || 0);
          const pct = totalForBar > 0 ? (value / totalForBar) * 100 : 0;
          if (pct === 0) return null;
          const isTiny = pct < 5;
          return (
            <button
              key={s._id}
              type="button"
              onClick={() => handleSelect(s._id)}
              title={`${seg.fullLabel}: ${fmtNum(s.count)} clientes · ${fmtMoneyShort(s.totalRevenue)}`}
              className="h-full flex items-center justify-center transition hover:opacity-80 cursor-pointer"
              style={{
                width: `${pct}%`,
                background: seg.color,
                color: 'rgba(0,0,0,0.75)',
                fontSize: isTiny ? 0 : '10.5px',
                fontWeight: 700,
                opacity: selected && selected !== s._id ? 0.4 : 1,
              }}
            >
              {!isTiny && seg.label}
            </button>
          );
        })}
      </div>

      {/* Grid 4×2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {SEGMENT_ORDER.map((id) => {
          const seg = SEGMENTS[id];
          const data = segmentById.get(id);
          const count = data?.count || 0;
          const revenue = data?.totalRevenue || 0;
          const avgOrders = data?.avgOrders || 0;
          const isActive = selected === id;
          const isDimmed = selected && !isActive;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelect(id)}
              className={`text-left rounded-xl p-3.5 border transition cursor-pointer
                ${isActive
                  ? 'border-blue-500/50 bg-blue-500/[0.06]'
                  : 'border-white/[0.06] bg-white/[0.025] hover:border-white/[0.18] hover:bg-white/[0.04]'}
                ${isDimmed ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-white">{seg.label}</span>
              </div>
              <p className="text-[22px] font-bold text-white mt-1.5 leading-none">
                {count === 0 && id === 'lost' ? '0' : fmtNum(count)}
              </p>
              <p className="text-[11px] text-gray-300 mt-1">
                {count === 0 && id === 'lost'
                  ? 'No detectados'
                  : <>{fmtMoneyShort(revenue)} · prom. {avgOrders.toFixed(1).replace('.', ',')} {avgOrders === 1 ? 'compra' : 'compras'}</>}
              </p>
              <p className="text-[11px] text-gray-200 mt-1.5 leading-snug">{seg.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
