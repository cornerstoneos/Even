// Even admin sales CRM: pure logic (no DOM, no network) so tests can run it in Node.
// Loaded by admin/index.html only. The contractor app (index.html) never loads this.
(function (root) {
  const CHANNELS = ['call', 'ig', 'fb', 'tiktok', 'supply_house', 'group_post'];
  const CHANNEL_LABEL = { call: 'Call', ig: 'Instagram', fb: 'Facebook', tiktok: 'TikTok', supply_house: 'Supply house', group_post: 'Group post' };
  const OUTCOMES = ['answered', 'no answer', 'call back', 'follow up', 'not interested', 'yes', 'appointment', 'sale'];
  const STAGES = ['New', 'Contacted', 'Demo', 'Customer', 'Lost'];
  const SH_STAGES = ['not contacted', 'visited', 'talking', 'price sheet received', 'partner'];
  const COUNTIES = ['Miami-Dade', 'Broward', 'Palm Beach'];
  const EXPENSE_CATS = ['API', 'hosting', 'software', 'ads', 'giving', 'other'];
  const NOTE_PRESETS = ['Left voicemail', 'Sent DM', 'Asked who handles estimates', 'Wants a demo', 'Send the link', 'Running a job for them',
    'Already has a tool', 'Uses a spreadsheet', 'Too busy, call later', 'Gatekeeper / office', 'Spanish speaker', 'Wrong number'];
  const OBJECTIONS = ['Too expensive', 'Already have a tool', 'Do estimates in my head', 'Office / estimator handles it', 'No time right now',
    'Don\'t trust the numbers', 'Not interested', 'Send me info'];
  // Outcomes that count toward each rate. A sale also counts as a yes and an appointment.
  const YES = new Set(['yes', 'appointment', 'sale']);
  const APPT = new Set(['appointment', 'sale']);

  // ---- dates (all in Eastern time; the business runs on Miami time) ----
  function etToday(now) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now || new Date());
    return p; // YYYY-MM-DD
  }
  function parseD(s) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
  function fmtD(dt) { return dt.toISOString().slice(0, 10); }
  function addDays(s, n) { const d = parseD(s); d.setUTCDate(d.getUTCDate() + n); return fmtD(d); }
  function dow(s) { return parseD(s).getUTCDay(); } // 0 = Sunday
  function weekStart(s) { const w = dow(s); return addDays(s, w === 0 ? -6 : 1 - w); } // Monday
  // Work days left this week counting today (Mon-Sat by default; Sunday is off).
  function workDaysLeft(s, workDays) {
    const wd = workDays || [1, 2, 3, 4, 5, 6];
    if (dow(s) === 0) return 0;
    let n = 0;
    for (let d = s; dow(d) !== 0; d = addDays(d, 1)) if (wd.includes(dow(d))) n++;
    return n;
  }

  // ---- today's rolling target ----
  // (weekly goal - done before today) / work days left including today, never below the floor.
  // Uses touches BEFORE today so the target holds still while you work through the day.
  function rollingTarget(o) {
    const left = workDaysLeft(o.today, o.workDays);
    if (left === 0) return { target: 0, dayOff: true, left, doneBefore: 0, doneWeek: 0 };
    const ws = weekStart(o.today);
    let doneBefore = 0, doneWeek = 0;
    for (const t of o.touches) {
      if (t.touch_date >= ws && t.touch_date <= o.today) { doneWeek++; if (t.touch_date < o.today) doneBefore++; }
    }
    const remaining = Math.max(0, o.goal - doneBefore);
    const target = Math.max(o.floor, Math.ceil(remaining / left));
    return { target, dayOff: false, left, doneBefore, doneWeek };
  }

  function countBy(list, key) { const m = {}; for (const x of list) { const k = x[key]; m[k] = (m[k] || 0) + 1; } return m; }

  // ---- rates per channel ----
  function channelRates(touches) {
    const out = {};
    for (const c of CHANNELS) out[c] = { touches: 0, yes: 0, appt: 0, sales: 0 };
    for (const t of touches) {
      const r = out[t.channel]; if (!r) continue;
      r.touches++; if (YES.has(t.outcome)) r.yes++; if (APPT.has(t.outcome)) r.appt++; if (t.outcome === 'sale') r.sales++;
    }
    for (const c of CHANNELS) {
      const r = out[c];
      r.yesRate = r.touches ? r.yes / r.touches : 0;
      r.apptRate = r.touches ? r.appt / r.touches : 0;
      r.closeRate = r.touches ? r.sales / r.touches : 0;
      r.touchesPerSale = r.sales ? r.touches / r.sales : null;
    }
    return out;
  }

  // ---- stage + follow-up rules applied when a touch is logged ----
  function stageAfter(current, outcome) {
    if (current === 'Customer') return 'Customer';
    if (outcome === 'sale') return 'Customer';
    if (outcome === 'appointment') return 'Demo';
    if (outcome === 'not interested') return 'Lost';
    if (current === 'New' || !current) return 'Contacted';
    return current;
  }
  // Default next follow-up (days from today); the person can change it before or after logging.
  const FOLLOW_DAYS = { 'no answer': 3, 'call back': 3, 'follow up': 3, answered: 7, yes: 1, appointment: 1 };
  function defaultFollowUp(outcome, today) {
    const n = FOLLOW_DAYS[outcome];
    return n ? addDays(today, n) : null;
  }

  // Latest touch per lead (or supply house) whose follow-up date has come. Done/blocked leads drop out.
  function followUpsDue(touches, today, key, isOpen) {
    const latest = {};
    for (const t of touches) {
      const id = t[key]; if (!id) continue;
      const cur = latest[id];
      if (!cur || t.created_at > cur.created_at) latest[id] = t;
    }
    return Object.values(latest)
      .filter(t => t.next_follow_up && t.next_follow_up <= today && (!isOpen || isOpen(t[key])))
      .sort((a, b) => a.next_follow_up < b.next_follow_up ? -1 : a.next_follow_up > b.next_follow_up ? 1 : 0);
  }

  // ---- by-city view ----
  function byCity(leads, touches, coverage) {
    const cov = {};
    for (const c of (coverage || [])) cov[c.city.toLowerCase()] = c.status;
    const leadCity = {};
    const rows = {};
    const row = city => (rows[city] = rows[city] || { city, leads: 0, touches: 0, yeses: 0, customers: 0, coverage: cov[city.toLowerCase()] || 'not on list' });
    for (const l of leads) {
      const city = l.city || '(no city)';
      leadCity[l.id] = city;
      const r = row(city); r.leads++; if (l.stage === 'Customer') r.customers++;
    }
    for (const t of touches) {
      if (!t.lead_id || !leadCity[t.lead_id]) continue;
      const r = row(leadCity[t.lead_id]); r.touches++; if (YES.has(t.outcome)) r.yeses++;
    }
    return Object.values(rows).sort((a, b) => b.leads - a.leads || a.city.localeCompare(b.city));
  }

  function nextId(prefix, rows) {
    let max = 0;
    for (const r of rows) { const m = new RegExp('^' + prefix + '(\\d+)$').exec(r.id || ''); if (m) max = Math.max(max, Number(m[1])); }
    return prefix + String(max + 1).padStart(3, '0');
  }

  // ---- CSV export ----
  // Quotes every cell; a leading = + - @ gets a ' so a spreadsheet never runs it as a formula.
  function csvCell(v) {
    if (v == null) return '""';
    let s = Array.isArray(v) ? v.join('; ') : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function toCSV(rows, cols) {
    return [cols.map(csvCell).join(',')].concat(rows.map(r => cols.map(c => csvCell(r[c])).join(','))).join('\r\n') + '\r\n';
  }

  const api = { CHANNELS, CHANNEL_LABEL, OUTCOMES, STAGES, SH_STAGES, COUNTIES, EXPENSE_CATS, NOTE_PRESETS, OBJECTIONS,
    etToday, addDays, weekStart, workDaysLeft, rollingTarget, countBy, channelRates, stageAfter, defaultFollowUp,
    followUpsDue, byCity, nextId, csvCell, toCSV };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CRM = api;
})(this);
