import { useAuth } from '../../hooks/useAuth';
import DateRangePicker from './DateRangePicker';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        {/* Logo */}
        <a
          href="/"
          className="text-xl font-bold text-primary-600 dark:text-primary-400 shrink-0"
        >
          ecom-analytics
        </a>

        {/* Date Range */}
        <DateRangePicker />

        {/* User menu */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {user?.nombre}
          </span>
          <button
            onClick={logout}
            className="text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
