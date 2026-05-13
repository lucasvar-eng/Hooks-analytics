import { useEffect } from 'react';

/**
 * Glosario de competencia: explica awareness levels, ángulos, territorios,
 * objeciones, oportunidades y el flujo de análisis AI.
 */
export default function GlossaryModalCompetencia({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[#131316] border border-white/[0.08] rounded-2xl max-w-[880px] w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-3 px-7 py-5 border-b border-white/[0.06] sticky top-0 bg-[#131316] z-10">
          <div>
            <p className="text-[18px] font-bold text-white">Glosario de competencia</p>
            <p className="text-[12.5px] text-gray-300 mt-1">Qué significa cada campo y cómo se usa el análisis competitivo</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/[0.04] border border-white/[0.08] w-8 h-8 rounded-full text-white text-[16px] hover:bg-white/[0.1] transition flex-shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="px-7 pt-1 pb-7">

          <Section title="Flujo de análisis">
            <Item name="Cómo usar la pestaña">
              <p>1. <strong className="text-white">Agregás competidor</strong> con nombre + URL.</p>
              <p className="mt-1.5">2. Ejecutás <strong className="text-white">"Analizar con AI"</strong>. La IA navega el sitio, infiere oferta principal, ángulos, posicionamiento y devuelve un informe en markdown.</p>
              <p className="mt-1.5">3. Generás <strong className="text-white">oportunidades focalizadas</strong>: la IA compara al competidor con tu tienda y sugiere 3-5 acciones concretas.</p>
              <p className="mt-1.5">4. <strong className="text-white">Comparás</strong> 2-3 competidores lado a lado para detectar patrones (qué hace cada uno distinto).</p>
            </Item>
          </Section>

          <Section title="Campos del competidor">
            <Item name="Nombre">
              Cómo querés llamarlo en la app. Suele ser la marca tal como la conoce el cliente.
            </Item>
            <Item name="URL del sitio">
              <p>Dominio principal del competidor. Es la pieza más importante: sin URL, la IA no puede analizar.</p>
              <p className="mt-1.5 text-gray-300"><strong className="text-blue-300">Tip:</strong> usar el dominio raíz (stockcenter.com.ar) y no una landing específica para que el análisis cubra el sitio completo.</p>
            </Item>
            <Item name="Posicionamiento">
              Frase corta que resume cómo se presenta al mercado. Ej: <em className="text-gray-300">"Marketplace de marcas premium"</em>, <em className="text-gray-300">"Cadena nacional con retiro en sucursales"</em>.
            </Item>
            <Item name="Oferta principal">
              El gancho comercial más visible: cuotas, descuentos, envío, programa de fidelidad. Lo primero que ve un visitante.
            </Item>
            <Item name="Avatar">
              Persona objetivo del competidor — quién es su cliente ideal. Ej: <em className="text-gray-300">"Deportista amateur 18-35"</em>, <em className="text-gray-300">"Familia argentina amplia"</em>.
            </Item>
            <Item name="Awareness target">
              Nivel de consciencia del cliente al que apunta el copy (modelo Eugene Schwartz):
              <p className="mt-1.5"><strong className="text-white">No consciente</strong>: ni siquiera sabe que tiene el problema.</p>
              <p><strong className="text-white">Consciente del problema</strong>: sabe que tiene un dolor pero no la solución.</p>
              <p><strong className="text-white">Consciente de la solución</strong>: conoce que existe la categoría (ej. "zapatillas running") pero no la marca.</p>
              <p><strong className="text-white">Consciente del producto</strong>: conoce marcas y compara.</p>
              <p><strong className="text-white">Muy consciente</strong>: ya conoce tu producto, evalúa precio/promo.</p>
            </Item>
          </Section>

          <Section title="Framework copy">
            <Item name="Ángulos">
              Las palancas que el competidor usa en su mensaje. Ej: <em className="text-gray-300">"precio sin interés"</em>, <em className="text-gray-300">"autoridad de marca"</em>, <em className="text-gray-300">"transformación"</em>, <em className="text-gray-300">"cuotas largas"</em>.
              <p className="mt-1.5 text-gray-300"><strong className="text-blue-300">Para qué sirve:</strong> identificar qué ángulos compiten en el mercado y cuáles no están ocupados (oportunidad de diferenciación).</p>
            </Item>
            <Item name="Territorios">
              El campo emocional o conceptual donde compite. Ej: <em className="text-gray-300">"confianza"</em>, <em className="text-gray-300">"urgencia"</em>, <em className="text-gray-300">"pasión deportiva"</em>, <em className="text-gray-300">"accesibilidad"</em>.
              <p className="mt-1.5 text-gray-300"><strong className="text-blue-300">Diferencia con ángulos:</strong> el ángulo es táctico (el copy concreto), el territorio es estratégico (el concepto que dueñás).</p>
            </Item>
            <Item name="Objeciones detectadas">
              Razones por las que un cliente potencial podría no comprarle al competidor. Ej: <em className="text-gray-300">"precio alto"</em>, <em className="text-gray-300">"stock real"</em>, <em className="text-gray-300">"talles"</em>.
              <p className="mt-1.5 text-gray-300"><strong className="text-blue-300">Para qué sirve:</strong> tus mejores ángulos a menudo nacen de las objeciones que el competidor no resuelve bien.</p>
            </Item>
          </Section>

          <Section title="Outputs de la IA">
            <Item name="Análisis completo (markdown)">
              Informe estructurado generado por la IA navegando el sitio. Incluye foto del posicionamiento, ángulos detectados, fortalezas/debilidades y observaciones.
            </Item>
            <Item name="Oportunidades focalizadas">
              <p>Lista corta de acciones concretas que TU tienda podría hacer para diferenciarse o cerrar gaps detectados.</p>
              <p className="mt-1.5">Cada oportunidad tiene 3 partes:</p>
              <p className="mt-1.5"><strong className="text-white">Título</strong>: qué hacer (ej. "Crear sección Outlet permanente").</p>
              <p><strong className="text-white">Gap</strong>: por qué tiene sentido (ej. "Dexter tiene outlet permanente que les genera recurrencia").</p>
              <p><strong className="text-white">Acción</strong>: cómo ejecutarlo (ej. "Identificar 30 SKUs con bajo stock y crear landing /outlet").</p>
            </Item>
          </Section>

        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-6">
      <h3 className="text-[11px] font-bold uppercase tracking-[1.5px] text-blue-300 mb-3 pb-2 border-b border-blue-500/15">{title}</h3>
      {children}
    </div>
  );
}

function Item({ name, children }) {
  return (
    <div className="py-3 border-b border-white/[0.04] last:border-b-0">
      <p className="text-[13.5px] font-bold text-white mb-1.5">{name}</p>
      <div className="text-[12.5px] text-gray-100 leading-relaxed">{children}</div>
    </div>
  );
}
