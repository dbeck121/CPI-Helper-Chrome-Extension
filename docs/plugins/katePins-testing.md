# KaTe Pins: implementation and testing

## Files and integration

- `plugins/kate.js`: plugin metadata, controls, drag/menu interactions, navigation
  receiver and event-driven rendering.
- `plugins/kate-background.js`: serialized workspace actions, tab/split APIs and
  targeted notifications for native split/URL changes and tab closure.
- `manifest.json`: content-script registration and background entry point.
  Chrome uses `service_worker`; Firefox uses `scripts`. The same script exits
  Pins requests before workspace access when split APIs are unavailable.
- `common/ui-kit.js`: two guards prevent CPI Helper dialogs from opening in the
  right pin tab. Pins intercepts Ctrl/Cmd+K in its own window capture listener;
  the core command palette stays unchanged. Ace keeps its editor shortcuts, and
  the left working tab retains the full toolbar and search.

The manifest's existing permissions and host permissions are unchanged. The dual
background declaration follows MDN's Chrome/Firefox guidance (Chrome/Firefox
121+); older manifest-loader versions are not validated. The extension's global
minimum Chrome version is not raised to 155 just for this optional plugin.

## Idle behavior

Pins has no heartbeat, interval, alarm, keep-alive port or periodic SAP request.
It reads state initially, on user actions, focus, persisted `pageshow`, relevant
storage events and targeted native-tab notifications. Worker messages target
frame 0 and skip discarded/frozen tabs for refresh notifications.

Repeated refreshes compare state before writing extension storage. Rendering
changes HTML classes, the UI visibility marker and pin selection attributes only
when their values change. Existing pin nodes are retained when only selection
changes. This avoids repeatedly invoking the host HTML-class/theme observer and
its sync-storage writes. The existing CPI Helper core heartbeat is unchanged.

A back/forward-cache restoration resets the content-script request queue and
ignores late responses from the previous document generation. Native split
restoration after extension reload requires an existing saved right-hand pin;
an arbitrary split is not adopted. Workspace origins prevent an owner navigation
from mixing two tenants' pin catalogs.

## Automated checks

```sh
npm ci --ignore-scripts
npm test
npx playwright install chromium
npm run test:kate:browser
```

`npm test` includes these Pins checks without requiring a browser:

- `tests/kate-pins/kate-split.test.js`: pin limit, duplicate reuse, one shared right tab,
  stable split on selection, persistent restore, tenant isolation, navigation
  guard, history fallback and BFCache request-queue recovery.
- `tests/kate-pins/kate-pin-interactions.test.js`: click/drag separation, cancelled drops,
  keyboard context-menu entry, selection updates and root-class mutation guard.
- `tests/kate-pins/kate-background-events.test.js`: unsupported APIs, active-pin removal,
  1,200 unchanged state requests without storage writes, targeted tab events,
  closed tabs, sender validation, refusal to adopt unrelated splits, extension
  reload recovery, owner tenant changes and safe missing-receiver handling.

`tests/kate-pins/kate-browser.test.mjs` loads the actual plugin, UI kit, command palette and
HTML theme observer in headless Chromium with a mocked Chrome messaging boundary.
It checks one simulated idle hour, 1,200 unchanged refresh events without DOM or
storage writes, selection, keyboard menu/focus, dialog guards, visible navigation
error feedback in the right tab, light/dark UI,
narrow layout, and deactivation/reactivation. Results and screenshots are written
to the ignored `test-results/kate-pins/` directory.

It also loads the complete extension in an isolated Chromium profile and verifies
the real background registration. When split APIs are absent, activation creates
neither tabs nor a saved pin catalog. The temporary test profile is removed on exit.

The browser fixture does not exercise native Split View, SAP routing, real
session expiry or an actual elapsed hour. Its clock test proves absence of idle
timer work in the loaded code, not a measured memory or SAP-session soak test.

The checks run locally with the commands above and need no SAP credentials or
tenant access. This plugin contribution adds no GitHub Actions workflow and does
not change the existing build or release scripts.

## Native-browser acceptance checklist

Record the browser version, platform, plugin version and result. Use read-only
SAP views and a designated test iFlow for editor checks. Do not deploy artifacts.

- Activate/deactivate Pins; the left CPI Helper UI remains usable.
- Add up to five pins; duplicates reuse the existing pin; a sixth is refused.
- Switch between Messages, Security Materials/Discover and an iFlow. Confirm one
  right-hand tab and unchanged divider width; repeated selection is a no-op.
- Rename with the context menu; remove by menu and trash; cancelled drag does not
  select or remove. Confirm keyboard menu navigation and Escape focus return.
- Close/reopen using Pins and the native browser controls. Close the right tab;
  the saved list survives and selection creates a replacement only when needed.
- Restart the browser and reload the extension separately. Saved pins survive;
  reload both SAP documents after extension updates. Test right-first restoration.
- Use two tenants, including navigating the left tab to another tenant. No pins
  cross tenant boundaries and state updates settle without a storage loop.
- In the right test-iFlow editor, enter edit mode, try another pin, verify the
  guard, then cancel. No unsaved edits should be discarded.
- Leave the real workspace open for at least 60 minutes, with some time in the
  background. Record console errors, responsiveness, storage writes and memory
  before/after; resume and switch pins. Separate SAP login expiry from a plugin
  failure. Check with DevTools closed as well, since debugging changes lifecycle.
- On an unsupported browser, Pins displays no controls and existing CPI Helper
  functionality still works. Check shared-extension loading and existing CPI
  Helper behavior on Edge/Firefox as regression checks. These checks do not
  establish Pins support on those browsers; Pins targets Google Chrome 155+.

Report unchecked scenarios explicitly in the PR; the automated fixtures are not
substitutes for these native-browser results.
