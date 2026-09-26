import { getPage, mask } from "./_lib.mjs";
const { b, page } = await getPage();
const r = await page.evaluate(() => {
  const ids = [...document.querySelectorAll("[id^='BPMNShape_'],[id^='BPMNEdge_']")].map((e) => e.id + "<" + e.tagName);
  const reg = sap.ui.core.Element.registry.all();
  const types = {};
  for (const k in reg) { const n = reg[k].getMetadata().getName(); types[n] = (types[n] || 0) + 1; }
  const interesting = Object.keys(types).filter((n) => !/^sap\.(m|ui\.core|ui\.layout|f|uxap|ui\.unified|tnt)\./.test(n));
  const models = new Set();
  for (const k in reg) { const e = reg[k]; const ms = Object.assign({}, e.oModels || {}); for (const [nm, m] of Object.entries(ms)) models.add((nm) + ":" + m.getMetadata().getName()); }
  const g = Object.keys(window).filter((k) => /bpmn|iflow|galilei|sap_|diagram|editor|clip/i.test(k));
  return { ids: ids.slice(0, 40), nIds: ids.length, interesting: interesting.map((n) => n + "×" + types[n]), models: [...models], g, ns: Object.keys(window.sap || {}), galilei: typeof window.sap?.galilei };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
