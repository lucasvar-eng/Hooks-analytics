import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

const TIER_COLORS = {
  A: 'bg-green-100 text-green-800 border-green-300',
  B: 'bg-blue-100 text-blue-800 border-blue-300',
  C: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  D: 'bg-orange-100 text-orange-800 border-orange-300',
  E: 'bg-red-100 text-red-800 border-red-300',
};

function AdCard({ ad }) {
  return (
    <div className={`rounded-lg border p-3 bg-white dark:bg-gray-800 ${ad.tier ? 'border-l-4' : ''} ${TIER_COLORS[ad.tier]?.split(' ')[2] || 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-start gap-3">
        {ad.thumbnailUrl && (
          <img src={ad.thumbnailUrl} alt="" className="w-16 h-16 rounded object-cover shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${TIER_COLORS[ad.tier] || 'bg-gray-100 text-gray-600'}`}>
              {ad.tier || '?'}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{ad.nombre}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <p className="text-gray-500">Spend</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">{fmt(ad.metrics?.spend)}</p>
            </div>
            <div>
              <p className="text-gray-500">ROAS</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">{ad.metrics?.roas?.toFixed(2) || '—'}x</p>
            </div>
            <div>
              <p className="text-gray-500">CPA</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">{fmt(ad.metrics?.cpa)}</p>
            </div>
            <div>
              <p className="text-gray-500">CTR</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">{ad.metrics?.ctr?.toFixed(2) || '—'}%</p>
            </div>
          </div>

          {/* Funnel */}
          <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-500">
            <span>{ad.metrics?.impressions?.toLocaleString() || 0} imp</span>
            <span>→</span>
            <span>{ad.metrics?.clicks?.toLocaleString() || 0} clicks</span>
            <span>→</span>
            <span>{ad.metrics?.purchases || 0} compras</span>
            <span>→</span>
            <span>{fmt(ad.metrics?.purchaseValue)} rev</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignResultsTable({ campaigns }) {
  if (!campaigns || campaigns.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">Sin datos de campañas.</p>;
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
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-750">
          {['Campaña', 'Spend', 'Reach', 'CTR', 'Compras', 'CPA', 'ROAS', 'Revenue'].map((h) => (
            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
        {campaigns.map((c) => (
          <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
            <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{c.nombre}</td>
            <td className="px-3 py-2">{fmt(c.metrics?.spend)}</td>
            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{(c.metrics?.reach || 0).toLocaleString()}</td>
            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{c.metrics?.ctr?.toFixed(2) || '—'}%</td>
            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{c.metrics?.purchases || 0}</td>
            <td className="px-3 py-2">{fmt(c.metrics?.cpa)}</td>
            <td className="px-3 py-2 font-medium">{c.metrics?.roas?.toFixed(2) || '—'}x</td>
            <td className="px-3 py-2 font-medium text-green-600">{fmt(c.metrics?.purchaseValue)}</td>
          </tr>
        ))}
        {/* Total row */}
        <tr className="bg-gray-50 dark:bg-gray-750 font-semibold">
          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">TOTAL</td>
          <td className="px-3 py-2">{fmt(totals.spend)}</td>
          <td className="px-3 py-2">{totals.reach.toLocaleString()}</td>
          <td className="px-3 py-2">{totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '—'}%</td>
          <td className="px-3 py-2">{totals.purchases}</td>
          <td className="px-3 py-2">{fmt(totals.cpa)}</td>
          <td className="px-3 py-2">{totals.roas.toFixed(2)}x</td>
          <td className="px-3 py-2 text-green-600">{fmt(totals.purchaseValue)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export default function Creativos() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [ads, setAds] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ads'); // 'ads' | 'campaigns'
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
    return <div className="text-center py-12 text-gray-500">Cargando creativos...</div>;
  }

  const filteredAds = filterTier ? ads.filter((a) => a.tier === filterTier) : ads;

  // Tier counts
  const tierCounts = {};
  for (const a of ads) {
    tierCounts[a.tier] = (tierCounts[a.tier] || 0) + 1;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Creativos</h2>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('ads')} className={`px-4 py-2 text-sm rounded-lg transition ${tab === 'ads' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
          Clasificación ABCDE ({ads.length})
        </button>
        <button onClick={() => setTab('campaigns')} className={`px-4 py-2 text-sm rounded-lg transition ${tab === 'campaigns' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
          Resultados por campaña
        </button>
      </div>

      {tab === 'ads' ? (
        <>
          {/* Tier filters */}
          <div className="flex gap-2">
            <button onClick={() => setFilterTier(null)} className={`px-3 py-1 text-xs rounded ${!filterTier ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
              Todos ({ads.length})
            </button>
            {['A', 'B', 'C', 'D', 'E'].map((t) => (
              <button key={t} onClick={() => setFilterTier(filterTier === t ? null : t)} className={`px-3 py-1 text-xs rounded font-bold ${filterTier === t ? TIER_COLORS[t] : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                {t} ({tierCounts[t] || 0})
              </button>
            ))}
          </div>

          {/* Ad grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredAds.map((ad) => (
              <AdCard key={ad._id} ad={ad} />
            ))}
          </div>
          {filteredAds.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">No hay ads para mostrar.</p>
          )}
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <CampaignResultsTable campaigns={campaigns} />
        </div>
      )}
    </div>
  );
}
