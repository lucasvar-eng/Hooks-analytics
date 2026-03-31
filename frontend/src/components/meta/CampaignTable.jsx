import { useState } from 'react';
import ExpandableRow from './ExpandableRow';

const VERDICT_COLORS = {
  ESCALAR: 'bg-emerald-500/10 text-emerald-400',
  PAUSAR: 'bg-red-500/10 text-red-400',
  TESTEAR: 'bg-blue-500/10 text-blue-400',
  REVISAR: 'bg-amber-500/10 text-amber-400',
  MANTENER: 'bg-white/[0.05] text-gray-500',
};

const DEFAULT_COLUMNS = [
  { key: 'status', label: 'Estado', format: 'status', align: 'left' },
  { key: 'nombre', label: 'Campaña', format: 'text', align: 'left' },
  { key: 'spend', label: 'Gasto', format: 'currency' },
  { key: 'revenue', label: 'Ingresos Ads', format: 'currency' },
  { key: 'purchases', label: 'Compras', format: 'number' },
  { key: 'roas', label: 'ROAS', format: 'decimal', suffix: 'x' },
  { key: 'cpa', label: 'CPA', format: 'currency' },
  { key: 'ctr', label: 'CTR', format: 'percent' },
  { key: 'verdict', label: 'Veredicto', format: 'verdict' },
];

function formatValue(value, format, suffix = '') {
  switch (format) {
    case 'text':
      return value ? String(value) : '—';
    case 'status':
      if (!value) return '—';
      return value === 'ACTIVE'
        ? 'Activa'
        : value === 'PAUSED'
          ? 'Pausada'
          : value === 'ARCHIVED'
            ? 'Archivada'
            : value === 'DELETED'
              ? 'Eliminada'
              : value === 'SIN_ESTADO'
                ? 'Sin estado'
                : String(value);
    case 'verdict':
      return value || '—';
    case 'currency':
      if (value == null || Number.isNaN(Number(value))) return '—';
      return `$${Number(value).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
    case 'number':
      if (value == null || Number.isNaN(Number(value))) return '—';
      return Number(value).toLocaleString('es-AR');
    case 'decimal':
      if (value == null || Number.isNaN(Number(value))) return '—';
      return `${Number(value).toFixed(2)}${suffix}`;
    case 'percent':
      if (value == null || Number.isNaN(Number(value))) return '—';
      return `${Number(value).toFixed(2)}%`;
    default:
      return String(value || '—');
  }
}

export default function CampaignTable({ campaigns, storeId, from, to }) {
  const [columns] = useState(DEFAULT_COLUMNS);
  const campaignsWithSpend = campaigns.filter((campaign) => Number(campaign.metrics?.spend || 0) > 0).length;
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'ACTIVE').length;

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center py-8 text-[13px] text-gray-600">
        No hay campañas. Conectá Meta Ads o importá un CSV.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Campañas</p>
          <p className="text-white text-lg font-semibold mt-1">{campaigns.length}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Con gasto</p>
          <p className="text-white text-lg font-semibold mt-1">{campaignsWithSpend}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Activas</p>
          <p className="text-white text-lg font-semibold mt-1">{activeCampaigns}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full table-dark">
        <thead>
          <tr>
            <th className="w-7 px-2 py-2.5" />
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.align === 'left' ? 'text-left' : 'text-right'}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <ExpandableRow
              key={campaign.metaId || campaign._id}
              item={campaign}
              columns={columns}
              formatValue={formatValue}
              verdictColors={VERDICT_COLORS}
              storeId={storeId}
              from={from}
              to={to}
              level="campaign"
            />
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}
