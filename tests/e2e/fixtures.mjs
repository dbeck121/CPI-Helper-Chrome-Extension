import { test as base, expect, chromium } from "@playwright/test";
import { env } from "./env.mjs";

// connects to the browser of `npm run e2e:browser`, every test gets a fresh tab in the logged in context.
// extensionErrors collects console errors that come from the content scripts of CPI Helper
export const test = base.extend({
  cdpBrowser: [
    async ({}, use) => {
      let browser;
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${env.cdpPort}`);
      } catch (error) {
        throw new Error(`No browser on port ${env.cdpPort}. Start it with "npm run e2e:browser" and log in first.`);
      }
      await use(browser);
      // only drop the connection, the browser and the login stay
      await browser.close().catch(() => {});
    },
    { scope: "worker" },
  ],
  extensionErrors: async ({}, use) => {
    await use([]);
  },
  page: async ({ cdpBrowser, extensionErrors }, use) => {
    const context = cdpBrowser.contexts()[0];
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const location = message.location()?.url || "";
      if (location.startsWith("chrome-extension://") || /cpihelper/i.test(message.text())) extensionErrors.push(`${message.text()} @ ${location}`);
    });
    page.on("pageerror", (error) => {
      if (/chrome-extension:\/\//.test(error.stack || "")) extensionErrors.push(error.stack);
    });
    await use(page);
    await page.close().catch(() => {});
  },
});

export { expect };

// fails with a clear message when the tenant sent us to the login page
export async function expectLoggedIn(page, url) {
  const target = new URL(url);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
  const current = new URL(page.url());
  if (current.host !== target.host) {
    throw new Error(`Redirected to ${current.host}, the session is gone. Log in again in the e2e browser.`);
  }
}

export async function openIflow(page, url) {
  await page.goto(url);
  await expectLoggedIn(page, url);
  await expect(page.locator("#cpiHelper_floatingToolbar")).toBeVisible({ timeout: 60_000 });
}

// the big CPI Helper popup
export const bigPopup = (page) => page.locator("#cpiHelper_semanticui_modal.visible");
