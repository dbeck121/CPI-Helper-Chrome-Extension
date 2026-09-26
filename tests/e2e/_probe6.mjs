import { getPage } from "./_lib.mjs";
import fs from "node:fs";
const { b, page } = await getPage();
const r = await page.evaluate(() => {
  const ed = sap.ui.getCore().byId("__xmlview0--galileiEditorView--galileiEditor");
  const find = (o, n) => { let p = o; while (p) { if (Object.prototype.hasOwnProperty.call(p, n)) return p[n]; p = Object.getPrototypeOf(p); } };
  const out = {};
  for (const n of ["copy", "paste", "onCopy", "onPaste"]) { out["editor." + n] = String(find(ed._editor, n)); out["ctrl." + n] = String(find(ed, n) ?? ""); }
  for (const k of ["prePasteCallback", "postPasteCallback", "canPasteSymbolsCallback", "preCopyCallback", "postCopyCallback", "canCopyCallback"]) { const c = ed[k]; out[k] = Object.keys(c).join(",") + " :: " + Object.values(c).map((v) => String(v)).join("\n---\n"); }
  return out;
});
let s = ""; for (const [k, v] of Object.entries(r)) s += `\n===== ${k}\n${v}\n`;
fs.writeFileSync(process.argv[2] + "/paste-src.txt", s);
console.log(s.length);
await b.close();
