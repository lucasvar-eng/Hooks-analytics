/**
 * Catálogo único de segmentos RFM — labels en español, colores, descripciones
 * y CTAs accionables. Cualquier componente que muestre un segmento debe importar
 * desde acá. El backend devuelve los IDs en inglés (champions, loyal, at_risk, etc).
 */

export const SEGMENTS = {
  champions: {
    id: 'champions',
    label: 'Mejores',
    fullLabel: 'Mejores clientes',
    color: '#34d399',
    badgeClass: 'bg-emerald-500/15 text-emerald-300',
    desc: 'Los más valiosos. Compran mucho y siguen activos. Cuidalos.',
    glossary: 'Compran mucho, gastan mucho y siguen activos (score 4-4-4 o más).',
    action: 'Programa VIP, acceso anticipado, descuentos en cumpleaños, programa de referidos. No los pierdas con descuentos genéricos.',
  },
  loyal: {
    id: 'loyal',
    label: 'Fieles',
    fullLabel: 'Clientes fieles',
    color: '#60a5fa',
    badgeClass: 'bg-blue-500/15 text-blue-300',
    desc: 'Recompran seguido. Cross-sell y promo de productos relacionados.',
    glossary: 'Compran con buena frecuencia y aún están activos (3-3-3 o más). Un poco menos top que los Mejores.',
    action: 'Cross-sell (productos relacionados), upsell (versiones premium), promo de productos nuevos en categorías que ya compraron.',
  },
  at_risk: {
    id: 'at_risk',
    label: 'En riesgo',
    fullLabel: 'En riesgo de perder',
    color: '#fbbf24',
    badgeClass: 'bg-amber-500/15 text-amber-300',
    desc: 'Compraron mucho pero hace tiempo. Recuperalos antes que se vayan.',
    glossary: 'Compraban seguido y bien, pero hace tiempo que no aparecen (recencia baja, frecuencia alta).',
    action: 'Recuperación urgente. Email/WhatsApp personalizado con descuento, "te extrañamos", productos nuevos relacionados a sus compras anteriores. Cuanto antes mejor.',
  },
  lost: {
    id: 'lost',
    label: 'Perdidos',
    fullLabel: 'Perdidos',
    color: '#f87171',
    badgeClass: 'bg-red-500/15 text-red-300',
    desc: 'Compraban seguido y se fueron. Hoy no hay matches.',
    glossary: 'Compraron varias veces y hace muchísimo que no vuelven (recencia 1, frecuencia ≥ 2).',
    action: 'Última oportunidad de recuperación con oferta agresiva, o aceptar la pérdida y enfocar presupuesto en clientes activos.',
  },
  hibernating: {
    id: 'hibernating',
    label: 'Dormidos',
    fullLabel: 'Dormidos',
    color: 'rgba(255,255,255,0.5)',
    badgeClass: 'bg-white/[0.06] text-gray-300',
    desc: 'Una compra hace mucho. Re-engagement masivo o aceptar la pérdida.',
    glossary: 'Compraron una sola vez hace mucho tiempo y no volvieron. Es el grupo más grande en la mayoría de tiendas.',
    action: 'Campaña de re-engagement masivo barata (email). No invertir mucho — el retorno por cliente es bajo, pero el volumen ayuda.',
  },
  new: {
    id: 'new',
    label: 'Nuevos',
    fullLabel: 'Nuevos clientes',
    color: '#67e8f9',
    badgeClass: 'bg-cyan-500/15 text-cyan-300',
    desc: 'Una sola compra reciente. Convertilos en Fieles con la segunda.',
    glossary: 'Acaban de hacer su primera compra reciente. Aún no sabés si vuelven o no.',
    action: 'Flujo de bienvenida automatizado, instructivo del producto, oferta para 2da compra a los 15-30 días. Convertirlos en Fieles es la prioridad.',
  },
  promising: {
    id: 'promising',
    label: 'Prometedores',
    fullLabel: 'Prometedores',
    color: '#c084fc',
    badgeClass: 'bg-purple-500/15 text-purple-300',
    desc: 'Compraron hace poco — empujá la segunda compra.',
    glossary: 'Compraron hace poco pero gastan poco o aún no tienen frecuencia (recencia alta, frecuencia y monto bajos).',
    action: 'Nurturing — contenido de valor, productos complementarios, animarlos a probar más categorías. Pueden convertirse en Fieles si los cuidás.',
  },
  potential: {
    id: 'potential',
    label: 'Potenciales',
    fullLabel: 'Potenciales',
    color: '#f9a8d4',
    badgeClass: 'bg-pink-500/15 text-pink-300',
    desc: 'Tickets altos, pocas compras. Subí la frecuencia con remarketing.',
    glossary: 'Tickets altos pero pocas compras. Tienen poder de compra pero no le compran seguido a la tienda.',
    action: 'Remarketing dirigido, ofertas personalizadas según historial, productos exclusivos. El objetivo es subir la frecuencia.',
  },
};

// Orden canónico para listados/chips/barra — top valor primero
export const SEGMENT_ORDER = [
  'champions',
  'loyal',
  'at_risk',
  'potential',
  'promising',
  'new',
  'hibernating',
  'lost',
];

export function getSegment(id) {
  return SEGMENTS[id] || {
    id,
    label: id || '—',
    fullLabel: id || '—',
    color: 'rgba(255,255,255,0.4)',
    badgeClass: 'bg-white/[0.06] text-gray-300',
    desc: '',
    glossary: '',
    action: '',
  };
}
