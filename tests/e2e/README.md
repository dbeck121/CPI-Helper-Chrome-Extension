# End to end tests against a real tenant

Playwright checks of the unpacked extension on a real SAP Cloud Integration tenant.
`smoke.spec.mjs` only reads. `trace.spec.mjs` switches trace on for `CPI_IFLOW_URL`, deploys it and debugs the new
message with the inline trace; it runs only with `E2E_ALLOW_DEPLOY=true` and is meant for a test iFlow that starts
with a timer on deploy.

1. `npm install` and once `npx playwright install chromium`
2. `cp .env.example .env` and fill in `CPI_URL` and `CPI_IFLOW_URL` (the file is git ignored)
3. `npm run e2e:browser` opens Chromium with CPI Helper loaded. Log in there and leave the window open.
4. `npm run e2e` connects to that browser, reloads the extension (so the tests see the current files) and runs
   `tests/e2e/*.spec.mjs`. Report: `playwright-report/index.html`

`node tests/e2e/wait-for-login.mjs` waits until a tab of the e2e browser shows a logged in CPI page.

The browser profile lives in `.e2e-profile/` (git ignored), so a later start often skips the login.
Branded Google Chrome ignores `--load-extension`, that is why the Chromium of Playwright is used.
Nothing of this ends up in the extension zip (see `zipFiles.sh`).
