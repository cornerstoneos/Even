// Build-ready notifications (founder spec 2026-10-31): web push + email, both OFF
// until Railway has the switches. Nothing secret is written in this public repo.
//   Push:  PUSH_ENABLED=1, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (VAPID_SUBJECT optional)
//   Email: BUILD_EMAIL_ENABLED=1, RESEND_API_KEY, NOTIFY_FROM_EMAIL (even-os.com verified in Resend)
const pushOn = () => process.env.PUSH_ENABLED === '1' && !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
const emailOn = () => process.env.BUILD_EMAIL_ENABLED === '1' && !!process.env.RESEND_API_KEY && !!process.env.NOTIFY_FROM_EMAIL;

// The exact words from the spec, in the contractor's language.
function buildMessage(ok, label, lang) {
  const es = lang === 'es';
  const job = String(label || '').trim() || (es ? 'tu trabajo' : 'your job');
  if (ok) return { title: 'Even', body: es ? `Tu estimado para ${job} está listo.` : `Your estimate for ${job} is ready.` };
  return { title: 'Even', body: es ? `No pudimos terminar ${job}. Toca para intentar de nuevo.` : `We couldn't finish ${job}. Tap to try again.` };
}

let webpush = null;
function pushLib() {
  if (!webpush) {
    webpush = require('web-push');
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@even-os.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  }
  return webpush;
}

// Sends one push to every device the account subscribed. Dead endpoints (404/410)
// are removed. `send` can be swapped in tests; it defaults to the web-push library.
async function pushToUser({ userId, payload, sbRest, send }) {
  if (!pushOn() || !userId) return { sent: 0, reason: 'off' };
  const subs = (await sbRest('GET', `push_subscriptions?user_id=eq.${userId}&select=id,endpoint,keys`)).data || [];
  const doSend = send || ((sub, body) => pushLib().sendNotification(sub, body, { TTL: 86400 }));
  let sent = 0;
  for (const s of subs) {
    try {
      await doSend({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload));
      sent++;
      sbRest('PATCH', `push_subscriptions?id=eq.${s.id}`, { last_ok_at: new Date().toISOString() }, 'return=minimal').catch(() => {});
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await sbRest('DELETE', `push_subscriptions?id=eq.${s.id}`, null, 'return=minimal').catch(() => {});
    }
  }
  return { sent, devices: subs.length };
}

async function emailUser({ to, subject, text, fetchImpl }) {
  if (!emailOn() || !to) return false;
  const r = await (fetchImpl || fetch)('https://api.resend.com/emails', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM_EMAIL, to: [to], subject, text, ...(process.env.REPLY_TO_EMAIL ? { reply_to: process.env.REPLY_TO_EMAIL } : {}) })
  });
  return r.ok;
}

module.exports = { pushOn, emailOn, buildMessage, pushToUser, emailUser };
