import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import PageBlockLayout from '../components/common/PageBlockLayout';
import MasterMetricBoard, { getPeriodLabel } from '../components/common/MasterMetricBoard';
import { createSharedPageBlocks } from '../components/common/pageBlockCatalog';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function pct(v) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(1)}%`;
}

function dateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupDailyOrdersByWeek(rows = [], valueKey) {
  const buckets = new Map();
  rows.forEach((item) => {
    const date = new Date(item._id);
    const day = date.getUTCDay() || 7;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - day + 1);
    const mondayKey = monday.toISOString().slice(0, 10);
    if (!buckets.has(mondayKey)) {
      buckets.set(mondayKey, { start: mondayKey, value: 0 });
    }
    buckets.get(mondayKey).value += Number(item[valueKey] || 0);
  });

  return Array.from(buckets.values()).map((item) => {
    const start = new Date(item.start);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return {
      label: `${start.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}-${end.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`,
      value: item.value,
    };
  });
}

function groupDailyOrdersByMonth(rows = [], valueKey) {
  const buckets = new Map();
  rows.forEach((item) => {
    const key = String(item._id || '').slice(0, 7);
    buckets.set(key, (buckets.get(key) || 0) + Number(item[valueKey] || 0));
  });

  return Array.from(buckets.entries()).map(([key, value]) => ({
    label: key,
    value,
  }));
}

function statusTone(status) {
  switch (status) {
    case 'healthy':
    case 'matched':
      return 'text-emerald-300 bg-emerald-500/[0.08] border-emerald-500/20';
    case 'running':
      return 'text-blue-200 bg-blue-500/[0.08] border-blue-500/20';
    case 'stale':
    case 'connected_no_data':
      return 'text-amber-200 bg-amber-500/[0.08] border-amber-500/20';
    case 'error':
    case 'mismatch':
      return 'text-red-200 bg-red-500/[0.08] border-red-500/20';
    default:
      return 'text-app-secondary bg-white/[0.04] border-white/[0.08]';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'healthy':
      return 'Saludable';
    case 'running':
      return 'Sincronizando';
    case 'stale':
      return 'Desactualizado';
    case 'connected_no_data':
      return 'Conectado sin datos';
    case 'error':
      return 'Con error';
    case 'matched':
      return 'Conciliado';
    case 'mismatch':
      return 'Con diferencias';
    case 'disconnected':
      return 'Desconectado';
    default:
      return 'Sin estado';
  }
}

function TiendaExecutiveStrip({ summary, devoluciones, ncrc, preset, from, to }) {
  if (!summary) return null;

  const cards = [
    { label: 'Ventas', value: Number(summary.totalOrdenes || 0).toLocaleString('es-AR'), badge: 'Tienda', sourceKey: 'tiendanube', subLabel: 'Órdenes del período' },
    { label: 'Facturación', value: fmt(summary.totalRevenue), badge: 'Tienda', sourceKey: 'tiendanube', subLabel: 'Ingresos brutos' },
    { label: 'Ingresos netos', value: fmt(summary.totalNeto), badge: 'Tienda', sourceKey: 'tiendanube', subLabel: 'Revenue neto' },
    { label: 'Liquidable', value: fmt(summary.totalLiquidable), badge: 'Cash', sourceKey: 'cash', subLabel: 'Monto a liquidar' },
    { label: 'AOV', value: fmt(summary.aov), badge: 'Tienda', sourceKey: 'tiendanube', subLabel: 'Ticket promedio' },
    { label: 'AOV neto', value: fmt(summary.aovNeto), badge: 'Tienda', sourceKey: 'tiendanube', subLabel: 'Ticket neto' },
    { label: 'NC %', value: pct(ncrc?.ncPct), badge: 'Clientes', sourceKey: 'clientes', subLabel: 'Nuevos clientes' },
    { label: 'Devoluciones', value: Number(devoluciones?.count || 0).toLocaleString('es-AR'), badge: 'Riesgo', sourceKey: 'cash', subLabel: 'Pedidos devueltos' },
  ];

  return (
    <MasterMetricBoard
      title="Lectura comercial de la tienda"
      subtitle="Primero volumen, monetización y calidad de venta. Después bajamos a medios de pago, clientes y conciliación."
      sourceLabel="Tienda Nube"
      sourceKey="tiendanube"
      periodLabel={getPeriodLabel(preset, from, to)}
      items={cards}
    />
  );
}

function StoreQuickDetails({ summary, devoluciones, ncrc }) {
  if (!summary) return null;

  const cards = [
    ['Cuotas promedio', summary.avgCuotas?.toFixed(1) || '—'],
    ['Devoluciones', Number(devoluciones?.count || 0).toLocaleString('es-AR')],
    ['Total devuelto', fmt(devoluciones?.total)],
    ['NC %', pct(ncrc?.ncPct)],
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map(([label, value]) => (
        <div key={label} className="card p-4">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.18em]">{label}</p>
          <p className="text-white text-[20px] font-bold mt-2 leading-none">{value}</p>
        </div>
      ))}
    </div>
  );
}

function MedioPagoTable({ data }) {
  if (!data || data.length === 0) return <p className="text-[13px] text-gray-600 text-center py-8">Sin datos de medios de pago.</p>;

  const total = data.reduce((s, d) => ({ ordenes: s.ordenes + d.ordenes, revenue: s.revenue + d.revenue, comisionPago: s.comisionPago + d.comisionPago, comisionCuotas: s.comisionCuotas + d.comisionCuotas }), { ordenes: 0, revenue: 0, comisionPago: 0, comisionCuotas: 0 });

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-dark">
        <thead>
          <tr>
            {['Gateway', 'Órdenes', '%', 'Revenue', 'Com. pago', 'Com. cuotas', 'Cuotas prom.'].map((h) => (
              <th key={h} className="text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d._id || 'unknown'}>
              <td className="font-medium text-white">{d._id || 'Sin gateway'}</td>
              <td>{d.ordenes}</td>
              <td>{total.ordenes > 0 ? pct((d.ordenes / total.ordenes) * 100) : '—'}</td>
              <td className="tabular-nums">{fmt(d.revenue)}</td>
              <td className="text-red-400 tabular-nums">{fmt(d.comisionPago)}</td>
              <td className="text-red-400 tabular-nums">{fmt(d.comisionCuotas)}</td>
              <td>{d.avgCuotas?.toFixed(1)}</td>
            </tr>
          ))}
          <tr className="bg-white/[0.03] font-semibold">
            <td className="text-white">TOTAL</td>
            <td>{total.ordenes}</td>
            <td>100%</td>
            <td className="tabular-nums">{fmt(total.revenue)}</td>
            <td className="text-red-400 tabular-nums">{fmt(total.comisionPago)}</td>
            <td className="text-red-400 tabular-nums">{fmt(total.comisionCuotas)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function NCRCCards({ ncrc }) {
  if (!ncrc) return null;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="card p-4">
        <p className="kpi-label mb-1">Nuevos Clientes (NC)</p>
        <p className="text-[24px] font-bold text-blue-400">{ncrc.nc.ordenes}</p>
        <p className="text-[12px] text-gray-600 mt-1">Revenue: {fmt(ncrc.nc.revenue)}</p>
        <p className="text-[12px] text-gray-600">AOV: {fmt(ncrc.nc.aov)}</p>
      </div>
      <div className="card p-4">
        <p className="kpi-label mb-1">Clientes Recurrentes (RC)</p>
        <p className="text-[24px] font-bold text-emerald-400">{ncrc.rc.ordenes}</p>
        <p className="text-[12px] text-gray-600 mt-1">Revenue: {fmt(ncrc.rc.revenue)}</p>
        <p className="text-[12px] text-gray-600">AOV: {fmt(ncrc.rc.aov)}</p>
      </div>
      <div className="card p-4">
        <p className="kpi-label mb-1">Ratio NC</p>
        <p className="text-[24px] font-bold text-white">{pct(ncrc.ncPct)}</p>
        <p className="text-[12px] text-gray-600 mt-1">del total de órdenes</p>
      </div>
    </div>
  );
}

function DailyOrdersTable({ data }) {
  if (!data || data.length === 0) return <p className="text-[13px] text-gray-600 text-center py-8">Sin datos diarios.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-dark">
        <thead>
          <tr>
            {['Fecha', 'Órdenes', 'Revenue', 'Net Revenue', 'NC', 'RC'].map((h) => (
              <th key={h} className="text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d._id}>
              <td className="font-medium text-white">{d._id}</td>
              <td>{d.ordenes}</td>
              <td className="tabular-nums">{fmt(d.revenue)}</td>
              <td className="tabular-nums">{fmt(d.netRevenue)}</td>
              <td className="text-blue-400">{d.ncOrdenes}</td>
              <td className="text-emerald-400">{d.rcOrdenes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopCustomersTable({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Top 10 clientes del período</p>
      <table className="w-full table-dark">
        <thead>
          <tr>
            {['Cliente', 'Email', 'Órdenes', 'Revenue'].map((h) => (
              <th key={h} className="text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((c, i) => (
            <tr key={i}>
              <td className="font-medium text-white">{c.name || '—'}</td>
              <td className="text-[11px]">{c._id}</td>
              <td>{c.ordenes}</td>
              <td className="font-semibold text-white tabular-nums">{fmt(c.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditView({ audit, onReconcile, onRebuildHistory, reconciling, rebuilding, reconcileResult, rebuildResult }) {
  if (!audit) return <p className="text-[13px] text-app-secondary text-center py-8">Sin diagnóstico disponible.</p>;

  const cards = [
    ['Órdenes sin cliente', audit.summary.ordersMissingCustomer],
    ['Órdenes sin costo', audit.summary.ordersMissingCosts],
    ['Clientes sin email real', audit.summary.customersWithoutEmail],
    ['Días legacy-only', audit.summary.legacyOnlyDays],
    ['Días sin DailyMetric', audit.summary.orderOnlyDays],
    ['Días con mismatch', audit.summary.mismatchedDays],
  ];

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Reconciliación histórica</p>
          <p className="text-app-secondary text-[12px] mt-1">Recalcula días respaldados por órdenes y marca remanentes legacy.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onRebuildHistory} disabled={rebuilding} className="btn-secondary disabled:opacity-50">
            {rebuilding ? 'Reconstruyendo...' : 'Reconstruir historia'}
          </button>
          <button onClick={onReconcile} disabled={reconciling} className="btn-primary disabled:opacity-50">
            {reconciling ? 'Reconciliando...' : 'Reconciliar período'}
          </button>
        </div>
      </div>

      {reconcileResult && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
          <p className="text-[12px] text-emerald-300">
            Recalculados: {reconcileResult.recalculatedDays} días · Legacy marcados: {reconcileResult.markedLegacyDays} · Mismatches marcados: {reconcileResult.markedMismatches}
          </p>
        </div>
      )}

      {rebuildResult?.scope && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.06] p-4">
          <p className="text-[12px] text-blue-200">
            Historia reconstruida desde {rebuildResult.scope.from} hasta {rebuildResult.scope.to} · días con órdenes detectados: {rebuildResult.scope.orderDays}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(([label, value]) => (
          <div key={label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">{label}</p>
            <p className="text-white text-[22px] font-bold mt-2">{value || 0}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-app-secondary text-[12px]">
          Cobertura diaria: {pct(audit.summary.dailyCoveragePct || 0)}
        </p>
      </div>

      {audit.mismatches?.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full table-dark">
            <thead>
              <tr>
                <th className="text-left">Día</th>
                <th className="text-left">Issue</th>
                <th className="text-right">Órdenes</th>
                <th className="text-right">DailyMetric</th>
                <th className="text-right">Revenue orden</th>
                <th className="text-right">Revenue daily</th>
              </tr>
            </thead>
            <tbody>
              {audit.mismatches.map((item) => (
                <tr key={`${item.day}-${item.issue}`}>
                  <td className="font-medium text-white">{item.day}</td>
                  <td className="text-app-secondary">{item.issue}</td>
                  <td className="text-right">{item.orderOrders ?? item.orders ?? '—'}</td>
                  <td className="text-right">{item.dailyOrders ?? '—'}</td>
                  <td className="text-right tabular-nums">{item.orderRevenue != null ? fmt(item.orderRevenue) : item.revenue != null ? fmt(item.revenue) : '—'}</td>
                  <td className="text-right tabular-nums">{item.dailyRevenue != null ? fmt(item.dailyRevenue) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[13px] text-app-secondary text-center py-6">No se detectaron mismatches en el rango filtrado.</p>
      )}
    </div>
  );
}

function SourceStatusCard({ title, source, metrics }) {
  if (!source) return null;

  const counts = metrics || [];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-app-muted uppercase tracking-[0.18em]">{title}</p>
          <p className="text-white text-[18px] font-semibold mt-2">
            {source.connected ? 'Conectado' : 'No conectado'}
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone(source.status)}`}>
          {statusLabel(source.status)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {counts.map((item) => (
          <div key={item.label} className="rounded-lg bg-white/[0.03] p-3 border border-white/[0.05]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-app-muted">{item.label}</p>
            <p className="text-white text-[18px] font-semibold mt-2">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
        <div className="rounded-lg bg-white/[0.02] p-3 border border-white/[0.05]">
          <p className="text-app-muted uppercase tracking-[0.14em] text-[10px]">Último sync</p>
          <p className="text-app-secondary mt-2">{dateTime(source.lastSync)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] p-3 border border-white/[0.05]">
          <p className="text-app-muted uppercase tracking-[0.14em] text-[10px]">Último dato crudo</p>
          <p className="text-app-secondary mt-2">{dateTime(source.latestSourceRecordAt)}</p>
        </div>
      </div>

      {source.accountId && (
        <p className="text-[12px] text-app-secondary">Cuenta Meta: <span className="text-white">{source.accountId}</span></p>
      )}
      {source.tokenSource && (
        <p className="text-[12px] text-app-secondary">Origen del token: <span className="text-white">{source.tokenSource === 'cro_service' ? 'CRO centralizado' : 'Manual'}</span></p>
      )}
      {source.lastLogs && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(source.lastLogs)
            .filter(([, value]) => value)
            .map(([key, log]) => (
              <div key={key} className="rounded-lg bg-white/[0.02] p-3 border border-white/[0.05]">
                <p className="text-app-muted uppercase tracking-[0.14em] text-[10px]">
                  Último {key === 'orders' ? 'sync órdenes' : key === 'products' ? 'sync productos' : key === 'token' ? 'chequeo de token' : key}
                </p>
                <p className="text-white text-[13px] mt-2">{statusLabel(log.status)}</p>
                <p className="text-app-secondary text-[12px] mt-1">{dateTime(log.createdAt)}</p>
                {log.error && <p className="text-red-300 text-[12px] mt-2 line-clamp-3">{log.error}</p>}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ReconciliationCard({ title, reconciliation, rows }) {
  if (!reconciliation) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-app-muted uppercase tracking-[0.18em]">{title}</p>
          <p className="text-app-secondary text-[12px] mt-2">Comparación entre fuente cruda y `DailyMetric` del período.</p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone(reconciliation.status)}`}>
          {statusLabel(reconciliation.status)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-dark">
          <thead>
            <tr>
              <th className="text-left">Métrica</th>
              <th className="text-right">Crudo</th>
              <th className="text-right">DailyMetric</th>
              <th className="text-right">Delta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="text-white font-medium">{row.label}</td>
                <td className="text-right tabular-nums">{row.format(reconciliation.raw[row.key])}</td>
                <td className="text-right tabular-nums">{row.format(reconciliation.dailyMetric[row.key])}</td>
                <td className={`text-right tabular-nums ${Math.abs(Number(reconciliation.delta[row.key] || 0)) > 1 ? 'text-red-300' : 'text-emerald-300'}`}>
                  {row.format(reconciliation.delta[row.key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SyncStatusView({ syncStatus }) {
  if (!syncStatus) return <p className="text-[13px] text-app-secondary text-center py-8">Sin estado de sincronización disponible.</p>;

  return (
    <div className="space-y-4 p-1">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SourceStatusCard
          title="Fuente Tienda Nube"
          source={syncStatus.connections?.tiendanube}
          metrics={[
            { label: 'Órdenes crudas', value: (syncStatus.connections?.tiendanube?.counts?.orders || 0).toLocaleString('es-AR') },
            { label: 'Productos', value: (syncStatus.connections?.tiendanube?.counts?.products || 0).toLocaleString('es-AR') },
          ]}
        />
        <SourceStatusCard
          title="Fuente Meta Ads"
          source={syncStatus.connections?.metaAds}
          metrics={[
            { label: 'Cuentas', value: (syncStatus.connections?.metaAds?.accountCount || 0).toLocaleString('es-AR') },
            { label: 'Campañas', value: (syncStatus.connections?.metaAds?.counts?.campaigns || 0).toLocaleString('es-AR') },
            { label: 'Adsets', value: (syncStatus.connections?.metaAds?.counts?.adsets || 0).toLocaleString('es-AR') },
            { label: 'Ads', value: (syncStatus.connections?.metaAds?.counts?.ads || 0).toLocaleString('es-AR') },
            { label: 'Insights API', value: (syncStatus.connections?.metaAds?.counts?.insights || 0).toLocaleString('es-AR') },
          ]}
        />
      </div>

      {syncStatus.connections?.metaAds?.accountIds?.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[11px] font-semibold text-app-muted uppercase tracking-[0.18em]">Cuentas Meta conectadas</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {syncStatus.connections.metaAds.accountIds.map((accountId, index) => (
              <div key={accountId} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                <span className="text-[11px] text-white font-mono">{accountId}</span>
                {index === 0 && <span className="text-[10px] text-emerald-300 ml-2">Principal</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-[11px] font-semibold text-app-muted uppercase tracking-[0.18em]">Último DailyMetric</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="rounded-lg bg-white/[0.03] p-3 border border-white/[0.05]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-app-muted">Fecha</p>
            <p className="text-white text-[16px] font-semibold mt-2">{syncStatus.connections?.dailyMetrics?.latestDate ? new Date(syncStatus.connections.dailyMetrics.latestDate).toISOString().slice(0, 10) : '—'}</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 border border-white/[0.05]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-app-muted">Revenue</p>
            <p className="text-white text-[16px] font-semibold mt-2">{fmt(syncStatus.connections?.dailyMetrics?.latestSnapshot?.revenue)}</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 border border-white/[0.05]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-app-muted">Ad Spend</p>
            <p className="text-white text-[16px] font-semibold mt-2">{fmt(syncStatus.connections?.dailyMetrics?.latestSnapshot?.adSpend)}</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 border border-white/[0.05]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-app-muted">Compras Meta</p>
            <p className="text-white text-[16px] font-semibold mt-2">{(syncStatus.connections?.dailyMetrics?.latestSnapshot?.metaPurchases || 0).toLocaleString('es-AR')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ReconciliationCard
          title="Reconciliación Tienda Nube"
          reconciliation={syncStatus.reconciliation?.tiendaNube}
          rows={[
            { key: 'orders', label: 'Órdenes positivas', format: (value) => Number(value || 0).toLocaleString('es-AR') },
            { key: 'revenue', label: 'Ingresos', format: fmt },
            { key: 'netRevenue', label: 'Ingresos netos', format: fmt },
          ]}
        />
        <ReconciliationCard
          title="Reconciliación Meta Ads"
          reconciliation={syncStatus.reconciliation?.metaAds}
          rows={[
            { key: 'adSpend', label: 'Ad Spend', format: fmt },
            { key: 'purchases', label: 'Compras', format: (value) => Number(value || 0).toLocaleString('es-AR') },
            { key: 'purchaseValue', label: 'Valor de compra', format: fmt },
          ]}
        />
      </div>
    </div>
  );
}

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'medios', label: 'Medios de Pago' },
  { key: 'ncrc', label: 'NC / RC' },
  { key: 'diario', label: 'Detalle Diario' },
  { key: 'top', label: 'Top Clientes' },
  { key: 'sync', label: 'Sync y Fuentes' },
  { key: 'audit', label: 'Integridad de Datos' },
];

export default function Tienda() {
  const { storeId } = useParams();
  const { from, to, preset } = useSelector((s) => s.date);
  const store = useSelector((state) => state.stores.stores.find((item) => item._id === storeId));
  const [data, setData] = useState(null);
  const [audit, setAudit] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('resumen');
  const [reconciling, setReconciling] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [rebuildResult, setRebuildResult] = useState(null);
  const sharedBlocks = createSharedPageBlocks('tienda', {
    storeId,
    storeName: store?.nombre,
    from,
    to,
    mode: tab === 'sync' || tab === 'audit' ? 'sync' : 'dashboard',
    section: 'dashboard',
    analysisDescription: 'IA y prompts quedan al final para no invadir la lectura principal de tienda.',
  });
  const blockContext = useMemo(() => ({
    kpiOptions: [
      { id: 'sales', label: 'Ventas', value: data?.summary?.totalOrdenes, format: 'number', sourceKey: 'tiendanube', badge: 'Tienda', description: 'Órdenes del período' },
      { id: 'gross', label: 'Facturación', value: data?.summary?.totalRevenue, format: 'money', sourceKey: 'tiendanube', badge: 'Tienda', description: 'Ingresos brutos' },
      { id: 'net', label: 'Ingresos netos', value: data?.summary?.totalNeto, format: 'money', sourceKey: 'tiendanube', badge: 'Tienda', description: 'Revenue neto' },
      { id: 'cash', label: 'Liquidable', value: data?.summary?.totalLiquidable, format: 'money', sourceKey: 'cash', badge: 'Cash', description: 'Monto a liquidar' },
      { id: 'aov', label: 'AOV', value: data?.summary?.aov, format: 'money', sourceKey: 'tiendanube', badge: 'Tienda', description: 'Ticket promedio' },
      { id: 'aov-neto', label: 'AOV neto', value: data?.summary?.aovNeto, format: 'money', sourceKey: 'tiendanube', badge: 'Tienda', description: 'Ticket neto' },
      { id: 'nc-pct', label: 'NC %', value: data?.ncrc?.ncPct, format: 'percent', sourceKey: 'clientes', badge: 'Clientes', description: 'Nuevos clientes' },
    ],
    comparisonOptions: [
      { id: 'gross-vs-net', label: 'Facturación vs neto', currentLabel: 'Bruto', currentValue: data?.summary?.totalRevenue, previousLabel: 'Neto', previousValue: data?.summary?.totalNeto, format: 'money', description: 'Brecha entre ingresos brutos y netos.' },
      { id: 'nc-vs-rc-orders', label: 'NC vs RC órdenes', currentLabel: 'NC', currentValue: data?.ncrc?.nc?.ordenes, previousLabel: 'RC', previousValue: data?.ncrc?.rc?.ordenes, format: 'number', description: 'Distribución de órdenes entre nuevos y recurrentes.' },
      { id: 'nc-vs-rc-revenue', label: 'NC vs RC ingresos', currentLabel: 'NC', currentValue: data?.ncrc?.nc?.revenue, previousLabel: 'RC', previousValue: data?.ncrc?.rc?.revenue, format: 'money', description: 'Distribución de ingresos entre nuevos y recurrentes.' },
    ],
    tableOptions: [
      {
        id: 'payment-methods',
        label: 'Medios de pago',
        description: 'Distribución comercial por gateway.',
        columns: [
          { key: 'gateway', label: 'Gateway' },
          { key: 'ordenes', label: 'Órdenes', numeric: true },
          { key: 'revenue', label: 'Revenue', numeric: true },
        ],
        rows: (data?.byMedioPago || []).slice(0, 8).map((item, index) => ({
          id: `${item._id || 'gw'}-${index}`,
          gateway: item._id || 'Sin gateway',
          ordenes: Number(item.ordenes || 0).toLocaleString('es-AR'),
          revenue: fmt(item.revenue),
        })),
      },
      {
        id: 'top-customers',
        label: 'Top clientes',
        description: 'Clientes que más aportaron en el período.',
        columns: [
          { key: 'name', label: 'Cliente' },
          { key: 'ordenes', label: 'Órdenes', numeric: true },
          { key: 'revenue', label: 'Revenue', numeric: true },
        ],
        rows: (data?.topCustomers || []).slice(0, 8).map((item, index) => ({
          id: `${item._id || 'customer'}-${index}`,
          name: item.name || item._id || '—',
          ordenes: Number(item.ordenes || 0).toLocaleString('es-AR'),
          revenue: fmt(item.revenue),
        })),
      },
      {
        id: 'daily-orders',
        label: 'Detalle diario',
        description: 'Vista diaria de ventas e ingresos.',
        columns: [
          { key: 'date', label: 'Fecha' },
          { key: 'ordenes', label: 'Órdenes', numeric: true },
          { key: 'revenue', label: 'Revenue', numeric: true },
        ],
        rows: (data?.dailyOrders || []).slice(0, 10).map((item) => ({
          id: item._id,
          date: item._id,
          ordenes: Number(item.ordenes || 0).toLocaleString('es-AR'),
          revenue: fmt(item.revenue),
        })),
      },
    ],
    chartOptions: [
      {
        id: 'orders-per-day',
        label: 'Ventas por día',
        description: 'Serie diaria de órdenes del período.',
        format: 'number',
        series: (data?.dailyOrders || []).map((item) => ({
          label: item._id?.slice(5) || item._id,
          value: Number(item.ordenes || 0),
        })),
      },
      {
        id: 'revenue-per-day',
        label: 'Facturación por día',
        description: 'Serie diaria de revenue de tienda.',
        format: 'money',
        series: (data?.dailyOrders || []).map((item) => ({
          label: item._id?.slice(5) || item._id,
          value: Number(item.revenue || 0),
        })),
      },
      {
        id: 'orders-per-week',
        label: 'Ventas x semana',
        description: 'Agrupado semanal de órdenes.',
        format: 'number',
        series: groupDailyOrdersByWeek(data?.dailyOrders || [], 'ordenes'),
      },
      {
        id: 'revenue-per-week',
        label: 'Facturación x semana',
        description: 'Agrupado semanal de revenue.',
        format: 'money',
        series: groupDailyOrdersByWeek(data?.dailyOrders || [], 'revenue'),
      },
      {
        id: 'revenue-per-month',
        label: 'Facturación por mes',
        description: 'Agrupado mensual de revenue dentro del rango.',
        format: 'money',
        series: groupDailyOrdersByMonth(data?.dailyOrders || [], 'revenue'),
      },
    ],
    donutOptions: [
      {
        id: 'nc-rc-orders',
        label: 'NC vs RC órdenes',
        description: 'Distribución de órdenes entre nuevos y recurrentes.',
        segments: [
          { label: 'NC', value: data?.ncrc?.nc?.ordenes, format: 'number', color: '#60a5fa' },
          { label: 'RC', value: data?.ncrc?.rc?.ordenes, format: 'number', color: '#34d399' },
        ],
      },
      {
        id: 'nc-rc-revenue',
        label: 'NC vs RC ingresos',
        description: 'Distribución de ingresos por tipo de cliente.',
        segments: [
          { label: 'NC', value: data?.ncrc?.nc?.revenue, format: 'money', color: '#60a5fa' },
          { label: 'RC', value: data?.ncrc?.rc?.revenue, format: 'money', color: '#34d399' },
        ],
      },
    ],
    heatmapOptions: [
      {
        id: 'orders-heatmap',
        label: 'Heatmap ventas diarias',
        description: 'Mapa simple de órdenes por día.',
        format: 'number',
        cells: (data?.dailyOrders || []).map((item) => ({
          label: item._id?.slice(5) || item._id,
          value: Number(item.ordenes || 0),
        })),
      },
      {
        id: 'revenue-heatmap',
        label: 'Heatmap ingresos diarios',
        description: 'Mapa simple de revenue por día.',
        format: 'money',
        cells: (data?.dailyOrders || []).map((item) => ({
          label: item._id?.slice(5) || item._id,
          value: Number(item.revenue || 0),
        })),
      },
    ],
  }), [data]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const [res, auditRes, syncRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/tienda/breakdown`, { params }),
        api.get(`/api/stores/${storeId}/tienda/audit`, { params }),
        api.get(`/api/stores/${storeId}/tienda/sync-status`, { params }),
      ]);
      setData(res.data);
      setAudit(auditRes.data);
      setSyncStatus(syncRes.data);
    } catch {
      setData(null);
      setAudit(null);
      setSyncStatus(null);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const reconcile = async () => {
    setReconciling(true);
    setReconcileResult(null);
    try {
      const { data: res } = await api.post(`/api/stores/${storeId}/tienda/reconcile`, { from, to });
      setReconcileResult(res);
      setAudit(res.postAudit || null);
    } catch {}
    setReconciling(false);
  };

  const rebuildHistory = async () => {
    setRebuilding(true);
    setRebuildResult(null);
    try {
      const { data: res } = await api.post(`/api/stores/${storeId}/tienda/rebuild-history`);
      setRebuildResult(res);
      setAudit(res.result?.postAudit || null);
    } catch {}
    setRebuilding(false);
  };

  if (loading) return <div className="text-center py-12 text-[13px] text-gray-600">Cargando datos de tienda...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Tienda</h1>
        <p className="page-subtitle">Primero los KPI más importantes de la operación; después tablas, conciliación y análisis más profundos.</p>
      </div>

      <PageBlockLayout
        storeId={storeId}
        pageKey="tiendaFixed"
        storeLayouts={store?.pageLayouts}
        initiallyEmpty
        blockContext={blockContext}
        presetTemplates={[
          {
            id: 'commercial',
            label: 'Tienda comercial',
            helper: 'KPIs + detalles rápidos + tabs',
            blockIds: ['tienda-kpis', 'tienda-quick-details', 'tienda-tabs'],
          },
          {
            id: 'audit',
            label: 'Tienda + auditoría',
            helper: 'KPIs + tabs + análisis',
            blockIds: ['tienda-kpis', 'tienda-tabs', 'tienda-analysis'],
          },
        ]}
        blocks={[
          {
            id: 'tienda-kpis',
            label: 'KPIs principales',
            category: 'Analítica',
            content: <TiendaExecutiveStrip summary={data?.summary} devoluciones={data?.devoluciones} ncrc={data?.ncrc} preset={preset} from={from} to={to} />,
          },
          {
            id: 'tienda-quick-details',
            label: 'Detalles rápidos',
            category: 'Analítica',
            content: <StoreQuickDetails summary={data?.summary} devoluciones={data?.devoluciones} ncrc={data?.ncrc} />,
          },
          {
            id: 'tienda-tabs',
            label: 'Tabs operativos',
            category: 'Detalle',
            content: (
              <div className="space-y-5">
                <div className="flex gap-2 border-b border-white/[0.06] pb-0">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition ${
                        tab === t.key
                          ? 'border-blue-500 text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="card">
                  {tab === 'resumen' && (
                    <div className="p-1 space-y-4">
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Resumen operativo</p>
                        <p className="text-app-secondary text-[12px]">Este bloque deja a mano los KPI secundarios; el detalle más complejo queda en las demás pestañas.</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'NC órdenes', value: data?.ncrc?.nc?.ordenes || 0, raw: true },
                          { label: 'RC órdenes', value: data?.ncrc?.rc?.ordenes || 0, raw: true },
                          { label: 'NC ingresos', value: data?.ncrc?.nc?.revenue, color: 'text-blue-300' },
                          { label: 'RC ingresos', value: data?.ncrc?.rc?.revenue, color: 'text-emerald-300' },
                        ].map((c) => (
                          <div key={c.label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                            <p className="kpi-label">{c.label}</p>
                            <p className={`text-[18px] font-bold mt-1 ${c.color || 'text-white'}`}>
                              {c.raw ? Number(c.value || 0).toLocaleString('es-AR') : fmt(c.value)}
                            </p>
                          </div>
                        ))}
                      </div>

                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Desglose de costos</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          { label: 'COGS', value: data?.summary?.totalCostoProductos },
                          { label: 'Comisión Pago', value: data?.summary?.totalComisionPago },
                          { label: 'Comisión Cuotas', value: data?.summary?.totalComisionCuotas },
                          { label: 'Impuestos IBB', value: data?.summary?.totalIBB },
                          { label: 'Fee Plataforma', value: data?.summary?.totalFeePlataforma },
                          { label: 'Costo Envío', value: data?.summary?.totalCostoEnvio },
                        ].map((c) => (
                          <div key={c.label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                            <p className="kpi-label">{c.label}</p>
                            <p className="text-[18px] font-bold text-red-400 mt-1">{fmt(c.value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {tab === 'medios' && <MedioPagoTable data={data?.byMedioPago} />}

                  {tab === 'ncrc' && (
                    <div className="p-1">
                      <NCRCCards ncrc={data?.ncrc} />
                    </div>
                  )}

                  {tab === 'diario' && <DailyOrdersTable data={data?.dailyOrders} />}

                  {tab === 'top' && (
                    <div className="p-1">
                      <TopCustomersTable data={data?.topCustomers} />
                    </div>
                  )}

                  {tab === 'sync' && <SyncStatusView syncStatus={syncStatus} />}

                  {tab === 'audit' && (
                    <AuditView
                      audit={audit}
                      onReconcile={reconcile}
                      onRebuildHistory={rebuildHistory}
                      reconciling={reconciling}
                      rebuilding={rebuilding}
                      reconcileResult={reconcileResult}
                      rebuildResult={rebuildResult}
                    />
                  )}
                </div>
              </div>
            ),
          },
          ...sharedBlocks,
        ]}
      />
    </div>
  );
}
