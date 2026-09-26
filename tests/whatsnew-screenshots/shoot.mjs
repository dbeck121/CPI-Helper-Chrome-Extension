// renders the screenshots of the What's new dialog (images/whatsnew) from scene.html: the real toolbar, search and
// panels with demo data, no tenant needed and nothing of a real tenant in the pictures.
// node tests/whatsnew-screenshots/shoot.mjs   (writes images/whatsnew/4.0-*.png)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../images/whatsnew");
const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1.5 });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

const scene = async ({ expanded, popup = false, trace = false }) => {
  await page.goto(`file://${here}/scene.html`);
  await page.waitForTimeout(300);
  if (popup) await page.evaluate(() => addPopup());
  await page.evaluate(([e, t]) => build(e, t), [expanded, trace]);
  await page.waitForTimeout(400);
};

// wide toolbar next to the message popup
await scene({ expanded: true, popup: true, trace: true });
await page.screenshot({ path: `${out}/4.0-toolbar.png` });

// compact toolbar with a plugin panel
await scene({ expanded: false });
await page.locator("#cpiHelperToolbarPlugin--simplenotepad").click();
await page.mouse.move(300, 600);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/4.0-plugins.png` });

// search
await scene({ expanded: true });
await page.locator("#__cpih_search").click();
await page.locator(".cpiHelper_palette_input").fill("order");
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/4.0-search.png` });

// jump to
await scene({ expanded: true });
await page.locator("#__cpih_jump").click();
await page.mouse.move(300, 600);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/4.0-jump.png` });

await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`written to ${out}`);
