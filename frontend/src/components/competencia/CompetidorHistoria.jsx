import { useEffect, useState } from 'react';
import api from '../../services/api';

/**
 * Timeline de snapshots históricos del competidor con diff visible entre
 * snapshots consecutivos. Se monta dentro del CompetidorDetailModal.
 *
 * Cada snapshot muestra:
 *  - Fecha + source (analyze / scrape / update / manual)
 *  - "Qué cambió desde el snapshot anterior" — diff de campos
 */

const SOURCE_LABEL = {
  analyze: 'Análisis con AI',
  scrape: 'Scrape del sitio',
  update: 'Edición manual',
  manual: 'Manual',
};

const SOURCE_CLS = {
  analyze: 'bg-blue-500/12 text-blue-200',
  scrape: 'bg-emerald-500/12 text-emerald-200',
  update: 'bg-amber-500/12 text-amber-200',
  manual: 'bg-white/[0.06] text-gray-300',
};

const FIELD_LABEL = {
  nombre: 'Nombre',
  url: 'URL',
  positioning: 'Posicionamiento',
  avatar: 'Avatar',
  awarenessLevel: 'Awareness',
  mainOffer: 'Oferta principal',
  angles: 'Ángulos',
  territories: 'Territorios',
  objectionsDetected: 'Objeciones',
  notas: 'Notas',
  analysisResult: 'Análisis AI',
};

const SNAPSHOT_FIELDS = Object.keys(FIELD_LABEL);

function normalizeForCompare(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean).join('|||');
  return String(value).trim();
}

function diffPair(prev, curr) {
  const changes = [];
  for (const f of SNAPSHOT_FIELDS) {
    const a = normalizeForCompare(prev?.[f]);
    const b = normalizeForCompare(curr?.[f]);
    if (a === b) continue;
    changes.push({
      field: f,
      label: FIELD_LABEL[f],
      previous: prev?.[f],
      current: curr?.[f],
    });
  }
  return changes;
}

function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function preview(v, max = 120) {
  if (v == null) return <span className="text-gray-400 italic">vacío</span>;
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-gray-400 italic">vacío</span>;
    return v.join(', ').slice(0, max);
  }
  const str = String(v);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

export default function CompetidorHistoria({ storeId, competitor }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [latestDiff, setLatestDiff] = useState(null);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      try {
        const [snapsRes, diffRes] = await Promise.all([
          api.get(`/api/stores/${storeId}/competitors/${competitor._id}/snapshots`),
          api.get(`/api/stores/${storeId}/competitors/${competitor._id}/diff`).catch(() => ({ data: null })),
        ]);
        if (cancel) return;
        setSnapshots(snapsRes.data || []);
        setLatestDiff(diffRes.data || null);
      } catch {
        if (!cancel) setSnapshots([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, [storeId, competitor._id]);

  if (loading) {
    return <p className="text-[13px] text-gray-300 py-4 text-center">Cargando historia...</p>;
  }

  if (snapshots.length === 0 && (!latestDiff || !latestDiff.hasPrevious)) {
    return (
      <div className="rounded-xl bg-white/[0.02] border border-dashed border-white/[0.1] p-5 text-center">
        <p className="text-[13px] text-gray-200">Sin historia aún</p>
        <p className="text-[12px] text-gray-300 mt-1.5 max-w-[420px] mx-auto leading-relaxed">
          A medida que ejecutes <strong className="text-white">Analizar con AI</strong>, <strong className="text-white">Scrapear sitio</strong> o edites datos, vamos a registrar cada cambio acá para que veas cómo evoluciona el competidor.
        </p>
      </div>
    );
  }

  const hasCurrentChanges = latestDiff?.changes?.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Cambios actuales vs último snapshot — destacado arriba */}
      {hasCurrentChanges && (
        <div className="rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-emerald-300 mb-2">
            Cambió desde {fmtDate(latestDiff.previousAt)}
          </p>
          <DiffList changes={latestDiff.changes} />
        </div>
      )}

      {/* Timeline de snapshots con diff entre consecutivos */}
      <div className="flex flex-col gap-3">
        {snapshots.map((snap, idx) => {
          const prev = snapshots[idx + 1]; // más viejo = índice mayor (orden desc)
          const changes = prev ? diffPair(prev, snap) : [];
          return (
            <div key={snap._id} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${SOURCE_CLS[snap.source] || SOURCE_CLS.manual}`}>
                  {SOURCE_LABEL[snap.source] || snap.source}
                </span>
                <span className="text-[12px] text-gray-200">{fmtDate(snap.capturedAt)}</span>
              </div>
              {changes.length > 0 ? (
                <DiffList changes={changes} />
              ) : prev ? (
                <p className="text-[12px] text-gray-300 italic">Sin cambios respecto al snapshot anterior.</p>
              ) : (
                <p className="text-[12px] text-gray-300 italic">Primer snapshot — no hay anterior para comparar.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiffList({ changes }) {
  return (
    <div className="space-y-2">
      {changes.map((c) => (
        <div key={c.field} className="text-[12.5px]">
          <p className="text-[10.5px] font-bold uppercase tracking-[1.2px] text-gray-300 mb-1">{c.label}</p>
          <div className="grid items-start gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="rounded-md bg-red-500/[0.05] border-l-2 border-red-500/40 px-3 py-1.5">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.8px] text-red-300 mb-0.5">Antes</p>
              <p className="text-[12px] text-gray-200 leading-relaxed">{preview(c.previous, 180)}</p>
            </div>
            <div className="rounded-md bg-emerald-500/[0.05] border-l-2 border-emerald-500/40 px-3 py-1.5">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.8px] text-emerald-300 mb-0.5">Ahora</p>
              <p className="text-[12px] text-gray-200 leading-relaxed">{preview(c.current, 180)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
