import { getPage } from "./_lib.mjs";
const { b, page } = await getPage();
const s = await page.evaluate(() => localStorage.getItem("GalileiClipboard"));
console.log(s.slice(0, 1500));
try { const j = JSON.parse(s); const walk = (o, p = "", d = 0) => { if (d > 3 || !o || typeof o !== "object") return; for (const k of Object.keys(o).slice(0, 15)) { const v = o[k]; console.log(p + k + " : " + (Array.isArray(v) ? "arr" + v.length : typeof v === "object" && v ? "{" + Object.keys(v).length + "}" : String(v).slice(0, 60))); walk(v, p + "  ", d + 1); } }; walk(j); } catch (e) { console.log("not json", e.message); }
await b.close();
