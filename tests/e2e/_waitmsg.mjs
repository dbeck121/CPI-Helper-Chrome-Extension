import { chromium } from "@playwright/test";
import { env } from "./env.mjs";
const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
const p = await b.contexts()[0].newPage();
await p.setViewportSize({ width: 1500, height: 950 });
await p.goto(env.apiUrl);
await p.locator("#cpiHelper_floatingToolbar").waitFor({ timeout: 60000 });
if (!(await p.locator("#cpiHelper_content").isVisible())) await p.locator("#__buttonxy").click();
await p.locator("#cpiHelper_content #messageList").waitFor();
await p.waitForTimeout(5000);
const first = async () => (await p.locator("#cpiHelper_content button[id^='logs--']").first().getAttribute("class").catch(() => null))?.split(" ")[0];
const before = await first();
const start = Date.now();
while (Date.now() - start < 20 * 60 * 1000) {
  await p.waitForTimeout(5000);
  const now = await first();
  if (now && now !== before) {
    const row = (await p.locator("#cpiHelper_content #messageList tr").nth(1).innerText()).replace(/\s+/g, " ");
    console.log("NEW_MESSAGE", row);
    break;
  }
}
await p.close(); await b.close();
