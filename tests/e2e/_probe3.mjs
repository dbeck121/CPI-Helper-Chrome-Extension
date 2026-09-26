import { getPage } from "./_lib.mjs";
const { b, page } = await getPage();
const r = await page.evaluate(() => {
  const ed = sap.ui.getCore().byId("__xmlview0--galileiEditorView--galileiEditor");
  const trim = (o, d = 0) => { if (d > 2 || o == null || typeof o !== "object") return typeof o === "string" ? o.slice(0, 80) : o; if (Array.isArray(o)) return [o.length, trim(o[0], d + 1)]; const x = {}; for (const k of Object.keys(o).slice(0, 25)) x[k] = trim(o[k], d + 1); return x; };
  const gm = ed.getModel("graphicalModel").getData();
  const def = ed.getModel().getData();
  const ls = Object.keys(localStorage).map((k) => k + ":" + localStorage.getItem(k).length);
  return {
    props: { copy: ed.getEnableCopyPaste(), ls: ed.getEnableLocalStorageClipboard(), pasteSel: ed.getEnablePasteInSelectedSymbol(), ro: ed.getIsReadOnly(), undo: ed.getEnableUndoRedo() },
    shape0: trim(gm.shapes[0] ?? Object.values(gm.shapes)[0]), shapesType: Array.isArray(gm.shapes) ? "arr" + gm.shapes.length : Object.keys(gm.shapes).slice(0, 10),
    defKeys: Object.keys(def).slice(0, 40),
    edType: ed._editor?.constructor?.name, edEditorKeys: ed._editor ? Object.keys(ed._editor).slice(0, 60) : null,
    modelCls: ed._model?.classDefinition?.qualifiedName || ed._model?.constructor?.name,
    ls,
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
