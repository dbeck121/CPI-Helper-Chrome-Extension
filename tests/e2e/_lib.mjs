import { chromium } from "@playwright/test";
process.loadEnvFile(".env");
export const SHOTS = "/private/tmp/claude-501/-Users-domi-Documents-GitHub-CPI-Helper-Chrome-Extension/79f92273-041f-4295-9484-f838c3293867/scratchpad/shots/";
export async function getPage({ create = false } = {}) {
  const b = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const ctx = b.contexts()[0];
  for (const p of ctx.pages()) {
    try { if ((await p.evaluate(() => window.name)) === "paste-probe") return { b, ctx, page: p }; } catch {}
  }
  if (!create) throw new Error("no probe page");
  const page = await ctx.newPage();
  await page.evaluate(() => (window.name = "paste-probe"));
  return { b, ctx, page };
}
export const mask = (s) => String(s).replace(/https?:\/\/[^/]+/g, "https://<host>");
export function logNet(page, tag) {
  const out = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (/\.(js|css|png|svg|woff2?|json|properties|gif)$/.test(u.pathname) && r.method() === "GET") return;
    if (u.pathname.includes("/resources/")) return;
    out.push(`${r.method()} ${u.pathname}${u.search.slice(0, 120)}`);
  });
  return out;
}
export function xhrLog(page) {
  const out = [];
  page.on("request", (r) => {
    if (!["xhr", "fetch"].includes(r.resourceType())) return;
    const u = new URL(r.url());
    out.push(`${r.method()} ${u.pathname}${u.search.slice(0, 100)}`);
  });
  return out;
}
export const snap = (page) => page.evaluate(() => {
  const ed = sap.ui.getCore().byId("__xmlview0--galileiEditorView--galileiEditor");
  const gm = ed.getModel("graphicalModel").getData();
  return { ids: [...document.querySelectorAll("[id^='BPMNShape_'],[id^='BPMNEdge_']")].map((e) => e.id), shapes: gm.shapes.length, conns: gm.connectors.length, ro: ed.getIsReadOnly(), dirty: gm.isDirty,
    names: gm.shapes.map((s) => s.id + "=" + s.attributes.name) };
});
export const diff = (a, b) => ({ added: b.ids.filter((x) => !a.ids.includes(x)), removed: a.ids.filter((x) => !b.ids.includes(x)), shapes: a.shapes + "->" + b.shapes, conns: a.conns + "->" + b.conns, ro: a.ro + "->" + b.ro, dirty: a.dirty + "->" + b.dirty });
