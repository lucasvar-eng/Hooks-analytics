/**
 * Para pauta — segmentos accionables de producto.
 * "Listos para empujar" (sano + venta) y "Reponer" (vende pero stock crítico),
 * con filtro por marca y export CSV para armar product sets / briefs.
 * Endpoint: /stores/:id/media-planning/push-segments
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const money = (n) => (n == null ? '—' : `$${Number(n).toLocaleString('es-AR')}`);

function downloadCsv(filename, rows) {
  const header = ['segmento', 'id', 'marca', 'genero', 'tipo', 'stock', 'talles_con_stock', 'total_talles', 'ventas30d', 'precio', 'nombre'];
  const esc = (s) => `"${String(s == null ? '' : s).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.segmento, r.tnProductId, r.marca, r.genero, r.tipo, r.stock, r.sizesInStock, r.totalSizes, r.ventas30dias, r.precio, esc(r.nombre)].join(',')
  );
  const csv = `${header.join(',')}\n${lines.join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function SegList({ title, color, rows }) {
  return (
    <div className="card p-4">
      <h3 className={`text-[14px] font-semibold mb-0.5 ${color}`}>{title}</h3>
      <p className="text-[11.5px] text-app-muted mb-3">{rows.length} productos</p>
      <div className="divide-y divide-white/[0.05] max-h-[520px] overflow-y-auto">
        {rows.map((r) => (
          <div key={r.tnProductId} className="flex justify-between gap-3 py-1.5 text-[13px]">
            <span className="text-app-secondary truncate" title={r.nombre}>{r.nombre}</span>
            <span className="text-app-muted text-[11.5px] tabular-nums whitespace-nowrap shrink-0">
              stk {r.stock} · {r.sizesInStock}/{r.totalSizes} · v{r.ventas30dias} · {money(r.precio)}
            </span>
          </div>
        ))}
        {rows.length === 0 && <div className="py-6 text-center text-app-muted text-[12px]">Sin productos con este filtro.</div>}
      </div>
    </div>
  );
}

export default function PautaSegmentos() {
  const { storeId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [marca, setMarca] = useState('TODAS');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    api
      .get(`/api/stores/${storeId}/media-planning/push-segments`)
      .then(({ data }) => alive && setData(data))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [storeId]);

  const marcas = useMemo(() => {
    if (!data) return [];
    const all = [...(data.listos || []), ...(data.reponer || [])];
    const counts = {};
    all.forEach((r) => { counts[r.marca] = (counts[r.marca] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([m]) => m).slice(0, 12);
  }, [data]);

  const filt = (arr) => (marca === 'TODAS' ? arr : (arr || []).filter((r) => r.marca === marca));
  const listos = filt(data?.listos);
  const reponer = filt(data?.reponer);

  const exportAll = () => {
    const rows = [
      ...listos.map((r) => ({ ...r, segmento: 'listo' })),
      ...reponer.map((r) => ({ ...r, segmento: 'reponer' })),
    ];
    downloadCsv(`segmentos-pauta-${marca.toLowerCase()}.csv`, rows);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Para pauta</h1>
        <p className="page-subtitle">Segmentos accionables: listos para empujar (sano + venta) y los que venden pero hay que reponer. Filtrá y exportá.</p>
      </div>

      {loading && <div className="text-center py-12 text-app-muted">Cargando…</div>}
      {error && !loading && <div className="card p-5 text-app-muted">No se pudo cargar.</div>}

      {!loading && !error && data && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMarca('TODAS')}
              className={`px-3 py-1.5 rounded-lg text-[12px] border transition ${marca === 'TODAS' ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/10 text-app-secondary hover:bg-white/[0.04]'}`}
            >
              Todas
            </button>
            {marcas.map((m) => (
              <button
                key={m}
                onClick={() => setMarca(m)}
                className={`px-3 py-1.5 rounded-lg text-[12px] border transition ${marca === m ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/10 text-app-secondary hover:bg-white/[0.04]'}`}
              >
                {m}
              </button>
            ))}
            <button
              onClick={exportAll}
              className="ml-auto px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-blue-500 text-white hover:bg-blue-600 transition"
            >
              ⬇ Exportar CSV
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SegList title="✅ Listos para empujar" color="text-emerald-300" rows={listos} />
            <SegList title="🟠 Vende pero se agota → reponer" color="text-amber-300" rows={reponer} />
          </div>
        </>
      )}
    </div>
  );
}
