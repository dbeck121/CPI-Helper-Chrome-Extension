import { getPage } from "./_lib.mjs";
const { b, page } = await getPage();
const r = await page.evaluate(() => {
  const reg = sap.ui.core.Element.registry.all();
  const ed = Object.values(reg).find((e) => e.getMetadata().getName() === "sap.bpm.BPMNDiagramEditor");
  const protoKeys = (o) => { const s = new Set(); let p = o; for (let i = 0; i < 4 && p; i++) { Object.getOwnPropertyNames(p).forEach((k) => s.add(k)); p = Object.getPrototypeOf(p); } return [...s]; };
  const edKeys = protoKeys(ed).filter((k) => !/^(get|set|bind|unbind|add|remove|insert|destroy|index|has|attach|detach|fire)(Aria|Busy|Field|Tooltip|Custom|Layout|Dependent|Event|Binding|Model|Parent|Element|Property|Aggregation|Association|Object|Id|Metadata|Visible|Blocked)/.test(k));
  const gm = ed.getModel("graphicalModel");
  const gmKeys = protoKeys(gm).slice(0, 150);
  const gmData = gm.getData ? gm.getData() : gm.oData;
  const gmDataKeys = gmData ? Object.keys(gmData).slice(0, 50) : null;
  const def = ed.getModel();
  return { edId: ed.getId(), edKeys: edKeys.slice(0, 200), ownEd: Object.keys(ed).slice(0, 80), gmKeys, gmDataKeys, gmType: typeof gmData, defSame: def === gm, galileiKeys: Object.keys(sap.galilei), bpmKeys: Object.keys(sap.bpm) };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
