import { useState, forwardRef, useImperativeHandle } from 'react';
import CostsWizard from './CostsWizard';
import CommissionsPanel from './CommissionsPanel';
import CSVUploadPanel from './CSVUploadPanel';
import FixedCostsPanel from './FixedCostsPanel';

/**
 * Acordeón colapsable que agrupa los 3 flujos de carga de costos en tabs.
 * Por default cerrado para no competir con la lectura del P&L.
 *
 * forwardRef expone `open()` para que el banner de cobertura pueda abrirlo
 * cuando el usuario hace click en "Cargar costos".
 */
const TABS = [
  { id: 'wizard', label: 'Top sellers', sub: 'Costo de productos uno por uno' },
  { id: 'commissions', label: 'Comisiones y fees', sub: 'IBB, fee plataforma y comisiones por medio de pago' },
  { id: 'csv', label: 'Importar CSV', sub: 'Carga masiva con plantilla descargable' },
  { id: 'fixed', label: 'Costos fijos', sub: 'Alquiler, sueldos, herramientas' },
];

function CostsConfigAccordion({ storeId, coverage, adsConnected, onChanged }, ref) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('wizard');

  useImperativeHandle(ref, () => ({
    open: (tab = 'wizard') => {
      setActiveTab(tab);
      setOpen(true);
      // Scroll suave al acordeón después del open
      setTimeout(() => {
        document.getElementById('costs-config-accordion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    },
  }), []);

  const total = 5;
  const loaded = countLoadedComponents(coverage, adsConnected);

  return (
    <div id="costs-config-accordion" className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.015] transition"
      >
        <div className="flex items-center gap-3 text-left">
          <div>
            <p className="text-[13px] font-semibold text-white">Configurar costos</p>
            <p className="text-[11px] text-gray-300 mt-0.5">Productos · Comisiones · Fijos · CSV bulk</p>
          </div>
          <span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5
            ${loaded === total
              ? 'bg-emerald-500/15 text-emerald-400'
              : loaded >= total / 2
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-amber-500/15 text-amber-400'}`}>
            {loaded} de {total} cargados
          </span>
        </div>
        <span className={`text-gray-200 text-[14px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="border-t border-white/[0.06]">
          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-2">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 py-3 text-[12.5px] font-medium transition
                    ${isActive ? 'text-white' : 'text-gray-300 hover:text-white'}`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-blue-400 rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-5">
            <p className="text-[11px] text-gray-300 mb-4">{TABS.find((t) => t.id === activeTab)?.sub}</p>

            {activeTab === 'wizard' && (
              <CostsWizard storeId={storeId} onUploaded={onChanged} embedded />
            )}
            {activeTab === 'commissions' && (
              <CommissionsPanel storeId={storeId} onChanged={onChanged} />
            )}
            {activeTab === 'csv' && (
              <CSVUploadPanel storeId={storeId} onUploaded={onChanged} />
            )}
            {activeTab === 'fixed' && (
              <FixedCostsPanel storeId={storeId} onChanged={onChanged} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Cuenta cuántos de los 5 componentes que el checklist muestra están "presentes".
// Mantiene paridad con CostCoverageChecklist (cogs, paymentCommission, fixedCosts, shippingCost, adSpend).
function countLoadedComponents(coverage, adsConnected) {
  if (!coverage?.components) return 0;
  const coverageKeys = ['cogs', 'paymentCommission', 'fixedCosts', 'shippingCost'];
  const covered = coverageKeys.filter((k) => coverage.components[k]?.present === true).length;
  return covered + (adsConnected !== false ? 1 : 0);
}

export default forwardRef(CostsConfigAccordion);
