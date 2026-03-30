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
  { key: 'status', label: 'Status', format: 'status' },
  { key: 'nombre', label: 'Campaña', format: 'text', align: 'left' },
  { key: 'spend', label: 'Gasto', format: 'currency' },
  { key: 'revenue', label: 'Revenue', format: 'currency' },
  { key: 'purchases', label: 'Compras', format: 'number' },
  { key: 'roas', label: 'ROAS', format: 'decimal', suffix: 'x' },
  { key: 'cpa', label: 'CPA', format: 'currency' },
  { key: 'ctr', label: 'CTR', format: 'percent' },
  { key: 'verdict', label: 'Veredicto', format: 'verdict' },
];

function formatValue(value, format, suffix = '') {
  if (value == null || isNaN(value)) return '—';
  switch (format) {
    case 'currency':
      return `$${Number(value).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
    case 'number':
      return Number(value).toLocaleString('es-AR');
    case 'decimal':
      return `${Number(value).toFixed(2)}${suffix}`;
    case 'percent':
      return `${Number(value).toFixed(2)}%`;
    case 'status':
      return value === 'ACTIVE' ? 'On' : value === 'PAUSED' ? 'Off' : value || '—';
    case 'verdict':
      return value || '—';
    default:
      return String(value || '—');
  }
}

export default function CampaignTable({ campaigns, storeId, from, to }) {
  const [columns] = useState(DEFAULT_COLUMNS);

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center py-8 text-[13px] text-gray-600">
        No hay campañas. Conectá Meta Ads o importá un CSV.
      </div>
    );
  }

  return (
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
  );
}
