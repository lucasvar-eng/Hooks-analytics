export const APPEARANCE_STORAGE_KEY = 'hooks-appearance';

export const DEFAULT_APPEARANCE = {
  contrast: 'normal',
  accent: 'blue',
  colors: {
    accent: '#3b82f6',
    accentHover: '#2563eb',
    accentSoft: 'rgba(59,130,246,0.18)',
    bgBase: '#0a0a0a',
    bgSurface: '#111111',
    bgCard: '#161616',
    bgElevated: '#1c1c1c',
    textPrimary: '#f5f5f5',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
    borderDefault: 'rgba(255,255,255,0.08)',
    borderSubtle: 'rgba(255,255,255,0.06)',
  },
};

const PRESET_ACCENTS = {
  blue: {
    accent: '#3b82f6',
    accentHover: '#2563eb',
    accentSoft: 'rgba(59,130,246,0.18)',
  },
  cyan: {
    accent: '#06b6d4',
    accentHover: '#0891b2',
    accentSoft: 'rgba(6,182,212,0.18)',
  },
  green: {
    accent: '#22c55e',
    accentHover: '#16a34a',
    accentSoft: 'rgba(34,197,94,0.18)',
  },
  custom: null,
};

function normalizeHex(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  return fallback;
}

function hexToRgba(hex, alpha) {
  const safe = normalizeHex(hex, '#3b82f6').slice(1);
  const num = parseInt(safe, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shiftHex(hex, amount = 0) {
  const safe = normalizeHex(hex, '#3b82f6').slice(1);
  const num = parseInt(safe, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

export function getSavedAppearance() {
  const saved = localStorage.getItem(APPEARANCE_STORAGE_KEY);
  if (!saved) return DEFAULT_APPEARANCE;

  try {
    const parsed = JSON.parse(saved);
    const preset = PRESET_ACCENTS[parsed.accent] || PRESET_ACCENTS.blue;
    const accent = normalizeHex(parsed?.colors?.accent || preset.accent, preset.accent);
    return {
      contrast: parsed.contrast || DEFAULT_APPEARANCE.contrast,
      accent: parsed.accent || DEFAULT_APPEARANCE.accent,
      colors: {
        accent,
        accentHover: normalizeHex(parsed?.colors?.accentHover, parsed.accent === 'custom' ? shiftHex(accent, -24) : preset.accentHover),
        accentSoft: parsed?.colors?.accentSoft || hexToRgba(accent, 0.18),
        bgBase: normalizeHex(parsed?.colors?.bgBase, DEFAULT_APPEARANCE.colors.bgBase),
        bgSurface: normalizeHex(parsed?.colors?.bgSurface, DEFAULT_APPEARANCE.colors.bgSurface),
        bgCard: normalizeHex(parsed?.colors?.bgCard, DEFAULT_APPEARANCE.colors.bgCard),
        bgElevated: normalizeHex(parsed?.colors?.bgElevated, DEFAULT_APPEARANCE.colors.bgElevated),
        textPrimary: normalizeHex(parsed?.colors?.textPrimary, DEFAULT_APPEARANCE.colors.textPrimary),
        textSecondary: normalizeHex(parsed?.colors?.textSecondary, DEFAULT_APPEARANCE.colors.textSecondary),
        textMuted: normalizeHex(parsed?.colors?.textMuted, DEFAULT_APPEARANCE.colors.textMuted),
        borderDefault: parsed?.colors?.borderDefault || DEFAULT_APPEARANCE.colors.borderDefault,
        borderSubtle: parsed?.colors?.borderSubtle || DEFAULT_APPEARANCE.colors.borderSubtle,
      },
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function applyAppearance(appearance) {
  const merged = {
    ...DEFAULT_APPEARANCE,
    ...appearance,
    colors: {
      ...DEFAULT_APPEARANCE.colors,
      ...(appearance?.colors || {}),
    },
  };

  document.documentElement.dataset.contrast = merged.contrast;
  document.documentElement.dataset.accent = merged.accent;

  document.documentElement.style.setProperty('--bg-base', merged.colors.bgBase);
  document.documentElement.style.setProperty('--bg-surface', merged.colors.bgSurface);
  document.documentElement.style.setProperty('--bg-card', merged.colors.bgCard);
  document.documentElement.style.setProperty('--bg-elevated', merged.colors.bgElevated);
  document.documentElement.style.setProperty('--text-primary', merged.colors.textPrimary);
  document.documentElement.style.setProperty('--text-secondary', merged.colors.textSecondary);
  document.documentElement.style.setProperty('--text-muted', merged.colors.textMuted);
  document.documentElement.style.setProperty('--accent', merged.colors.accent);
  document.documentElement.style.setProperty('--accent-hover', merged.colors.accentHover);
  document.documentElement.style.setProperty('--accent-soft', merged.colors.accentSoft);
  document.documentElement.style.setProperty('--border-default', merged.colors.borderDefault);
  document.documentElement.style.setProperty('--border-subtle', merged.colors.borderSubtle);
}

export function saveAppearance(appearance) {
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
}

export function buildAccentColors(accent, mode = 'preset') {
  const safeAccent = normalizeHex(accent, DEFAULT_APPEARANCE.colors.accent);
  if (mode !== 'custom') {
    const preset = PRESET_ACCENTS[mode] || PRESET_ACCENTS.blue;
    return {
      accent: preset.accent,
      accentHover: preset.accentHover,
      accentSoft: preset.accentSoft,
    };
  }

  return {
    accent: safeAccent,
    accentHover: shiftHex(safeAccent, -24),
    accentSoft: hexToRgba(safeAccent, 0.18),
  };
}
