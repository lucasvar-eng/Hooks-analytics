import { useMemo, useState } from 'react';

function formatRangeLabel(from, to) {
  if (!from && !to) return 'rango actual';
  return `${from || 'inicio'} a ${to || 'hoy'}`;
}

function buildResourceUri(kind, storeId, from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return `hooks://stores/${storeId}/${kind}${query ? `?${query}` : ''}`;
}

function buildSectionConfig(mode, { storeId, storeName, from, to }) {
  const label = storeName || storeId;
  const rangeLabel = formatRangeLabel(from, to);

  if (mode === 'meta') {
    return {
      title: 'Claude + Meta Ads',
      subtitle: 'Preparado para revisar gasto, compras, ROAS, campañas y salud del dato de Meta sin mezclarlo con otras fuentes.',
      resourceUri: buildResourceUri('ai-context', storeId, from, to) + `${from || to ? '&' : '?'}section=meta`,
      readPrompt: `Usá el MCP "hooks-analytics" para analizar Meta Ads de "${label}" en el período ${rangeLabel}.

1. Ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "meta"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Ejecutá get_sync_status con el mismo rango.

Con eso, devolveme:
- diagnóstico de adquisición
- campañas o conjuntos a vigilar
- señales de saturación o caída de eficiencia
- 3 acciones concretas sobre presupuesto, estructura o creativos

Si Meta no está conciliado o el dato está incompleto, decilo explícitamente antes de recomendar cambios.`,
      savePrompt: `Usá el MCP "hooks-analytics" para analizar Meta Ads de "${label}" en el período ${rangeLabel}.

1. Ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "meta"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Ejecutá get_sync_status con el mismo rango.
3. Armá un análisis en Markdown con:
   - ## Diagnóstico de adquisición
   - ## Qué está funcionando
   - ## Riesgos
   - ## Acciones recomendadas
4. Guardalo con save_analysis usando:
   - store: "${label}"
   - titulo: "Meta Ads · ${label} · ${rangeLabel}"
   - section: "meta"
   - summary: una línea con el principal hallazgo
   - qualityNote: una nota breve sobre calidad del dato
   - confidence: valor entre 0 y 1
   - contenido: el markdown final completo`,
    };
  }

  if (mode === 'productos') {
    return {
      title: 'Claude + productos',
      subtitle: 'Enfocado en stock, catálogo, rotación y oportunidades comerciales reales del surtido.',
      resourceUri: buildResourceUri('commercial', storeId, from, to),
      readPrompt: `Usá el MCP "hooks-analytics" para analizar el surtido de "${label}" en el período ${rangeLabel}.

1. Ejecutá get_commercial_overview con:
   - store: "${label}"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "productos"
   - from: "${from || ''}"
   - to: "${to || ''}"

Con eso, devolveme:
- productos o categorías que sostienen el negocio
- stock inmovilizado o riesgo de sobrestock
- señales de baja rotación
- 3 acciones comerciales concretas sobre surtido, stock o pricing

No mezcles ingresos brutos con netos si el contexto marca otra cosa.`,
      savePrompt: `Usá el MCP "hooks-analytics" para analizar el surtido de "${label}" en el período ${rangeLabel}.

1. Ejecutá get_commercial_overview con:
   - store: "${label}"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "productos"
   - from: "${from || ''}"
   - to: "${to || ''}"
3. Armá un análisis en Markdown con:
   - ## Diagnóstico comercial
   - ## Qué sostiene el catálogo
   - ## Riesgos de stock
   - ## Acciones recomendadas
4. Guardalo con save_analysis usando:
   - store: "${label}"
   - titulo: "Productos · ${label} · ${rangeLabel}"
   - section: "productos"
   - summary: una línea con el principal hallazgo
   - qualityNote: una nota breve sobre calidad del dato
   - confidence: valor entre 0 y 1
   - contenido: el markdown final completo`,
    };
  }

  if (mode === 'creativos') {
    return {
      title: 'Claude + pipeline creativo',
      subtitle: 'Copiá un prompt listo para Claude Code/Desktop con el MCP de Hooks ya instalado.',
      resourceUri: buildResourceUri('creative-pipeline', storeId, from, to),
      readPrompt: `Usá el MCP "hooks-analytics" para revisar el pipeline creativo de "${label}" en el período ${rangeLabel}.

1. Ejecutá get_creative_pipeline con:
   - store: "${label}"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "creativos"
   - from: "${from || ''}"
   - to: "${to || ''}"

Con eso, devolveme:
- qué escalar
- qué pausar o rehacer
- qué testear después
- qué gaps de framework siguen abiertos

No inventes conclusiones si la confianza del dato es media o baja.`,
      savePrompt: `Usá el MCP "hooks-analytics" para revisar el pipeline creativo de "${label}" en el período ${rangeLabel}.

1. Ejecutá get_creative_pipeline con:
   - store: "${label}"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "creativos"
   - from: "${from || ''}"
   - to: "${to || ''}"
3. Armá un reporte en Markdown con estas secciones:
   - ## Diagnóstico
   - ## Qué escalar
   - ## Qué pausar
   - ## Próximos tests
   - ## Riesgos del dato
4. Guardalo con create_report usando:
   - store: "${label}"
   - titulo: "Pipeline creativo · ${label} · ${rangeLabel}"
   - section: "creativos"
   - tipo: "report"
   - summary: un resumen breve del pipeline
   - qualityNote: una nota breve sobre calidad del dato
   - confidence: valor entre 0 y 1
   - contenido: el markdown final completo`,
    };
  }

  if (mode === 'topic-map') {
    return {
      title: 'Claude + topic map',
      subtitle: 'Preparado para revisar gaps del framework, consciencia y prioridades del mapa.',
      resourceUri: buildResourceUri('ai-context', storeId, from, to) + `${from || to ? '&' : '?'}section=topic-map`,
      readPrompt: `Usá el MCP "hooks-analytics" para revisar el Topic Map de "${label}".

1. Ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "topic-map"
   - from: "${from || ''}"
   - to: "${to || ''}"

Con eso, devolveme:
- cuál es el principal hueco del framework
- qué topics están listos para scaling o testing
- qué consciencia o territorio está flojo
- 3 acciones concretas para ordenar el mapa`,
      savePrompt: `Usá el MCP "hooks-analytics" para revisar el Topic Map de "${label}".

1. Ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "topic-map"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Armá un análisis en Markdown con:
   - ## Diagnóstico del framework
   - ## Qué está sólido
   - ## Huecos prioritarios
   - ## Acciones
3. Guardalo con save_analysis usando:
   - store: "${label}"
   - titulo: "Topic Map · ${label} · ${rangeLabel}"
   - section: "topic-map"
   - summary: una línea con el principal hallazgo
   - qualityNote: una nota breve sobre calidad del dato
   - confidence: valor entre 0 y 1
   - contenido: el markdown final completo`,
    };
  }

  if (mode === 'language-bank') {
    return {
      title: 'Claude + lenguaje',
      subtitle: 'Sirve para detectar objeciones sin respuesta, hooks flojos y huecos de lenguaje comercial.',
      resourceUri: buildResourceUri('ai-context', storeId, from, to) + `${from || to ? '&' : '?'}section=language-bank`,
      readPrompt: `Usá el MCP "hooks-analytics" para revisar el Banco de Lenguaje de "${label}".

1. Ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "language-bank"
   - from: "${from || ''}"
   - to: "${to || ''}"

Con eso, devolveme:
- qué hooks o patrones de lenguaje están fuertes
- qué objeciones siguen sin respuesta
- qué avatar o consciencia está poco cubierto
- 3 acciones concretas de copy`,
      savePrompt: `Usá el MCP "hooks-analytics" para revisar el Banco de Lenguaje de "${label}".

1. Ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "language-bank"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Armá un análisis en Markdown con:
   - ## Diagnóstico de lenguaje
   - ## Hooks y patrones fuertes
   - ## Objeciones sin cubrir
   - ## Acciones
3. Guardalo con save_analysis usando:
   - store: "${label}"
   - titulo: "Language Bank · ${label} · ${rangeLabel}"
   - section: "language-bank"
   - summary: una línea con el principal hallazgo
   - qualityNote: una nota breve sobre calidad del dato
   - confidence: valor entre 0 y 1
   - contenido: el markdown final completo`,
    };
  }

  if (mode === 'competencia') {
    return {
      title: 'Claude + competencia',
      subtitle: 'Úsalo para leer gaps de mensaje, territorios y oportunidades frente a competidores.',
      resourceUri: buildResourceUri('ai-context', storeId, from, to) + `${from || to ? '&' : '?'}section=competencia`,
      readPrompt: `Usá el MCP "hooks-analytics" para revisar la competencia de "${label}".

1. Ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "competencia"
   - from: "${from || ''}"
   - to: "${to || ''}"

Con eso, devolveme:
- qué ventaja o hueco competitivo ves hoy
- qué mensajes de competencia están mejor trabajados
- qué territorios o ángulos nos faltan
- 3 acciones concretas`,
      savePrompt: `Usá el MCP "hooks-analytics" para revisar la competencia de "${label}".

1. Ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "competencia"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Armá un análisis en Markdown con:
   - ## Diagnóstico competitivo
   - ## Ventajas y gaps
   - ## Oportunidades
   - ## Acciones
3. Guardalo con save_analysis usando:
   - store: "${label}"
   - titulo: "Competencia · ${label} · ${rangeLabel}"
   - section: "competencia"
   - summary: una línea con el principal hallazgo
   - qualityNote: una nota breve sobre calidad del dato
   - confidence: valor entre 0 y 1
   - contenido: el markdown final completo`,
    };
  }

  if (mode === 'sync') {
    return {
      title: 'Claude + integridad',
      subtitle: 'Úsalo para auditar fuentes, conciliación y dejar diagnóstico guardado en Hooks.',
      resourceUri: buildResourceUri('sync-status', storeId, from, to),
      readPrompt: `Usá el MCP "hooks-analytics" para auditar la tienda "${label}" en el período ${rangeLabel}.

1. Ejecutá get_sync_status con:
   - store: "${label}"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Si necesitás contexto adicional, ejecutá get_store_overview con el mismo rango.

Con eso, decime:
- estado real de Tienda Nube y Meta
- si la reconciliación está matched o no
- qué dato todavía no tomarías como definitivo
- qué conviene revisar primero`,
      savePrompt: `Usá el MCP "hooks-analytics" para auditar la tienda "${label}" en el período ${rangeLabel}.

1. Ejecutá get_sync_status con:
   - store: "${label}"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Si necesitás contexto adicional, ejecutá get_store_overview con el mismo rango.
3. Armá un diagnóstico en Markdown con:
   - ## Estado de fuentes
   - ## Reconciliación
   - ## Riesgos
   - ## Próximas acciones
4. Guardalo con create_report usando:
   - store: "${label}"
   - titulo: "Diagnóstico de sync · ${label} · ${rangeLabel}"
   - section: "general"
   - tipo: "diagnostic"
   - summary: una línea con el estado general
   - qualityNote: una nota breve sobre confiabilidad
   - confidence: valor entre 0 y 1
   - contenido: el markdown final completo`,
    };
  }

  return {
    title: 'Claude + análisis ejecutivo',
    subtitle: 'Copiá el prompt o el recurso MCP y hacé que Claude deje el análisis guardado en la app.',
    resourceUri: buildResourceUri('overview', storeId, from, to),
    readPrompt: `Usá el MCP "hooks-analytics" para analizar la tienda "${label}" en el período ${rangeLabel}.

1. Ejecutá get_store_overview con:
   - store: "${label}"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Ejecutá get_sync_status con el mismo rango.
3. Ejecutá get_financial_consistency con el mismo rango.
4. Si necesitás más detalle, ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "dashboard"
   - from: "${from || ''}"
   - to: "${to || ''}"

Con eso, devolveme:
- diagnóstico ejecutivo
- qué está funcionando
- riesgos o límites del dato
- 3 acciones prioritarias

No inventes métricas ni recomiendes escalar si la calidad del dato no es alta.`,
    savePrompt: `Usá el MCP "hooks-analytics" para analizar la tienda "${label}" en el período ${rangeLabel}.

1. Ejecutá get_store_overview con:
   - store: "${label}"
   - from: "${from || ''}"
   - to: "${to || ''}"
2. Ejecutá get_sync_status con el mismo rango.
3. Ejecutá get_financial_consistency con el mismo rango.
4. Si necesitás más detalle, ejecutá get_ai_context_snapshot con:
   - store: "${label}"
   - section: "dashboard"
   - from: "${from || ''}"
   - to: "${to || ''}"
5. Armá un análisis en Markdown con:
   - ## Diagnóstico
   - ## Qué está funcionando
   - ## Riesgos o límites del dato
   - ## Acciones prioritarias
6. Guardalo con save_analysis usando:
   - store: "${label}"
   - titulo: "Análisis ejecutivo · ${label} · ${rangeLabel}"
   - section: "dashboard"
   - summary: una línea con el principal hallazgo
   - qualityNote: una nota breve sobre calidad del dato
   - confidence: valor entre 0 y 1
   - contenido: el markdown final completo`,
  };
}

async function copyText(text, onSuccess, onError) {
  try {
    await navigator.clipboard.writeText(text);
    onSuccess();
  } catch {
    onError();
  }
}

const COLLAPSE_STORAGE_KEY = 'hooks-claude-actionbar-collapsed';

function readCollapsedDefault() {
  try {
    const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    return stored == null ? true : stored === '1';
  } catch {
    return true;
  }
}

export default function ClaudeActionBar({ storeId, storeName, from, to, mode = 'dashboard' }) {
  const [message, setMessage] = useState(null);
  const [collapsed, setCollapsed] = useState(readCollapsedDefault);

  const config = useMemo(
    () => buildSectionConfig(mode, { storeId, storeName, from, to }),
    [mode, storeId, storeName, from, to]
  );

  if (!storeId) return null;

  const handleCopy = (text, successText) => {
    setMessage(null);
    copyText(
      text,
      () => setMessage({ ok: true, text: successText }),
      () => setMessage({ ok: false, text: 'No se pudo copiar al portapapeles.' })
    );
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition px-4 py-2.5"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-app-muted text-[10px] uppercase tracking-[0.18em] shrink-0">Claude</span>
          <span className="text-app-primary text-[13px] font-medium truncate">{config.title}</span>
          <span className="text-app-secondary text-[11px] truncate hidden md:inline">— prompts y recursos MCP listos</span>
        </div>
        <span className="text-app-secondary text-[11px] flex items-center gap-1.5 shrink-0">
          Mostrar
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Claude conectado</p>
          <h3 className="text-white text-[16px] font-semibold mt-1">{config.title}</h3>
          <p className="text-app-secondary text-[12px] mt-2 max-w-3xl">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <button
            type="button"
            onClick={() => handleCopy(config.readPrompt, 'Prompt copiado para usar con Claude.')}
            className="btn-secondary"
          >
            Copiar prompt
          </button>
          <button
            type="button"
            onClick={() => handleCopy(config.savePrompt, 'Prompt copiado con guardado automático en Hooks.')}
            className="btn-primary"
          >
            Copiar prompt + guardar
          </button>
          <button
            type="button"
            onClick={() => handleCopy(config.resourceUri, 'Recurso MCP copiado.')}
            className="btn-secondary"
          >
            Copiar recurso MCP
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="text-app-secondary text-[11px] hover:text-white transition flex items-center gap-1 px-2 py-1"
            title="Ocultar"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            Ocultar
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Recurso sugerido</p>
        <p className="text-app-primary text-[12px] mt-2 break-all">{config.resourceUri}</p>
      </div>

      <p className="text-app-secondary text-[12px]">
        Funciona mejor con <span className="text-white">Claude Code</span> o <span className="text-white">Claude Desktop</span> usando el MCP local de Hooks. En Claude web/cowork no siempre hay forma estable de abrir el recurso local automáticamente, por eso estos botones copian prompts y recursos listos.
      </p>

      {message && (
        <p className={`text-[12px] ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p>
      )}
    </div>
  );
}
