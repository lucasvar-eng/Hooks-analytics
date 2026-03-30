import { useState, useEffect } from 'react';
import { useParams, NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectStore } from '../store/storeSlice';
import Header from '../components/common/Header';
import AIChatPanel from '../components/common/AIChatPanel';
import InsightPanel from '../components/insights/InsightPanel';

const NAV_ITEMS = [
  { path: 'dashboard', label: 'Resumen', icon: '📊', group: 'General' },
  { path: 'tienda', label: 'Tienda', icon: '🏪', group: 'General' },
  { path: 'meta-ads', label: 'Meta Ads', icon: '📱', group: 'Marketing' },
  { path: 'creativos', label: 'Creativos', icon: '🎨', group: 'Marketing' },
  { path: 'cashflow', label: 'Cashflow', icon: '🏦', group: 'Finanzas' },
  { path: 'costos', label: 'Costos', icon: '💰', group: 'Finanzas' },
  { path: 'productos', label: 'Productos', icon: '📦', group: 'Ventas' },
  { path: 'clientes', label: 'Clientes', icon: '👥', group: 'Ventas' },
  { path: 'topic-map', label: 'Topic Map', icon: '🗺️', group: 'Contenido' },
  { path: 'language-bank', label: 'Lenguaje', icon: '💬', group: 'Contenido' },
  { path: 'competencia', label: 'Competencia', icon: '🔍', group: 'Contenido' },
  { path: 'simulador', label: 'Simulador', icon: '🧮', group: 'IA' },
  { path: 'reportes', label: 'Reportes', icon: '📋', group: 'IA' },
  { path: 'report-builder', label: 'Reporte AI', icon: '📝', group: 'IA' },
  { path: 'alertas', label: 'Alertas', icon: '🔔', group: 'IA' },
  { path: 'settings', label: 'Settings', icon: '⚙️', group: 'Config' },
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
  const { from, to } = useSelector((state) => state.date);
  const store = useSelector((state) =>
    state.stores.stores.find((s) => s._id === storeId)
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    dispatch(selectStore(storeId));
  }, [dispatch, storeId]);

  const pathSegment = location.pathname.split('/').pop();
  const insightSection = SECTION_MAP[pathSegment] || 'dashboard';
  const showPanel = SECTION_MAP[pathSegment] != null;

  // Group nav items
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
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <Header />

      {/* Mobile hamburger bar */}
      <div className="lg:hidden px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700/60 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-gray-500 hover:text-primary-500 transition"
          aria-label="Abrir menú"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {showPanel && (
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="p-2 text-gray-500 hover:text-primary-500 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
        )}
      </div>

      {/* Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 3-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT SIDEBAR */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40 w-[220px] shrink-0
            bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700/60
            flex flex-col overflow-hidden
            transform transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
          `}
        >
          {/* Store header */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700/60">
            <Link
              to="/"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-primary-500 transition mb-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Tiendas
            </Link>
            <h3 className="font-semibold text-[13px] text-gray-900 dark:text-white truncate">
              {store?.nombre || 'Tienda'}
            </h3>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-1 px-2">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="text-[9px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-[1.5px] px-2 pt-4 pb-1">
                  {g.label}
                </p>
                {g.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[12px] transition mb-px ${
                        isActive
                          ? 'bg-primary-500/10 text-primary-500 font-semibold'
                          : 'text-gray-500 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'
                      }`
                    }
                  >
                    <span className="text-[14px] w-5 text-center">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* CENTER CONTENT */}
        <main className="flex-1 overflow-y-auto p-5 min-w-0">
          <Outlet />
        </main>

        {/* RIGHT ANALYSIS PANEL */}
        {showPanel && panelOpen && (
          <aside className="hidden lg:flex w-[340px] shrink-0 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700/60 flex-col overflow-hidden">
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
            className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-20 bg-primary-600 text-white p-2 rounded-l-lg shadow-lg hover:bg-primary-700 transition"
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
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setPanelOpen(false)} />
          <aside className="lg:hidden fixed inset-y-0 right-0 z-50 w-[340px] max-w-[90vw] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700/60 flex flex-col">
            <InsightPanel storeId={storeId} section={insightSection} onClose={() => setPanelOpen(false)} />
          </aside>
        </>
      )}

      <AIChatPanel storeId={storeId} from={from} to={to} />
    </div>
  );
}
