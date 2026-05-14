import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const ROLE_LABELS = {
  owner: { label: 'Owner', color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  admin: { label: 'Admin', color: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  editor: { label: 'Editor', color: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  viewer: { label: 'Viewer', color: 'text-gray-300', bg: 'bg-white/[0.04]', border: 'border-white/[0.08]' },
};

function MetaTutorial() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <div className="text-left">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Cómo conectar tu cuenta de Facebook a Hooks</p>
          <p className="text-[12px] text-app-secondary mt-1">
            Paso a paso para generar el access token de Meta que vincula tus ad accounts. Hacelo una vez por tienda.
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-5 space-y-6 border-t border-white/[0.06] pt-5">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
            <p className="text-[12px] text-amber-200 font-medium">Importante</p>
            <p className="text-[12px] text-amber-100/80 mt-1">
              Cada miembro del equipo necesita generar su propio token con la cuenta de Facebook que tenga acceso a las ad accounts de la tienda. El token de otro miembro no sirve si no comparten acceso al Business Manager.
            </p>
          </div>

          {/* Paso 1 */}
          <div>
            <p className="text-[12px] font-semibold text-white">1 — Asegurate de tener permisos sobre el Business Manager</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-[12px] text-app-secondary">
              <li>Entrá a <a className="text-blue-400 hover:underline" href="https://business.facebook.com/" target="_blank" rel="noreferrer">business.facebook.com</a> con tu cuenta personal.</li>
              <li>En el menú lateral elegí <b>Cuentas → Cuentas publicitarias</b>. Tenés que ver al menos una. Si no aparece ninguna, alguien con acceso al BM tiene que asignártela primero.</li>
              <li>El permiso mínimo necesario por cada ad account es <b>Analizar resultados</b>. Si vas a usar funciones que escriben (futuro), también necesitás <b>Administrar campañas</b>.</li>
            </ul>
          </div>

          {/* Paso 2 */}
          <div>
            <p className="text-[12px] font-semibold text-white">2 — Crear una System User en tu Business Manager (recomendado)</p>
            <p className="mt-1 text-[12px] text-app-secondary">
              Una System User da un token <b>long-lived</b> que no expira cada 60 días, ideal para que la app sincronice sola.
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-[12px] text-app-secondary">
              <li>En Business Manager: <b>Configuración → Usuarios → Usuarios del sistema → Agregar</b>.</li>
              <li>Nombre sugerido: <span className="font-mono text-[11px] bg-white/[0.05] px-1.5 py-0.5 rounded">hooks-analytics</span>. Rol: <b>Empleado</b>.</li>
              <li>Una vez creada, click <b>Asignar activos</b> → elegí las <b>Cuentas publicitarias</b> que querés conectar a Hooks. Permiso: <b>Administrar cuenta publicitaria</b> (o como mínimo <b>Ver rendimiento</b>).</li>
              <li>(Opcional pero recomendado) Asigná también la <b>Página de Facebook</b> y la <b>Cuenta de Instagram</b> si vas a sincronizar creativos.</li>
            </ul>
          </div>

          {/* Paso 3 */}
          <div>
            <p className="text-[12px] font-semibold text-white">3 — Generar el access token</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-[12px] text-app-secondary">
              <li>Sobre la System User recién creada, click <b>Generar nuevo token</b>.</li>
              <li>Aplicación: si no tenés app propia, podés usar <span className="font-mono text-[11px] bg-white/[0.05] px-1.5 py-0.5 rounded">Marketing API</span>.</li>
              <li>Vigencia: <b>Sin fecha de vencimiento</b> (long-lived).</li>
              <li>Permisos (scopes) requeridos: <span className="font-mono text-[11px] bg-white/[0.05] px-1.5 py-0.5 rounded">ads_read</span>, <span className="font-mono text-[11px] bg-white/[0.05] px-1.5 py-0.5 rounded">ads_management</span>, <span className="font-mono text-[11px] bg-white/[0.05] px-1.5 py-0.5 rounded">business_management</span>, <span className="font-mono text-[11px] bg-white/[0.05] px-1.5 py-0.5 rounded">read_insights</span>.</li>
              <li>Click <b>Generar token</b>. Copialo y guardalo en un lugar seguro (Facebook NO te lo vuelve a mostrar).</li>
            </ul>
          </div>

          {/* Paso 4 */}
          <div>
            <p className="text-[12px] font-semibold text-white">4 — Alternativa rápida sin System User (token "personal", expira a los 60 días)</p>
            <p className="mt-1 text-[12px] text-app-secondary">
              Si todavía no tenés permisos para crear System Users, podés generar un token personal corto y después extenderlo a 60 días.
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-[12px] text-app-secondary">
              <li>Entrá a <a className="text-blue-400 hover:underline" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Graph API Explorer</a>.</li>
              <li>App: cualquiera que tengas (si no, primero creá una en <a className="text-blue-400 hover:underline" href="https://developers.facebook.com/" target="_blank" rel="noreferrer">developers.facebook.com</a> → "Mis apps").</li>
              <li>Click <b>Generate Access Token</b> y permitir los scopes: <span className="font-mono text-[11px] bg-white/[0.05] px-1.5 py-0.5 rounded">ads_read</span>, <span className="font-mono text-[11px] bg-white/[0.05] px-1.5 py-0.5 rounded">ads_management</span>, <span className="font-mono text-[11px] bg-white/[0.05] px-1.5 py-0.5 rounded">business_management</span>, <span className="font-mono text-[11px] bg-white/[0.05] px-1.5 py-0.5 rounded">read_insights</span>.</li>
              <li>Te devuelve un token short-lived (1-2hs). Para extenderlo a 60 días, pegalo en <a className="text-blue-400 hover:underline" href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noreferrer">Access Token Debugger</a> y click <b>Extend Access Token</b>.</li>
              <li>Si elegís este método, vas a tener que regenerar el token cada ~55 días. Hooks te va a avisar antes de que expire.</li>
            </ul>
          </div>

          {/* Paso 5 */}
          <div>
            <p className="text-[12px] font-semibold text-white">5 — Conectar el token en Hooks</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-[12px] text-app-secondary">
              <li>Entrá a la tienda en Hooks → <b>Configuración → Integraciones → Meta Ads</b>.</li>
              <li>Pegá el token en <b>Long-lived access token</b> y click <b>Traer cuentas</b>.</li>
              <li>Hooks va a mostrar todas las ad accounts a las que ese token tiene acceso.</li>
              <li>Elegí una o varias para asociar a la tienda. Marcá cuál es la <b>principal</b> (la primera que se usa de referencia).</li>
              <li>Click <b>Conectar Meta Ads</b>. La primera sincronización tarda unos minutos.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[12px] text-app-secondary">
              <b className="text-white">Problemas frecuentes:</b>
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-[12px] text-app-secondary">
              <li><b>"No se encontraron cuentas"</b> → tu token no tiene <span className="font-mono text-[11px] bg-white/[0.05] px-1 rounded">ads_read</span>, o la System User no tiene asignada ninguna ad account.</li>
              <li><b>"Token inválido"</b> → expiró (típicamente a los 60 días en tokens personales). Regeneralo y volvé a conectar.</li>
              <li><b>"La cuenta no está activa"</b> → la ad account está pausada o deshabilitada por Meta. Revisá en Business Manager.</li>
              <li><b>Faltan cuentas que sí tenés</b> → asignalas a la System User (paso 2), o pedile a un admin del BM que te las asigne.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationsSection() {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get('/api/user/notifications')
      .then(({ data }) => setData(data))
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="card p-5">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Notificaciones</p>
        <p className="text-[12px] text-gray-600">Cargando…</p>
      </div>
    );
  }

  const set = (path, value) => {
    setData((prev) => {
      const next = { ...prev, preferences: { ...prev.preferences } };
      const [section, key] = path.split('.');
      if (section === 'alerts' || section === 'digests' || section === 'reports') {
        next.preferences[section] = { ...prev.preferences[section], [key]: value };
      } else {
        next[path] = value;
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { data: saved } = await api.put('/api/user/notifications', {
        notificationEmail: data.notificationEmail,
        preferences: data.preferences,
      });
      setData(saved);
      setMsg({ ok: true, text: 'Preferencias guardadas' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'Error al guardar' });
    }
    setSaving(false);
  };

  const effectiveEmail = data.notificationEmail || data.fallbackEmail;
  const alerts = data.preferences?.alerts || {};
  const digests = data.preferences?.digests || {};
  const reports = data.preferences?.reports || {};

  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Notificaciones</p>
      <p className="text-[12px] text-app-secondary mb-4">
        A dónde y qué te llega. Si no completás un email separado, se usa <span className="font-mono">{data.fallbackEmail}</span>.
      </p>

      <div className="space-y-4">
        <div>
          <label className="kpi-label mb-1 block">Email para notificaciones</label>
          <input
            type="email"
            value={data.notificationEmail}
            onChange={(e) => set('notificationEmail', e.target.value)}
            placeholder={data.fallbackEmail}
            className="input-dark w-full"
          />
          <p className="text-[11px] text-gray-600 mt-1">Actual: <span className="font-mono text-app-secondary">{effectiveEmail}</span></p>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Alertas en tiempo real</p>
          <label className="flex items-center gap-2 text-[12px] text-app-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={!!alerts.enabled}
              onChange={(e) => set('alerts.enabled', e.target.checked)}
              className="w-4 h-4 accent-blue-500 rounded"
            />
            Recibir alertas (ROAS bajo, CPA alto, errores de sync, etc.)
          </label>
          <div>
            <label className="kpi-label mb-1 block">Severidad mínima</label>
            <select
              value={alerts.minSeverity || 'warning'}
              onChange={(e) => set('alerts.minSeverity', e.target.value)}
              className="input-dark w-full"
              disabled={!alerts.enabled}
            >
              <option value="info">Info y superior</option>
              <option value="warning">Warning y superior</option>
              <option value="critical">Solo critical</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Resúmenes</p>
          <label className="flex items-center gap-2 text-[12px] text-app-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={!!digests.daily}
              onChange={(e) => set('digests.daily', e.target.checked)}
              className="w-4 h-4 accent-blue-500 rounded"
            />
            Resumen diario
          </label>
          <label className="flex items-center gap-2 text-[12px] text-app-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={!!digests.weekly}
              onChange={(e) => set('digests.weekly', e.target.checked)}
              className="w-4 h-4 accent-blue-500 rounded"
            />
            Resumen semanal
          </label>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Reportes</p>
          <label className="flex items-center gap-2 text-[12px] text-app-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={!!reports.onPublish}
              onChange={(e) => set('reports.onPublish', e.target.checked)}
              className="w-4 h-4 accent-blue-500 rounded"
            />
            Avisarme cuando se publique un reporte en mis tiendas
          </label>
        </div>

        <div className="flex items-center justify-between pt-1">
          {msg ? (
            <span className={`text-[12px] font-medium ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>
          ) : (
            <span />
          )}
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar preferencias'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MyStoresSection() {
  const { user } = useAuth();
  const [stores, setStores] = useState([]);

  useEffect(() => {
    api.get('/api/stores').then(({ data }) => setStores(data)).catch(() => setStores([]));
  }, []);

  if (!stores.length) {
    return (
      <div className="card p-5">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Mis tiendas</p>
        <p className="text-[12px] text-gray-600">No tenés tiendas asignadas todavía.</p>
      </div>
    );
  }

  const detailed = user?.storeAccessDetailed || [];
  const roleByStore = new Map(detailed.map((a) => [String(a.storeId), a.role]));

  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-4">Mis tiendas</p>
      <div className="space-y-2">
        {stores.map((store) => {
          const role = user?.role === 'admin' ? 'admin (global)' : roleByStore.get(String(store._id)) || '—';
          const roleConfig = ROLE_LABELS[role.replace(' (global)', '')] || ROLE_LABELS.viewer;
          return (
            <div key={store._id} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center gap-3 min-w-0">
                {store.logoUrl ? (
                  <img src={store.logoUrl} alt={store.nombre} className="w-8 h-8 rounded-lg object-cover border border-white/[0.08]" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[10px] font-semibold text-gray-400">
                    {(store.nombre || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-white truncate">{store.nombre}</p>
                  <p className="text-[11px] text-gray-600 truncate">{store.plataforma === 'tiendanube' ? 'Tienda Nube' : store.plataforma === 'shopify' ? 'Shopify' : 'Manual'}</p>
                </div>
              </div>
              <span className={`text-[11px] font-medium px-2 py-1 rounded-full border ${roleConfig.bg} ${roleConfig.border} ${roleConfig.color}`}>
                {role}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function UserProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell min-h-screen">
      <header className="app-surface border-b border-white/[0.06] px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-[13px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition">
            ← Volver
          </button>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Mi perfil</p>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-5">
        <div className="card p-5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-4">Cuenta</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="kpi-label">Nombre</p>
              <p className="text-[13px] text-white font-medium mt-0.5">{user?.nombre || '—'}</p>
            </div>
            <div>
              <p className="kpi-label">Email</p>
              <p className="text-[13px] text-white font-medium mt-0.5">{user?.email || '—'}</p>
            </div>
            <div>
              <p className="kpi-label">Rol global</p>
              <p className="text-[13px] text-white font-medium mt-0.5 capitalize">{user?.role || '—'}</p>
            </div>
          </div>
        </div>

        <NotificationsSection />
        <MyStoresSection />
        <MetaTutorial />
      </div>
    </div>
  );
}
