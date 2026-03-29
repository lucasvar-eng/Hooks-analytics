import { useState, useEffect } from 'react';
import { useParams, NavLink, Outlet, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectStore } from '../store/storeSlice';
import Header from '../components/common/Header';
import AIChatPanel from '../components/common/AIChatPanel';

const NAV_ITEMS = [
  { path: 'dashboard', label: 'Dashboard' },
  // Fuentes de datos
  { path: 'tienda', label: 'Tienda', section: true },
  { path: 'meta-ads', label: 'Meta Ads' },
  // Análisis
  { path: 'cashflow', label: 'Cashflow' },
  { path: 'costos', label: 'Costos & P&L' },
  { path: 'productos', label: 'Productos' },
  { path: 'clientes', label: 'Clientes' },
  { path: 'creativos', label: 'Creativos' },
  { path: 'topic-map', label: 'Topic Map' },
  { path: 'language-bank', label: 'Lenguaje' },
  { path: 'competencia', label: 'Competencia' },
  { path: 'simulador', label: 'Simulador' },
  { path: 'reportes', label: 'Reportes' },
  { path: 'report-builder', label: 'Generar Reporte' },
  { path: 'alertas', label: 'Alertas' },
  // Config
  { path: 'settings', label: 'Settings' },
];

export default function StoreLayout() {
  const { storeId } = useParams();
  const dispatch = useDispatch();
  const { from, to } = useSelector((state) => state.date);
  const store = useSelector((state) =>
    state.stores.stores.find((s) => s._id === storeId)
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    dispatch(selectStore(storeId));
  }, [dispatch, storeId]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      {/* Mobile hamburger bar */}
      <div className="md:hidden px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
          aria-label="Abrir menú"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Backdrop (mobile only) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed md:static inset-y-0 left-0 z-40 w-56 shrink-0
            bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
            min-h-screen md:min-h-[calc(100vh-57px)]
            transform transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0
          `}
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <Link
              to="/"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition mb-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Todas las tiendas
            </Link>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
              {store?.nombre || 'Tienda'}
            </h3>
          </div>
          <nav className="p-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-sm transition ${
                    item.disabled
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed pointer-events-none'
                      : isActive
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
                onClickCapture={(e) => item.disabled && e.preventDefault()}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6 min-w-0">
          <Outlet />
        </main>
      </div>

      <AIChatPanel storeId={storeId} from={from} to={to} />
    </div>
  );
}
