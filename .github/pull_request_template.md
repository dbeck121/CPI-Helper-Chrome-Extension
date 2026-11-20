<!--
Read the contribution rules first: docs/readme/contributing.md

We know this template is extra work. CPI Helper is maintained voluntarily and unpaid,
and without the template we cannot keep up with the number of pull requests:
a complete PR can be reviewed in minutes, an incomplete one takes hours. Thank you for filling it in.
PRs that leave this template empty or skip a section are closed without review.
An automatic check runs on every PR and lists what is missing.

Found a security problem? Do not open a PR or issue, see SECURITY.md.
-->

## Type of change

<!-- Check exactly one. -->

- [ ] Bugfix
- [ ] Core feature or improvement (needs an issue discussed first)
- [ ] New plugin (needs an issue discussed first)
- [ ] Change to an existing plugin
- [ ] Docs, tests or tooling only

## What and why

<!-- What does this PR change, and which problem does it solve?
     Link the issue: "Fixes #123" or "Issue: #123". Required for core features and new plugins. -->

## How to reproduce

<!-- Bugfix only: steps to reproduce the bug before the fix, and what happens now instead.
     Other types: write "n/a". -->

## Screenshots / GIF

<!-- Required for every visible change (toolbar, popup, plugin panel, dialogs). Before and after, light and dark theme if the look differs.
     Write "No UI change" only if nothing visible changes. -->

## Data flow

<!-- Exactly one of the two. Every request that does not go to the SAP Cloud Integration tenant counts:
     fetch, XHR, WebSocket, images, iframes, scripts, fonts, links that send data in the URL. -->

- [ ] This PR sends **no data** anywhere except the CPI tenant the user has open.
- [ ] This PR sends data to the following hosts (list each host, what is sent and when):
  - `host`: what, when

## Checklist

General
- [ ] Target branch is `dev`, one topic per PR.
- [ ] I tested the change myself on a real CPI tenant. Tenant type (Neo / Cloud Foundry): ___ Browser(s): ___ (Firefox too if browser APIs are touched).
- [ ] I read and understand every line, including code written by AI tools.
- [ ] All code is my own or GPL-3.0 compatible, copied code names its source.
- [ ] Changelog line added to `README.md` and `whatsNew/whatsNewLog.js` (`[Feature]`, `[Fix]`, `[Plugin]`, ...). Not needed for docs, tests or tooling only.

Security
- [ ] No `eval`, `new Function`, `setTimeout`/`setInterval` with strings, and no code loaded from a remote source.
- [ ] No minified, bundled or obfuscated code. Everything is readable source.
- [ ] Data from the tenant or user input never goes into `innerHTML` unescaped (use `textContent` or escape it).
- [ ] No new `permissions`, `host_permissions` or `web_accessible_resources` in `manifest.json`, no new scripts injected into the page itself.
- [ ] No new library without an issue discussed first.
- [ ] No passwords, tokens or keys in `chrome.storage.sync` or plugin settings (they sync through the Google account). Nothing stored beyond what the feature needs, no secrets in the console.
- [ ] Changes on the tenant (save, deploy, undeploy, delete, unlock, revert) only after an explicit click, destructive ones ask with `cpihConfirm` first.

Core changes only (anything outside `plugins/`)
- [ ] Works on Neo and Cloud Foundry tenants, or the PR says why only one is affected.
- [ ] Existing plugins still work (the plugin API in `scripts/plugins.js` is unchanged, or the change is described above).

Plugins only
- [ ] The plugin file only declares and registers: either one `(() => { ... })();` wrapper with declarations and `pluginList.push(plugin)`, or just `var plugin = { ... };` and `pluginList.push(plugin);`. No listeners, intervals, observers or injected scripts outside hooks.
- [ ] Nothing runs while the plugin is not activated.
- [ ] External calls (if any) only happen after a user action and are named in the plugin `description`.
- [ ] If the plugin needs an account, a license or a paid service, the `description` says so.
- [ ] CSS is scoped to the plugin (classes prefixed with the plugin id), no global styles.
- [ ] Plugin metadata (`id` = file name, `author`, `email`, `website`, `description`) is filled in.
