/**
 * Logos para las fuentes de datos del Resumen.
 * Meta y Tiendanube usan los PNG oficiales (frontend/src/assets/).
 * P&L queda como SVG inline (no es una marca externa).
 */

import metaLogoUrl from '../../assets/logo-meta.png';
import tnLogoUrl from '../../assets/logo-tiendanube.png';

export function MetaLogo({ size = 28 }) {
  return (
    <img
      src={metaLogoUrl}
      width={size}
      height={size}
      alt="Meta"
      style={{ borderRadius: 7, display: 'block', objectFit: 'cover' }}
    />
  );
}

export function TiendanubeLogo({ size = 28 }) {
  return (
    <img
      src={tnLogoUrl}
      width={size}
      height={size}
      alt="Tiendanube"
      style={{ borderRadius: 7, display: 'block', objectFit: 'cover' }}
    />
  );
}

export function PnlLogo({ size = 28 }) {
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
