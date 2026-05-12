/**
 * Logos SVG inline para las fuentes de datos del Resumen.
 * Recreados a partir de las brand marks oficiales. Si necesitás los SVG
 * exactos de Meta y Tiendanube, reemplazá estos componentes por los
 * archivos oficiales (assets en /frontend/src/assets/).
 */

export function MetaLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" aria-label="Meta">
      <defs>
        <linearGradient id="metaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0064E0" />
          <stop offset="50%" stopColor="#0082FB" />
          <stop offset="100%" stopColor="#0064E0" />
        </linearGradient>
      </defs>
      <path
        d="M5.5 19.5c0-4.5 2.8-9 7-9 3.2 0 5.5 2.5 7 6 1.5 3.5 3.8 6 7 6 4.2 0 7-4.5 7-9s-2.8-9-7-9c-3.2 0-5.5 2.5-7 6-1.5 3.5-3.8 6-7 6-4.2 0-7-4.5-7-9"
        fill="none"
        stroke="url(#metaGradient)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TiendanubeLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" aria-label="Tiendanube">
      <rect width="36" height="36" rx="7" fill="#1864F2" />
      <path
        d="M11 14.5c-2.2 0-4 1.8-4 4s1.8 4 4 4h5v-8h-5zm14 0c-2.2 0-4 1.8-4 4s1.8 4 4 4h0c2.2 0 4-1.8 4-4s-1.8-4-4-4zm-10 0c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm10 0c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"
        fill="white"
      />
      <circle cx="15" cy="18.5" r="4" fill="#1864F2" />
      <circle cx="21" cy="18.5" r="4" fill="#1864F2" />
    </svg>
  );
}

export function PnlLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" aria-label="P&L">
      <defs>
        <linearGradient id="pnlGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="7" fill="url(#pnlGradient)" />
      <path
        d="M9 25v-4h2v4H9zm4 0v-9h2v9h-2zm4 0V12h2v13h-2zm4 0v-7h2v7h-2zm4 0v-11h2v11h-2z"
        fill="white"
      />
    </svg>
  );
}
