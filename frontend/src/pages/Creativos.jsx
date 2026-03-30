import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

const TIER_STYLES = {
  A: { badge: 'badge-green', border: 'border-l-2 border-emerald-500' },
  B: { badge: 'badge-blue', border: 'border-l-2 border-blue-500' },
  C: { badge: 'badge-amber', border: 'border-l-2 border-amber-500' },
  D: { badge: 'bg-orange-500/15 text-orange-400 badge', border: 'border-l-2 border-orange-500' },
  E: { badge: 'badge-red', border: 'border-l-2 border-red-500' },
};

function AdCard({ ad }) {
  const tier = TIER_STYLES[ad.tier];
  return (
    <div className={`card p-4 ${tier?.border || ''}`}>
      <div className="flex items-start gap-3">
        {ad.thumbnailUrl && (
          <img src={ad.thumbnailUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={tier?.badge || 'badge-gray'}>{ad.tier || '?'}</span>
            <span className="text-[13px] font-medium text-gray-200 truncate">{ad.nombre}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Spend', value: fmt(ad.metrics?.spend) },
              { label: 'ROAS', value: `${ad.metrics?.roas?.toFixed(2) || '—'}x` },
              { label: 'CPA', value: fmt(ad.metrics?.cpa) },
              { label: 'CTR', value: `${ad.metrics?.ctr?.toFixed(2) || '—'}%` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[9px] text-gray-600 uppercase tracking-wide">{label}</p>
                <p className="text-[12px] font-semibold text-gray-200 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-gray-600">
            <span>{ad.metrics?.impressions?.toLocaleString() || 0} imp</span>
            <span className="text-gray-700">→</span>
            <span>{ad.metrics?.clicks?.toLocaleString() || 0} clicks</span>
            <span className="text-gray-700">→</span>
            <span>{ad.metrics?.purchases || 0} compras</span>
            <span className="text-gray-700">→</span>
            <span>{fmt(ad.metrics?.purchaseValue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignResultsTable({ campaigns }) {
  if (!campaigns || campaigns.length === 0) {
    return <p className="text-gray-600 text-[13px] text-center py-8">Sin datos de campañas.</p>;
  }

  const totals = campaigns.reduce(
    (acc, c) => {
      acc.spend += c.metrics?.spend || 0;
      acc.impressions += c.metrics?.impressions || 0;
      acc.reach += c.metrics?.reach || 0;
      acc.clicks += c.metrics?.clicks || 0;
      acc.purchases += c.metrics?.purchases || 0;
      acc.purchaseValue += c.metrics?.purchaseValue || 0;
      return acc;
    },
    { spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, purchaseValue: 0 }
  );
  totals.roas = totals.spend > 0 ? totals.purchaseValue / totals.spend : 0;
  totals.cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-dark">
        <thead>
          <tr>
            {['Campaña', 'Spend', 'Reach', 'CTR', 'Compras', 'CPA', 'ROAS', 'Revenue'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c._id}>
              <td className="font-medium text-white truncate max-w-[200px]">{c.nombre}</td>
              <td>{fmt(c.metrics?.spend)}</td>
              <td>{(c.metrics?.reach || 0).toLocaleString()}</td>
              <td>{c.metrics?.ctr?.toFixed(2) || '—'}%</td>
              <td>{c.metrics?.purchases || 0}</td>
              <td>{fmt(c.metrics?.cpa)}</td>
              <td className="font-semibold">{c.metrics?.roas?.toFixed(2) || '—'}x</td>
              <td className="text-emerald-400 font-semibold">{fmt(c.metrics?.purchaseValue)}</td>
            </tr>
          ))}
          <tr className="bg-white/[0.03] font-semibold">
            <td className="text-white">TOTAL</td>
            <td>{fmt(totals.spend)}</td>
            <td>{totals.reach.toLocaleString()}</td>
            <td>{totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '—'}%</td>
            <td>{totals.purchases}</td>
            <td>{fmt(totals.cpa)}</td>
            <td className="font-semibold">{totals.roas.toFixed(2)}x</td>
            <td className="text-emerald-400">{fmt(totals.purchaseValue)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Creativos() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [ads, setAds] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ads');
  const [filterTier, setFilterTier] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const [adsRes, campRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/creativos`, { params }),
        api.get(`/api/stores/${storeId}/creativos/campaigns`, { params }),
      ]);
      setAds(adsRes.data);
      setCampaigns(campRes.data);
    } catch {
      setAds([]);
      setCampaigns([]);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="text-center py-12 text-gray-600 text-[13px]">Cargando creativos...</div>;
  }

  const filteredAds = filterTier ? ads.filter((a) => a.tier === filterTier) : ads;
  const tierCounts = {};
  for (const a of ads) {
    tierCounts[a.tier] = (tierCounts[a.tier] || 0) + 1;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Creativos</h1>
        <p className="page-subtitle">Clasificación ABCDE y resultados por campaña.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-0">
        {[
          { id: 'ads', label: `Clasificación ABCDE (${ads.length})` },
          { id: 'campaigns', label: 'Resultados por campaña' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ads' ? (
        <>
          {/* Tier filters */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterTier(null)}
              className={!filterTier ? 'chip-active' : 'chip'}
            >
              Todos ({ads.length})
            </button>
            {['A', 'B', 'C', 'D', 'E'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterTier(filterTier === t ? null : t)}
                className={filterTier === t ? 'chip-active' : 'chip'}
              >
                Tier {t} ({tierCounts[t] || 0})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredAds.map((ad) => (
              <AdCard key={ad._id} ad={ad} />
            ))}
          </div>
          {filteredAds.length === 0 && (
            <p className="text-gray-600 text-[13px] text-center py-10">No hay ads para mostrar.</p>
          )}
        </>
      ) : (
        <div className="card">
          <CampaignResultsTable campaigns={campaigns} />
        </div>
      )}
    </div>
  );
}