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
      className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-white/[0.05] transition"
      title={dark ? 'Modo claro' : 'Modo oscuro'}
    >
      {dark ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="h-[52px] min-h-[52px] bg-[#0f0f0f] border-b border-white/[0.06] px-4 flex items-center shrink-0">
      <div className="w-full flex items-center justify-between gap-4">
        {/* Logo */}
        <a href="/" className="shrink-0">
          <span className="text-[13px] font-extrabold tracking-[2.5px] uppercase">
            <span className="text-blue-500">ECOM</span>
            <span className="text-gray-600"> ANALYTICS</span>
          </span>
        </a>

        {/* Date Range */}
        <DateRangePicker />

        {/* Right actions */}
        <div className="flex items-center gap-1 shrink-0">
          <ThemeToggle />

          {/* Notifications */}
          <button className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-white/[0.05] transition" title="Notificaciones">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          {/* Help */}
          <button className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-white/[0.05] transition" title="Ayuda">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <div className="w-px h-4 bg-white/[0.08] mx-1" />

          {user?.role === 'admin' && (
            <Link
              to="/admin/users"
              className="text-[11px] text-gray-600 hover:text-gray-400 transition px-2 py-1.5 rounded-lg hover:bg-white/[0.05]"
            >
              Usuarios
            </Link>
          )}

          {/* User avatar */}
          <Link
            to="/profile"
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/[0.05] transition"
          >
            <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <span className="text-[10px] font-bold text-blue-400">
                {user?.nombre?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <span className="text-[12px] text-gray-400 hidden sm:block">{user?.nombre}</span>
          </Link>

          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-gray-700 hover:text-red-500 hover:bg-red-500/10 transition"
            title="Salir"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}