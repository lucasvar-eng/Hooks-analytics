import { useEffect } from 'react';
import { SEGMENTS, SEGMENT_ORDER } from './segmentsCatalog';

/**
 * Modal con glosario de métricas y segmentos.
 * Estructura:
 *  - Métricas generales (Gasto total, Ticket promedio, etc.)
 *  - Score RFM
 *  - Segmentos RFM (los 8)
 *  - Retención y cohortes
 *  - Concentración
 *
 * Props:
 *   open: bool
 *   onClose: () => void
 */
export default function GlossaryModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#131316] border border-white/[0.08] rounded-2xl max-w-[880px] w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-3 px-7 py-5 border-b border-white/[0.06] sticky top-0 bg-[#131316] z-10">
          <div>
            <p className="text-[18px] font-bold text-white">Glosario de métricas</p>
            <p className="text-[12.5px] text-gray-300 mt-1">Qué significa cada concepto y cómo usarlo en tu negocio</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/[0.04] border border-white/[0.08] w-8 h-8 rounded-full text-white text-[16px] hover:bg-white/[0.1] transition flex-shrink-0"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="px-7 pt-1 pb-7">

          <GlossarySection title="Métricas generales">
            <GlossaryItem name="Gasto total (LTV)" what="Cuánto gastó un cliente en total a lo largo de toda su vida en la tienda — sumando todas sus compras. En marketing se llama LTV o 'Lifetime Value'.">
              <strong className="text-blue-300">Para qué sirve:</strong> identificar a los clientes más valiosos. Un cliente con gasto total alto vale más invertir en retención que conseguir uno nuevo.
            </GlossaryItem>
            <GlossaryItem name="Ticket promedio" what="Cuánto gasta el cliente en promedio cada vez que compra. Se calcula: gasto total dividido cantidad de compras.">
              <strong className="text-blue-300">Para qué sirve:</strong> detectar quién pide más por orden. Útil para upsell y para definir mínimos de envío gratis.
            </GlossaryItem>
            <GlossaryItem name="Días sin comprar (Recencia)" what="Cuántos días pasaron desde la última compra del cliente. Mientras menos, más activo está.">
              <strong className="text-blue-300">Para qué sirve:</strong> es el indicador más fuerte de probabilidad de que vuelva a comprar. Si pasaron 30 días, probablemente vuelva. Si pasaron 300, ya casi no vuelve solo.
            </GlossaryItem>
            <GlossaryItem name="Tasa de recompra" what="% de tus clientes que compraron más de una vez. Si tenés 100 clientes y 20 hicieron una 2da compra, tu tasa es 20%.">
              <strong className="text-blue-300">Para qué sirve:</strong> mide qué tan bien retenés clientes. Una tienda saludable de ecom tiene entre 20-40%. Menos de 15% indica que sos muy dependiente de adquisición.
            </GlossaryItem>
            <GlossaryItem name="Demora 2da compra" what="Cuántos días tardó un cliente entre su primera y segunda compra.">
              <strong className="text-blue-300">Para qué sirve:</strong> define cuándo conviene mandar un email/promo de retención. Si la mayoría compra de nuevo a los 30 días, ahí es donde hay que tocar.
            </GlossaryItem>
          </GlossarySection>

          <GlossarySection title="Score RFM (Recencia · Frecuencia · Monto)">
            <div className="py-3 text-[12.5px] text-gray-100 leading-relaxed">
              <p>Un puntaje de 3 dígitos que clasifica a cada cliente del 1 al 5 en cada dimensión. Por ejemplo "5-4-3" significa: muy reciente (5), bastante frecuente (4), gasto medio (3).</p>
              <p className="mt-3"><strong className="text-white">R · Recencia:</strong> qué tan reciente fue su última compra. 5 = compró muy reciente · 1 = hace mucho.</p>
              <p className="mt-1"><strong className="text-white">F · Frecuencia:</strong> cuántas veces compró. 5 = compra muchísimo · 1 = solo una vez.</p>
              <p className="mt-1"><strong className="text-white">M · Monto:</strong> cuánto gastó en total. 5 = de los que más gastan · 1 = de los que menos.</p>
              <p className="mt-3 text-gray-300"><strong className="text-blue-300">Para qué sirve:</strong> es la base de la segmentación. Un 5-5-5 es tu mejor cliente; un 1-1-1 está perdido. El score se calcula automáticamente comparando a cada cliente con el resto de tu base.</p>
            </div>
          </GlossarySection>

          <GlossarySection title="Segmentos RFM">
            {SEGMENT_ORDER.map((id) => {
              const seg = SEGMENTS[id];
              return (
                <div key={id} className="py-3 border-b border-white/[0.04] last:border-b-0">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${seg.badgeClass}`}>
                      {seg.label}
                    </span>
                    <span className="text-[13.5px] font-bold text-white">{seg.fullLabel}</span>
                  </div>
                  <p className="text-[12.5px] text-gray-100 leading-relaxed">{seg.glossary}</p>
                  <p className="text-[12.5px] text-gray-300 leading-relaxed mt-1.5">
                    <strong className="text-blue-300">Acción:</strong> {seg.action}
                  </p>
                </div>
              );
            })}
          </GlossarySection>

          <GlossarySection title="Retención y cohortes">
            <GlossaryItem name="Cohorte (mes de alta)" what='Un grupo de clientes que compraron por primera vez en el mismo mes. Por ejemplo, la cohorte "2025-10" son todos los que estrenaron tu tienda en octubre 2025.'>
              <strong className="text-blue-300">Para qué sirve:</strong> comparar grupos en igualdad de condiciones. Si la cohorte de octubre retiene mejor que la de septiembre, algo que cambiaste en octubre funcionó.
            </GlossaryItem>
            <GlossaryItem name="Retención (% en M0, M1, M2...)" what="% de clientes de una cohorte que volvieron a comprar N meses después. M0 = el mes de su primera compra (siempre 100%). M3 = 3 meses después.">
              <strong className="text-blue-300">Para qué sirve:</strong> medir si tu tienda retiene clientes. Si M1 es alto (más del 15%) es buena señal — significa que la gente vuelve pronto.
            </GlossaryItem>
          </GlossarySection>

          <GlossarySection title="Concentración">
            <GlossaryItem name="Regla 80/20 (Pareto)" what="Idea de que aproximadamente el 20% de tus clientes generan el 80% de tu facturación. En la práctica el ratio varía pero el concepto se mantiene: pocos clientes generan la mayoría.">
              <strong className="text-blue-300">Para qué sirve:</strong> decidir dónde invertir. Si el top 20% te da el 56% de la facturación, mover una aguja con ellos rinde más que mover una con el resto.
            </GlossaryItem>
          </GlossarySection>

        </div>
      </div>
    </div>
  );
}

function GlossarySection({ title, children }) {
  return (
    <div className="mt-6">
      <h3 className="text-[11px] font-bold uppercase tracking-[1.5px] text-blue-300 mb-3 pb-2 border-b border-blue-500/15">{title}</h3>
      {children}
    </div>
  );
}

function GlossaryItem({ name, what, children }) {
  return (
    <div className="py-3 border-b border-white/[0.04] last:border-b-0">
      <p className="text-[13.5px] font-bold text-white mb-1.5">{name}</p>
      <p className="text-[12.5px] text-gray-100 leading-relaxed">{what}</p>
      {children && <p className="text-[12.5px] text-gray-300 leading-relaxed mt-1.5">{children}</p>}
    </div>
  );
}
