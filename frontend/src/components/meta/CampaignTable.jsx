import { useState } from 'react';
import ExpandableRow from './ExpandableRow';

const VERDICT_COLORS = {
  ESCALAR: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  PAUSAR: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  TESTEAR: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  REVISAR: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  MANTENER: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
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
      <div className="text-center py-8 text-gray-500 dark:text-gray-500 text-sm">
        No hay campañas. Conectá Meta Ads o importá un CSV.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-gray-50/50 dark:bg-white/[0.02]">
            <th className="w-7 px-2 py-2.5" />
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2.5 ${col.align === 'left' ? 'text-left' : 'text-right'} text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-200 dark:border-gray-700/60`}
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
