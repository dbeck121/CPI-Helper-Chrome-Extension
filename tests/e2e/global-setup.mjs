// the e2e browser keeps the extension it loaded at start. reload it before every run, so the tests see the
// current files of the repo. tabs opened afterwards get the new content scripts
import { chromium } from "@playwright/test";
import { env } from "./env.mjs";

export default async function globalSetup() {
  let browser;
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${env.cdpPort}`);
  } catch {
    throw new Error(`No browser on port ${env.cdpPort}. Start it with "npm run e2e:browser" and log in first.`);
  }
  const page = await browser.contexts()[0].newPage();
  try {
    await page.goto("chrome://extensions");
    const reloaded = await page.evaluate(async () => {
      const manager = document.querySelector("extensions-manager");
      const toolbar = manager.shadowRoot.querySelector("extensions-toolbar");
      const devMode = toolbar.shadowRoot.querySelector("#devMode");
      if (devMode && !devMode.checked) devMode.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const items = [...manager.shadowRoot.querySelector("extensions-item-list").shadowRoot.querySelectorAll("extensions-item")];
      const item = items.find((element) => /CPI Helper/.test(element.shadowRoot.querySelector("#name")?.textContent || ""));
      const reload = item?.shadowRoot.querySelector("#dev-reload-button");
      if (!reload) return false;
      reload.click();
      return true;
    });
    if (!reloaded) console.warn("CPI Helper could not be reloaded, the tests may run against an older state");
    await page.waitForTimeout(1500);
  } finally {
    await page.close();
    await browser.close();
  }
}
