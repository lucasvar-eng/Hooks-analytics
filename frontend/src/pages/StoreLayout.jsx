import { useEffect } from 'react';
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
  { path: 'competencia', label: 'Competencia' },
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

  useEffect(() => {
    dispatch(selectStore(storeId));
  }, [dispatch, storeId]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-[calc(100vh-57px)]">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <Link
              to="/"
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
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-sm transition ${
                    item.disabled
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed pointer-events-none'
                      : isActive
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
                onClick={(e) => item.disabled && e.preventDefault()}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>

      <AIChatPanel storeId={storeId} from={from} to={to} />
    </div>
  );
}
