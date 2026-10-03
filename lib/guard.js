// What /api/estimate is allowed to send to Anthropic. The proxy used to forward
// any request body with our API key, so anyone with the URL could run any Claude
// request on our bill. Now the server rebuilds every request from a fixed
// recipe per kind: fixed model and effort, capped max_tokens, and the prompt has
// to have the shape the app itself sends. Anything else is rejected.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// The estimate prompt's fixed RULES block is read from index.html at boot, so the
// check can never drift from the app that is actually deployed alongside it.
function loadEstimateRules(htmlPath = path.join(__dirname, '..', 'index.html')) {
  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const start = html.indexOf('  const RULES=`');
    const end = html.indexOf('`;', start + 15);
    if (start < 0 || end < 0) return null;
    const text = html.slice(start + 15, end);
    if (text.includes('${')) return null; // must be a fixed string to be checkable
    return text;
  } catch (e) { return null; }
}
const ESTIMATE_RULES = loadEstimateRules();
const RULES_SHA = ESTIMATE_RULES ? crypto.createHash('sha256').update(ESTIMATE_RULES).digest('hex') : null;

const SONNET = 'claude-sonnet-5';
const HAIKU = 'claude-haiku-4-5';
const SCOPE_FIX_TEXT = 'Your response was not valid JSON. Return ONLY the corrected JSON object, nothing else.';
const MAX_PROMPT_CHARS = 60000;     // text the client may put in one request
const MAX_ATTACHMENTS = 13;          // 10 photos + 3 PDFs, same caps as the app

const textOf = block => (block && block.type === 'text' && typeof block.text === 'string') ? block.text : null;
const contentBlocks = c => (typeof c === 'string' ? [{ type: 'text', text: c }] : (Array.isArray(c) ? c : null));
const isAttachment = b => b && (b.type === 'image' || b.type === 'document') && b.source && b.source.type === 'base64'
  && typeof b.source.data === 'string' && /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/.test(b.source.media_type || '');
const totalText = msgs => msgs.reduce((n, m) => n + (contentBlocks(m.content) || []).reduce((k, b) => k + (textOf(b) || '').length, 0), 0);
const onlyKeys = (o, keys) => o && typeof o === 'object' && Object.keys(o).every(k => keys.includes(k));
const cleanBlock = b => {
  if (b.type === 'text') { const o = { type: 'text', text: b.text }; if (b.cache_control) o.cache_control = { type: 'ephemeral' }; return o; }
  return { type: b.type, source: { type: 'base64', media_type: b.source.media_type, data: b.source.data } };
};

function scopeUserMessage(m) {
  if (!m || m.role !== 'user') return null;
  const blocks = contentBlocks(m.content);
  if (!blocks || !blocks.length || blocks.length > MAX_ATTACHMENTS + 1) return null;
  const last = blocks[blocks.length - 1];
  if (!textOf(last) || !last.text.startsWith('Construction estimating. Trade:')) return null;
  if (!blocks.slice(0, -1).every(isAttachment)) return null;
  return { role: 'user', content: blocks.map(cleanBlock) };
}

// kind -> { model, cap (max_tokens), effort, pro, stream, build(body) -> messages | null }
const KINDS = {
  scope: {
    model: SONNET, cap: 3000, effort: 'low', counts: false,
    build: b => (b.messages.length === 1 ? (m => m && [m])(scopeUserMessage(b.messages[0])) : null)
  },
  scope_fix: {
    model: SONNET, cap: 1500, effort: 'low', counts: false,
    build: b => {
      if (b.messages.length !== 3) return null;
      const first = scopeUserMessage(b.messages[0]);
      const a = b.messages[1], u = b.messages[2];
      if (!first || !a || a.role !== 'assistant' || typeof a.content !== 'string' || a.content.length > 20000) return null;
      if (!u || u.role !== 'user' || u.content !== SCOPE_FIX_TEXT) return null;
      return [first, { role: 'assistant', content: a.content }, { role: 'user', content: SCOPE_FIX_TEXT }];
    }
  },
  estimate: {
    model: SONNET, cap: 48000, effort: 'medium', stream: true, thinking: true, counts: true,
    build: b => {
      if (!RULES_SHA || b.messages.length !== 1 || b.messages[0].role !== 'user') return null;
      const blocks = contentBlocks(b.messages[0].content);
      if (!blocks || blocks.length !== 3 || !blocks.every(x => textOf(x) !== null)) return null;
      if (crypto.createHash('sha256').update(blocks[0].text).digest('hex') !== RULES_SHA) return null;
      if (!blocks[2].text.startsWith('Trade:') || !blocks[2].text.includes('\nSCOPE:')) return null;
      return [{ role: 'user', content: blocks.map(cleanBlock) }];
    }
  },
  beautify: {
    model: HAIKU, cap: 500, pro: true, counts: false,
    build: b => (b.messages.length === 1 && b.messages[0].role === 'user' && typeof b.messages[0].content === 'string'
      && b.messages[0].content.startsWith('You are a professional proposal writer for contractors.')) ? [{ role: 'user', content: b.messages[0].content }] : null
  },
  insights: {
    model: HAIKU, cap: 400, pro: true, counts: false,
    build: b => (b.messages.length === 1 && b.messages[0].role === 'user' && typeof b.messages[0].content === 'string'
      && b.messages[0].content.startsWith('You are Even, a business intelligence AI for contractors.')) ? [{ role: 'user', content: b.messages[0].content }] : null
  },
  price_sheet: {
    model: HAIKU, cap: 1500, pro: true, counts: false,
    build: b => {
      if (b.messages.length !== 1 || b.messages[0].role !== 'user') return null;
      const blocks = contentBlocks(b.messages[0].content);
      if (!blocks || blocks.length !== 2 || !isAttachment(blocks[0]) || blocks[0].type !== 'image') return null;
      if (!textOf(blocks[1]) || !blocks[1].text.startsWith('Extract all material pricing from this supplier price sheet.')) return null;
      return [{ role: 'user', content: blocks.map(cleanBlock) }];
    }
  }
};

// Returns { kind, spec, body } with a body rebuilt from scratch, or { error }.
function buildRequest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'bad_body' };
  if (!onlyKeys(raw, ['even_kind', 'model', 'max_tokens', 'messages', 'stream', 'thinking', 'output_config'])) return { error: 'unexpected_field' };
  const spec = KINDS[raw.even_kind];
  if (!spec) return { error: 'unknown_kind' };
  if (raw.model !== spec.model) return { error: 'model_not_allowed' };
  if (!Array.isArray(raw.messages)) return { error: 'bad_messages' };
  if (raw.stream && !spec.stream) return { error: 'stream_not_allowed' };
  if (raw.thinking && !(spec.thinking && onlyKeys(raw.thinking, ['type', 'display']) && raw.thinking.type === 'adaptive' && raw.thinking.display === 'summarized')) return { error: 'thinking_not_allowed' };
  if (raw.output_config && !(spec.effort && onlyKeys(raw.output_config, ['effort']) && raw.output_config.effort === spec.effort)) return { error: 'effort_not_allowed' };
  if (totalText(raw.messages) > MAX_PROMPT_CHARS + (ESTIMATE_RULES ? ESTIMATE_RULES.length : 0) + 400000) return { error: 'too_long' };
  const messages = spec.build(raw);
  if (!messages) return { error: 'prompt_shape' };
  const body = { model: spec.model, max_tokens: Math.min(Math.max(1, parseInt(raw.max_tokens, 10) || spec.cap), spec.cap), messages };
  if (spec.effort) body.output_config = { effort: spec.effort };
  if (raw.stream) body.stream = true;
  if (raw.thinking) body.thinking = { type: 'adaptive', display: 'summarized' };
  return { kind: raw.even_kind, spec, body };
}

module.exports = { buildRequest, KINDS, RULES_SHA, ESTIMATE_RULES, SCOPE_FIX_TEXT, loadEstimateRules };
