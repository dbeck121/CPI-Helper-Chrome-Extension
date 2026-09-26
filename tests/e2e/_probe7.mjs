import { getPage } from "./_lib.mjs";
import fs from "node:fs";
const { b, page } = await getPage();
const r = await page.evaluate(() => {
  const M = sap.galilei.ui.editor.util.copyPaste.CopyPasteManager;
  let s = "keys: " + Object.keys(M).join(",") + "\nhas=" + M.hasClipboardContent + "\n";
  const all = new Set(); let p = M; for (let i = 0; i < 4 && p; i++) { Object.getOwnPropertyNames(p).forEach((k) => all.add(k)); p = Object.getPrototypeOf(p); }
  for (const k of all) { try { const v = M[k]; if (typeof v === "function" && /storage|clipboard|Storage/i.test(String(v))) s += `\n== ${k}\n${String(v).slice(0, 1200)}\n`; } catch {} }
  s += "\ncopyPaste ns: " + Object.keys(sap.galilei.ui.editor.util.copyPaste).join(",");
  return s;
});
fs.writeFileSync(SP() + "/cpm.txt", r);
function SP() { return process.argv[2]; }
console.log(r.slice(0, 6000));
await b.close();
