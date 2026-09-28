// Visited artifacts per tenant (chrome.storage.sync "visitedIflows_<tenant>"), shared by the content script and the node tests.
// The list is ordered oldest first, the last entry is the most recent visit. favorit marks a favorite,
// favorites never fall out of the list when it is trimmed.

const CPIH_HISTORY_MAX_RECENT = 15;
const CPIH_HISTORY_MAX_FAVORITES = 20;
// chrome.storage.sync allows 8192 bytes per item (key + JSON). Long Integration Suite urls take ~400 bytes per entry,
// so the list is also trimmed by size, and favorites may use at most part of it so recent visits keep some room
const CPIH_HISTORY_MAX_BYTES = 7600;
const CPIH_HISTORY_MAX_FAVORITE_BYTES = 5600;

function cpihHistoryBytes(entries) {
  return new TextEncoder().encode(JSON.stringify(entries)).length;
}

function cpihSameArtifact(a, b) {
  return String(a.name) === String(b.name) && a.type === b.type;
}

// drops the oldest non favorites until at most CPIH_HISTORY_MAX_RECENT of them are left and the list fits the storage item
function cpihTrimHistory(entries) {
  let surplus = entries.filter((entry) => !entry.favorit).length - CPIH_HISTORY_MAX_RECENT;
  let list = entries.filter((entry) => entry.favorit || surplus-- <= 0);
  while (cpihHistoryBytes(list) > CPIH_HISTORY_MAX_BYTES) {
    const oldest = list.findIndex((entry) => !entry.favorit);
    if (oldest < 0) break;
    list = list.filter((_, index) => index !== oldest);
  }
  return list;
}

// visit: { name, fullName, url, type }. A revisited artifact moves to the end and keeps its favorite flag
function cpihAddVisit(entries, visit) {
  const list = Array.isArray(entries) ? entries : [];
  const previous = list.find((entry) => cpihSameArtifact(entry, visit));
  const rest = list.filter((entry) => !cpihSameArtifact(entry, visit));
  rest.push({ ...visit, favorit: !!previous?.favorit });
  return cpihTrimHistory(rest);
}

// returns { entries, ok, error }; ok is false when the favorite limit is reached
function cpihToggleFavorite(entries, artifact) {
  const list = Array.isArray(entries) ? entries : [];
  const target = list.find((entry) => cpihSameArtifact(entry, artifact));
  if (!target) return { entries: list, ok: false, error: "This artifact is not in the history anymore." };
  if (!target.favorit) {
    const favorites = list.filter((entry) => entry.favorit);
    if (favorites.length >= CPIH_HISTORY_MAX_FAVORITES || cpihHistoryBytes([...favorites, target]) > CPIH_HISTORY_MAX_FAVORITE_BYTES) {
      return { entries: list, ok: false, error: `No room for more favorites (up to ${CPIH_HISTORY_MAX_FAVORITES}, fewer with long names), remove one first.` };
    }
  }
  const toggled = list.map((entry) => (entry === target ? { ...entry, favorit: !entry.favorit } : entry));
  return { entries: cpihTrimHistory(toggled), ok: true };
}

// older versions stored the missing name as the string "undefined"
function cpihHistoryLabel(entry) {
  return entry.fullName && entry.fullName !== "undefined" && entry.fullName !== "null" ? entry.fullName : String(entry.name);
}

// { favorites, recent }, both newest first. current ({ name, type }) marks the artifact that is open right now
function cpihBuildHistoryView(entries, current) {
  const view = { favorites: [], recent: [] };
  const list = Array.isArray(entries) ? entries : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const entry = list[i];
    const item = {
      ...entry,
      label: cpihHistoryLabel(entry),
      // an old bug stored the package section twice
      url: String(entry.url).replace("?section=ARTIFACTS?section=ARTIFACTS", "?section=ARTIFACTS"),
      current: !!current && cpihSameArtifact(entry, current),
    };
    (entry.favorit ? view.favorites : view.recent).push(item);
  }
  return view;
}

if (typeof module !== "undefined") {
  module.exports = { CPIH_HISTORY_MAX_RECENT, CPIH_HISTORY_MAX_FAVORITES, CPIH_HISTORY_MAX_BYTES, cpihHistoryBytes, cpihAddVisit, cpihToggleFavorite, cpihBuildHistoryView, cpihHistoryLabel };
}
