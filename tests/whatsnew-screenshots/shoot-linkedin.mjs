// renders the LinkedIn and What's new pictures (docs/images/linkedin/*.png, 2x, cropped) from scene.html with demo data, like shoot.mjs
// node tests/whatsnew-screenshots/shoot-linkedin.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../docs/images/linkedin");
// icons.css points to the extension origin first, the scene gets it with the fonts from the repo
const iconsCss = fs
  .readFileSync(path.resolve(here, "../../css/icons.css"), "utf8")
  .replace(/url\(chrome-extension:[^)]*\) format\('woff2'\), /g, "")
  .replaceAll("url(/lib/", "url(../../lib/");
const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

fs.mkdirSync(out, { recursive: true });

const scene = async ({ expanded = true, popup = true, trace = true } = {}) => {
  await page.goto(`file://${here}/scene.html`);
  await page.addStyleTag({ content: iconsCss });
  await page.waitForTimeout(300);
  if (popup) await page.evaluate(() => addPopup());
  await page.evaluate(([e, t]) => build(e, t), [expanded, trace]);
  await page.waitForTimeout(400);
};

// search with the toolbar
await scene({ popup: false });
await page.locator("#__cpih_search").click();
await page.locator(".cpiHelper_palette_input").fill("order");
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/whatsnew-search.png`, clip: { x: 300, y: 60, width: 980, height: 560 } });

// wide toolbar, the new buttons
await scene({ popup: false });
await page.mouse.move(300, 700);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/whatsnew-toolbar.png`, clip: { x: 1080, y: 130, width: 200, height: 610 } });

// compact toolbar
await scene({ expanded: false, popup: false, trace: false });
await page.mouse.move(300, 700);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/whatsnew-toolbar-compact.png`, clip: { x: 1160, y: 130, width: 120, height: 610 } });

// toolbar in context, wide with the message popup
await scene();
await page.evaluate(() => addInlineTrace(2));
await page.evaluate(() => Object.assign(document.getElementById("cpiHelper_content").style, { left: "480px", top: "450px" }));
await page.mouse.move(300, 700);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/linkedin-inline-trace.png` });

// jump to
await scene({ popup: false });
await page.locator("#__cpih_jump").click();
await page.mouse.move(300, 700);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/linkedin-jump.png` });

await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`written to ${out}`);
