import { getPage } from "./_lib.mjs";
const { b, page } = await getPage();
console.log(await page.evaluate(() => {
  const M = sap.galilei.ui.editor.util.copyPaste.CopyPasteManager;
  const out = [];
  for (const k of ["clipboardContent", "hasClipboardContent", "_clipboardContent"]) { const d = Object.getOwnPropertyDescriptor(M, k); out.push(k + ": " + (d ? (d.get ? "GET " + String(d.get).slice(0, 700) + " SET " + String(d.set).slice(0, 500) : "value " + typeof d.value) : "none")); }
  out.push("ENABLE_LS=" + sap.galilei.ui.editor.DiagramEditor?.ENABLE_LOCAL_STORAGE_CLIPBOARD);
  return out.join("\n");
}));
await b.close();
