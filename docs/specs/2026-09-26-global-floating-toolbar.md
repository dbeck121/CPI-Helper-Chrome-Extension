# Global Floating Toolbar

Status: Phase 1 approved for planning. Phases 2–4 are roadmap only.

## Goal

The floating toolbar (`scripts/floatingToolbar.js`) currently exists only on artifact pages (IFlow, API types, MCP Server). It becomes the CPI Helper's everywhere-entry point: it shows on every CPI page the content script runs on, with a small set of global buttons, and keeps the artifact buttons on artifact pages.

Decisions taken:

- One toolbar with two modes (approach A), not a persistent bar with swappable sections.
- The old header button `#__cpihelper` (`scripts/Mode-Script.js`) stays unchanged, in parallel.
- The Plugins button only opens plugin management. There is no new plugin hook for global buttons.

## Phase 1 (this implementation)

### Modes

`buildFloatingToolbar()` in `scripts/contentScript.js` gets a mode:

| Mode | When | Buttons |
|---|---|---|
| `artifact` | `cpiData.currentArtifactType` is in `AllowedTypes` (as today) | Trace, Messages, Info, Logs, Runtime · plugin buttons · **Jump to** · **Recent** · Manage plugins |
| `global` | every other page | **Jump to** · **Recent** · **Plugins** |

- Rebuild key: `data-artifact-id` becomes `artifactId ?? "global"`. The toolbar is rebuilt only when this key changes (same guard as today, `buildButtonBar()` concurrency lock stays).
- Heartbeat (`contentScript.js` ~l.1788): the `else` branch no longer calls `removeFloatingToolbar()`; it calls `buildButtonBar()` in global mode. `sidebar.deactivate()` outside artifacts stays.
- `addBreadcrumbs()` stays artifact-only.
- Position and expanded state stay shared across modes (existing storage keys).
- Visibility follows the manifest: all `itspaces`/`shell` paths and the Integration Suite host. This includes non-CPI areas of the Integration Suite host (e.g. API Management); accepted for Phase 1.
- The plugin `---isActive` storage listener keeps removing the toolbar for a rebuild; in global mode this is harmless.

### Jump to (menu button)

A menu button (`addFloatingToolbarMenuButton`) with fixed navigation targets.

**Shared target list.** The monitoring links in `popup/popup.js` l.325–353 move to a new `common/jump-targets.js` that exports a plain array (`{ path, label, icon, group, toolbar }`). Both the popup (`popup.html` script tag) and the content script (manifest, before `floatingToolbar.js`) load it. The popup renders from it instead of its inline list; its visible output stays the same.

**Global entries** (always):

- Failed messages (past hour), All messages, Status overview, Integration content
- Security material, Keystore, Message queues, Data stores, Variables, Message locks, Connectivity tests
- Design overview (`/shell/design`)

Full list of monitoring subpages stays in the popup; the toolbar shows the entries marked `toolbar: true` in the shared list, so both stay in sync.

**Context entries** (artifact mode only, above the global ones, separated):

- *Messages of this artifact*: Message monitor filtered on `cpiData.currentArtifactId`, past hour, all statuses.
- *Deployment status*: Manage Integration Content filtered on the artifact.
- *Open package*: `/shell/design/contentpackage/<cpiData.currentPackageId>?section=ARTIFACTS`, only when the package id is known.

The exact filter JSON keys for the monitor and Manage Integration Content routes are verified against a live tenant during implementation (the failed-messages route in `popup.js` l.325 is the known reference: `{"status":"FAILED","time":"PASTHOUR","type":"INTEGRATION_FLOW"}`). A context entry whose route cannot be verified is left out rather than shipped guessing.

All paths are prefixed with `"/" + cpiData.urlExtension` (Neo `itspaces/`). Entries are real `<a href>` links: click navigates in the tab, Cmd/Ctrl+click opens a new tab.

### Recent (panel button)

A panel button (`addFloatingToolbarPanelButton`) listing the visit history.

- Source: existing `chrome.storage.sync` key `visitedIflows_<tenant>` written by `storeVisitedIflowsForPopup()`. No schema migration; the existing `favorit` field (already written as `false`) becomes the favorite flag.
- Two sections: **Favorites** (entries with `favorit: true`) on top, then **Recent** (newest first).
- Row: type icon, `fullName` (fallback `name`), type label, star toggle. The currently open artifact is highlighted.
- Row is an `<a href="entry.url">` (same click behaviour as Jump to).
- Star toggle flips `favorit` and writes the list back. The star click must not trigger navigation.
- Live update via `chrome.storage.onChanged` on the key while the panel is open.
- Empty state: short hint ("Open an iFlow or package, it will show up here.").

**History writing changes** (`storeVisitedIflowsForPopup`):

- When an artifact is revisited, its existing `favorit` value is kept (today the entry is filtered out and re-pushed with `favorit: false`).
- Trimming to 15 drops the oldest **non-favorite** entry. Favorites never fall out.
- Favorites are capped at 20; starring a 21st shows a `cpihToast` and does nothing. Keeps the sync item well below the 8 KB per-item quota.

**Pure helper.** A new function `buildHistoryView(entries, current)` returns `{ favorites, recent }` (sorting, current-marking, fullName fallback). A second pure function `addVisit(entries, visit)` implements dedupe, favorite retention and trimming. Both live in `common/visit-history.js`, loaded by the content script, and are covered by a node test.

### Plugins (global mode)

Same action as the existing "Manage plugins" button: `showBigPopup(createContentNodeForPlugins())`. In artifact mode the existing "Manage plugins" button is reused, no duplicate.

### Icons

New inline SVGs in `FLOATING_TOOLBAR_ICONS`: `jump`, `history`, `star`, `starFilled`. Type icons for the Recent rows reuse the popup's artifact type icons where available.

### Error handling

- Storage read fails or returns nothing: Recent shows the empty state.
- Storage write fails (quota): `cpihToast` with the error, list stays unchanged.

### Testing

- `tests/visit-history.test.js` (plain node, like existing tests, added to `npm test`): dedupe, favorite retention on revisit, trim skips favorites, favorites cap, view ordering, current marking.
- `tests/e2e/smoke.spec.mjs` new cases:
  - On the monitoring overview, the toolbar is visible with exactly Jump to, Recent, Plugins.
  - Jump to → Message queues navigates there, toolbar still present afterwards.
  - After opening the test iFlow, it appears in Recent; starring it moves it to Favorites and survives a reload.
  - On the test iFlow, Jump to shows the context entries and "Messages of this artifact" lands in the monitor filtered on it.
  - Plugins opens the plugin management popup.
- Existing e2e suites (`trace`, `api`) must stay green: artifact mode unchanged apart from the two added buttons.

## Roadmap (not implemented now)

### Phase 2: Failed-messages badge

- Badge on the Jump to button with the tenant-wide count of failed messages in the past hour (`MessageProcessingLogs/$count` with status/time filter), polled every few minutes, only while the tab is visible.
- Click on the badge area jumps to Failed messages.
- Setting to turn it off.

### Phase 3: Command palette

- Cmd/Ctrl+K opens a search box over: artifacts and packages tenant-wide (OData `IntegrationDesigntimeArtifacts`, `IntegrationPackages`, cached per session), Jump to targets, favorites and history.
- Keyboard navigation, Enter navigates, Cmd/Ctrl+Enter opens a new tab.
- Toolbar gets a search button that opens the same palette.

### Phase 4: Tenant hopping

- Settings map tenants to stages (Dev → Test → Prod).
- On an artifact page, "Open on <stage>" rewrites the URL to the mapped tenant host, keeping package and artifact id.
- Shown in Jump to as context entries.
