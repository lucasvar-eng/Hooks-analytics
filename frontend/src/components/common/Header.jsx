import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import DateRangePicker from './DateRangePicker';
import LastUpdateChip from './LastUpdateChip';
import {
  applyAppearance,
  buildAccentColors,
  DEFAULT_APPEARANCE,
  getSavedAppearance,
  saveAppearance,
} from '../../utils/appearance';

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

function AppearanceControl() {
  const [open, setOpen] = useState(false);
  const [appearance, setAppearance] = useState(() => getSavedAppearance());

  useEffect(() => {
    applyAppearance(appearance);
    saveAppearance(appearance);
  }, [appearance]);

  const setContrast = (contrast) => setAppearance((prev) => ({ ...prev, contrast }));
  const setAccent = (accent) =>
    setAppearance((prev) => ({
      ...prev,
      accent,
      colors: {
        ...prev.colors,
        ...buildAccentColors(prev.colors.accent, accent),
      },
    }));
  const setColor = (key, value) =>
    setAppearance((prev) => ({
      ...prev,
      accent: key === 'accent' ? 'custom' : prev.accent,
      colors: {
        ...prev.colors,
        [key]: value,
        ...(key === 'accent' ? buildAccentColors(value, 'custom') : {}),
      },
    }));
  const reset = () => setAppearance(DEFAULT_APPEARANCE);

  const ColorField = ({ label, value, onChange, placeholder }) => (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[1.4px] text-gray-400">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-lg border border-white/[0.08] bg-transparent p-1 cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-dark w-full"
          placeholder={placeholder}
        />
      </div>
    </label>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="header-icon-button"
        title="Apariencia"
      >
        <span className="text-[11px] font-semibold tracking-wide">Aa</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[320px] rounded-xl border border-white/[0.08] bg-[var(--bg-surface)] p-3 shadow-2xl shadow-black/50">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-gray-400">Texto</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {[
                  { id: 'normal', label: 'Normal' },
                  { id: 'high', label: 'Alto contraste' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setContrast(option.id)}
                    className={`rounded-lg px-2.5 py-2 text-[11px] font-medium transition ${
                      appearance.contrast === option.id
                        ? 'bg-app-accent text-white'
                        : 'bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-gray-400">Acento</p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {[
                  { id: 'blue', label: 'Azul', swatch: '#3b82f6' },
                  { id: 'cyan', label: 'Cian', swatch: '#06b6d4' },
                  { id: 'green', label: 'Verde', swatch: '#22c55e' },
                  { id: 'custom', label: 'Hex', swatch: appearance.colors.accent },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setAccent(option.id)}
                    className={`rounded-lg border px-2 py-2 text-[11px] font-medium transition ${
                      appearance.accent === option.id
                        ? 'border-white/[0.18] bg-white/[0.08] text-white'
                        : 'border-white/[0.06] bg-white/[0.03] text-gray-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span
                      className="mx-auto mb-1 block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: option.swatch }}
                    />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <ColorField
                label="Hex acento"
                value={appearance.colors.accent}
                onChange={(value) => setColor('accent', value)}
                placeholder="#3b82f6"
              />
              <ColorField
                label="Fondo base"
                value={appearance.colors.bgBase}
                onChange={(value) => setColor('bgBase', value)}
                placeholder="#0a0a0a"
              />
              <ColorField
                label="Menús / paneles"
                value={appearance.colors.bgSurface}
                onChange={(value) => setColor('bgSurface', value)}
                placeholder="#111111"
              />
              <ColorField
                label="Tarjetas"
                value={appearance.colors.bgCard}
                onChange={(value) => setColor('bgCard', value)}
                placeholder="#161616"
              />
              <ColorField
                label="Texto principal"
                value={appearance.colors.textPrimary}
                onChange={(value) => setColor('textPrimary', value)}
                placeholder="#f5f5f5"
              />
              <ColorField
                label="Texto secundario"
                value={appearance.colors.textSecondary}
                onChange={(value) => setColor('textSecondary', value)}
                placeholder="#9ca3af"
              />
            </div>

            <div className="flex justify-end">
              <button onClick={reset} className="btn-ghost text-[11px]">
                Resetear tema
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-white/[0.06] px-4 py-3 shrink-0" style={{ background: 'var(--bg-surface)' }}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {/* Logo */}
        <div className="flex items-center justify-between gap-3 xl:min-w-[220px] xl:justify-start">
          <a href="/" className="shrink-0">
            <span className="text-[13px] font-extrabold tracking-[2.5px] uppercase">
              <span className="text-app-accent">HOOKS</span>
              <span className="text-app-muted"> ANALYTICS</span>
            </span>
          </a>

          <div className="flex items-center gap-1 xl:hidden">
            <AppearanceControl />
            <ThemeToggle />
          </div>
        </div>

        {/* Last update + Date Range */}
        <div className="min-w-0 xl:flex-1 xl:flex xl:items-center xl:justify-center xl:gap-3">
          <LastUpdateChip />
          <DateRangePicker />
        </div>

        {/* Right actions */}
        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 xl:min-w-[220px] xl:flex-nowrap">
          <div className="hidden xl:flex">
            <AppearanceControl />
          </div>

          <div className="hidden xl:flex">
            <ThemeToggle />
          </div>

          {/* Notifications */}
          <button className="header-icon-button hidden sm:inline-flex" title="Notificaciones">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          {/* Help */}
          <button className="header-icon-button hidden sm:inline-flex" title="Ayuda">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <div className="hidden h-4 w-px bg-white/[0.08] xl:block" />

          {user?.role === 'admin' && (
            <Link
              to="/admin/users"
              className="header-link"
            >
              Usuarios
            </Link>
          )}

          {/* User avatar */}
          <Link
            to="/profile"
            className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-white/[0.05]"
          >
            <div className="user-avatar-accent">
              <span className="text-[10px] font-bold text-white">
                {user?.nombre?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <span className="text-[12px] text-app-secondary hidden sm:block">{user?.nombre}</span>
          </Link>

          <button
            onClick={logout}
            className="header-icon-button"
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
