/**
 * emailService — wrapper sobre Resend con soporte multi-tenant.
 *
 * Cada User puede traer su propia API key de Resend (encrypted en
 * User.resendApiKey*). La app le manda los mails a ese user con SU key
 * — así cada uno recibe sus propios mails sin necesidad de dominio
 * verificado del lado de la app.
 *
 * Si el user no tiene key configurada, fallback a la global del .env
 * (que solo puede mandar a la cuenta del owner de Resend del .env).
 *
 * APIs:
 *   sendEmail({ to, subject, html, text?, replyTo?, apiKey?, from? })
 *      → manda directo con la apiKey provista (o la del .env como fallback).
 *
 *   sendEmailForUser(userId, { to, subject, html, text?, replyTo? })
 *      → resuelve la API key del User y manda con esa. El `from` se toma
 *        del User.resendFromEmail si lo tiene, sino del .env.
 *
 *   verifyApiKey(apiKey, testTo) → manda un mail de prueba.
 *
 * Templates: buildInvitationEmail, buildTokenExpiringEmail, buildAlertEmail.
 */
const { Resend } = require('resend');
const { email: emailConfig } = require('../config/environment');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

// Cache de clientes Resend por API key para no instanciar uno nuevo en cada send.
const clientCache = new Map();
function getResendFor(apiKey) {
  if (!apiKey) return null;
  if (!clientCache.has(apiKey)) clientCache.set(apiKey, new Resend(apiKey));
  return clientCache.get(apiKey);
}

function isEnabled() {
  return !!emailConfig.resendApiKey;
}

function decryptUserResendKey(user) {
  if (!user?.resendApiKeyEncrypted || !user?.resendApiKeyIV || !user?.resendApiKeyAuthTag) {
    return null;
  }
  try {
    return decrypt(user.resendApiKeyEncrypted, user.resendApiKeyIV, user.resendApiKeyAuthTag);
  } catch (err) {
    logger.warn(`[emailService] No pude descifrar resendApiKey de user ${user._id}: ${err.message}`);
    return null;
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Manda un email directo. `apiKey` y `from` son opcionales (fallback al .env global).
 * Devuelve `{ ok, id?, error?, skipped? }`. Nunca tira.
 */
async function sendEmail({ to, subject, html, text, replyTo, apiKey, from }) {
  if (!to || !subject || !html) {
    return { ok: false, error: 'to, subject y html son obligatorios' };
  }

  const effectiveKey = apiKey || emailConfig.resendApiKey;
  const resend = getResendFor(effectiveKey);
  if (!resend) {
    logger.warn(`[emailService] Sin API key disponible — email a "${to}" no enviado. Subject: "${subject}"`);
    return { ok: false, skipped: true, error: 'email_disabled' };
  }

  try {
    const payload = {
      from: from || emailConfig.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };
    if (text) payload.text = text;
    if (replyTo || emailConfig.replyTo) payload.reply_to = replyTo || emailConfig.replyTo;

    const { data, error } = await resend.emails.send(payload);
    if (error) {
      logger.error(`[emailService] Resend devolvió error mandando a ${to}: ${error.message || JSON.stringify(error)}`);
      return { ok: false, error: error.message || 'resend_error', errorCode: error.statusCode || error.name };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    logger.error(`[emailService] Excepción mandando email a ${to}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * Manda un email "para" un user (usando la API key personal del user).
 *
 * Cargá el User con `+resendApiKeyEncrypted +resendApiKeyIV +resendApiKeyAuthTag`
 * para que esta función pueda descifrar. Si el user no tiene key, hace fallback
 * a la global del .env.
 */
async function sendEmailForUser(user, { to, subject, html, text, replyTo }) {
  const userKey = decryptUserResendKey(user);
  const apiKey = userKey || emailConfig.resendApiKey;
  const from = user?.resendFromEmail || emailConfig.from;

  if (!apiKey) {
    logger.warn(`[emailService] sendEmailForUser sin key disponible — email a "${to}" no enviado.`);
    return { ok: false, skipped: true, error: 'email_disabled' };
  }

  return sendEmail({
    to,
    subject,
    html,
    text,
    replyTo,
    apiKey,
    from,
    keySource: userKey ? 'user' : 'global',
  });
}

/**
 * Verifica que una API key de Resend funciona mandando un email mínimo de prueba.
 * Devuelve { ok, error? } — el caller muestra el resultado al usuario.
 */
async function verifyApiKey(apiKey, testTo) {
  if (!apiKey || !apiKey.startsWith('re_')) {
    return { ok: false, error: 'La API key debe empezar con "re_"' };
  }
  if (!testTo) return { ok: false, error: 'Falta destinatario de prueba' };

  return sendEmail({
    apiKey,
    to: testTo,
    subject: '[Hooks Analytics] Tu Resend está conectado',
    html: `${WRAPPER_OPEN}
      <h2 style="margin:0 0 16px 0;font-size:20px;color:#ffffff;">Resend conectado correctamente</h2>
      <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#d1d5db;">
        Si recibís este mail, significa que tu API key de Resend funciona y Hooks Analytics
        puede mandarte alertas, recordatorios y digests a este email.
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Recordá: con cuenta gratis de Resend, solo podés recibir mails en este mismo email.
        Para recibir en otros emails (o mandar invitaciones a tu equipo) verificá un dominio en Resend.
      </p>
    ${WRAPPER_CLOSE}`,
    text: 'Tu Resend está conectado. Vas a poder recibir alertas y digests de Hooks Analytics en este email.',
  });
}

const BUTTON_STYLE =
  'display:inline-block;padding:12px 24px;background:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;';

const WRAPPER_OPEN = `<div style="background:#0a0a0a;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e5e7eb;">
  <div style="max-width:560px;margin:0 auto;background:#111111;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:32px;">
    <p style="margin:0 0 24px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;font-weight:700;">Hooks Analytics</p>`;
const WRAPPER_CLOSE = `
    <p style="margin:32px 0 0 0;font-size:11px;color:#6b7280;">
      Recibiste este mail porque estás registrado en Hooks Analytics. Si no esperabas este mensaje, podés ignorarlo.
    </p>
  </div>
</div>`;

function buildInvitationEmail({ invitedByName, invitedByEmail, storeName, role, acceptUrl, expiresAt }) {
  const subject = `Te invitaron a "${storeName}" en Hooks Analytics`;
  const expiraTxt = expiresAt
    ? `Esta invitación vence el ${new Date(expiresAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}.`
    : '';
  const html = `${WRAPPER_OPEN}
    <h2 style="margin:0 0 16px 0;font-size:20px;color:#ffffff;font-weight:700;">Tenés una invitación</h2>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#d1d5db;">
      <strong style="color:#ffffff;">${escapeHtml(invitedByName || invitedByEmail)}</strong> te invitó a sumarte a la tienda
      <strong style="color:#ffffff;">${escapeHtml(storeName)}</strong> con el rol de
      <strong style="color:#60a5fa;">${escapeHtml(role)}</strong>.
    </p>
    <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#d1d5db;">
      Para aceptar la invitación, primero iniciá sesión con el mismo email al que llegó este mensaje y después hacé click en el botón.
    </p>
    <p style="margin:0 0 24px 0;text-align:center;">
      <a href="${acceptUrl}" style="${BUTTON_STYLE}">Aceptar invitación</a>
    </p>
    <p style="margin:0 0 8px 0;font-size:12px;color:#9ca3af;">
      Si el botón no funciona, copiá y pegá este enlace en tu navegador:
    </p>
    <p style="margin:0 0 16px 0;font-size:11px;color:#6b7280;word-break:break-all;font-family:ui-monospace,monospace;">
      ${acceptUrl}
    </p>
    ${expiraTxt ? `<p style="margin:0;font-size:12px;color:#9ca3af;">${expiraTxt}</p>` : ''}
  ${WRAPPER_CLOSE}`;

  const text = `${invitedByName || invitedByEmail} te invitó a "${storeName}" en Hooks Analytics con el rol de ${role}.\n\nAceptar: ${acceptUrl}\n\n${expiraTxt}`;

  return { subject, html, text };
}

function buildTokenExpiringEmail({ storeName, provider, daysLeft, expiresAt, reconnectUrl }) {
  const subject = `Token de ${provider} de "${storeName}" vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}`;
  const html = `${WRAPPER_OPEN}
    <h2 style="margin:0 0 16px 0;font-size:20px;color:#ffffff;font-weight:700;">Tu conexión está por vencer</h2>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#d1d5db;">
      El access token de <strong style="color:#ffffff;">${escapeHtml(provider)}</strong> de la tienda
      <strong style="color:#ffffff;">${escapeHtml(storeName)}</strong> vence en
      <strong style="color:#f59e0b;">${daysLeft} día${daysLeft === 1 ? '' : 's'}</strong>
      (${new Date(expiresAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}).
    </p>
    <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#d1d5db;">
      Cuando el token expira, dejamos de poder sincronizar campañas, gasto y métricas. Regeneralo desde Business Manager y volvé a conectarlo.
    </p>
    <p style="margin:0 0 24px 0;text-align:center;">
      <a href="${reconnectUrl}" style="${BUTTON_STYLE}">Re-conectar ahora</a>
    </p>
  ${WRAPPER_CLOSE}`;

  const text = `El token de ${provider} de "${storeName}" vence en ${daysLeft} día(s). Re-conectalo en: ${reconnectUrl}`;
  return { subject, html, text };
}

function buildAlertEmail({ storeName, alertTitle, alertMessage, severity, storeUrl }) {
  const severityColor = severity === 'critical' ? '#ef4444' : severity === 'warning' ? '#f59e0b' : '#3b82f6';
  const severityLabel = severity === 'critical' ? 'CRÍTICA' : severity === 'warning' ? 'ATENCIÓN' : 'INFO';
  const subject = `[${severityLabel}] ${alertTitle} — ${storeName}`;
  const html = `${WRAPPER_OPEN}
    <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${severityColor};font-weight:700;">
      Alerta · ${severityLabel}
    </p>
    <h2 style="margin:0 0 12px 0;font-size:20px;color:#ffffff;font-weight:700;">${escapeHtml(alertTitle)}</h2>
    <p style="margin:0 0 8px 0;font-size:13px;color:#9ca3af;">Tienda: <strong style="color:#ffffff;">${escapeHtml(storeName)}</strong></p>
    <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#d1d5db;">${escapeHtml(alertMessage)}</p>
    ${storeUrl ? `<p style="margin:0 0 24px 0;text-align:center;"><a href="${storeUrl}" style="${BUTTON_STYLE}">Ver en la app</a></p>` : ''}
  ${WRAPPER_CLOSE}`;

  const text = `[${severityLabel}] ${alertTitle}\nTienda: ${storeName}\n\n${alertMessage}${storeUrl ? `\n\nVer: ${storeUrl}` : ''}`;
  return { subject, html, text };
}

module.exports = {
  sendEmail,
  sendEmailForUser,
  verifyApiKey,
  isEnabled,
  buildInvitationEmail,
  buildTokenExpiringEmail,
  buildAlertEmail,
};
