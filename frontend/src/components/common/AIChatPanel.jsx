import { useState, useRef, useEffect } from 'react';
import api from '../../services/api';

function formatMessage(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*)/gm, '<h4 class="font-semibold text-gray-800 dark:text-gray-200 mt-2">$1</h4>')
    .replace(/^## (.*)/gm, '<h3 class="font-bold text-gray-900 dark:text-gray-100 mt-2">$1</h3>')
    .replace(/^- (.*)/gm, '<li class="ml-4">$1</li>')
    .replace(/\n/g, '<br>');
}

export default function AIChatPanel({ storeId, from, to }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post(`/api/stores/${storeId}/ai/chat`, {
        messages: newMessages,
        from,
        to,
      });
      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `Error: ${err.response?.data?.error || 'No se pudo conectar con AI'}` },
      ]);
    }
    setLoading(false);
  };

  const suggestions = [
    'Cómo está el rendimiento general?',
    'Qué campaña debería escalar?',
    'Cómo puedo mejorar el profit?',
    'Qué productos tienen mejor margen?',
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 w-12 h-12 bg-primary-600 text-white rounded-full shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition flex items-center justify-center z-40"
        title="Chat con AI"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 w-[360px] h-[480px] bg-white dark:bg-gray-900 rounded-lg shadow-2xl shadow-black/30 border border-gray-200 dark:border-gray-700/60 flex flex-col z-40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700/60 bg-primary-600 text-white">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="text-[12px] font-bold tracking-wide">CHAT AI</span>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-[10px] text-white/60 hover:text-white transition"
              title="Limpiar chat"
            >
              Limpiar
            </button>
          )}
          <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {messages.length === 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-[11px] text-gray-500 dark:text-gray-500 text-center">
              Preguntale cualquier cosa sobre los datos de tu tienda.
            </p>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  className="block w-full text-left px-2.5 py-1.5 text-[11px] rounded border border-gray-200 dark:border-gray-700/60 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-[11px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700/60'
              }`}
            >
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <div
                  className="prose prose-xs dark:prose-invert max-w-none [&_li]:list-disc"
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700/60">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700/60 p-2.5">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Preguntá sobre tus datos..."
            className="flex-1 px-2.5 py-1.5 text-[11px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-2.5 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
