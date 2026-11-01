// node tests/manifest-matching.test.js
// Checks which pages get the content scripts: Chrome runs them when the url fits one of "matches" AND one of
// "include_globs". Real CPI pages must match, other SAP apps on the same domains must not.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
const script = manifest.content_scripts[0];

// match pattern: scheme://host/path, host may start with "*." (any subdomain), path "*" = anything (incl. query)
function matchesPattern(pattern, url) {
  const [, scheme, host, pathPattern] = pattern.match(/^(\*|https?):\/\/([^/]+)(\/.*)$/);
  const u = new URL(url);
  if (scheme !== "*" && u.protocol !== scheme + ":") return false;
  const hostOk = host === "*" || (host.startsWith("*.") ? u.hostname === host.slice(2) || u.hostname.endsWith(host.slice(1)) : u.hostname === host);
  if (!hostOk) return false;
  return globToRegExp(pathPattern).test(u.pathname + u.search);
}

// glob: "*" any characters, "?" exactly one, matched against the whole url without the fragment
function globToRegExp(glob) {
  return new RegExp("^" + glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
}

function injected(url) {
  const withoutHash = url.split("#")[0];
  const inMatches = script.matches.some((pattern) => matchesPattern(pattern, withoutHash));
  const inGlobs = !script.include_globs || script.include_globs.some((glob) => globToRegExp(glob).test(withoutHash));
  const excluded = (script.exclude_globs || []).some((glob) => globToRegExp(glob).test(withoutHash));
  return inMatches && inGlobs && !excluded;
}

const cpi = [
  "https://acme.integrationsuite.cfapps.eu10.hana.ondemand.com/shell/design",
  "https://acme.integrationsuite.cfapps.eu10.hana.ondemand.com/shell/design/contentpackage/Pkg/integrationflows/Flow",
  "https://acme.integrationsuite-cpi049.cfapps.eu10-003.hana.ondemand.com/shell/home",
  "https://acme.integrationsuite-trial.cfapps.us10-001.hana.ondemand.com/shell/monitoring/Messages",
  "https://acme.integrationsuite.cfapps.eu10.hana.ondemand.com/",
  "https://acme.integrationsuite.cfapps.eu10.hana.ondemand.com/shell",
  "https://acme.integrationsuite.cfapps.eu10.hana.ondemand.com/shell?sap-language=en",
  "https://acme.integrationsuite.cfapps.eu10.hana.ondemand.com/login/callback?code=abc",
  "https://acme.it-cpi018.cfapps.eu10-003.hana.ondemand.com/itspaces/shell/design",
  "https://acme.it-cpi018.cfapps.eu10-003.hana.ondemand.com/itspaces",
  "https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/",
  "https://e1234-tmn.hci.eu2.hana.ondemand.com/",
  "https://acme.integrationsuite.cfapps.cn40.platform.sapcloud.cn/shell/design",
];

const notCpi = [
  // Cloud Transport Management (issue #315)
  "https://acme.ts.cfapps.eu10.hana.ondemand.com/main/webapp/index.html",
  "https://acme.ts.cfapps.eu10.hana.ondemand.com/",
  // BTP cockpit
  "https://cockpit.eu10.hana.ondemand.com/cockpit/#/globalaccount/123",
  "https://emea.cockpit.btp.cloud.sap/cockpit",
  // Build Work Zone / launchpad (UI5 shell in the hash only)
  "https://acme.launchpad.cfapps.eu10.hana.ondemand.com/site?siteId=abc#Shell-home",
  "https://acme.launchpad.cfapps.eu10.hana.ondemand.com/cp.portal/site#Shell-home",
  "https://flpportal-acme.dispatcher.hana.ondemand.com/sites#Shell-home",
  // login pages
  "https://acme.authentication.eu10.hana.ondemand.com/login",
  "https://acme.authentication.eu10.hana.ondemand.com/oauth_error",
  "https://accounts.sap.com/saml2/idp/sso",
  // custom CAP / approuter apps and other services
  "https://acme-dev-myapp.cfapps.eu10.hana.ondemand.com/index.html",
  "https://acme-dev-myapp.cfapps.eu10.hana.ondemand.com/odata/v4/catalog/Books",
  "https://acme.eu10.hanacloud.ondemand.com/",
  "https://api.cf.eu10.hana.ondemand.com/v3/apps",
  "https://acme.cfapps.eu10.hana.ondemand.com/admin/shellscripts/list",
  // "shell" or "itspaces" somewhere else in the path or query of another app
  "https://acme-dev-myapp.cfapps.eu10.hana.ondemand.com/app/shell/index.html",
  "https://acme-dev-myapp.cfapps.eu10.hana.ondemand.com/shellscripts",
  "https://acme-dev-myapp.cfapps.eu10.hana.ondemand.com/index.html?next=/shell/home",
  "https://acme-dev-myapp.cfapps.eu10.hana.ondemand.com/docs/itspaces/x",
  // hana.ondemand.com only in the path or query
  "https://evil.example.com/?next=https://x.hana.ondemand.com/shell/",
  "https://example.com/shell/design",
];

let failed = 0;
const report = (list, expected, label) =>
  list.forEach((url) => {
    const actual = injected(url);
    const ok = actual === expected;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(7)} ${actual ? "injected    " : "not injected"} ${url}`);
  });
report(cpi, true, "CPI");
report(notCpi, false, "other");
console.log(failed ? `${failed} unexpected` : "all as expected");
process.exit(failed ? 1 : 0);
