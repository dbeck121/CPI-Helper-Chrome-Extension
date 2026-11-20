# Contributing

| [Home](/README.md) | [Plugin Dev](/docs/readme/PluginREADME.md) | [Code of conduct](/docs/readme/code_of_conduct.md) | [License](/docs/LICENSE) |
| ------------------ | ------------------------------------------ | -------------------------------------------------- | ------------------------ |

**Security problems are not reported in public issues or PRs.** See [SECURITY.md](/SECURITY.md).

Pull requests are welcome. CPI Helper runs inside the SAP Cloud Integration of many companies with the session of the user, so every PR is reviewed with that in mind. The rules below are not optional. **PRs that do not follow them or leave the PR template empty are closed without review.**

We know that filling in the template and following these rules is extra work. We still ask for it: CPI Helper is maintained voluntarily and unpaid, and the number of pull requests has grown so much that we cannot review them otherwise. A complete PR with screenshots and a clear data flow statement can be reviewed way faster. An incomplete one takes hours of back and forth, or never gets merged. Thank you for taking the time.

For bigger changes, new plugins or new libraries, open an issue first and wait for feedback before you build it.

## 1. The pull request

- Target branch is `dev`. One topic per PR, no unrelated formatting or refactoring.
- Fill in the [PR template](/.github/pull_request_template.md) completely and pick the type of change. Bugfixes need steps to reproduce, core features and new plugins a linked issue.
- An automatic check runs on every PR and comments what is missing or breaks a rule. Fix everything under "Must be fixed" before you ask for a review. The check reruns when you push or edit the description.
- Describe what changes and why, link the issue.
- **Screenshots or a short GIF for every visible change.** Toolbar, popup, plugin panel, dialogs, toasts. Before and after, light and dark theme if they look different. Without screenshots there is no review.
- Test it yourself on a real tenant and say which (Neo or Cloud Foundry) and in which browser. CPI Helper ships to Chrome, Edge and Firefox, so changes to browser APIs are tested in Firefox too.
- Your code is GPL-3.0 compatible. Code copied from elsewhere names its source and license.
- You are responsible for every line. AI generated code is fine if you have read, understood and tested it. Large unreviewed AI dumps are closed.
- Add a changelog line to `README.md` and `whatsNew/whatsNewLog.js` with a prefix like `[Feature]`, `[Fix]`, `[Improvement]` or `[Plugin]`.

## 2. Data never leaves the browser unless the user wants it

CPI Helper does not collect or send data. It only talks to the tenant the user has open. This has to stay true.

- Every PR states in the template whether it sends data anywhere other than the CPI tenant. **"Anywhere" means any request**: fetch, XHR, WebSocket, images, iframes, scripts, fonts, and links that carry data in the URL.
- No tracking, analytics, telemetry or error reporting to any server.
- Core features (everything outside `plugins/`) never call external servers.
- Plugins may call an external service only if it is the purpose of the plugin (e.g. an external IDE), only after the user activated the plugin and triggered the action, and the `description` of the plugin says so.
- No payloads, headers, credentials or tenant names in logs that end up outside the browser.

## 3. Security

- No `eval`, `new Function`, `setTimeout`/`setInterval` with strings, no code or config loaded from a remote source at runtime.
- No minified, bundled or obfuscated code. Reviewers have to be able to read every line that ships.
- Tenant data and user input never go into `innerHTML` unescaped. Use `textContent` or escape it. iFlow names, headers and payloads can contain HTML.
- No new `permissions`, `host_permissions` or `web_accessible_resources` in `manifest.json` and no scripts injected into the page itself without an issue discussed first. Injected scripts run in the context of SAP's page, not in the isolated extension world.
- No new third party library without an issue discussed first. If accepted, it goes into `lib/` with a fixed version, never from a CDN.
- Store only what the feature needs. Never put passwords, tokens or keys into `chrome.storage.sync` or plugin settings: they are synced through the user's Google account. If a feature really has to keep a secret, it goes into `chrome.storage.local`, the user is told, and it is discussed in an issue first.
- Changes on the tenant (save, deploy, undeploy, delete, unlock, revert) happen only after an explicit click. Destructive actions ask with `cpihConfirm` first.
- Use the existing CPI session and APIs. Do not ask the user for credentials.

## 4. Plugins

Plugins are community code. They are switched off by default, and when a user switches one on CPI Helper shows a warning that plugins are used at their own risk and are not reviewed by the CPI Helper team. To make that switch mean something:

- **Nothing runs and no global names are declared while the plugin is not active.** All plugin files are loaded on every CPI page, active or not. So the file either wraps everything in one `(() => { ... })();` that only declares helpers and registers the plugin, or contains only `var plugin = { ... };` and `pluginList.push(plugin);` at top level. Listeners, observers and intervals are started from a hook. See [Plugin Dev](/docs/readme/PluginREADME.md#nothing-runs-while-the-plugin-is-off).
- Plugins are released under the same license as CPI Helper.
- Fill in the metadata: `id` equals the file name, `author`, `email`, `website`, `description`.
- A plugin does not change core files. If you need something from the core, open an issue.
- CSS of a plugin is scoped to the plugin (classes prefixed with the plugin id). No global styles that change SAP's UI or other plugins.
- If a plugin needs an account, a license or a paid service, its `description` says so.
- Existing plugins that do not follow these rules yet are not blocked by them: a PR must not add new violations, the old ones are reported as warnings and cleaned up when the plugin is reworked. The `id` of an existing plugin is never renamed, it is the storage key of its settings.

## 5. What gets closed without review

- empty or incomplete PR template
- visible change without screenshots
- unclear or missing data flow statement
- calls to external servers that are not declared
- minified or obfuscated code
- new permissions, host permissions or libraries without a prior issue
- plugin code that runs or declares global names while the plugin is off
- mixed topics, mass reformatting, generated code nobody tested

**Working on your first Pull Request?** You can learn how from this _free_ series [How to Contribute to an Open Source Project on GitHub](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github)
