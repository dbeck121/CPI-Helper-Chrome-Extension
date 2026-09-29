// waits until a tab of the e2e browser shows a logged in CPI page, prints its url
import { chromium } from "@playwright/test";
import { env } from "./env.mjs";

const timeoutMs = Number(process.argv[2] || 30 * 60 * 1000);
const started = Date.now();
while (Date.now() - started < timeoutMs) {
  try {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${env.cdpPort}`);
    for (const page of browser.contexts().flatMap((context) => context.pages())) {
      const url = page.url();
      if (!/\.(hana\.ondemand\.com|platform\.sapcloud\.cn)\//.test(url) || !/\/(shell|itspaces)/.test(url)) continue;
      const ready = await page.locator("#shell--toolHeader, #cpiHelper_floatingToolbar, #__cpihelper").count().catch(() => 0);
      if (ready) {
        console.log("LOGGED_IN " + url);
        await browser.close();
        process.exit(0);
      }
    }
    await browser.close();
  } catch {
    // browser not reachable yet
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
console.log("TIMEOUT");
process.exit(1);
