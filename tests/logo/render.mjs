// builds the CPI Helper logo (images/v5): cloud of v4 in Kangoolutions navy to teal with white "CPI" and a white
// outline, so one icon works on light, dark and colored toolbars. writes the svg source and the png icons.
// node tests/logo/render.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../images/v5");

// cloud of v4: left puff, big top puff, right puff, flat base at y 1871
const CLOUD = `<circle cx="530" cy="1391" r="480"/><circle cx="2066" cy="1487" r="384"/><circle cx="1346" cy="1171" r="742"/><rect x="530" y="1100" width="1536" height="771"/>`;
// the same cloud 60 units bigger all around, white, behind the colored one
const OUTLINE = `<circle cx="530" cy="1391" r="540"/><circle cx="2066" cy="1487" r="444"/><circle cx="1346" cy="1171" r="802"/><rect x="530" y="1040" width="1536" height="891"/>`;
// letters on the grid of v4: C concentric in the left puff, P and I as high as the C, clear of the base line
const W = 150;
const TOP = 1031 + W / 2;
const BOTTOM = 1757 - W / 2;
const onC = (deg) => [503 + 288 * Math.cos((deg * Math.PI) / 180), 1394 - 288 * Math.sin((deg * Math.PI) / 180)].map(Math.round);
const [c1x, c1y] = onC(42);
const [c2x, c2y] = onC(-42);
const LETTERS = `<g fill="none" stroke="#fff" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round"><path d="M${c1x} ${c1y} A288 288 0 1 0 ${c2x} ${c2y}"/><path d="M942 ${BOTTOM} V${TOP} H1123 A139 139 0 0 1 1123 1384 H942"/><path d="M1513 ${TOP} V${BOTTOM}"/></g>`;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -129 2560 2560"><defs><clipPath id="base"><rect width="2500" height="1871"/></clipPath><clipPath id="outline"><rect x="-200" y="-200" width="2900" height="2131"/></clipPath><linearGradient id="fill" gradientUnits="userSpaceOnUse" x1="50" y1="0" x2="2450" y2="0"><stop offset="0" stop-color="#282D5A"/><stop offset="1" stop-color="#00AFB4"/></linearGradient></defs><g clip-path="url(#outline)" fill="#fff">${OUTLINE}</g><g clip-path="url(#base)" fill="url(#fill)">${CLOUD}</g>${LETTERS}</svg>\n`;

fs.writeFileSync(`${out}/logo.svg`, SVG);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${SVG.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: `${out}/${size}.png`, omitBackground: true });
}
await browser.close();
console.log(`written to ${out}`);
