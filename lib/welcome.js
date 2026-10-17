// Welcome email from the founder (approved idea 2026-10-13; the copy below is the
// DRAFT in tasks/app.md, waiting for the founder's OK). Sent once per account,
// right after the server first sees it (email or Google sign-up alike), in the
// app's language. OFF unless Railway has all of:
//   WELCOME_EMAIL_ENABLED=1, RESEND_API_KEY, WELCOME_FROM_EMAIL
//   (e.g. "Lenny from Even <lenny@...>", needs even-os.com verified in Resend)
// Replies go to REPLY_TO_EMAIL. No address is written in this public repo.
const enabled = () => process.env.WELCOME_EMAIL_ENABLED === '1' && !!process.env.RESEND_API_KEY && !!process.env.WELCOME_FROM_EMAIL;

function welcomeEmail(lang) {
  if (lang === 'es') return {
    subject: 'Bienvenido a Even',
    text: [
      'Hola,', '',
      'Soy Lenny, creé Even. Lo creé porque cotizar un trabajo no debería significar adivinar los permisos o buscar recibos viejos de noche.', '',
      '3 cosas para empezar:',
      '1. Haz tu primer estimado con un trabajo real que estés cotizando ahora.',
      '2. Pon tu overhead y tu ganancia una sola vez en Ajustes. Even usa tus números, nunca los nuestros.',
      '3. Envía la propuesta al cliente directo desde el estimado.', '',
      'P.D. ¿Qué trabajo estás cotizando ahora? Responde y cuéntame. Leo cada mensaje.', '',
      'Lenny', '',
      '¿No quieres correos de Even? Responde "cancelar" y no te enviamos más.'
    ].join('\n')
  };
  return {
    subject: 'Welcome to Even',
    text: [
      'Hey,', '',
      "I'm Lenny, I built Even. I built it because pricing a job shouldn't mean guessing at permits or digging through old receipts at night.", '',
      '3 things to get started:',
      "1. Run your first estimate on a real job you're bidding right now.",
      '2. Set your overhead and profit once in Settings. Even uses your numbers, never ours.',
      '3. Send the client proposal straight from the estimate.', '',
      "P.S. What job are you pricing right now? Hit reply and tell me. I read every one.", '',
      'Lenny', '',
      "Don't want emails from Even? Reply \"unsubscribe\" and you won't get more."
    ].join('\n')
  };
}

// Claims the account's one welcome (welcome_sent_at is set only if it was empty),
// then sends. A second sighting of the same account finds it claimed and stops.
async function sendWelcome({ user, lang, supabaseUrl, serviceKey, fetchImpl, log }) {
  if (!enabled() || !user || !user.email) return { sent: false, reason: 'off' };
  const sk = serviceKey();
  const claim = await fetchImpl(`${supabaseUrl}/rest/v1/users?id=eq.${user.id}&welcome_sent_at=is.null`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', apikey: sk, Authorization: `Bearer ${sk}`, Prefer: 'return=representation' },
    body: JSON.stringify({ welcome_sent_at: new Date().toISOString() })
  });
  const rows = claim.ok ? await claim.json().catch(() => []) : [];
  if (!rows.length) return { sent: false, reason: 'already' };
  const m = welcomeEmail(lang === 'es' ? 'es' : 'en');
  const reply = process.env.REPLY_TO_EMAIL;
  const r = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: process.env.WELCOME_FROM_EMAIL, to: [user.email], subject: m.subject, text: m.text,
      ...(reply ? { reply_to: reply, headers: { 'List-Unsubscribe': `<mailto:${reply}?subject=unsubscribe>` } } : {}) })
  });
  if (!r.ok && log) log('welcome_' + r.status);
  return { sent: r.ok };
}

module.exports = { welcomeEmail, sendWelcome, enabled };
