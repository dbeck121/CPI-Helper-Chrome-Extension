// renders the README screenshots (docs/images/screenshots/4.0-*.png) from scene.html with demo data, like shoot.mjs
// node tests/whatsnew-screenshots/shoot-readme.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../docs/images/screenshots");
// icons.css points to the extension origin first, the scene gets it with the fonts from the repo
const iconsCss = fs
  .readFileSync(path.resolve(here, "../../css/icons.css"), "utf8")
  .replace(/url\(chrome-extension:[^)]*\) format\('woff2'\), /g, "")
  .replaceAll("url(/lib/", "url(../../lib/");
const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1.5 });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

const scene = async () => {
  await page.goto(`file://${here}/scene.html`);
  await page.addStyleTag({ content: iconsCss });
  await page.waitForTimeout(300);
  await page.evaluate(() => addPopup());
  await page.evaluate(() => build(true, true));
  await page.waitForTimeout(400);
};

// inline trace: colored steps of a failed message next to the message sidebar
await scene();
await page.evaluate(() => addInlineTrace(2));
// sidebar below the diagram so it covers no step, wait until the flash of the selected message is over
await page.evaluate(() => Object.assign(document.getElementById("cpiHelper_content").style, { left: "480px", top: "450px" }));
await page.mouse.move(300, 700);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/4.0-inline-trace.png` });

// trace popup with the payload viewer
await scene();
await page.evaluate(() => addInlineTrace());
await page.evaluate(() => openTracePopup(2));
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/4.0-payload-viewer.png` });

await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`written to ${out}`);
