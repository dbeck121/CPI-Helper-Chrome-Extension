// Ranking of the command palette (Cmd/Ctrl+K), shared by the content script and the node tests.
// item: { label, id?, sub?, keywords?, boost? }. Every word of the query has to match label, id, sub or keywords; a match at the start of
// the label counts most. boost lifts favorites and recently visited artifacts, cpihPaletteUsageBoost what was picked often.

// the token starts the text or follows a separator, e.g. "paste" in "copy_and_paste_test"
function cpihPaletteWordStart(text, token) {
  for (let index = text.indexOf(token); index >= 0; index = text.indexOf(token, index + 1)) {
    if (index === 0 || /[\s_\-./]/.test(text[index - 1])) return true;
  }
  return false;
}

function cpihPaletteScoreToken(fields, token) {
  const { label, id, sub, keywords } = fields;
  if (label.startsWith(token)) return 100;
  if (id.startsWith(token)) return 90;
  if (cpihPaletteWordStart(label, token)) return 70;
  if (cpihPaletteWordStart(id, token)) return 60;
  if (label.includes(token)) return 50;
  if (id.includes(token)) return 40;
  if (cpihPaletteWordStart(keywords, token)) return 20;
  if (sub.includes(token)) return 10;
  return 0;
}

function cpihPaletteSearch(items, query, limit = 50) {
  const tokens = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  const list = Array.isArray(items) ? items : [];

  // no query: what was used lately and the fixed targets, in the order they were given
  if (tokens.length === 0) {
    return list
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.hideWithoutQuery)
      .sort((a, b) => (b.item.boost || 0) - (a.item.boost || 0) || a.index - b.index)
      .slice(0, limit)
      .map(({ item }) => item);
  }

  const scored = [];
  for (const item of list) {
    const fields = {
      label: String(item.label || "").toLowerCase(),
      id: String(item.id || "").toLowerCase(),
      sub: String(item.sub || "").toLowerCase(),
      keywords: String(item.keywords || "").toLowerCase(),
    };
    let score = 0;
    for (const token of tokens) {
      const tokenScore = cpihPaletteScoreToken(fields, token);
      if (tokenScore === 0) {
        score = 0;
        break;
      }
      score += tokenScore;
    }
    if (score > 0) scored.push({ item, score: score + (item.boost || 0), length: fields.label.length });
  }
  scored.sort((a, b) => b.score - a.score || a.length - b.length);
  return scored.slice(0, limit).map(({ item }) => item);
}

// picks per item key: { key: { score, time } }. A pick adds 1, the score halves every 30 days, so what was used
// often lately ranks above what was used often long ago. Only the strongest entries are kept
const CPIH_PALETTE_USAGE_HALF_LIFE = 30 * 24 * 60 * 60 * 1000;
const CPIH_PALETTE_USAGE_MAX_ENTRIES = 200;
const CPIH_PALETTE_USAGE_MAX_BOOST = 40;

function cpihPaletteUsageScore(entry, now) {
  if (!entry || !(entry.score > 0)) return 0;
  return entry.score * Math.pow(0.5, Math.max(0, now - (entry.time || 0)) / CPIH_PALETTE_USAGE_HALF_LIFE);
}

function cpihPaletteRecordPick(usage, key, now = Date.now()) {
  const next = { ...(usage || {}) };
  next[key] = { score: cpihPaletteUsageScore(next[key], now) + 1, time: now };
  const keys = Object.keys(next);
  if (keys.length > CPIH_PALETTE_USAGE_MAX_ENTRIES) {
    keys
      .sort((a, b) => cpihPaletteUsageScore(next[b], now) - cpihPaletteUsageScore(next[a], now))
      .slice(CPIH_PALETTE_USAGE_MAX_ENTRIES)
      .forEach((stale) => delete next[stale]);
  }
  return next;
}

// 1 pick: 12, 3 picks: 24, 7 picks: 36, capped below the boost of the page actions
function cpihPaletteUsageBoost(usage, key, now = Date.now()) {
  const score = cpihPaletteUsageScore(usage?.[key], now);
  return score > 0 ? Math.min(CPIH_PALETTE_USAGE_MAX_BOOST, Math.round(12 * Math.log2(1 + score))) : 0;
}

if (typeof module !== "undefined") {
  module.exports = { cpihPaletteSearch, cpihPaletteRecordPick, cpihPaletteUsageBoost, CPIH_PALETTE_USAGE_HALF_LIFE, CPIH_PALETTE_USAGE_MAX_ENTRIES };
}
