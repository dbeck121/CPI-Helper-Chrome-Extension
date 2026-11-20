// Checks a pull request against docs/readme/contributing.md and the PR template.
//
// Runs in .github/workflows/pr-check.yml on pull_request_target. The script always comes from the base branch,
// the pull request is only read as data (git diff / git show, parsed, never executed).
//
// Local run:
//   node .github/scripts/pr-check.mjs --base origin/dev --head HEAD --body-file my-pr-body.md
//
// Errors fail the check. The label "pr-check-override" (only maintainers can set labels) turns them into warnings.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as acorn from "acorn";

export const OVERRIDE_LABEL = "pr-check-override";
const REPORT_MARKER = "<!-- cpi-helper-pr-check -->";

// hosts that may appear in code without being "data to another server"
const KNOWN_HOSTS = ["hana.ondemand.com", "platform.sapcloud.cn", "sapcloud.cn", "sap.com", "github.com", "kangoolutions.com", "w3.org", "openxmlformats.org", "xmlsoap.org", "apache.org", "example.com"];
// files that are not plugins although they live in plugins/
const PLUGIN_EXEMPT = [/^plugins\/run\.js$/, /-inject\.js$/];
// changes here are not a visible change and need no changelog
const NON_PRODUCT = [/^docs\//, /^tests\//, /^\.github\//, /\.md$/, /^package(-lock)?\.json$/, /^\.gitignore$/, /^zipFiles\.sh$/];
// changes here are probably visible and need a screenshot
const UI_FILES = [/^css\//, /^popup\//, /^plugins\//, /^scripts\//, /^common\/ui-kit\.js$/, /^images\//];
// manifest keys that change what the extension may do
const SENSITIVE_MANIFEST_KEYS = ["permissions", "optional_permissions", "host_permissions", "optional_host_permissions", "web_accessible_resources", "content_security_policy", "externally_connectable", "background", "key", "sandbox", "declarative_net_request"];

// ---------------------------------------------------------------- results

export function createResults() {
  const items = [];
  return {
    items,
    error: (rule, message, file, line) => items.push({ level: "error", rule, message, file, line }),
    warn: (rule, message, file, line) => items.push({ level: "warning", rule, message, file, line }),
  };
}

// ---------------------------------------------------------------- PR body / template

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

export function parseSections(body) {
  const sections = {};
  let current = null;
  for (const line of stripComments(body || "").split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1].trim();
      sections[current] = [];
    } else if (current) sections[current].push(line);
  }
  for (const key of Object.keys(sections)) sections[key] = sections[key].join("\n").trim();
  return sections;
}

const checkbox = (line) => line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
const checkboxesOf = (text) =>
  text
    .split(/\r?\n/)
    .map(checkbox)
    .filter(Boolean)
    .map((m) => ({ checked: m[1].toLowerCase() === "x", text: m[2].trim() }));

// the checklist is split into groups by plain lines like "General", "Security", "Plugins only"
function checklistGroups(text) {
  const groups = {};
  let current = "General";
  for (const line of text.split(/\r?\n/)) {
    const box = checkbox(line);
    if (box) (groups[current] ||= []).push({ checked: box[1].toLowerCase() === "x", text: box[2].trim() });
    else if (line.trim() && !line.trim().startsWith("-")) current = line.trim();
  }
  return groups;
}

const hasMedia = (text) => /!\[[^\]]*\]\([^)]+\)|<img\s|<video\s|github\.com\/user-attachments\/|\.(png|jpe?g|gif|webp|mp4|mov)\b/i.test(text);

export const CHANGE_TYPES = [
  { key: "bugfix", match: /^bugfix/i },
  { key: "core", match: /^core feature/i },
  { key: "new-plugin", match: /^new plugin/i },
  { key: "plugin", match: /^change to an existing plugin/i },
  { key: "docs", match: /^docs, tests or tooling/i },
];
const ISSUE_REFERENCE = /(^|[\s(])#\d+\b|github\.com\/[^\s/]+\/[^\s/]+\/issues\/\d+/;

const normalizeBox = (text) => text.replace(/[`*_]/g, "").replace(/\s+/g, " ").trim().slice(0, 40).toLowerCase();

export function checkBody(body, { changedFiles = [], pluginChanged = false, coreChanged = false, productChanged = false, addedPlugins = [], uiChanged = "", templateText = null }, r) {
  const sections = parseSections(body);
  const required = ["Type of change", "What and why", "How to reproduce", "Screenshots / GIF", "Data flow", "Checklist"];
  const missing = required.filter((name) => !(name in sections));
  if (missing.length === required.length) {
    r.error("template", "The PR template is not used. Edit the PR description and fill in the template from .github/pull_request_template.md.");
    return { noDataClaimed: false };
  }
  for (const name of missing) r.error("template", `Section "## ${name}" of the PR template is missing.`);

  if ("What and why" in sections && sections["What and why"].replace(/\s+/g, " ").length < 20) r.error("template", 'Section "What and why" is empty or too short. Describe what changes and why.');

  let type = null;
  if ("Type of change" in sections) {
    const checked = checkboxesOf(sections["Type of change"]).filter((b) => b.checked);
    if (checked.length !== 1) r.error("type", 'Check exactly one box in "Type of change".');
    else type = CHANGE_TYPES.find((t) => t.match.test(checked[0].text))?.key || null;
  }
  const whatAndWhy = sections["What and why"] || "";
  if ((type === "core" || type === "new-plugin") && !ISSUE_REFERENCE.test(whatAndWhy)) {
    r.error("issue", 'Core features and new plugins need an issue discussed first. Link it in "What and why" (e.g. "Issue: #123").');
  }
  if (type === "bugfix" && !ISSUE_REFERENCE.test(whatAndWhy)) r.warn("issue", 'No issue linked. If there is one, add "Fixes #123".');
  if (type === "bugfix" && "How to reproduce" in sections) {
    const steps = sections["How to reproduce"].trim();
    if (steps.length < 20 || /^n\/?a\.?$/i.test(steps)) r.error("reproduce", 'Bugfixes need steps to reproduce the bug in "How to reproduce".');
  }
  if (type === "docs" && productChanged) r.error("type", '"Docs, tests or tooling only" is checked, but files of the extension changed. Pick the right type.');
  if (type === "new-plugin" && !addedPlugins.length) r.warn("type", '"New plugin" is checked, but no new file in plugins/ was added.');
  if (type && type !== "new-plugin" && addedPlugins.length) r.warn("type", `A new plugin file was added (${addedPlugins.join(", ")}), but "New plugin" is not checked.`);
  if (type === "plugin" && coreChanged) r.warn("type", '"Change to an existing plugin" is checked, but core files changed too. Core changes need their own PR or an issue.');

  if ("Screenshots / GIF" in sections) {
    const text = sections["Screenshots / GIF"];
    const noUi = /no ui change/i.test(text);
    if (!hasMedia(text) && !noUi) r.error("screenshots", 'No screenshot or GIF in "Screenshots / GIF". Add one, or write "No UI change" if nothing visible changes.');
    if (noUi && !hasMedia(text) && uiChanged) r.warn("screenshots", `"No UI change" is stated, but UI related files changed (${uiChanged}). Please double check.`);
  }

  let noDataClaimed = false;
  if ("Data flow" in sections) {
    const boxes = checkboxesOf(sections["Data flow"]);
    const noData = boxes.find((b) => /no data/i.test(b.text));
    const hosts = boxes.find((b) => /following hosts/i.test(b.text));
    const checked = [noData, hosts].filter((b) => b?.checked);
    if (checked.length !== 1) r.error("data-flow", 'Check exactly one box in "Data flow": no data, or the list of hosts.');
    noDataClaimed = !!noData?.checked && !hosts?.checked;
    if (hosts?.checked) {
      const listed = sections["Data flow"]
        .split(/\r?\n/)
        .filter((line) => /^\s+[-*]\s+/.test(line) && !checkbox(line))
        .filter((line) => !/`host`:\s*what,\s*when/.test(line));
      if (!listed.length) r.error("data-flow", 'You checked that data goes to other hosts, but no host is listed. Add "- `host`: what is sent, when".');
    }
  }

  if ("Checklist" in sections) {
    const text = sections["Checklist"];
    if (/___/.test(text)) r.error("checklist", "Fill in tenant type and browser(s) in the checklist (replace the ___).");
    const groups = checklistGroups(text);
    const applies = (group) => !(/^plugins only/i.test(group) && !pluginChanged) && !(/^core changes only/i.test(group) && !coreChanged);
    // boxes removed from the template count as not confirmed
    if (templateText) {
      const present = new Set(Object.values(groups).flat().map((b) => normalizeBox(b.text)));
      const expected = checklistGroups(parseSections(templateText)["Checklist"] || "");
      for (const [group, boxes] of Object.entries(expected)) {
        if (!applies(group)) continue;
        const missing = boxes.filter((box) => !present.has(normalizeBox(box.text)));
        if (missing.length === 1) r.error("checklist", `Checklist item missing in "${group}": ${missing[0].text.replace(/`/g, "'").replace(/\.$/, "")}. Do not remove items, check them.`);
        else if (missing.length > 1) r.error("checklist", `${missing.length} items of "${group}" are missing in the checklist. Copy the checklist from the PR template again and check the items.`);
      }
    }
    for (const [group, boxes] of Object.entries(groups)) {
      if (!applies(group)) continue;
      const open = boxes.filter((b) => !b.checked && !(/^changelog/i.test(b.text) && !productChanged));
      for (const box of open) r.error("checklist", `Checklist "${group}" not confirmed: ${box.text.replace(/`/g, "'")}`);
    }
  }
  return { noDataClaimed };
}

// ---------------------------------------------------------------- plugins

// walks an AST without descending into function bodies: those only run when the engine calls a hook
function findLoadTimeCode(node, found = []) {
  if (!node || typeof node.type !== "string") return found;
  if (["FunctionExpression", "ArrowFunctionExpression", "FunctionDeclaration"].includes(node.type)) {
    // default values of parameters run on call, not on load. the body is skipped too
    return found;
  }
  if (["CallExpression", "NewExpression", "TaggedTemplateExpression", "AssignmentExpression", "UpdateExpression", "AwaitExpression", "ImportExpression", "YieldExpression"].includes(node.type)) {
    found.push(node);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "start" || key === "end") continue;
    if (Array.isArray(value)) value.forEach((child) => findLoadTimeCode(child, found));
    else if (value && typeof value === "object" && typeof value.type === "string") findLoadTimeCode(value, found);
  }
  return found;
}

const isPluginObjectDeclaration = (statement) =>
  statement.type === "VariableDeclaration" &&
  statement.kind === "var" &&
  statement.declarations.length === 1 &&
  statement.declarations[0].id.type === "Identifier" &&
  statement.declarations[0].id.name === "plugin" &&
  statement.declarations[0].init?.type === "ObjectExpression";

const isPluginPush = (statement) => {
  if (statement.type !== "ExpressionStatement") return false;
  const call = statement.expression;
  if (call.type !== "CallExpression" || call.arguments.length !== 1) return false;
  const callee = call.callee;
  const isPush = callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier" && callee.object.name === "pluginList" && callee.property.name === "push";
  const arg = call.arguments[0];
  return isPush && ((arg.type === "Identifier" && arg.name === "plugin") || arg.type === "ObjectExpression");
};

// (() => { ... })(); or (function () { ... })(); without arguments. Only the wrapper itself is allowed here,
// what is inside is checked statement by statement
const isWrapper = (statement) => {
  if (statement.type !== "ExpressionStatement") return false;
  const call = statement.expression;
  if (call.type !== "CallExpression" || call.arguments.length !== 0) return false;
  const fn = call.callee;
  return ["ArrowFunctionExpression", "FunctionExpression"].includes(fn.type) && fn.body.type === "BlockStatement" && fn.params.length === 0 && !fn.async && !fn.generator;
};

const propertyValue = (object, name) => object?.properties?.find((p) => p.type === "Property" && !p.computed && (p.key.name === name || p.key.value === name))?.value;

// all rule violations of one plugin file. each finding carries the code it is about, so findings of the
// base version can be recognized in the new version even when line numbers moved
function pluginFindings(file, source) {
  const r = createResults();
  const snippet = (node) => source.slice(node.start, Math.min(node.end, node.start + 120)).replace(/\s+/g, " ");
  const error = (rule, message, node, code = node ? snippet(node) : message) => r.items.push({ level: "error", rule, message, file, line: node?.loc.start.line || 1, code });
  let ast;
  try {
    ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script", locations: true, allowHashBang: true });
  } catch (e) {
    r.items.push({ level: "error", rule: "plugin", message: `Plugin file does not parse: ${e.message}`, file, line: e.loc?.line, code: "parse" });
    return r.items;
  }

  let pluginObject = null;
  let pushed = false;
  let wrappers = 0;
  for (const statement of ast.body) {
    if (statement.type === "EmptyStatement") continue;
    if (isPluginObjectDeclaration(statement)) {
      pluginObject = statement.declarations[0].init;
      continue;
    }
    if (isPluginPush(statement)) {
      pushed = true;
      if (statement.expression.arguments[0].type === "ObjectExpression") pluginObject = statement.expression.arguments[0];
      continue;
    }
    if (isWrapper(statement) && ++wrappers === 1) {
      // inside the wrapper: declarations only. Nothing in it may run on load except the declarations
      // themselves and the registration. Names declared here stay private to the plugin
      for (const inner of statement.expression.callee.body.body) {
        if (inner.type === "EmptyStatement" || inner.directive) continue;
        if (inner.type === "FunctionDeclaration") continue;
        if (isPluginObjectDeclaration({ ...inner, kind: "var" }) && !pluginObject) {
          pluginObject = inner.declarations[0].init;
          continue;
        }
        if (isPluginPush(inner)) {
          pushed = true;
          if (inner.expression.arguments[0].type === "ObjectExpression") pluginObject = inner.expression.arguments[0];
          continue;
        }
        if (inner.type === "VariableDeclaration") {
          for (const node of findLoadTimeCode(inner)) {
            error("plugin-load-time", `This declaration runs code on load (${node.type}), also while the plugin is off. Start it from a hook.`, node);
          }
          continue;
        }
        error("plugin-top-level", `Code in the plugin wrapper runs on load (${inner.type}). Inside "(() => { ... })();" only declarations (const, let, var, function) and "pluginList.push(plugin)" are allowed.`, inner);
      }
      continue;
    }
    error("plugin-top-level", `Top-level code outside the plugin object (${statement.type}). Allowed are "var plugin = {...}" with "pluginList.push(plugin)", or one "(() => { ... })();" wrapper that only declares and registers. Everything else runs while the plugin is off.`, statement);
  }

  if (!pluginObject) {
    error("plugin", 'No "var plugin = { ... }" object found.', null, "no-object");
    return r.items;
  }
  if (!pushed) error("plugin", 'The plugin is never registered with "pluginList.push(plugin)".', null, "no-push");

  for (const node of findLoadTimeCode(pluginObject)) {
    error("plugin-load-time", `Code in the plugin object runs on load (${node.type}), also while the plugin is off. Move it into a hook.`, node);
  }

  const id = propertyValue(pluginObject, "id");
  const expectedId = path.basename(file, ".js");
  if (id?.type !== "Literal") error("plugin-metadata", 'The plugin has no literal "id".', pluginObject, "no-id");
  else if (id.value !== expectedId) error("plugin-metadata", `The plugin id "${id.value}" does not match the file name "${expectedId}".`, id, "id-mismatch");
  for (const field of ["name", "author", "description"]) {
    const value = propertyValue(pluginObject, field);
    if (!value || (value.type === "Literal" && !String(value.value).trim())) error("plugin-metadata", `The plugin has no "${field}".`, pluginObject, `no-${field}`);
  }
  for (const field of ["email", "website", "version", "metadataVersion"]) {
    if (!propertyValue(pluginObject, field)) r.items.push({ level: "warning", rule: "plugin-metadata", message: `The plugin has no "${field}".`, file, line: pluginObject.loc.start.line, code: `no-${field}` });
  }
  return r.items;
}

// baseSource: the file before the PR (null for a new plugin). Violations that already existed there are only
// warnings, so a small fix in an old plugin is not blocked. New violations are errors
export function checkPluginSource(file, source, r, baseSource = null) {
  const known = new Map();
  if (baseSource != null) {
    for (const item of pluginFindings(file, baseSource)) {
      const key = item.rule + "|" + item.code;
      known.set(key, (known.get(key) || 0) + 1);
    }
  }
  const legacy = [];
  for (const item of pluginFindings(file, source)) {
    const key = item.rule + "|" + item.code;
    const existed = known.get(key) > 0;
    if (existed) known.set(key, known.get(key) - 1);
    const { code, ...finding } = item;
    if (existed && finding.level === "error") legacy.push(finding);
    else r.items.push(finding);
  }
  if (legacy.length) {
    const lines = [...new Set(legacy.map((f) => f.line))].sort((a, b) => a - b);
    const kinds = [...new Set(legacy.map((f) => f.rule))].join(", ");
    r.warn("plugin-legacy", `${legacy.length} rule violation(s) that were already in this plugin before the PR (${kinds}, lines ${lines.join(", ")}). Not blocking, please clean them up when you rework the plugin.`, file, lines[0]);
  }
}

// ---------------------------------------------------------------- manifest

const stable = (value) => JSON.stringify(value, (key, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));

export function checkManifest(baseText, headText, r) {
  let base, head;
  try {
    head = JSON.parse(headText);
  } catch (error) {
    r.error("manifest", `manifest.json is not valid JSON: ${error.message}`, "manifest.json");
    return;
  }
  base = baseText ? JSON.parse(baseText) : {};
  for (const key of SENSITIVE_MANIFEST_KEYS) {
    if (stable(base[key]) !== stable(head[key])) r.error("manifest", `"${key}" in manifest.json changed. New permissions and web accessible resources need an issue discussed first.`, "manifest.json");
  }
  // adding plugin files to content_scripts is fine, everything else about content scripts is not
  const withoutFiles = (scripts) => (scripts || []).map(({ js, css, ...rest }) => rest);
  if (stable(withoutFiles(base.content_scripts)) !== stable(withoutFiles(head.content_scripts))) {
    r.error("manifest", "content_scripts in manifest.json changed beyond the js/css lists (matches, world, run_at, ...). This needs an issue discussed first.", "manifest.json");
  }
  const baseJs = new Set((base.content_scripts || []).flatMap((s) => s.js || []));
  for (const js of (head.content_scripts || []).flatMap((s) => s.js || [])) {
    if (!baseJs.has(js) && !/^\/?plugins\//.test(js)) r.warn("manifest", `New core content script ${js}. Please double check that it is needed.`, "manifest.json");
  }
}

// ---------------------------------------------------------------- added lines

const isCommentLine = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);
const NETWORK_API = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b|\.open\s*\(|\bsrc\s*=|\bhref\s*=|\baction\s*=|\burl\s*\(|@import/;

export function hostAllowed(host) {
  host = host.toLowerCase();
  return host === "localhost" || KNOWN_HOSTS.some((known) => host === known || host.endsWith("." + known));
}

export function checkAddedLines(file, lines, { noDataClaimed }, r) {
  const isCode = /\.(m?js|html)$/.test(file);
  const isCss = /\.css$/.test(file);
  for (const { line, number } of lines) {
    if ((!isCode && !isCss) || isCommentLine(line)) continue;
    if (isCss) {
      // css is loaded on every CPI page, also while a plugin is off: an external url is a request for every user
      for (const match of line.matchAll(/(?:url\(\s*["']?|@import\s+["'])(?:https?:)?\/\/([a-z0-9.-]+)/gi)) {
        if (!hostAllowed(match[1])) r.error("data-flow", `CSS loads from ${match[1]}. Styles are loaded on every CPI page, ship the file in the extension instead.`, file, number);
      }
      continue;
    }
    if (/\beval\s*\(/.test(line)) r.error("security", "eval() is not allowed.", file, number);
    if (/\bnew\s+Function\s*\(/.test(line)) r.error("security", "new Function() is not allowed.", file, number);
    if (/\bset(Timeout|Interval)\s*\(\s*["'`]/.test(line)) r.error("security", "setTimeout/setInterval with a string is not allowed, pass a function.", file, number);
    if (/\bimport\s*\(\s*["'`]https?:/.test(line) || /<script[^>]+src\s*=\s*["']https?:/i.test(line)) r.error("security", "Code loaded from a remote source is not allowed.", file, number);
    if (/document\.write\s*\(/.test(line)) r.warn("security", "document.write is not wanted. Build the DOM instead.", file, number);
    if (/\.(innerHTML|outerHTML)\s*\+?=\s*(?!["'][^"'$]*["']\s*;?\s*$)/.test(line) && /(\$\{|\+\s*[A-Za-z_$])/.test(line)) {
      r.warn("xss", "innerHTML/outerHTML with dynamic content. Tenant data and user input must be escaped or set with textContent.", file, number);
    }
    if (/insertAdjacentHTML\s*\(/.test(line) && /(\$\{|\+\s*[A-Za-z_$])/.test(line)) r.warn("xss", "insertAdjacentHTML with dynamic content. Escape tenant data and user input.", file, number);
    if (/storage\.sync/.test(line) && /(pass(word)?|token|secret|api.?key|bearer|credential)/i.test(line)) r.warn("secrets", "Possible secret in chrome.storage.sync, which syncs through the Google account.", file, number);
    if (/["']?type["']?\s*:\s*["']textinput["']/.test(line) && /(password|token|secret|api.?key|bearer)/i.test(line)) r.warn("secrets", "A plugin setting that looks like a secret. Plugin settings are synced through the Google account.", file, number);

    for (const match of line.matchAll(/\b(?:https?|wss?):\/\/([a-z0-9.-]+\.[a-z]{2,}|localhost)/gi)) {
      const host = match[1];
      if (hostAllowed(host)) continue;
      if (noDataClaimed && NETWORK_API.test(line)) r.error("data-flow", `Request to ${host}, but the PR says it sends no data to other hosts.`, file, number);
      else r.warn("data-flow", `External host ${host}. Make sure it is listed in "Data flow" if data is sent there.`, file, number);
    }
  }
}

export function looksMinified(file, source) {
  if (/\.min\.(js|css)$/.test(file)) return true;
  const lines = source.split(/\r?\n/);
  if (lines.some((line) => line.length > 1000)) return true;
  return source.length > 2000 && source.length / lines.length > 200;
}

// ---------------------------------------------------------------- git

export function parseDiffAddedLines(diff) {
  const files = new Map();
  let file = null;
  let number = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      file = line === "+++ /dev/null" ? null : line.replace(/^\+\+\+ b\//, "");
      if (file) files.set(file, []);
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      number = Number(hunk[1]);
      continue;
    }
    if (!file) continue;
    if (line.startsWith("+")) files.get(file).push({ line: line.slice(1), number: number++ });
    else if (!line.startsWith("-") && !line.startsWith("\\")) number++;
  }
  return files;
}

// the template of the checked out base branch, so a PR cannot weaken the checklist by editing it
function readTemplate(cwd) {
  try {
    return fs.readFileSync(path.join(cwd, ".github", "pull_request_template.md"), "utf8");
  } catch {
    return null;
  }
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

function gitShow(ref, file, cwd) {
  try {
    return execFileSync("git", ["show", `${ref}:${file}`], { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- global names

// all content scripts share one global scope. A let/const/class whose name another script already declared
// (or the other way round) throws a SyntaxError and the whole later file is not loaded. Two var/function with
// the same name silently overwrite each other. files: [{ file, source }] in manifest order
export function findGlobalClashes(files) {
  const seen = new Map();
  const clashes = [];
  for (const { file, source } of files) {
    let ast;
    try {
      ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
    } catch {
      continue; // parse errors of plugins are reported by checkPluginSource
    }
    for (const statement of ast.body) {
      const names = [];
      if (statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") names.push([statement.id.name, statement.type === "ClassDeclaration" ? "class" : "function"]);
      if (statement.type === "VariableDeclaration") for (const d of statement.declarations) if (d.id.type === "Identifier") names.push([d.id.name, statement.kind]);
      for (const [name, kind] of names) {
        const first = seen.get(name);
        if (!first) {
          seen.set(name, { file, kind });
          continue;
        }
        if (name === "plugin" && first.kind === "var" && kind === "var") continue; // the documented shared plugin variable
        const lexical = (k) => k === "let" || k === "const" || k === "class";
        clashes.push({ name, first: first.file, second: file, fatal: lexical(first.kind) || lexical(kind), kinds: `${first.kind}/${kind}` });
      }
    }
  }
  return clashes;
}

// clashes that the PR introduces. Existing ones are not the PR's fault and are left out
export function checkGlobalNames(baseFiles, headFiles, r) {
  const key = (c) => `${c.name}|${c.first}|${c.second}`;
  const before = new Set(findGlobalClashes(baseFiles).map(key));
  for (const clash of findGlobalClashes(headFiles)) {
    if (before.has(key(clash))) continue;
    const where = `"${clash.name}" is declared at top level in ${clash.first} and ${clash.second} (${clash.kinds})`;
    if (clash.fatal) r.error("global-clash", `${where}. All content scripts share one global scope, so ${clash.second} fails to load with a SyntaxError for every user. Wrap the code in "(() => { ... })();".`, clash.second);
    else r.warn("global-clash", `${where}. All content scripts share one global scope, the later one silently replaces the first. Wrap the code in "(() => { ... })();".`, clash.second);
  }
}

function contentScriptSources(ref, cwd) {
  const manifest = JSON.parse(gitShow(ref, "manifest.json", cwd) || "{}");
  const files = [...new Set((manifest.content_scripts || []).flatMap((s) => s.js || []).map((js) => js.replace(/^\//, "")))];
  return files.map((file) => ({ file, source: gitShow(ref, file, cwd) })).filter((f) => f.source != null);
}

// ---------------------------------------------------------------- whole PR

export function checkPullRequest({ body, baseRef, headRef, labels = [], baseBranch = "dev", cwd = process.cwd() }) {
  const r = createResults();
  const mergeBase = git(["merge-base", baseRef, headRef], cwd).trim();
  const changed = git(["diff", "--name-status", "--no-renames", mergeBase, headRef], cwd)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, file] = line.split("\t");
      return { status, file };
    });
  const live = changed.filter((c) => c.status !== "D");
  const changedFiles = changed.map((c) => c.file);

  if (baseBranch !== "dev") r.error("branch", `The PR targets "${baseBranch}". Pull requests go to "dev".`);

  const pluginFiles = live.map((c) => c.file).filter((f) => /^plugins\/[^/]+\.js$/.test(f) && !PLUGIN_EXEMPT.some((re) => re.test(f)));
  const uiFiles = changedFiles.filter((f) => UI_FILES.some((re) => re.test(f)));
  const productFiles = changedFiles.filter((f) => !NON_PRODUCT.some((re) => re.test(f)));
  const addedPlugins = changed.filter((c) => c.status === "A" && pluginFiles.includes(c.file)).map((c) => c.file);
  const { noDataClaimed } = checkBody(
    body,
    {
      changedFiles,
      pluginChanged: pluginFiles.length > 0,
      coreChanged: productFiles.some((f) => !/^(plugins\/|images\/plugin_logos\/|whatsNew\/|manifest\.json$)/.test(f)),
      productChanged: productFiles.length > 0,
      addedPlugins,
      uiChanged: uiFiles.slice(0, 3).join(", "),
      templateText: readTemplate(cwd),
    },
    r
  );

  for (const file of pluginFiles) {
    const source = gitShow(headRef, file, cwd);
    if (source != null) checkPluginSource(file, source, r, gitShow(mergeBase, file, cwd));
  }

  if (changedFiles.includes("manifest.json")) checkManifest(gitShow(mergeBase, "manifest.json", cwd), gitShow(headRef, "manifest.json", cwd) || "{}", r);
  const headManifest = JSON.parse(gitShow(headRef, "manifest.json", cwd) || "{}");
  const registered = new Set((headManifest.content_scripts || []).flatMap((s) => s.js || []).map((js) => js.replace(/^\//, "")));
  for (const { status, file } of changed) {
    if (status === "A" && pluginFiles.includes(file) && !registered.has(file)) r.warn("plugin", "New plugin is not registered in manifest.json content_scripts.", file);
  }

  if (changedFiles.some((f) => /\.js$/.test(f) && !/^(tests|\.github|docs)\//.test(f)) || changedFiles.includes("manifest.json")) {
    checkGlobalNames(contentScriptSources(mergeBase, cwd), contentScriptSources(headRef, cwd), r);
  }

  for (const { status, file } of live) {
    if (/^lib\//.test(file) && status === "A") r.error("library", `New third party file ${file}. New libraries need an issue discussed first.`, file);
    if (/\.(m?js|css)$/.test(file) && !/^lib\//.test(file) && !/^(tests|node_modules|dist)\//.test(file)) {
      const source = gitShow(headRef, file, cwd) || "";
      if (looksMinified(file, source)) r.error("minified", "Minified or bundled code is not allowed, commit readable source.", file);
    }
  }
  if (changedFiles.includes("package.json")) {
    const deps = (text) => {
      const pkg = JSON.parse(text || "{}");
      return stable({ ...pkg.dependencies, ...pkg.devDependencies });
    };
    if (deps(gitShow(mergeBase, "package.json", cwd)) !== deps(gitShow(headRef, "package.json", cwd))) r.error("library", "Dependencies in package.json changed. New libraries need an issue discussed first.", "package.json");
  }

  const diff = git(["diff", "--no-color", "--unified=0", "--no-renames", mergeBase, headRef, "--", ".", ":(exclude)lib/**", ":(exclude)tests/**", ":(exclude).github/**", ":(exclude)package-lock.json"], cwd);
  for (const [file, lines] of parseDiffAddedLines(diff)) checkAddedLines(file, lines, { noDataClaimed }, r);

  if (productFiles.length) {
    if (!changedFiles.includes("README.md")) r.error("changelog", "No changelog line in README.md.", "README.md");
    if (!changedFiles.includes("whatsNew/whatsNewLog.js")) r.error("changelog", "No changelog line in whatsNew/whatsNewLog.js.", "whatsNew/whatsNewLog.js");
  }
  if (changedFiles.some((f) => f.startsWith(".github/"))) r.warn("ci", "The PR changes files in .github/ (workflows, templates or this check). A maintainer has to review that part.");

  const overridden = labels.includes(OVERRIDE_LABEL);
  if (overridden) for (const item of r.items) if (item.level === "error") Object.assign(item, { level: "warning", overridden: true });
  return { items: r.items, overridden, changedFiles };
}

// ---------------------------------------------------------------- output

const clean = (text) => String(text).replace(/@/g, "@​").replace(/\r?\n/g, " ");

export function renderReport({ items, overridden }) {
  const errors = items.filter((i) => i.level === "error");
  const overruled = items.filter((i) => i.overridden);
  const warnings = items.filter((i) => i.level === "warning" && !i.overridden);
  const where = (i) => (i.file ? ` \`${clean(i.file)}${i.line ? `:${i.line}` : ""}\`` : "");
  const list = (group) => group.map((i) => `- **${i.rule}**${where(i)}: ${clean(i.message)}`);
  const lines = [REPORT_MARKER, "## PR check"];
  if (!errors.length && !warnings.length && !overruled.length) lines.push("", "All checks passed. Thank you for the complete pull request.");
  else {
    if (errors.length) lines.push("", `**${errors.length} problem(s) must be fixed before the review starts.**`);
    else if (overruled.length) lines.push("", `**Passed by maintainer override:** ${overruled.length} problem(s) would block this PR. A maintainer set the label \`${OVERRIDE_LABEL}\` and accepts them for this PR.`);
    else lines.push("", "No blocking problems.");
    if (errors.length) lines.push("", "### Must be fixed", ...list(errors));
    if (overruled.length) lines.push("", "### Accepted by maintainer override", ...list(overruled));
    if (warnings.length) lines.push("", "### Please check", ...list(warnings));
  }
  const repo = process.env.GITHUB_REPOSITORY || "dbeck121/CPI-Helper-Chrome-Extension";
  lines.push("", `Rules: [contributing.md](https://github.com/${repo}/blob/dev/docs/readme/contributing.md). Edit the PR description or push a fix, the check runs again.`);
  return lines.join("\n");
}

const escapeData = (text) => String(text).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProperty = (text) => escapeData(text).replace(/:/g, "%3A").replace(/,/g, "%2C");

function annotate(item) {
  const props = [item.file && `file=${escapeProperty(item.file)}`, item.line && `line=${item.line}`, `title=${escapeProperty(item.rule)}`].filter(Boolean).join(",");
  console.log(`::${item.level} ${props}::${escapeData(item.message)}`);
}

// ---------------------------------------------------------------- cli

function argument(name) {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : undefined;
}

function main() {
  let body = "";
  let labels = [];
  let baseBranch = "dev";
  let baseRef = argument("--base") || process.env.BASE_SHA;
  let headRef = argument("--head") || process.env.HEAD_SHA;
  const event = process.env.GITHUB_EVENT_PATH && JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  if (event?.pull_request) {
    body = event.pull_request.body || "";
    labels = (event.pull_request.labels || []).map((l) => l.name);
    baseBranch = event.pull_request.base.ref;
  }
  if (argument("--body-file")) body = fs.readFileSync(argument("--body-file"), "utf8");
  if (argument("--base-branch")) baseBranch = argument("--base-branch");
  if (!baseRef || !headRef) throw new Error("base and head are missing (--base/--head or BASE_SHA/HEAD_SHA)");

  const result = checkPullRequest({ body, baseRef, headRef, labels, baseBranch });
  const report = renderReport(result);
  result.items.forEach(annotate);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
  if (argument("--report")) fs.writeFileSync(argument("--report"), report);
  else if (!process.env.GITHUB_ACTIONS) console.log("\n" + report);
  if (result.items.some((i) => i.level === "error")) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();
