import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

const PLATFORM_OPTIONS = [
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'microsoft', label: 'Microsoft' },
  { value: 'other', label: 'Otro' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'unknown', label: 'Sin dato' },
];

const FORMAT_OPTIONS = [
  { value: 'unknown', label: 'Sin dato' },
  { value: 'image', label: 'Imagen' },
  { value: 'video', label: 'Video' },
  { value: 'carousel', label: 'Carrusel' },
  { value: 'search', label: 'Search' },
  { value: 'display', label: 'Display' },
  { value: 'shopping', label: 'Shopping' },
];

const EMPTY = {
  platform: 'meta',
  status: 'active',
  format: 'unknown',
  sourceUrl: '',
  externalAdId: '',
  headline: '',
  primaryText: '',
  hook: '',
  angle: '',
  offer: '',
  cta: '',
  landingUrl: '',
  thumbnailUrl: '',
  tags: '',
  notes: '',
};

function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label || value || 'Sin dato';
}

function host(url) {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function fmtDate(date) {
  if (!date) return 'Sin fecha';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleDateString('es-AR');
}

export default function CompetidorAdsPanel({ storeId, competitor }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const fetchAds = useCallback(async () => {
    if (!storeId || !competitor?._id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/competitors/${competitor._id}/ads`);
      setAds(data || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'No se pudieron cargar los anuncios.');
    } finally {
      setLoading(false);
    }
  }, [storeId, competitor?._id]);

  useEffect(() => {
    setAds([]);
    setFormOpen(false);
    setForm(EMPTY);
    fetchAds();
  }, [fetchAds]);

  const stats = useMemo(() => {
    const active = ads.filter((ad) => ad.status === 'active').length;
    const withHook = ads.filter((ad) => ad.hook).length;
    return { active, withHook };
  }, [ads]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.primaryText.trim() && !form.headline.trim() && !form.sourceUrl.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
      };
      await api.post(`/api/stores/${storeId}/competitors/${competitor._id}/ads`, payload);
      setForm(EMPTY);
      setFormOpen(false);
      await fetchAds();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'No se pudo guardar el anuncio.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ad) => {
    if (!window.confirm('Eliminar este anuncio competitivo?')) return;
    try {
      await api.delete(`/api/stores/${storeId}/competitors/${competitor._id}/ads/${ad._id}`);
      await fetchAds();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'No se pudo eliminar el anuncio.');
    }
  };

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
      <div className="flex justify-between gap-3 items-start mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Ads competitivos</p>
          <p className="text-[12px] text-gray-400 mt-1">
            Biblioteca manual preparada para Meta, Google y otros canales.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="bg-blue-500/12 border border-blue-500/30 text-blue-200 hover:bg-blue-500/20 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold"
        >
          {formOpen ? 'Cerrar' : '+ Cargar ad'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Metric label="Total" value={ads.length} />
        <Metric label="Activos" value={stats.active} />
        <Metric label="Con hook" value={stats.withHook} />
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-500/[0.06] border border-red-500/20 px-3 py-2 text-[12px] text-red-200">
          {error}
        </div>
      )}

      {formOpen && (
        <form onSubmit={handleSubmit} className="mb-5 rounded-xl bg-black/20 border border-white/[0.06] p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select label="Plataforma" value={form.platform} onChange={update('platform')} options={PLATFORM_OPTIONS} />
            <Select label="Estado" value={form.status} onChange={update('status')} options={STATUS_OPTIONS} />
            <Select label="Formato" value={form.format} onChange={update('format')} options={FORMAT_OPTIONS} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="URL fuente" value={form.sourceUrl} onChange={update('sourceUrl')} placeholder="Link de Meta Ad Library / Google Transparency" />
            <Input label="Landing" value={form.landingUrl} onChange={update('landingUrl')} placeholder="URL de destino del anuncio" />
          </div>

          <Input label="Headline" value={form.headline} onChange={update('headline')} placeholder="Título o headline visible" />
          <Textarea label="Copy principal" value={form.primaryText} onChange={update('primaryText')} placeholder="Texto principal del anuncio" rows={4} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input label="Hook" value={form.hook} onChange={update('hook')} placeholder="Primer golpe creativo" />
            <Input label="Ángulo" value={form.angle} onChange={update('angle')} placeholder="Ej: precio, aspiracional, problema" />
            <Input label="Oferta" value={form.offer} onChange={update('offer')} placeholder="Ej: 3 cuotas + envío gratis" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="CTA" value={form.cta} onChange={update('cta')} placeholder="Comprar ahora, Ver más..." />
            <Input label="Tags" value={form.tags} onChange={update('tags')} placeholder="Separados por coma" />
          </div>

          <Textarea label="Notas" value={form.notes} onChange={update('notes')} placeholder="Lectura estratégica, dudas o contexto" rows={2} />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="bg-white/[0.04] border border-white/[0.08] text-gray-200 hover:text-white px-4 py-2 rounded-lg text-[12px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-emerald-500/12 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 px-4 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Guardar ad'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-[12.5px] text-gray-300 py-4">Cargando anuncios...</p>
      ) : ads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.1] p-4 text-center">
          <p className="text-[13px] text-gray-200">Todavía no hay anuncios cargados para este competidor.</p>
          <p className="text-[11.5px] text-gray-400 mt-1">
            Pegá los mejores ejemplos desde Meta Ad Library o Google Transparency para construir patrones.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <div key={ad._id} className="rounded-xl bg-white/[0.025] border border-white/[0.06] p-4">
              <div className="flex justify-between gap-3 items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <Badge>{labelFor(PLATFORM_OPTIONS, ad.platform)}</Badge>
                    <Badge tone={ad.status === 'active' ? 'good' : null}>{labelFor(STATUS_OPTIONS, ad.status)}</Badge>
                    <Badge>{labelFor(FORMAT_OPTIONS, ad.format)}</Badge>
                  </div>
                  <p className="text-[14px] font-semibold text-white leading-snug">
                    {ad.headline || ad.hook || ad.primaryText?.slice(0, 90) || 'Anuncio sin título'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(ad)}
                  className="text-[11px] text-gray-400 hover:text-red-300"
                >
                  Eliminar
                </button>
              </div>

              {ad.primaryText && <p className="text-[12.5px] text-gray-200 leading-relaxed mt-2">{ad.primaryText}</p>}

              {(ad.hook || ad.angle || ad.offer) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                  <Mini label="Hook" value={ad.hook} />
                  <Mini label="Ángulo" value={ad.angle} />
                  <Mini label="Oferta" value={ad.offer} />
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-3 text-[11px] text-gray-400">
                <span>Visto: {fmtDate(ad.firstSeenAt)}</span>
                {ad.landingUrl && <a className="text-blue-300 hover:text-blue-200" href={ad.landingUrl.startsWith('http') ? ad.landingUrl : `https://${ad.landingUrl}`} target="_blank" rel="noopener noreferrer">Landing: {host(ad.landingUrl)}</a>}
                {ad.sourceUrl && <a className="text-blue-300 hover:text-blue-200" href={ad.sourceUrl.startsWith('http') ? ad.sourceUrl : `https://${ad.sourceUrl}`} target="_blank" rel="noopener noreferrer">Fuente</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg bg-white/[0.025] border border-white/[0.06] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-gray-400">{label}</p>
      <p className="text-[17px] font-bold text-white mt-0.5">{value}</p>
    </div>
  );
}

function Badge({ children, tone }) {
  const cls = tone === 'good'
    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
    : 'bg-white/[0.04] border-white/[0.08] text-gray-300';
  return <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${cls}`}>{children}</span>;
}

function Mini({ label, value }) {
  return (
    <div className="rounded-lg bg-black/15 border border-white/[0.05] px-3 py-2">
      <p className="text-[9.5px] font-bold uppercase tracking-[1.1px] text-gray-400">{label}</p>
      <p className="text-[12px] text-gray-100 mt-1 leading-snug">{value || '—'}</p>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300">{label}</span>
      <input
        {...props}
        className="mt-1 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12.5px] text-white placeholder:text-gray-500 outline-none focus:border-blue-500/40"
      />
    </label>
  );
}

function Select({ label, options, ...props }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300">{label}</span>
      <select
        {...props}
        className="mt-1 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12.5px] text-white outline-none focus:border-blue-500/40"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function Textarea({ label, rows = 3, ...props }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300">{label}</span>
      <textarea
        rows={rows}
        {...props}
        className="mt-1 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12.5px] text-white placeholder:text-gray-500 outline-none focus:border-blue-500/40 resize-none"
      />
    </label>
  );
}
