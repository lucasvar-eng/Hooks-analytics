/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  // Clases construidas dinámicamente vía template literal (className={`...--${tone}`})
  // no son detectadas por el extractor del scanner. Hay que listarlas o usar regex.
  safelist: [
    {
      // Cualquier BEM modifier de los componentes del Resumen.
      pattern: /^resumen-(kpi|kpi__delta|alert-icon|highlight__rank|highlight__value|source-row__brand-icon)(--[a-z-]+)?$/,
    },
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Darker dark-mode palette matching v4 prototype
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          750: '#2a2a2a',
          800: '#1a1a1a',
          850: '#141414',
          900: '#0e0e0e',
          950: '#080808',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
    },
  },
  plugins: [],
};
