// "Your free estimates are back" win-back email (founder spec 2026-10-31).
// Who: signed-up accounts with an email, not Pro, not internal/test, not
// unsubscribed, that used all their free estimates OR ran no estimate in 14 days.
// What: top their free count back up so 3 are available, then email them in their
// language. Limits: at most once per 30 days, at most 3 times ever.
// OFF unless Railway has WINBACK_EMAIL_ENABLED=1, RESEND_API_KEY, WELCOME_FROM_EMAIL.
// The daily run is protected by WINBACK_SECRET. No address is written in this public repo.
const crypto = require('crypto');

const DAY = 86400000;
const RULES = { topUpTo: 3, idleDays: 14, everyDays: 30, maxTimes: 3 };
const enabled = () => process.env.WINBACK_EMAIL_ENABLED === '1' && !!process.env.RESEND_API_KEY && !!process.env.WELCOME_FROM_EMAIL;
const unsubSecret = () => process.env.UNSUB_SECRET || process.env.USAGE_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'even-dev';

function unsubToken(userId) { return crypto.createHmac('sha256', unsubSecret()).update('unsub:' + userId).digest('hex').slice(0, 32); }
function unsubOk(userId, token) {
  const a = Buffer.from(unsubToken(userId)), b = Buffer.from(String(token || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Internal and test accounts never get it: the founder's address, anything listed
// in WINBACK_EXCLUDE (comma separated, Railway only), the users.is_internal flag,
// and test addresses (@example.com / @test.*).
function isInternal(u) {
  const email = String(u.email || '').toLowerCase();
  const list = [process.env.FOUNDER_EMAIL, process.env.REPLY_TO_EMAIL, ...String(process.env.WINBACK_EXCLUDE || '').split(',')]
    .map(s => String(s || '').trim().toLowerCase()).filter(Boolean);
  return !!u.is_internal || list.includes(email) || /@example\.(com|org|net)$/.test(email) || /@test\./.test(email);
}

// lastRun: the account's newest estimate_run time (ISO) or null.
function whyEligible(u, { now, freeLimit, lastRun }) {
  if (!u.email) return { ok: false, why: 'no_email' };
  if (u.is_pro) return { ok: false, why: 'pro' };
  if (u.email_unsub) return { ok: false, why: 'unsubscribed' };
  if (isInternal(u)) return { ok: false, why: 'internal' };
  if ((u.winback_count || 0) >= RULES.maxTimes) return { ok: false, why: 'max_times' };
  if (u.winback_last_at && now - Date.parse(u.winback_last_at) < RULES.everyDays * DAY) return { ok: false, why: 'sent_recently' };
  const limit = freeLimit + (u.bonus_estimates || 0), used = u.estimate_count || 0;
  if (used >= limit) return { ok: true, why: 'used_all' };
  const since = lastRun ? Date.parse(lastRun) : Date.parse(u.created_at || 0);
  if (now - since >= RULES.idleDays * DAY) return { ok: true, why: 'idle_14_days' };
  return { ok: false, why: 'active' };
}

// The bonus that leaves 3 free estimates available (never lowers it).
function topUpBonus(u, freeLimit) {
  const used = u.estimate_count || 0, bonus = u.bonus_estimates || 0;
  return Math.max(bonus, used + RULES.topUpTo - freeLimit);
}

function email(lang, { appUrl, unsubUrl }) {
  if (lang === 'es') return {
    subject: 'Tus 3 estimados gratis están de vuelta',
    text: ['Hola,', '', 'Even te arma el estimado completo de un trabajo real: materiales, mano de obra y los permisos de tu ciudad, con tus números.', '',
      'Claridad antes de cotizar.', '', 'Tus 3 estimados gratis están de vuelta.', '', `Haz un estimado: ${appUrl}`, '', 'Lenny, Even', '',
      `¿No quieres más correos de Even? Cancela aquí: ${unsubUrl}`].join('\n'),
    html: `<p>Hola,</p><p>Even te arma el estimado completo de un trabajo real: materiales, mano de obra y los permisos de tu ciudad, con tus números.</p><p><b>Claridad antes de cotizar.</b></p><p>Tus 3 estimados gratis están de vuelta.</p><p><a href="${appUrl}" style="display:inline-block;background:#FFB300;color:#000;padding:12px 20px;border-radius:8px;font-weight:700;text-decoration:none">Haz un estimado</a></p><p>Lenny, Even</p><p style="font-size:12px;color:#888">¿No quieres más correos de Even? <a href="${unsubUrl}">Cancela aquí</a>.</p>`
  };
  return {
    subject: 'Your 3 free estimates are back',
    text: ['Hey,', '', 'Even builds the full estimate for a real job: materials, labor and your city\'s permit fees, with your numbers.', '',
      'Clarity before you bid.', '', 'Your 3 free estimates are back.', '', `Run an estimate: ${appUrl}`, '', 'Lenny, Even', '',
      `Don't want emails from Even? Unsubscribe: ${unsubUrl}`].join('\n'),
    html: `<p>Hey,</p><p>Even builds the full estimate for a real job: materials, labor and your city's permit fees, with your numbers.</p><p><b>Clarity before you bid.</b></p><p>Your 3 free estimates are back.</p><p><a href="${appUrl}" style="display:inline-block;background:#FFB300;color:#000;padding:12px 20px;border-radius:8px;font-weight:700;text-decoration:none">Run an estimate</a></p><p>Lenny, Even</p><p style="font-size:12px;color:#888">Don't want emails from Even? <a href="${unsubUrl}">Unsubscribe</a>.</p>`
  };
}

module.exports = { RULES, enabled, unsubToken, unsubOk, isInternal, whyEligible, topUpBonus, email };
