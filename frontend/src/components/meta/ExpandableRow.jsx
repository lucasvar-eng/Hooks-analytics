import { useState } from 'react';
import api from '../../services/api';

const VERDICT_COLORS = {
  ESCALAR: 'bg-emerald-500/10 text-emerald-400',
  PAUSAR: 'bg-red-500/10 text-red-400',
  TESTEAR: 'bg-blue-500/10 text-blue-400',
  REVISAR: 'bg-amber-500/10 text-amber-400',
  MANTENER: 'bg-white/[0.05] text-gray-500',
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
  const statusBadge =
    item.status === 'ACTIVE'
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
      : item.status === 'PAUSED'
        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
        : item.status === 'ARCHIVED' || item.status === 'DELETED'
          ? 'bg-white/[0.04] text-app-secondary border-white/[0.08]'
          : 'bg-white/[0.04] text-app-secondary border-white/[0.08]';
  const objectiveText = item.objective ? String(item.objective).replace(/_/g, ' ').toLowerCase() : '';
  const rowMuted = Number(metrics.spend || 0) === 0 ? 'opacity-70' : '';

  return (
    <>
      <tr
        onClick={handleExpand}
        className={`${canExpand ? 'cursor-pointer' : ''} ${rowMuted}`}
      >
        <td className="px-2 py-2 text-gray-600 text-center text-[10px]">
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
                  ? `font-medium text-white ${indent}`
                  : ''
              } ${col.align === 'left' ? 'text-left' : 'text-right'}`}
            >
              {col.key === 'status' ? (
                <span className={`inline-flex min-w-[88px] justify-center items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusBadge}`}>
                  {formatValue(value, col.format, col.suffix)}
                </span>
              ) : col.key === 'nombre' ? (
                <div className="flex items-start gap-2">
                  {item.thumbnailUrl && (
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="w-6 h-6 rounded inline-block align-middle shrink-0 mt-0.5"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate">{formatValue(value, col.format, col.suffix)}</p>
                    <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-app-secondary">
                      {objectiveText && <span>{objectiveText}</span>}
                      {item.adAccountId && <span className="font-mono">{item.adAccountId}</span>}
                      <span className="font-mono">{item.metaId}</span>
                    </div>
                  </div>
                </div>
              ) : col.format === 'verdict' && value && VERDICT_COLORS[value] ? (
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
          <td colSpan={columns.length + 1} className="px-6 py-3 text-[12px] text-gray-600">
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
