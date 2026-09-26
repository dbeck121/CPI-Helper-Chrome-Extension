# Drop jQuery + Semantic UI, new payload editor

Status: implemented on branch `feat/drop-jquery-semantic`, needs a check on a real tenant (Chrome and Firefox) before release
Date: 2026-09-26

## Goal

- No jQuery, no Semantic/Fomantic UI (JS **and** CSS) in the content scripts, popup and plugins.
- Payload viewer (trace body, JSON/XML/SQL) rebuilt on a current Ace: one editor view, resizable, fullscreen, toolbar, lossless formatter.
- Drop further dependencies where it is cheap and safe (pako, ulog).

## Decisions / assumptions

- Semantic CSS is replaced by an own, small stylesheet (`css/ui.css`) that implements only the class subset in use
  (`ui button/segment/message/table/menu/tab/form/checkbox/label/list/header/divider/grid/modal/...`).
  It is built on the SAP theming variables (`--sap*`) with fallbacks, so dark mode follows the CPI theme.
- Icons: the Font Awesome icon fonts that shipped inside the Fomantic build move to `lib/icons/`;
  `css/icons.css` maps only the icon classes that are in use (same approach the popup already used).
  Markup like `<i class="copy icon">` stays unchanged.
- Font: `var(--sapFontFamily)` ("72") in the CPI page, Lato (moved to `lib/fonts/`) in the popup.
- Modal DOM stays plugin API: `#cpiHelper_semanticui_modal`, `#cpiHelper_waiting_model`,
  `#cpiHelper_bigPopup_content_semanticui`, `.header[count][maxcount]`, `.scrolling.content`, `.actions`.
  Ids keep their legacy names on purpose.
- Modals are own overlays (no `<dialog>.showModal()`), so toasts stay visible above an open modal.
- All plugins in this repo are migrated. External plugins that use `$` or `.modal()` break; this is announced in the release notes.
- Out of scope: the GitHub pages site under `docs/` (own jQuery copy), `plugins/settingsPaneResizer-inject.js`
  (runs in the page world and uses the jQuery of SAPUI5, not ours).
- JSZip and markdown-it stay (real work, no native replacement). `xmlToJson` is own code and stays.

## Phases

1. **UI kit, CSS, icons (additive).** `common/ui-kit.js` (modal, confirm, toast, tabs, checkbox, table sort,
   search, tooltip, DOM helpers), `css/ui.css`, `css/icons.css`. Loaded next to jQuery/Semantic, nothing breaks.
2. **Core migration.** `scripts/*`, `common/*`, `whatsNew/*` off jQuery and Semantic JS.
3. **Plugin migration.** Every `plugins/*.js` that uses `$`, `.modal()`, `.tab()`, `$.toast`, `.checkbox()`, `.tablesort()`.
4. **Payload editor.** One Ace view with toolbar (pretty/raw, copy, download, wrap, theme, font size, fold, search,
   edit), drag-to-resize with stored height, fullscreen (ESC), lossless XML/JSON formatter (`common/formatter.js`,
   keeps CDATA, comments, PIs, big numbers, key order), parse errors as inline hint.
5. **Ace 1.5 → 1.44.** Same file layout (`lib/ace/*`), `useWorker:false` (CSP), only the modes/themes in use.
6. **Remove jQuery + Semantic.** Manifest, `web_accessible_resources`, `lib/jQuery`, `lib/semanticui`, popup font paths.
7. **Optional dependency cleanup.** pako → native `CompressionStream` (round-trip tested),
   ulog → small own logger with the same `log.*` surface.

## Verification

- Static gate: no `$(`/`$.`/`jQuery` outside `lib/`, `docs/` and the inject file; `node --check` on all scripts.
- Formatter unit tests in Node (`tests/formatter.test.js`).
- Browser harness (Playwright, outside the repo): loads the manifest content scripts in order with `chrome.*` stubbed,
  exercises big popup, waiting popup, confirm, toast over modal, tabs, checkbox, payload editor (resize, fullscreen, ESC),
  fails on any page error, screenshots light and dark.
- Manual check on a real tenant before release (not possible from the dev session).

## Added during implementation

- Modals, toasts and the plugin cards take the look of the floating toolbar / message sidebar (tenant colored header strip, see-through card).
- Hint to the SAP Customer Influence request in the 4.0 welcome card, links to SAP Customer Influence idea 336795.
- Plugin runtime hardening in scripts/plugins.js (error isolation, heartbeat guard, shared settings snapshot, button click fix, validation). No plugin API change.
- Content scripts also run on the Integration Suite / -tmn hosts and on /shell, /itspaces without trailing slash (first load after the login redirect). Hypothesis, see verification.
- Dead code and CSS cleanup, auto refresh setting of the message sidebar is honoured now.

## Before release (manual)

- Real tenant, Chrome: trace popup, payload viewer (resize, fullscreen, Esc), plugin settings, What's New, credential search, log mode, version history revert, Groovy/XSLT debugger share links.
- First load after login in a fresh tab: Network "Preserve log", check the final URL and that the content scripts are listed under Sources.
- Firefox: after an update style install check about:addons permissions for the broader content script matches.
- Other BTP apps on hana.ondemand.com (Cloud Transport Management, issue #315) must not get CPI Helper.
- Runtime picker on a tenant with edge runtimes: the selected location shows "(deployed)", the others only after the info popup ran (getIflowInfoExtended).

## Roadmap after this

- Fallback injection with a background worker (`tabs.onUpdated` + `scripting`) if the manifest fix does not cover every login flow.
- Plugin API v2 (metadataVersion 2.0.0): settings without prefix, explicit pluginHelper (context, ui, storage, log), onActivate / onDeactivate / onPageChange instead of own polling, `registerPlugin()` instead of the global `var plugin`, declarative matches, one observer instead of the four script header intervals.
- Optional dark mode override (auto / light / dark) independent of the CPI theme: toolbar and sidebar CSS to the `--cpih-*` tokens first.

- WXT migration (paused) gets a jQuery-free code base; the UI kit can become an ES module there.
- Rename the legacy modal ids once the plugin API is versioned.
