import { useState } from 'react';
import api from '../../services/api';

const VERDICT_COLORS = {
  ESCALAR: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  PAUSAR: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  TESTEAR: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  REVISAR: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  MANTENER: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
};

export default function ExpandableRow({
  item,
  columns,
  formatValue,
  storeId,
  from,
  to,
  level,
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);

  const metrics = item.metrics || {};
  const canExpand = level !== 'ad';

  const handleExpand = async () => {
    if (!canExpand) return;

    if (expanded) {
      setExpanded(false);
      return;
    }

    setLoading(true);
    try {
      let url;
      if (level === 'campaign') {
        url = `/api/stores/${storeId}/meta/campaigns/${item.metaId}/adsets`;
      } else if (level === 'adset') {
        url = `/api/stores/${storeId}/meta/adsets/${item.metaId}/ads`;
      }

      if (url) {
        const params = {};
        if (from) params.from = from;
        if (to) params.to = to;
        const { data } = await api.get(url, { params });
        setChildren(data);
      }
    } catch {
      setChildren([]);
    }
    setLoading(false);
    setExpanded(true);
  };

  const indent = level === 'campaign' ? '' : level === 'adset' ? 'pl-6' : 'pl-12';
  const nextLevel = level === 'campaign' ? 'adset' : 'ad';

  const statusColor =
    item.status === 'ACTIVE'
      ? 'text-green-500'
      : item.status === 'PAUSED'
        ? 'text-yellow-500'
        : 'text-gray-400';

  return (
    <>
      <tr
        onClick={handleExpand}
        className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition ${
          canExpand ? 'cursor-pointer' : ''
        } ${indent}`}
      >
        <td className="px-2 py-2 text-gray-400 text-center">
          {canExpand ? (expanded ? '▼' : '▶') : ''}
        </td>
        {columns.map((col) => {
          let value;
          if (col.key === 'status') {
            value = item.status;
          } else if (col.key === 'nombre') {
            value = item.nombre;
          } else {
            value = metrics[col.key];
          }
          return (
            <td
              key={col.key}
              className={`px-3 py-2 whitespace-nowrap ${
                col.key === 'nombre'
                  ? `font-medium text-gray-900 dark:text-gray-100 ${indent}`
                  : col.key === 'status'
                    ? statusColor
                    : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {col.key === 'nombre' && item.thumbnailUrl && (
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  className="w-6 h-6 rounded inline-block mr-2 align-middle"
                />
              )}
              {col.format === 'verdict' && value && VERDICT_COLORS[value] ? (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${VERDICT_COLORS[value]}`}>
                  {value}
                </span>
              ) : (
                formatValue(value, col.format, col.suffix)
              )}
            </td>
          );
        })}
      </tr>
      {expanded && loading && (
        <tr>
          <td colSpan={columns.length + 1} className="px-6 py-3 text-gray-500 text-sm">
            Cargando...
          </td>
        </tr>
      )}
      {expanded &&
        !loading &&
        children.map((child) => (
          <ExpandableRow
            key={child.metaId || child._id}
            item={child}
            columns={columns}
            formatValue={formatValue}
            storeId={storeId}
            from={from}
            to={to}
            level={nextLevel}
          />
        ))}
    </>
  );
}
