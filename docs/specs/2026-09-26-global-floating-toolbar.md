# Global Floating Toolbar

Status: Phases 1–3 implemented. Phase 4 is roadmap only.

## Goal

The floating toolbar (`scripts/floatingToolbar.js`) used to exist only on artifact pages (IFlow, API types, MCP Server). It is now the CPI Helper's entry point on every CPI page the content script runs on: navigation and plugin management everywhere, the artifact actions on artifact pages.

Decisions taken:

- One toolbar with two modes, not a persistent bar with swappable sections.
- The old header button `#__cpihelper` (`scripts/Mode-Script.js`) stays unchanged, in parallel.
- The Plugins button only opens plugin management. There is no new plugin hook for global buttons.

## Files

| File | Purpose |
|---|---|
| `common/jump-targets.js` | Shared navigation targets (popup + toolbar), artifact context targets, workspace type → editor path mapping. Pure, node tested. |
| `common/visit-history.js` | Visit history with favorites: add visit, toggle favorite, build the view. Pure, node tested. |
| `common/palette-search.js` | Ranking of the command palette. Pure, node tested. |
| `scripts/globalToolbar.js` | SPA navigation, Jump to, Recent, failed messages badge. |
| `scripts/commandPalette.js` | Command palette: index, actions, UI, Cmd/Ctrl+K. |
| `tests/global-toolbar.test.js` | Node tests of the three pure files (`npm test`). |
| `tests/e2e/global-toolbar.spec.mjs` | E2E against the tenant. |

## Phase 1: toolbar everywhere, Jump to, Recent, favorites

### Modes

`buildFloatingToolbar()` in `scripts/contentScript.js` picks the mode with `isArtifactToolbarPage()` (`FLOATING_TOOLBAR_ARTIFACT_TYPES`, the former `AllowedTypes`):

| Mode | Buttons |
|---|---|
| artifact | Trace, Messages, Snippets, Info, Logs, Runtime · *Go to*: Search, Jump to, Recent · *Plugins*: plugin buttons, Manage plugins |
| global | Search, Jump to, Recent, Plugins |

- Rebuild key `data-artifact-id` is the artifact id in artifact mode and `"global"` otherwise. Moving between global pages does not rebuild.
- The heartbeat no longer removes the toolbar; it calls `buildButtonBar()` on every beat. `addBreadcrumbs()` and the sidebar deactivation stay artifact-only.
- Visibility follows the manifest globs, including non-CPI areas of the Integration Suite host (accepted).

### Navigation

`cpihNavigate(url, event)` navigates inside the app without a reload: `history.pushState` plus a `popstate` event, which the UI5 router follows (verified on the tenant). That only works inside one area of the shell (`/shell/<area>/…`, e.g. design → design, monitoring → monitoring). Once the shell has loaded an app, it ignores a popstate into it from another area: monitor → iFlow (in the app) → All Messages only changes the URL. That was seen on the tenant, and the app router cannot be reached from the content script. So a change of the area loads the page normally. A click with a modifier or the middle button is left to the browser. After navigating it calls `checkURLchange()`, so `cpiData` updates right away. The next heartbeat switches the toolbar mode.

Edit mode guard: leaving an artifact editor in edit mode through the router drops the changes without asking and leaves the CPI with a busy indicator that never ends (seen on the tenant). While the editor shows Save and no Edit button (English or German UI), `cpihNavigate` does nothing and shows a toast instead. Cmd/Ctrl+click still opens a new tab.

Paths are relative to `cpihTenantBase()`: `""` on Integration Suite hosts, `"/itspaces"` on Neo. `cpiData.urlExtension` is only set on iFlow pages and is therefore not used.

### Jump to

A menu button. Menu entries can now be real links (`href`), group titles (`header`) and carry a detail badge (`detail`); `openFloatingToolbarMenu` supports all three.

- Global entries: every `CPIH_JUMP_TARGETS` entry with `toolbar: true` (All/Failed messages, Status overview, Integration content, Packages, Security material, Keystore, Connectivity tests, Data stores, Variables, Message queues, Message locks), grouped under the area headers "Monitor" and "Design". Every target has an `area`.
- Context entries on artifact pages (`cpihArtifactJumpTargets`), under the artifact name:
  - *Messages of this artifact*: `/shell/monitoring/Messages/{edge, status: ALL, packageId: ALL, artifactIds: [id], type: ALL, time: PASTHOUR}`; the monitor rewrites a single `artifact` key to exactly this form (verified).
  - *Deployment status*: `/shell/monitoring/Artifacts/{edge, artifact: id}` (verified, the key survives the routing).
  - *Open package*: `/shell/design/contentpackage/<id>?section=ARTIFACTS`.
- The popup renders its Main Links and Monitoring group from the same list (`popup.html` loads `common/jump-targets.js`).

### Recent and favorites

- Source: `chrome.storage.sync` `visitedIflows_<tenant>`, written by `storeVisitedIflowsForPopup()` through `cpihAddVisit`. The existing `favorit` field is the favorite flag, no migration.
- A revisit keeps the favorite flag. Trimming keeps at most 15 non-favorites; favorites never fall out and are capped at 20 (toast on the 21st).
- Storage budget: `chrome.storage.sync` allows 8192 bytes per item, and a real entry on an Integration Suite host is about 400 bytes (35 entries ≈ 14.5 KB). So the list is also trimmed by size, to 7600 bytes, oldest non-favorites first. Favorites may take at most 5600 bytes, which leaves room for recent visits. With long names fewer than 20 favorites fit, and the toast says so.
- Panel: Favorites on top, then Recent, newest first; section titles only when favorites exist. Rows are links with type icon, name, type and a star (`span role=button`, because the panel styles every `<button>` of plugin content). The open artifact is highlighted. A storage listener re-renders the open panel; it is removed with the toolbar (`onFloatingToolbarRemoved`).

## Phase 2: failed messages badge

- `refreshFailedMessagesBadge()` runs on every heartbeat and fetches at most every 5 minutes, only while the tab is visible: `odata/api/v1/MessageProcessingLogs/$count` with `Status eq 'FAILED' and LogEnd gt datetime'<now - 1h>'`.
- The count is a red badge on Jump to (hint "Jump to (N failed messages in the past hour)") and a red detail on the *Failed Messages* menu entry.
- Popup setting "Failed messages badge on the toolbar" (`failedMessagesBadge` in sync storage, default on). A change refreshes the badge at once.

## Phase 3: command palette

- Opened with Cmd/Ctrl+K on every CPI page or with the Search button. Inside an ace editor the key stays with the editor.
- **Index:** the design time workspace API: `/api/1.0/workspace` for the packages, then `/api/1.0/workspace/<id>/artifacts/` per package, 6 in parallel. The OData `IntegrationPackages` entity does not exist on the tenant UI host (404), so it is not used. The index is cached per tenant in `chrome.storage.local` (`cpiHelper_paletteIndex_<tenant>`, about 660 artifacts / 67 packages ≈ 3 s to load). A cached list is shown at once and refreshed after 15 minutes; a "Reload list" button forces it.
- **Items, in priority order:**
  1. Actions of the page (a page without artifact offers its own toolbar buttons, e.g. Plugins, and Deploy where the CPI shows one):
     - Start/Stop trace
     - Deploy
     - Start trace and deploy (only while trace is off)
     - Open/Close message sidebar
     - every other plain toolbar button: Snippets, Info, Logs, direct plugin buttons, Manage plugins
  2. Context jump targets of the open artifact
  3. Favorites and recent visits
  4. All `CPIH_JUMP_TARGETS`, including the ones not on the toolbar. Jump targets carry their area in the label ("Monitor - All Messages", "Design - Packages", "Monitor - Messages of this artifact")
  5. Artifacts and packages of the index (only with a query)
- **Deploy** presses the CPI's own Deploy button (found by its title, English or German; UI5 needs the pointer/mouse event sequence, `click()` alone does nothing). The CPI confirmation dialog still asks, so nothing deploys from a stray Enter.
- **Ranking** (`cpihPaletteSearch`): every query word has to match label, id, package or the keywords of an action. Keywords are other words for the action, e.g. "trace on/off, activate", or "bereitstellen" for Deploy. Label start > id start > word start > contains; favorites and recent visits get a boost. With no query, boosted items come first and index items are hidden.
- **Keys:** ↑/↓ select, Enter opens (SPA navigation) or runs the action, Cmd/Ctrl+Enter opens a page in a new tab, Esc or a click outside closes and returns focus.

## Testing

- `npm test` includes `tests/global-toolbar.test.js` (18 cases: history, jump targets, ranking, keywords).
- `tests/e2e/global-toolbar.spec.mjs` covers:
  - The global toolbar has exactly its 4 buttons.
  - Jump to navigates without a reload.
  - The badge matches the monitor count.
  - Plugins opens the plugin management.
  - The context jumps land in the filtered monitor (checked by page content, not only the URL) and the toolbar switches back to global.
  - Monitor → iFlow through the palette → Jump to All Messages shows the monitor.
  - Recent plus a favorite survives a reload (the flag is reset afterwards).
  - The palette finds and opens the test iFlow.
  - The palette actions: sidebar open/close, and Deploy plus Trace and deploy up to the CPI dialog, answered with "No". Trace and deploy runs only with `E2E_ALLOW_DEPLOY=true`.
  - The edit mode guard, on the snippets test iFlow. The edit is cancelled and never saved.
- A node test fills the history with real-shaped long entries and checks the storage quota.
- Not tested: classic Neo tenants (`/itspaces` base path, workspace API and pushState routing there).
- The existing suites (smoke, api, trace, snippets) stay green.

## Roadmap

### Phase 4: tenant hopping (not implemented)

- Settings map tenants to stages (Dev → Test → Prod).
- On an artifact page, "Open on <stage>" rewrites the URL to the mapped tenant host, keeping package and artifact id.
- Shown in Jump to and the command palette as context entries.
