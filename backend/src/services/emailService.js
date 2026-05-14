/**
 * emailService — wrapper sobre Resend.
 *
 * Si RESEND_API_KEY no está configurada, no manda nada y solo loguea
 * (modo dev). Si está configurada, manda via Resend SDK.
 *
 * Función principal:
 *   sendEmail({ to, subject, html, text?, replyTo? })
 *
 * Helpers de templates (devuelven { subject, html, text }):
 *   buildInvitationEmail(...)
 *   buildTokenExpiringEmail(...)
 *   buildAlertEmail(...)
 */
const { Resend } = require('resend');
const { email: emailConfig } = require('../config/environment');
const logger = require('../utils/logger');

let resendClient = null;
function getResend() {
  if (!emailConfig.resendApiKey) return null;
  if (!resendClient) resendClient = new Resend(emailConfig.resendApiKey);
  return resendClient;
}

function isEnabled() {
  return !!emailConfig.resendApiKey;
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
 * Manda un email. Devuelve `{ ok, id?, error?, skipped? }`.
 * Nunca tira — si falla, devuelve `{ ok: false, error }` para que el caller decida.
 */
async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!to || !subject || !html) {
    return { ok: false, error: 'to, subject y html son obligatorios' };
  }

  const resend = getResend();
  if (!resend) {
    logger.warn(`[emailService] RESEND_API_KEY no configurada — email a "${to}" no enviado. Subject: "${subject}"`);
    return { ok: false, skipped: true, error: 'email_disabled' };
  }

  try {
    const payload = {
      from: emailConfig.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };
    if (text) payload.text = text;
    if (replyTo || emailConfig.replyTo) payload.reply_to = replyTo || emailConfig.replyTo;

    const { data, error } = await resend.emails.send(payload);
    if (error) {
      logger.error(`[emailService] Resend devolvió error mandando a ${to}: ${error.message || JSON.stringify(error)}`);
      return { ok: false, error: error.message || 'resend_error' };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    logger.error(`[emailService] Excepción mandando email a ${to}: ${err.message}`);
    return { ok: false, error: err.message };
  }
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
  isEnabled,
  buildInvitationEmail,
  buildTokenExpiringEmail,
  buildAlertEmail,
};
