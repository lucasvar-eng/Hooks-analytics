import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import DateRangePicker from './DateRangePicker';
import LastUpdateChip from './LastUpdateChip';
import NotificationsBell from './NotificationsBell';
import {
  applyAppearance,
  buildAccentColors,
  DEFAULT_APPEARANCE,
  getSavedAppearance,
  saveAppearance,
} from '../../utils/appearance';

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

          <NotificationsBell />

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
