import { getPage } from "./_lib.mjs";
import fs from "node:fs";
const { b, page } = await getPage();
const bk = await page.evaluate(() => localStorage.getItem("GalileiClipboard"));
fs.writeFileSync(process.argv[2] + "/clipboard-backup.txt", bk ?? "");
const r = await page.evaluate(() => {
  const ed = sap.ui.getCore().byId("__xmlview0--galileiEditorView--galileiEditor");
  const src = {};
  for (const k of ["prePasteCallback", "postPasteCallback", "canPasteSymbolsCallback", "preCopyCallback", "postCopyCallback", "canCopyCallback"]) src[k] = String(ed[k]).slice(0, 700);
  const meths = new Set(); let p = ed._editor; for (let i = 0; i < 6 && p; i++) { Object.getOwnPropertyNames(p).forEach((k) => /copy|paste|clip|create|delete|storage/i.test(k) && meths.add(k)); p = Object.getPrototypeOf(p); }
  const edm = new Set(); p = ed; for (let i = 0; i < 6 && p; i++) { Object.getOwnPropertyNames(p).forEach((k) => /copy|paste|clip|storage/i.test(k) && edm.add(k)); p = Object.getPrototypeOf(p); }
  const status = document.body.innerText.match(/[^\n]*Deployment Status[^\n]*/)?.[0];
  return { src, meths: [...meths], edm: [...edm], status };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
