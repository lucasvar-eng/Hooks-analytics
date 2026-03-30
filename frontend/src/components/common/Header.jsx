import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import DateRangePicker from './DateRangePicker';

function ThemeToggle() {
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-md text-gray-400 hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      title={dark ? 'Modo claro' : 'Modo oscuro'}
    >
      {dark ? (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="h-[50px] min-h-[50px] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700/60 px-4 flex items-center">
      <div className="w-full flex items-center justify-between gap-4">
        {/* Logo */}
        <a
          href="/"
          className="text-[13px] font-extrabold tracking-[2px] text-white shrink-0 uppercase"
        >
          <span className="text-primary-500">ECOM</span>{' '}
          <span className="text-gray-400 dark:text-gray-500">ANALYTICS</span>
        </a>

        {/* Date Range */}
        <DateRangePicker />

        {/* User menu */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ThemeToggle />
          {user?.role === 'admin' && (
            <Link
              to="/admin/users"
              className="text-[11px] text-gray-500 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 transition"
            >
              Usuarios
            </Link>
          )}
          <Link
            to="/profile"
            className="text-[11px] text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition"
          >
            {user?.nombre}
          </Link>
          <button
            onClick={logout}
            className="text-[10px] text-gray-400 hover:text-red-500 transition"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
