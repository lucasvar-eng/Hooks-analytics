import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

const PRESETS = {
  dashboard: [
    '¿Cuál es hoy el principal cuello de botella del negocio?',
    '¿Qué tres acciones priorizarías esta semana?',
  ],
  creativos: [
    '¿Qué hook o ángulo creativo falta explorar?',
    '¿Qué objeciones aparecen poco respondidas en nuestro lenguaje actual?',
  ],
};

export default function AIChatPanel({
  storeId,
  section = 'dashboard',
  from,
  to,
  title = 'Chat AI',
  collapsible = false,
  defaultOpen = true,
  docked = false,
  storageKey = null,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [meta, setMeta] = useState(null);
  const presets = useMemo(() => PRESETS[section] || PRESETS.dashboard, [section]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved != null) {
        setOpen(saved === '1');
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, open ? '1' : '0');
    } catch {}
  }, [open, storageKey]);

  useEffect(() => {
    api.get(`/api/stores/${storeId}/ai/chat?section=${section}`).then(({ data }) => {
      setMessages(data.messages || []);
      setMeta(null);
    }).catch(() => {
      setMessages([]);
      setMeta(null);
    });
  }, [storeId, section]);

  const sendMessage = async (text) => {
    const question = text.trim();
    if (!question) return;

    const nextMessages = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post(`/api/stores/${storeId}/ai/chat`, {
        section,
        from,
        to,
        messages: nextMessages,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
      setMeta({
        confidence: data.confidence,
        qualityNote: data.qualityNote,
        model: data.model,
        provider: data.provider,
      });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: error.response?.data?.error || 'No pude responder esa consulta.' },
      ]);
    }

    setLoading(false);
  };

  const clearConversation = async () => {
    try {
      await api.delete(`/api/stores/${storeId}/ai/chat?section=${section}`);
      setMessages([]);
      setMeta(null);
    } catch {}
  };

  if (collapsible && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`${
          docked
            ? 'fixed bottom-5 right-5 z-30'
            : ''
        } flex items-center gap-2 rounded-full border border-blue-500/25 bg-[#111827]/95 px-4 py-2 text-[12px] font-medium text-blue-200 shadow-lg hover:bg-[#162033] transition`}
      >
        <span className="inline-flex h-2 w-2 rounded-full bg-blue-400" />
        <span>{title}</span>
      </button>
    );
  }

  return (
    <div className={`${docked ? 'fixed bottom-5 right-5 z-30 w-[380px] max-w-[calc(100vw-24px)] shadow-2xl' : ''} card p-4`}>
      <div className="flex items-center justify-between mb-3 gap-3">
        <div>
          <p className="text-[11px] font-bold text-app-muted uppercase tracking-wider">{title}</p>
          <p className="text-[12px] text-app-secondary mt-1">Consultas puntuales con contexto de la sección.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={clearConversation} className="btn-ghost text-[11px]">
            Limpiar
          </button>
          {collapsible && (
            <button onClick={() => setOpen(false)} className="btn-ghost text-[11px] px-2">
              Ocultar
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map((preset) => (
          <button key={preset} onClick={() => sendMessage(preset)} className="chip text-[11px]">
            {preset}
          </button>
        ))}
      </div>

      {meta && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {meta.confidence != null && (
            <span className={`badge ${
              meta.confidence >= 0.8
                ? 'bg-emerald-500/15 text-emerald-400'
                : meta.confidence >= 0.5
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-red-500/15 text-red-400'
            }`}>
              Confianza {(meta.confidence * 100).toFixed(0)}%
            </span>
          )}
          {meta.provider && (
            <span className="text-[11px] text-app-secondary">
              {meta.provider}{meta.model ? ` · ${meta.model}` : ''}
            </span>
          )}
          {meta.qualityNote && (
            <span className="text-[11px] text-app-secondary">{meta.qualityNote}</span>
          )}
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 min-h-[120px] max-h-[220px] overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <p className="text-[12px] text-app-secondary">Todavía no hay mensajes. Probá con una de las preguntas sugeridas.</p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                message.role === 'user'
                  ? 'bg-blue-500/12 border border-blue-500/20 text-blue-100 ml-10'
                  : 'bg-white/[0.03] border border-white/[0.05] text-app-primary mr-10'
              }`}
            >
              {message.content}
            </div>
          ))
        )}
        {loading && (
          <div className="rounded-xl px-3 py-2 text-[12px] bg-white/[0.03] border border-white/[0.05] text-app-secondary mr-10">
            Pensando...
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={docked ? 2 : 2}
          placeholder="Preguntale algo puntual a la IA..."
          className="input-dark flex-1 resize-none"
        />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} className="btn-primary disabled:opacity-50 self-end">
          Enviar
        </button>
      </div>
    </div>
  );
}
