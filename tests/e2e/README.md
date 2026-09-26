# End to end tests against a real tenant

Read only Playwright checks of the unpacked extension on a real SAP Cloud Integration tenant.
Nothing here switches trace, deploys, undeploys or unlocks.

1. `npm install` and once `npx playwright install chromium`
2. `cp .env.example .env` and fill in `CPI_URL` and `CPI_IFLOW_URL` (the file is git ignored)
3. `npm run e2e:browser` opens Chromium with CPI Helper loaded. Log in there and leave the window open.
4. `npm run e2e` connects to that browser and runs `tests/e2e/*.spec.mjs`. Report: `playwright-report/index.html`

The browser profile lives in `.e2e-profile/` (git ignored), so a later start often skips the login.
Branded Google Chrome ignores `--load-extension`, that is why the Chromium of Playwright is used.
Nothing of this ends up in the extension zip (see `zipFiles.sh`).
