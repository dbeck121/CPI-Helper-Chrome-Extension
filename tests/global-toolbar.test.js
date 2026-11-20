// node tests/global-toolbar.test.js
// visit history, jump targets and palette ranking of the global floating toolbar
const assert = require("node:assert/strict");
const { CPIH_HISTORY_MAX_RECENT, CPIH_HISTORY_MAX_FAVORITES, CPIH_HISTORY_MAX_BYTES, cpihHistoryBytes, cpihAddVisit, cpihToggleFavorite, cpihBuildHistoryView } = require("../common/visit-history.js");
const { CPIH_JUMP_TARGETS, CPIH_FAILED_MESSAGES_PATH, cpihArtifactJumpTargets, cpihArtifactPath, cpihPackagePath, cpihPackageMessagesPath } = require("../common/jump-targets.js");
const { cpihPaletteSearch, cpihPaletteRecordPick, cpihPaletteUsageBoost, CPIH_PALETTE_USAGE_HALF_LIFE, CPIH_PALETTE_USAGE_MAX_ENTRIES } = require("../common/palette-search.js");

const cases = [];
const test = (name, fn) => cases.push([name, fn]);

const visit = (name, type = "IFlow") => ({ name, fullName: name + " name", url: "https://t/" + name, type });

test("history: a revisit moves the artifact to the end without a duplicate", () => {
  const list = [visit("a"), visit("b"), visit("a")].reduce(cpihAddVisit, []);
  assert.deepEqual(list.map((e) => e.name), ["b", "a"]);
});

test("history: same id with another type is another artifact", () => {
  const list = [visit("a"), visit("a", "Package")].reduce(cpihAddVisit, []);
  assert.equal(list.length, 2);
});

test("history: a revisit keeps the favorite flag", () => {
  let list = [visit("a"), visit("b")].reduce(cpihAddVisit, []);
  list = cpihToggleFavorite(list, visit("a")).entries;
  list = cpihAddVisit(list, visit("a"));
  assert.equal(list.find((e) => e.name === "a").favorit, true);
});

test("history: trimming drops the oldest non favorite, favorites stay", () => {
  let list = cpihAddVisit([], visit("fav"));
  list = cpihToggleFavorite(list, visit("fav")).entries;
  list = Array.from({ length: CPIH_HISTORY_MAX_RECENT + 3 }, (_, i) => visit("r" + i)).reduce(cpihAddVisit, list);
  assert.ok(list.some((e) => e.name === "fav"));
  assert.equal(list.filter((e) => !e.favorit).length, CPIH_HISTORY_MAX_RECENT);
  assert.equal(list.filter((e) => !e.favorit)[0].name, "r3");
});

test("history: favorites are capped", () => {
  const list = Array.from({ length: CPIH_HISTORY_MAX_FAVORITES + 1 }, (_, i) => ({ ...visit("f" + i), favorit: i < CPIH_HISTORY_MAX_FAVORITES }));
  const result = cpihToggleFavorite(list, list[list.length - 1]);
  assert.equal(result.ok, false);
  assert.match(result.error, /favorites/);
  assert.equal(result.entries, list);
});

test("history: removing a favorite trims the recent list again", () => {
  let list = cpihAddVisit([], visit("fav"));
  list = cpihToggleFavorite(list, visit("fav")).entries;
  list = Array.from({ length: CPIH_HISTORY_MAX_RECENT }, (_, i) => visit("r" + i)).reduce(cpihAddVisit, list);
  list = cpihToggleFavorite(list, visit("fav")).entries;
  assert.equal(list.length, CPIH_HISTORY_MAX_RECENT);
  assert.ok(!list.some((e) => e.name === "fav"));
});

// real shaped entry of an Integration Suite host, about 400 bytes
const longVisit = (i) => ({
  name: "SAP_Cloud_for_Customer_Utilities_Service_Order_Get_" + i,
  fullName: "SAP Cloud for Customer Utilities Service Order Get " + i,
  url: "https://mytenant-a1b2c3d4.integrationsuite-cpi033.cfapps.eu10-005.hana.ondemand.com/shell/design/contentpackage/SAPCloudforCustomerUtilitiesSolutionIntegrationwithSAPS4HANA/integrationflows/SAP_Cloud_for_Customer_Utilities_Service_Order_Get_" + i,
  type: "IFlow",
});

test("history: long entries are trimmed to the storage item quota, favorites leave room for recent", () => {
  let list = [];
  for (let i = 0; i < 40; i++) {
    list = cpihAddVisit(list, longVisit(i));
    const result = cpihToggleFavorite(list, longVisit(i));
    if (result.ok) list = result.entries;
  }
  list = Array.from({ length: 20 }, (_, i) => longVisit(100 + i)).reduce(cpihAddVisit, list);
  assert.ok(cpihHistoryBytes(list) + "visitedIflows_mytenant-a1b2c3d4".length <= 8192, "fits chrome.storage.sync per item");
  assert.ok(cpihHistoryBytes(list) <= CPIH_HISTORY_MAX_BYTES);
  assert.ok(list.filter((e) => e.favorit).length >= 10, "favorites kept");
  assert.ok(list.filter((e) => !e.favorit).length >= 3, "recent visits keep some room");
  assert.equal(list[list.length - 1].name, longVisit(119).name);
});

test("history: view is newest first, split and marks the current artifact", () => {
  let list = [visit("a"), visit("b"), visit("c")].reduce(cpihAddVisit, []);
  list = cpihToggleFavorite(list, visit("a")).entries;
  const view = cpihBuildHistoryView(list, { name: "b", type: "IFlow" });
  assert.deepEqual(view.favorites.map((e) => e.name), ["a"]);
  assert.deepEqual(view.recent.map((e) => e.name), ["c", "b"]);
  assert.equal(view.recent[1].current, true);
  assert.equal(view.recent[0].current, false);
});

test("history: label falls back to the id for old entries, doubled package section is fixed", () => {
  const view = cpihBuildHistoryView([{ name: "P1", fullName: "undefined", type: "Package", url: "u?section=ARTIFACTS?section=ARTIFACTS" }], null);
  assert.equal(view.recent[0].label, "P1");
  assert.equal(view.recent[0].url, "u?section=ARTIFACTS");
});

test("history: broken storage values do not throw", () => {
  assert.deepEqual(cpihBuildHistoryView(undefined, null), { favorites: [], recent: [] });
  assert.equal(cpihAddVisit(undefined, visit("a")).length, 1);
});

test("jump: failed messages path is the one the popup always used", () => {
  assert.equal(CPIH_FAILED_MESSAGES_PATH, "/shell/monitoring/Messages/%7B%22status%22%3A%22FAILED%22%2C%22time%22%3A%22PASTHOUR%22%2C%22type%22%3A%22INTEGRATION_FLOW%22%7D");
  assert.ok(CPIH_JUMP_TARGETS.filter((t) => t.toolbar).length >= 10);
  assert.ok(CPIH_JUMP_TARGETS.every((t) => t.area === "Monitor" || t.area === "Design"));
  assert.equal(new Set(CPIH_JUMP_TARGETS.map((t) => t.path)).size, CPIH_JUMP_TARGETS.length);
});

test("jump: iflow gets messages, deployment and package, in the monitor filter format", () => {
  const targets = cpihArtifactJumpTargets({ artifactId: "My_Flow", artifactType: "IFlow", packageId: "Pkg", runtimeLocationId: "cloudintegration" });
  assert.deepEqual(targets.map((t) => t.label), ["Messages of this artifact", "Deployment status", "Open package"]);
  const messages = JSON.parse(decodeURIComponent(targets[0].path.split("/Messages/")[1]));
  assert.deepEqual(messages, { edge: { runtimeLocationId: "cloudintegration" }, status: "ALL", packageId: "ALL", artifactIds: ["My_Flow"], type: "ALL", time: "PASTHOUR" });
  assert.deepEqual(JSON.parse(decodeURIComponent(targets[1].path.split("/Artifacts/")[1])), { edge: { runtimeLocationId: "cloudintegration" }, artifact: "My_Flow" });
  assert.equal(targets[2].path, "/shell/design/contentpackage/Pkg?section=ARTIFACTS");
});

test("jump: value mapping has no messages, unknown package no package entry, no runtime no edge", () => {
  const targets = cpihArtifactJumpTargets({ artifactId: "VM", artifactType: "Value Mapping", packageId: null, runtimeLocationId: null });
  assert.deepEqual(targets.map((t) => t.label), ["Deployment status"]);
  assert.deepEqual(JSON.parse(decodeURIComponent(targets[0].path.split("/Artifacts/")[1])), { artifact: "VM" });
});

test("jump: package messages use the monitor filter of the package", () => {
  const filter = JSON.parse(decodeURIComponent(cpihPackageMessagesPath("Spielwiese", "cloudintegration").split("/Messages/")[1]));
  assert.deepEqual(filter, { edge: { runtimeLocationId: "cloudintegration" }, status: "ALL", packageId: "Spielwiese", type: "ALL", time: "PASTHOUR" });
});

test("jump: workspace types map to editor paths, adapters have none", () => {
  assert.equal(cpihArtifactPath("Pkg", "IFlow", "My_Flow"), "/shell/design/contentpackage/Pkg/integrationflows/My_Flow");
  assert.equal(cpihArtifactPath("Pkg", "OData Service", "X"), "/shell/design/contentpackage/Pkg/odataservices/X");
  assert.equal(cpihArtifactPath("Pkg", "MCPSERVER", "X"), "/shell/design/contentpackage/Pkg/mcpservers/X");
  assert.equal(cpihArtifactPath("Pkg", "IntegrationAdapter", "X"), null);
  assert.equal(cpihPackagePath("A B"), "/shell/design/contentpackage/A%20B?section=ARTIFACTS");
});

const items = [
  { label: "Order to S4", id: "Order_to_S4", sub: "Sales" },
  { label: "Copy and Paste Test", id: "Copy_and_Paste_Test", sub: "CPIHelperTestarea" },
  { label: "Customer Replication", id: "Customer_Replication", sub: "Master Data" },
  { label: "Message Queues", hideWithoutQuery: false },
  { label: "Replicate Orders", id: "Replicate_Orders", sub: "Sales", boost: 30 },
];

test("palette: all words have to match, label start ranks first", () => {
  assert.deepEqual(cpihPaletteSearch(items, "copy paste").map((i) => i.id), ["Copy_and_Paste_Test"]);
  assert.deepEqual(cpihPaletteSearch(items, "order").map((i) => i.id), ["Order_to_S4", "Replicate_Orders"]);
});

test("palette: package name matches with less weight, boost lifts recent items", () => {
  assert.deepEqual(cpihPaletteSearch(items, "sales").map((i) => i.id), ["Replicate_Orders", "Order_to_S4"]);
  assert.deepEqual(cpihPaletteSearch(items, "repl").map((i) => i.id), ["Replicate_Orders", "Customer_Replication"]);
});

test("palette: keywords find actions under other words", () => {
  const actions = [{ label: "Start trace", keywords: "trace on activate enable", boost: 50 }, { label: "Deploy", keywords: "bereitstellen", boost: 50 }, { label: "Monitor - Connectivity Tests" }];
  assert.deepEqual(cpihPaletteSearch(actions, "trace on").map((i) => i.label), ["Start trace"]);
  assert.deepEqual(cpihPaletteSearch(actions, "bereit").map((i) => i.label), ["Deploy"]);
  assert.deepEqual(cpihPaletteSearch(actions, "monitor conn").map((i) => i.label), ["Monitor - Connectivity Tests"]);
});

test("palette: empty query lists boosted first and keeps the order otherwise, limit applies", () => {
  const result = cpihPaletteSearch(items, "  ", 3);
  assert.deepEqual(result.map((i) => i.label), ["Replicate Orders", "Order to S4", "Copy and Paste Test"]);
  assert.deepEqual(cpihPaletteSearch(items, "nothing like this"), []);
});

test("palette usage: more picks give more boost, capped", () => {
  let usage = {};
  const boosts = [];
  for (let i = 0; i < 20; i++) {
    usage = cpihPaletteRecordPick(usage, "jump|/security", 1000);
    boosts.push(cpihPaletteUsageBoost(usage, "jump|/security", 1000));
  }
  assert.equal(boosts[0], 12);
  assert.equal(boosts[2], 24);
  assert.ok(boosts.every((b, i) => i === 0 || b >= boosts[i - 1]));
  assert.equal(boosts[19], 40);
  assert.equal(cpihPaletteUsageBoost(usage, "jump|/other", 1000), 0);
  assert.equal(cpihPaletteUsageBoost(undefined, "jump|/security"), 0);
});

test("palette usage: the score halves after the half life", () => {
  const usage = [1, 2, 3].reduce((u) => cpihPaletteRecordPick(u, "a", 0), {});
  assert.equal(cpihPaletteUsageBoost(usage, "a", 0), 24);
  assert.equal(cpihPaletteUsageBoost(usage, "a", CPIH_PALETTE_USAGE_HALF_LIFE), Math.round(12 * Math.log2(2.5)));
  const later = cpihPaletteRecordPick(usage, "a", CPIH_PALETTE_USAGE_HALF_LIFE);
  assert.equal(later.a.score, 2.5);
});

test("palette usage: only the strongest entries are kept", () => {
  let usage = cpihPaletteRecordPick(cpihPaletteRecordPick({}, "often", 0), "often", 0);
  for (let i = 0; i < CPIH_PALETTE_USAGE_MAX_ENTRIES; i++) usage = cpihPaletteRecordPick(usage, "once" + i, 0);
  assert.equal(Object.keys(usage).length, CPIH_PALETTE_USAGE_MAX_ENTRIES);
  assert.ok(usage.often);
});

test("palette usage: a used page outranks an equal match", () => {
  const pages = [{ label: "Monitor - Security Material" }, { label: "Monitor - System Logs" }];
  assert.deepEqual(cpihPaletteSearch(pages, "s").map((i) => i.label), ["Monitor - System Logs", "Monitor - Security Material"]);
  pages[0].boost = cpihPaletteUsageBoost(cpihPaletteRecordPick({}, "sec", 0), "sec", 0);
  assert.deepEqual(cpihPaletteSearch(pages, "s").map((i) => i.label), ["Monitor - Security Material", "Monitor - System Logs"]);
});

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log("ok   " + name);
  } catch (error) {
    failed++;
    console.log("FAIL " + name + "\n     " + error.message);
  }
}
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
