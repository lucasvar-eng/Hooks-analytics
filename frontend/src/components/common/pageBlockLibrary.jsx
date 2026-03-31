import { SourceIcon } from './MasterMetricBoard';

function UtilityShell({ title, description, children }) {
  return (
    <div className="card p-5">
      {title && <h3 className="text-white text-xl font-semibold">{title}</h3>}
      {description && <p className="text-app-secondary text-[13px] mt-2">{description}</p>}
      {children}
    </div>
  );
}

function getToneClasses(tone) {
  switch (tone) {
    case 'positive':
      return 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-200';
    case 'warning':
      return 'border-amber-500/20 bg-amber-500/[0.08] text-amber-200';
    case 'critical':
      return 'border-red-500/20 bg-red-500/[0.08] text-red-200';
    case 'info':
    default:
      return 'border-blue-500/20 bg-blue-500/[0.08] text-blue-100';
  }
}

function parseLines(text) {
  return String(text || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDisplayValue(value, format = 'text') {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (format === 'money') {
    if (Number.isNaN(numeric)) return String(value);
    return `$${Math.round(numeric).toLocaleString('es-AR')}`;
  }
  if (format === 'percent') {
    if (Number.isNaN(numeric)) return String(value);
    return `${numeric.toFixed(1)}%`;
  }
  if (format === 'ratio') {
    if (Number.isNaN(numeric)) return String(value);
    return `${numeric.toFixed(2)}x`;
  }
  if (format === 'number') {
    if (Number.isNaN(numeric)) return String(value);
    return numeric.toLocaleString('es-AR');
  }
  return String(value);
}

function getOptionMeta(options = [], id) {
  return options.find((item) => item.id === id) || null;
}

function EmptyDataCard({ message = 'Sin dataset configurado para este bloque.' }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-10 text-center">
      <p className="text-app-secondary text-[12px]">{message}</p>
    </div>
  );
}

function MiniBarChart({ series = [], format = 'number' }) {
  const values = series.map((item) => Number(item.value || 0));
  const max = Math.max(...values, 1);

  return (
    <div className="space-y-3">
      {series.map((item, index) => {
        const pct = Math.max(6, (Number(item.value || 0) / max) * 100);
        return (
          <div key={`${item.label}-${index}`} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span className="text-app-secondary truncate">{item.label}</span>
              <span className="text-white font-semibold">{formatDisplayValue(item.value, format)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniDonut({ segments = [] }) {
  const total = segments.reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (!total) {
    return <EmptyDataCard message="Este dataset no tiene composición para mostrar." />;
  }

  let cumulative = 0;
  const gradientParts = segments.map((segment, index) => {
    const start = (cumulative / total) * 360;
    cumulative += Number(segment.value || 0);
    const end = (cumulative / total) * 360;
    const color = segment.color || ['#60a5fa', '#a78bfa', '#34d399', '#f59e0b', '#f472b6'][index % 5];
    return `${color} ${start}deg ${end}deg`;
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[220px,1fr] gap-5 items-center">
      <div className="flex items-center justify-center">
        <div
          className="h-[180px] w-[180px] rounded-full relative"
          style={{ background: `conic-gradient(${gradientParts.join(', ')})` }}
        >
          <div className="absolute inset-[22%] rounded-full bg-[#161616] border border-white/[0.06] flex flex-col items-center justify-center">
            <span className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Total</span>
            <span className="text-white text-[22px] font-bold mt-1">{total.toLocaleString('es-AR')}</span>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {segments.map((segment, index) => {
          const pct = total > 0 ? (Number(segment.value || 0) / total) * 100 : 0;
          const color = segment.color || ['#60a5fa', '#a78bfa', '#34d399', '#f59e0b', '#f472b6'][index % 5];
          return (
            <div key={`${segment.label}-${index}`} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-app-secondary text-[13px] truncate">{segment.label}</span>
              </div>
              <div className="text-right">
                <p className="text-white text-[13px] font-semibold">{formatDisplayValue(segment.value, segment.format || 'number')}</p>
                <p className="text-app-muted text-[11px]">{pct.toFixed(1)}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniHeatmap({ cells = [], format = 'number' }) {
  const values = cells.map((cell) => Number(cell.value || 0));
  const max = Math.max(...values, 1);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
      {cells.map((cell, index) => {
        const intensity = Number(cell.value || 0) / max;
        const bg = `rgba(244, 57, 176, ${0.12 + intensity * 0.7})`;
        return (
          <div
            key={`${cell.label}-${index}`}
            className="rounded-2xl border border-white/[0.06] p-3 min-h-[86px] flex flex-col justify-between"
            style={{ backgroundColor: bg }}
          >
            <p className="text-app-muted text-[10px] uppercase tracking-[0.14em]">{cell.label}</p>
            <p className="text-white text-[18px] font-bold">{formatDisplayValue(cell.value, format)}</p>
          </div>
        );
      })}
    </div>
  );
}

function SimpleTable({ columns = [], rows = [] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-dark">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="text-left">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.id || index}`}>
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? 'tabular-nums' : ''}>
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SOURCE_OPTIONS = [
  { value: 'tiendanube', label: 'Tienda Nube' },
  { value: 'meta', label: 'Meta Ads' },
  { value: 'cash', label: 'Finanzas / Cash' },
  { value: 'clientes', label: 'Clientes / Funnel' },
  { value: 'manual', label: 'Manual / neutro' },
];

export function createUtilityBlocks(prefix = 'page') {
  return [
    {
      id: `${prefix}-free-title`,
      label: 'Título libre',
      category: 'Utilidad',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        title: 'Nuevo bloque',
        description: 'Usalo para introducir una sección o remarcar una idea importante.',
        size: 'full',
      },
      render: ({ config }) => (
        <UtilityShell
          title={config.title || 'Nuevo bloque'}
          description={config.description || 'Sumá una bajada corta para contextualizar la sección.'}
        />
      ),
    },
    {
      id: `${prefix}-free-note`,
      label: 'Nota libre',
      category: 'Utilidad',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        title: 'Nota',
        description: 'Texto libre para observaciones, contexto o próximos pasos.',
        size: 'half',
      },
      render: ({ config }) => (
        <div className="card p-5">
          <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">{config.title || 'Nota'}</p>
          <p className="text-white text-[15px] leading-7 mt-3 whitespace-pre-wrap">
            {config.description || 'Texto libre para observaciones, contexto o próximos pasos.'}
          </p>
        </div>
      ),
    },
    {
      id: `${prefix}-divider`,
      label: 'Separador',
      category: 'Utilidad',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        title: 'Separador',
        description: '',
        size: 'full',
      },
      render: ({ config }) => (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-4">
            <p className="text-app-muted text-[11px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap">
              {config.title || 'Separador'}
            </p>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>
          {config.description ? (
            <p className="text-app-secondary text-[12px] mt-2">{config.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: `${prefix}-metric-card`,
      label: 'Métrica destacada',
      category: 'Analítica libre',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        title: 'Nueva métrica',
        description: 'Contexto breve de esta lectura.',
        metricValue: '$0',
        metricBadge: 'Manual',
        metricSource: 'manual',
        metricFooter: 'Período actual',
        size: 'half',
      },
      configFields: [
        { key: 'metricValue', label: 'Valor', type: 'text', placeholder: '$0' },
        { key: 'metricBadge', label: 'Badge', type: 'text', placeholder: 'Manual' },
        { key: 'metricSource', label: 'Origen', type: 'select', options: SOURCE_OPTIONS },
        { key: 'metricFooter', label: 'Pie', type: 'text', placeholder: 'Período actual' },
      ],
      render: ({ config }) => (
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="master-metric-card__badge">
                <SourceIcon sourceKey={config.metricSource} />
                <span>{config.metricBadge || 'Manual'}</span>
              </span>
              <p className="master-metric-card__value mt-3">{config.metricValue || '$0'}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="master-metric-card__label">{config.title || 'Nueva métrica'}</p>
            <p className="master-metric-card__sub">{config.description || 'Contexto breve de esta lectura.'}</p>
          </div>
          {config.metricFooter ? (
            <div className="mt-3 text-[11px] text-app-secondary">{config.metricFooter}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: `${prefix}-comparison-card`,
      label: 'Comparativa simple',
      category: 'Analítica libre',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        title: 'Comparativa',
        description: 'Compará dos valores o dos períodos.',
        currentLabel: 'Actual',
        currentValue: '$0',
        previousLabel: 'Anterior',
        previousValue: '$0',
        size: 'half',
      },
      configFields: [
        { key: 'currentLabel', label: 'Label actual', type: 'text', placeholder: 'Actual' },
        { key: 'currentValue', label: 'Valor actual', type: 'text', placeholder: '$0' },
        { key: 'previousLabel', label: 'Label anterior', type: 'text', placeholder: 'Anterior' },
        { key: 'previousValue', label: 'Valor anterior', type: 'text', placeholder: '$0' },
      ],
      render: ({ config }) => (
        <div className="card p-5">
          <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">{config.title || 'Comparativa'}</p>
          <p className="text-app-secondary text-[12px] mt-2">{config.description || 'Compará dos valores o dos períodos.'}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">{config.currentLabel || 'Actual'}</p>
              <p className="text-white text-[24px] font-bold mt-2">{config.currentValue || '$0'}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">{config.previousLabel || 'Anterior'}</p>
              <p className="text-white text-[24px] font-bold mt-2">{config.previousValue || '$0'}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: `${prefix}-callout`,
      label: 'Callout / alerta',
      category: 'Analítica libre',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        title: 'Observación importante',
        description: 'Explicá qué está pasando y por qué importa.',
        tone: 'info',
        size: 'wide',
      },
      configFields: [
        {
          key: 'tone',
          label: 'Tono',
          type: 'select',
          options: [
            { value: 'info', label: 'Info' },
            { value: 'positive', label: 'Positivo' },
            { value: 'warning', label: 'Warning' },
            { value: 'critical', label: 'Crítico' },
          ],
        },
      ],
      render: ({ config }) => (
        <div className={`rounded-2xl border p-5 ${getToneClasses(config.tone)}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{config.title || 'Observación importante'}</p>
          <p className="mt-3 text-[14px] leading-7">{config.description || 'Explicá qué está pasando y por qué importa.'}</p>
        </div>
      ),
    },
    {
      id: `${prefix}-editorial-insight`,
      label: 'Insight editorial',
      category: 'Utilidad',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        title: 'Insight',
        description: 'Escribí una lectura breve, más editorial y más visible que una nota simple.',
        icon: '✦',
        size: 'wide',
      },
      configFields: [
        { key: 'icon', label: 'Ícono', type: 'text', placeholder: '✦' },
      ],
      render: ({ config }) => (
        <div className="card p-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-2xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center text-[18px] shrink-0">
              {config.icon || '✦'}
            </div>
            <div>
              <p className="text-white text-[18px] font-semibold">{config.title || 'Insight'}</p>
              <p className="text-app-secondary text-[14px] leading-7 mt-2">
                {config.description || 'Escribí una lectura breve, más editorial y más visible que una nota simple.'}
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: `${prefix}-checklist`,
      label: 'Lista / backlog',
      category: 'Utilidad',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        title: 'Checklist',
        description: 'Primer punto\nSegundo punto\nTercer punto',
        size: 'half',
      },
      configFields: [
        {
          key: 'description',
          label: 'Ítems (uno por línea)',
          type: 'textarea',
          rows: 6,
          fullWidth: true,
          placeholder: 'Primer punto\nSegundo punto\nTercer punto',
        },
      ],
      render: ({ config }) => (
        <div className="card p-5">
          <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">{config.title || 'Checklist'}</p>
          <div className="mt-4 space-y-3">
            {parseLines(config.description || 'Primer punto').map((line, index) => (
              <div key={`${line}-${index}`} className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)] shrink-0" />
                <p className="text-white text-[14px] leading-6">{line}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: `${prefix}-data-kpi`,
      label: 'KPI configurable',
      category: 'Analítica universal',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        datasetId: '',
        size: 'half',
      },
      configFields: (context) => [
        {
          key: 'datasetId',
          label: 'Dataset KPI',
          type: 'select',
          options: (context?.kpiOptions || []).length
            ? context.kpiOptions.map((item) => ({ value: item.id, label: item.label }))
            : [{ value: '', label: 'Sin KPIs disponibles' }],
        },
      ],
      render: ({ config, context }) => {
        const dataset = getOptionMeta(context?.kpiOptions, config.datasetId);
        if (!dataset) return <EmptyDataCard message="Elegí un KPI disponible en esta hoja." />;

        return (
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="master-metric-card__badge">
                  <SourceIcon sourceKey={dataset.sourceKey} />
                  <span>{dataset.badge || 'Dato'}</span>
                </span>
                <p className="master-metric-card__value mt-3">{formatDisplayValue(dataset.value, dataset.format)}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="master-metric-card__label">{dataset.label}</p>
              {dataset.description ? <p className="master-metric-card__sub">{dataset.description}</p> : null}
            </div>
            {dataset.footer ? <div className="mt-3 text-[11px] text-app-secondary">{dataset.footer}</div> : null}
          </div>
        );
      },
    },
    {
      id: `${prefix}-data-comparison`,
      label: 'Comparativa de períodos',
      category: 'Analítica universal',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        comparisonId: '',
        size: 'half',
      },
      configFields: (context) => [
        {
          key: 'comparisonId',
          label: 'Comparativa',
          type: 'select',
          options: (context?.comparisonOptions || []).length
            ? context.comparisonOptions.map((item) => ({ value: item.id, label: item.label }))
            : [{ value: '', label: 'Sin comparativas disponibles' }],
        },
      ],
      render: ({ config, context }) => {
        const dataset = getOptionMeta(context?.comparisonOptions, config.comparisonId);
        if (!dataset) return <EmptyDataCard message="Elegí una comparativa disponible en esta hoja." />;

        return (
          <div className="card p-5">
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">{dataset.label}</p>
            {dataset.description ? <p className="text-app-secondary text-[12px] mt-2">{dataset.description}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">{dataset.currentLabel || 'Actual'}</p>
                <p className="text-white text-[24px] font-bold mt-2">{formatDisplayValue(dataset.currentValue, dataset.format)}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">{dataset.previousLabel || 'Anterior'}</p>
                <p className="text-white text-[24px] font-bold mt-2">{formatDisplayValue(dataset.previousValue, dataset.format)}</p>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: `${prefix}-data-table`,
      label: 'Tabla configurable',
      category: 'Analítica universal',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        tableId: '',
        rowsLimit: 8,
        size: 'full',
      },
      configFields: (context) => [
        {
          key: 'tableId',
          label: 'Tabla',
          type: 'select',
          options: (context?.tableOptions || []).length
            ? context.tableOptions.map((item) => ({ value: item.id, label: item.label }))
            : [{ value: '', label: 'Sin tablas disponibles' }],
        },
        {
          key: 'rowsLimit',
          label: 'Filas visibles',
          type: 'number',
          placeholder: '8',
        },
      ],
      render: ({ config, context }) => {
        const dataset = getOptionMeta(context?.tableOptions, config.tableId);
        if (!dataset) return <EmptyDataCard message="Elegí una tabla disponible en esta hoja." />;

        return (
          <div className="card p-5">
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">{dataset.label}</p>
            {dataset.description ? <p className="text-app-secondary text-[12px] mt-2 mb-4">{dataset.description}</p> : null}
            <SimpleTable columns={dataset.columns || []} rows={(dataset.rows || []).slice(0, Math.max(1, Number(config.rowsLimit || 8)))} />
          </div>
        );
      },
    },
    {
      id: `${prefix}-data-chart`,
      label: 'Gráfico configurable',
      category: 'Analítica universal',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        chartId: '',
        size: 'wide',
      },
      configFields: (context) => [
        {
          key: 'chartId',
          label: 'Serie',
          type: 'select',
          options: (context?.chartOptions || []).length
            ? context.chartOptions.map((item) => ({ value: item.id, label: item.label }))
            : [{ value: '', label: 'Sin series disponibles' }],
        },
      ],
      render: ({ config, context }) => {
        const dataset = getOptionMeta(context?.chartOptions, config.chartId);
        if (!dataset) return <EmptyDataCard message="Elegí una serie disponible en esta hoja." />;
        if (!Array.isArray(dataset.series) || dataset.series.length === 0) {
          return <EmptyDataCard message="Este dataset no tiene puntos para el rango actual." />;
        }

        return (
          <div className="card p-5">
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">{dataset.label}</p>
            {dataset.description ? <p className="text-app-secondary text-[12px] mt-2 mb-4">{dataset.description}</p> : null}
            <MiniBarChart series={dataset.series} format={dataset.format} />
          </div>
        );
      },
    },
    {
      id: `${prefix}-data-donut`,
      label: 'Donut configurable',
      category: 'Analítica universal',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        donutId: '',
        size: 'wide',
      },
      configFields: (context) => [
        {
          key: 'donutId',
          label: 'Composición',
          type: 'select',
          options: (context?.donutOptions || []).length
            ? context.donutOptions.map((item) => ({ value: item.id, label: item.label }))
            : [{ value: '', label: 'Sin composiciones disponibles' }],
        },
      ],
      render: ({ config, context }) => {
        const dataset = getOptionMeta(context?.donutOptions, config.donutId);
        if (!dataset) return <EmptyDataCard message="Elegí una composición disponible en esta hoja." />;

        return (
          <div className="card p-5">
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">{dataset.label}</p>
            {dataset.description ? <p className="text-app-secondary text-[12px] mt-2 mb-4">{dataset.description}</p> : null}
            <MiniDonut segments={dataset.segments || []} />
          </div>
        );
      },
    },
    {
      id: `${prefix}-data-heatmap`,
      label: 'Heatmap simple',
      category: 'Analítica universal',
      repeatable: true,
      defaultEnabled: false,
      defaultConfig: {
        heatmapId: '',
        size: 'full',
      },
      configFields: (context) => [
        {
          key: 'heatmapId',
          label: 'Heatmap',
          type: 'select',
          options: (context?.heatmapOptions || []).length
            ? context.heatmapOptions.map((item) => ({ value: item.id, label: item.label }))
            : [{ value: '', label: 'Sin heatmaps disponibles' }],
        },
      ],
      render: ({ config, context }) => {
        const dataset = getOptionMeta(context?.heatmapOptions, config.heatmapId);
        if (!dataset) return <EmptyDataCard message="Elegí un heatmap disponible en esta hoja." />;

        return (
          <div className="card p-5">
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">{dataset.label}</p>
            {dataset.description ? <p className="text-app-secondary text-[12px] mt-2 mb-4">{dataset.description}</p> : null}
            <MiniHeatmap cells={dataset.cells || []} format={dataset.format} />
          </div>
        );
      },
    },
  ];
}

export default createUtilityBlocks;
