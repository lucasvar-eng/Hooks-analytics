import { useState } from 'react';
import ExpandableRow from './ExpandableRow';

const DEFAULT_COLUMNS = [
  { key: 'status', label: 'Status', format: 'status' },
  { key: 'nombre', label: 'Nombre', format: 'text' },
  { key: 'spend', label: 'Spend', format: 'currency' },
  { key: 'revenue', label: 'Revenue', format: 'currency' },
  { key: 'purchases', label: 'Compras', format: 'number' },
  { key: 'roas', label: 'ROAS', format: 'decimal', suffix: 'x' },
  { key: 'cpa', label: 'CPA', format: 'currency' },
  { key: 'ctr', label: 'CTR', format: 'percent' },
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
      return value === 'ACTIVE' ? 'On' : value === 'PAUSED' ? 'Paused' : value || '—';
    default:
      return String(value || '—');
  }
}

export default function CampaignTable({ campaigns, storeId, from, to }) {
  const [columns] = useState(DEFAULT_COLUMNS);

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No hay campañas. Conectá Meta Ads o importá un CSV.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-750">
            <th className="w-8 px-2 py-2" /> {/* expand arrow */}
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
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
