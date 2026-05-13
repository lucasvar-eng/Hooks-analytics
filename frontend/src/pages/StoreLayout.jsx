import { useState, useEffect } from 'react';
import { useParams, NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchStores, fetchStoreMetrics, selectStore } from '../store/storeSlice';
import Header from '../components/common/Header';
import InsightPanel from '../components/insights/InsightPanel';

const ICONS = {
  dashboard: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
    </svg>
  ),
  tienda: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </svg>
  ),
  'meta-ads': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  creativos: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  cashflow: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  costos: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  productos: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  clientes: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  competencia: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  simulador: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M16 3h5m0 0v5m0-5l-8 8" />
    </svg>
  ),
  reportes: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  'report-builder': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  alertas: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  automatizaciones: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 3l4 4-4 4M7 21l-4-4 4-4M3 17h10a4 4 0 004-4V7" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { path: 'dashboard', label: 'Resumen', group: 'General' },
  { path: 'tienda', label: 'Tienda', group: 'General' },
  { path: 'meta-ads', label: 'Meta Ads', group: 'Marketing' },
  { path: 'creativos', label: 'Creativos', group: 'Marketing' },
  { path: 'competencia', label: 'Competencia', group: 'Marketing' },
  { path: 'cashflow', label: 'Cashflow', group: 'Finanzas' },
  { path: 'costos', label: 'Costos', group: 'Finanzas' },
  { path: 'productos', label: 'Productos', group: 'Ventas' },
  { path: 'clientes', label: 'Clientes', group: 'Ventas' },
  { path: 'simulador', label: 'Simulador', group: 'IA' },
  { path: 'reportes', label: 'Reportes', group: 'IA' },
  { path: 'report-builder', label: 'Reporte AI', group: 'IA' },
  { path: 'alertas', label: 'Alertas', group: 'IA' },
  { path: 'automatizaciones', label: 'Automatizaciones', group: 'IA' },
  { path: 'settings', label: 'Settings', group: 'Config' },
];

const SECTION_MAP = {
  dashboard: 'dashboard',
  'meta-ads': 'meta',
  creativos: 'creativos',
  costos: 'costos',
  productos: 'productos',
  clientes: 'clientes',
  cashflow: 'cashflow',
  competencia: 'competencia',
};

export default function StoreLayout() {
  const { storeId } = useParams();
  const dispatch = useDispatch();
  const location = useLocation();
  const store = useSelector((state) =>
    state.stores.stores.find((s) => s._id === storeId)
  );
  const { from, to } = useSelector((state) => state.date);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('hooks-insight-panel-open');
      if (saved != null) {
        setPanelOpen(saved === '1');
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('hooks-insight-panel-open', panelOpen ? '1' : '0');
    } catch {}
  }, [panelOpen]);

  useEffect(() => {
    dispatch(selectStore(storeId));
  }, [dispatch, storeId]);

  useEffect(() => {
    if (!storeId || store) return;
    dispatch(fetchStores());
  }, [dispatch, storeId, store]);

  // Cargar métricas (incluye costCoverage) para que el badge "Preliminar"
  // esté disponible en cualquier página interna sin pasar por Dashboard.
  useEffect(() => {
    if (!storeId || !from || !to) return;
    dispatch(fetchStoreMetrics({ storeId, from, to }));
  }, [dispatch, storeId, from, to]);

  const pathSegment = location.pathname.split('/').pop();
  const insightSection = SECTION_MAP[pathSegment] || 'dashboard';
  const showPanel = SECTION_MAP[pathSegment] != null;

  const groups = [];
  let lastGroup = null;
  for (const item of NAV_ITEMS) {
    if (item.group !== lastGroup) {
      groups.push({ label: item.group, items: [] });
      lastGroup = item.group;
    }
    groups[groups.length - 1].items.push(item);
  }

  return (
    <div className="app-shell h-screen flex flex-col overflow-hidden">
      <Header />

      {/* Mobile hamburger bar */}
      <div className="app-surface lg:hidden px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-gray-500 hover:text-gray-300 transition"
          aria-label="Abrir menú"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {showPanel && (
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="p-2 text-gray-500 hover:text-gray-300 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
        )}
      </div>

      {/* Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 3-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT SIDEBAR */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40 w-[220px] shrink-0
            app-surface border-r border-white/[0.06]
            flex flex-col overflow-hidden
            transform transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
          `}
        >
          {/* Store header */}
          <div className="px-3 py-3 border-b border-white/[0.06]">
            <Link
              to="/"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-gray-400 transition mb-2"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Tiendas
            </Link>
            <h3 className="font-semibold text-[13px] text-white truncate">
              {store?.nombre || 'Tienda'}
            </h3>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mt-0.5">
              Hooks Analytics
            </p>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {groups.map((g) => (
              <div key={g.label} className="mb-1">
                <p className="text-[9px] font-bold text-gray-700 uppercase tracking-[1.5px] px-2.5 pt-3 pb-1.5">
                  {g.label}
                </p>
                {g.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] font-medium transition mb-0.5 ${
                        isActive
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'
                      }`
                    }
                  >
                    <span className={`shrink-0 ${location.pathname.endsWith(item.path) ? 'text-blue-400' : 'text-gray-600'}`}>
                      {ICONS[item.path]}
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* CENTER CONTENT */}
        <main className="app-shell flex-1 overflow-y-auto p-5 min-w-0">
          <Outlet />
        </main>

        {/* RIGHT ANALYSIS PANEL */}
        {showPanel && panelOpen && (
          <aside className="app-surface hidden lg:flex w-[320px] shrink-0 border-l border-white/[0.06] flex-col overflow-hidden">
            <InsightPanel
              storeId={storeId}
              section={insightSection}
              onClose={() => setPanelOpen(false)}
            />
          </aside>
        )}

        {/* Panel toggle (desktop, when closed) */}
        {showPanel && !panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-20 bg-blue-600 text-white p-2 rounded-l-lg shadow-lg hover:bg-blue-700 transition"
            title="Abrir análisis"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Mobile panel */}
      {showPanel && panelOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setPanelOpen(false)} />
          <aside className="app-surface lg:hidden fixed inset-y-0 right-0 z-50 w-[320px] max-w-[90vw] border-l border-white/[0.06] flex flex-col">
            <InsightPanel storeId={storeId} section={insightSection} onClose={() => setPanelOpen(false)} />
          </aside>
        </>
      )}
    </div>
  );
}
