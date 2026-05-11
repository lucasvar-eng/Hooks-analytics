import { Link } from 'react-router-dom';

/**
 * Mini card al pie del Resumen con una tabla compacta de 4-5 items.
 *
 * Props:
 *   title: string
 *   linkTo, linkLabel: si presentes, muestra link arriba a la derecha
 *   rows: [{ rank?: string | number, rankTone?: 'success'|'warn'|'danger'|'neutral',
 *           name: string, meta?: string, value: string, valueTone?: same }]
 *   emptyText: string a mostrar si rows vacío
 */
export default function HighlightCard({ title, linkTo, linkLabel = 'Ver todos', rows = [], emptyText = 'Sin datos.' }) {
  return (
    <div className="resumen-highlight">
      <div className="resumen-highlight__header">
        <span className="resumen-highlight__title">{title}</span>
        {linkTo && (
          <Link to={linkTo} className="resumen-highlight__link">
            {linkLabel} →
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-gray-500">{emptyText}</div>
      ) : (
        <div>
          {rows.map((row, i) => (
            <div key={i} className="resumen-highlight__row">
              {row.rank != null && (
                <span className={`resumen-highlight__rank resumen-highlight__rank--${row.rankTone || 'neutral'}`}>
                  {row.rank}
                </span>
              )}
              <span className="resumen-highlight__name">
                {row.name}
                {row.meta && <span className="resumen-highlight__name-meta">— {row.meta}</span>}
              </span>
              {row.value != null && (
                <span className={`resumen-highlight__value resumen-highlight__value--${row.valueTone || 'neutral'}`}>
                  {row.value}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
