/*
 * CPI Panel Mover, page-world part of the CPI Helper plugin "cpiPanelMover".
 * Author: Amit Shukla, Mindset Consulting.
 *
 * Loaded by plugins/cpiPanelMover.js through a <script id="cpiPanelMoverScript"> tag
 * (same pattern as plugins/settingsPaneResizer.js). It must run in the page world because it
 * talks to SAP UI5 (window.sap.ui.require). It has no access to chrome.* APIs.
 * Configuration comes from data attributes on that script tag, which the content script keeps
 * current on every CPI Helper heartbeat:
 *   data-default-dock = bottom | left | right  (used until the user clicks L / B / R in the bar)
 *   data-default-full = off | wrap | line      (used until the user clicks Full in the bar)
 * The content script also renders <div id="cpiPanelMover-dock"> in its CPI Helper toolbar
 * panel; the bar docks there while the panel is open (see placeBar).
 * The same code also runs as a standalone userscript. If both are active, whichever runs first
 * wins (window.__cpiPrevNext guard) and the other one does nothing.
 *
 * Features
 * 1. Package list (.../contentpackage/<pkg>?section=ARTIFACTS)
 *    Snapshots the filtered + sorted artifact list from the UI5 table binding into
 *    sessionStorage. Remembers the list search text and restores it when the field is empty.
 * 2. Artifact editor: bar at the bottom  [< Prev] i/N [Next >] [List] | Fit Map | Panel L B R
 *    - Prev/Next do a normal page load (location.assign). SPA navigation left hidden stale
 *      iFlow views in the DOM, which broke CPI Helper buttons and editor features (v1.0 bug).
 *    - Alt+Shift+Left/Right = Prev/Next (ignored inside inputs and code editors).
 * 3. Dock the "Integration Flow" property panel Left / Bottom / Right. Stored in localStorage,
 *    re-applied on every iFlow. Side width is remembered after you drag the splitter.
 *    Uses the public sap.ui.layout.Splitter API (setOrientation, content area order).
 * 4. Fit = zoom so the whole diagram is visible. Map = toggle SAP's own minimap.
 *    View-only calls on the diagram viewer. The editor stays read-only, nothing is changed.
 * 5. Full = show the complete Default Value / Configured Value text in the Externalized
 *    Parameters tab, for screenshots. Click cycles: off > wrap (wider columns, text wraps)
 *    > line (one line per value, horizontal scroll, Description after the scroll). Click a value to edit it
 *    in SAP's own field again. Toggle off to restore SAP's layout. Stored in localStorage.
 *    The other panel tabs too (General, Runtime Configuration, step and adapter tabs): a text
 *    field whose value is cut off gets the same read-only full view.
 * 6. Move = drag diagram boxes in display mode, e.g. to get the relevant pools into one screenshot.
 *    Drag a pool (its steps follow) or a single step; Shift+drag moves the outer pool.
 *    Group: select several boxes (Shift+click, with Move on or off), then drag any of them and
 *    the whole selection moves together. Selection is SAP's own (editor.selectedSymbols).
 *    Lines re-route like in edit mode. View only: never saved, a reload restores SAP's layout,
 *    Reset restores it without a reload. Move off keeps the layout and gives back normal clicks.
 *    Moves are undone automatically before SAP's Edit, so they can never reach a save.
 * 7. Drag the bar by its grip (left end) to any place. Position is stored in localStorage.
 *    Home = inside the plugin's CPI Helper toolbar panel while it is open (element
 *    #cpiPanelMover-dock), else bottom centre. Drag it out of the panel to float it; drop it on
 *    the panel to dock it again. Double-click the grip = back home.
 * Safety: never saves, deploys or unlocks. Asks before leaving a page that looks like edit mode.
 */
(function () {
  "use strict";
  if (window.__cpiPrevNext) {
    // e.g. the Tampermonkey copy is also active
    console.debug("[cpi-helper-us] already loaded (v" + window.__cpiPrevNext.version + "), CPI Helper plugin copy skipped");
    return;
  }
  const API = (window.__cpiPrevNext = { version: "1.7.3", loadedBy: "cpi-helper-plugin" });

  // ---------------- constants ----------------
  const LOG = (...a) => console.debug("[cpi-helper-us]", ...a);
  // package keys: Design keeps the old key, Discover gets its own (a copied package keeps its id)
  const PKEY = (u) => (u.area === "discover" ? "discover:" : "") + u.pkg;
  const KEY = (u) => "cpiPrevNext:" + PKEY(u);
  const FKEY = (u) => "cpiPrevNext:filter:" + PKEY(u);
  const PENDING = "cpiPrevNext:pendingOpen";
  const DOCK = "cpiPrevNext:dock"; // localStorage: 'bottom' | 'left' | 'right'
  const DOCKW = "cpiPrevNext:dockWidth"; // localStorage: side panel width, e.g. "30%" or "620px"
  const FULL = "cpiPrevNext:fullValues"; // localStorage: '1' = show full parameter values
  const BARPOS = "cpiPrevNext:barPos"; // localStorage: bar top-left as viewport fractions, e.g. {"fx":0.1,"fy":0.8}; none = home (see placeBar)
  const HOST_ID = "cpiPanelMover-dock";
  // element the CPI Helper plugin puts in its toolbar panel; the bar docks there while it is visible
  // CPI Helper plugin settings "Default panel position" and "Default Full mode", passed on the loader script tag.
  // Read on every use, so a change in the plugin settings applies without a page reload.
  const CFG_ID = "cpiPanelMoverScript";
  function defaultDock() {
    const el = document.getElementById(CFG_ID);
    const v = el && el.dataset ? el.dataset.defaultDock : "";
    return v === "left" || v === "right" || v === "top" ? v : "bottom";
  }
  function defaultFull() {
    const el = document.getElementById(CFG_ID);
    const v = el && el.dataset ? el.dataset.defaultFull : "";
    return v === "wrap" || v === "line" ? v : "off";
  }
  // Artifact Type (OData Type) -> URL segment. Verified live or in CPI Helper URL patterns.
  const SEGMENT = {
    IFlow: "integrationflows",
    MessageMapping: "messagemappings",
    ValueMapping: "valuemappings",
    ScriptCollection: "scriptcollections",
  }; // anything else opens via the list (fallback)

  // ---------------- small helpers ----------------
  const ss = {
    get(k) {
      try {
        return sessionStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    set(k, v) {
      try {
        sessionStorage.setItem(k, v);
        return true;
      } catch (e) {
        try {
          sessionStorage.removeItem(k);
        } catch (_) {}
        return false;
      }
    },
    del(k) {
      try {
        sessionStorage.removeItem(k);
      } catch (e) {
        /* ignore */
      }
    },
  };
  const ls = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch (e) {
        /* ignore */
      }
    },
    del(k) {
      try {
        localStorage.removeItem(k);
      } catch (e) {
        /* ignore */
      }
    },
  };
  const PFX = (location.pathname.match(/^(.*?)\/shell\//) || [, ""])[1]; // '' on CF, '/itspaces' on Neo
  // area = "design" (Design) or "discover" (Discover, read-only catalog); both show the same iFlow viewer
  const base = (u) => PFX + "/shell/" + u.area + "/contentpackage/" + encodeURIComponent(u.pkg);

  function parse() {
    const m = location.pathname.match(/\/shell\/(design|discover)\/contentpackage\/([^/?#]+)(?:\/([^/?#]+)\/([^/?#]+))?/);
    if (!m) return null;
    return { area: m[1], pkg: decodeURIComponent(m[2]), seg: m[3] || null, name: m[4] ? decodeURIComponent(m[4]) : null };
  }
  // UI5 access goes through the module API, not the deprecated global namespace
  // (sap.ui.core.Element is gone in UI5 2.x). Sync probe only: never loads anything,
  // returns null until SAP's own page has loaded the module. Needs @grant none (page world).
  function ui5Element() {
    const ui = window.sap && window.sap.ui;
    if (!ui) return null;
    return (ui.require && ui.require("sap/ui/core/Element")) || (ui.core && ui.core.Element) || null;
  }
  const ui5Ready = () => !!ui5Element();
  function byId(id) {
    const E = ui5Element();
    if (!E) return null;
    if (E.getElementById) return E.getElementById(id); // UI5 1.119+
    return E.registry && E.registry.get ? E.registry.get(id) : null; // 1.84+
  }
  function controls(pred) {
    // all live controls matching pred
    const E = ui5Element();
    return E && E.registry && E.registry.filter ? E.registry.filter(pred) : [];
  }
  // cheap lookup: DOM id suffix -> UI5 control (visible one only)
  function ctl(suffix) {
    const els = document.querySelectorAll('[id$="' + suffix + '"]');
    for (const el of els) {
      if (!el.offsetParent) continue;
      const c = byId(el.id);
      if (c) return c;
    }
    return null;
  }
  const visible = (c) => !!(c && c.getDomRef && c.getDomRef() && c.getDomRef().offsetParent);
  const navigate = (path) => location.assign(path); // real page load on purpose

  // ---------------- list page ----------------
  let lastSnap = "";
  function readBinding(b) {
    // Avoid getContexts(): it updates the binding's change-detection state used by the table.
    let ctxs;
    if (b.getAllCurrentContexts) ctxs = b.getAllCurrentContexts();
    else if (b.aIndices) ctxs = b.aIndices.map((i) => b.getModel().getContext(b.getPath() + "/" + i));
    else ctxs = b.getContexts(0, b.getLength());
    return ctxs.map((c) => {
      const o = c.getObject();
      return { n: o.Name, t: o.Type, d: o.DisplayName || o.Name };
    });
  }
  function snapshot(table) {
    const u = parse();
    if (!u || u.name) return; // resolve package at fire time
    const b = table.getBinding("items");
    if (!b) return;
    const list = readBinding(b);
    if (!list.length && b.getModel() && !b.getModel().getProperty(b.getPath())) return; // still loading
    const s = JSON.stringify(list);
    if (s === lastSnap) return;
    lastSnap = s;
    ss.set(KEY(u), s);
    LOG("saved", list.length, "artifacts for", u.pkg);
  }
  function tableSearchField(table) {
    const tb = table.getHeaderToolbar && table.getHeaderToolbar();
    let sf = tb && tb.findAggregatedObjects(true, (c) => c.isA("sap.m.SearchField"))[0];
    if (!sf) {
      // header search is outside the table on this page: nearest visible SearchField
      sf = controls((c) => c.isA("sap.m.SearchField") && visible(c))[0];
    }
    return sf;
  }
  function hookList() {
    const u = parse();
    if (!u || u.name) return;
    const t = ctl("--artifactTable");
    if (!t || !t.getBinding("items")) return;
    if (!t.__cpiHooked) {
      t.__cpiHooked = true;
      t.getBinding("items").attachChange(() => snapshot(t));
      t.attachUpdateFinished(() => {
        snapshot(t);
        openPending(t);
      });
    }
    const sf = tableSearchField(t);
    if (sf && !sf.__cpiHooked) {
      sf.__cpiHooked = true;
      const saved = ss.get(FKEY(u));
      if (saved && !sf.getValue()) {
        sf.setValue(saved);
        sf.fireLiveChange({ newValue: saved });
        sf.fireSearch({ query: saved });
      }
      const store = (v) => {
        const p = parse();
        if (p && !p.name) ss.set(FKEY(p), v || "");
      };
      sf.attachLiveChange((e) => store(e.getParameter("newValue")));
      sf.attachSearch((e) => store(e.getParameter("query")));
    }
    snapshot(t);
    openPending(t);
  }
  function openPending(t) {
    let p;
    try {
      p = JSON.parse(ss.get(PENDING) || "null");
    } catch (e) {
      p = null;
    }
    const u = parse();
    if (!p) return;
    if (!u || u.name || p.pkg !== PKEY(u) || Date.now() - p.ts > 30000) {
      ss.del(PENDING);
      return;
    }
    const item = t.getItems().find((i) => {
      const o = i.getBindingContext() && i.getBindingContext().getObject();
      return o && o.Name === p.n && o.Type === p.t;
    });
    if (!item) return; // maybe not rendered yet; expires in 30 s
    ss.del(PENDING);
    item.firePress(); // verified: opens the artifact on this tenant
  }

  // ---------------- editor page: Prev / Next ----------------
  function looksLikeEditMode() {
    try {
      const ed = diagramEditor();
      if (ed && ed.isReadOnly === false) return true; // iFlow: exact signal from the diagram editor
      return controls((c) => c.isA("sap.m.Button") && c.getText && /^(Save|Speichern)$/.test(c.getText()) && c.getEnabled() && visible(c)).length > 0;
    } catch (e) {
      return false;
    }
  }
  const leaveOk = () => !looksLikeEditMode() || confirm("This artifact looks like it is in edit mode. Leave without saving? (It stays locked until you cancel edit.)");

  function state() {
    const u = parse();
    if (!u || !u.name) return null;
    let list;
    try {
      list = JSON.parse(ss.get(KEY(u)) || "null");
    } catch (e) {
      list = null;
    }
    if (!list || !list.length) return { u, list: null, i: -1 };
    return { u, list, i: list.findIndex((x) => x.n === u.name) };
  }
  function go(dir) {
    const s = state();
    if (!s || !s.list || s.i < 0) return;
    const j = s.i + dir;
    if (j < 0 || j >= s.list.length) return;
    if (!leaveOk()) return;
    const item = s.list[j],
      seg = SEGMENT[item.t];
    if (seg) navigate(base(s.u) + "/" + seg + "/" + encodeURIComponent(item.n));
    else {
      ss.set(PENDING, JSON.stringify({ pkg: PKEY(s.u), n: item.n, t: item.t, ts: Date.now() }));
      navigate(base(s.u) + "?section=ARTIFACTS");
    }
  }
  function toList() {
    const s = state();
    if (s && leaveOk()) navigate(base(s.u) + "?section=ARTIFACTS");
  }

  // ---------------- editor page: diagram view helpers ----------------
  function diagramEditor() {
    const c = ctl("--galileiEditor");
    return c && c.getEditor ? c.getEditor() : null;
  }
  function fitAll() {
    const ed = diagramEditor();
    if (ed && ed.showGlobalView) ed.showGlobalView();
  }
  function toggleMap() {
    const ed = diagramEditor();
    if (ed && ed.toggleOverview) ed.toggleOverview();
  }

  // ---------------- editor page: move boxes (view only) ----------------
  // SAP diagram = Galilei DiagramEditor (sap.galilei.ui.editor.DiagramEditor). Each drag step is one
  // undoable action on the diagram resource: ed.moveSymbolsBy moves the symbol, its sub-symbols and
  // re-routes the lines, exactly as SAP's own move tool does in edit mode. Same SVG elements move
  // (no clones), so classes and overlays other tools add to steps stay attached; lines touching a
  // moved box are redrawn. Nothing is sent: CPI autosave and "unsaved changes" only run in edit
  // mode. Reset = undo our actions on the resource, then the same light redraw.
  let moveOn = false,
    mv = null,
    drag = null,
    swallowClick = false;
  // mv: { ed, r, n: our undo actions, base: undo stack was not empty before us }
  const res = (ed) => ed && ed._diagram && ed._diagram.resource;
  const displayMode = (ed) => !!(ed && ed.isReadOnly !== false);
  function moveSym(ed, s, dx, dy) {
    const r = res(ed);
    if (!r) return;
    if (!mv || mv.r !== r) mv = { ed, r, n: 0, base: r.canUndo() };
    const list = Array.isArray(s) ? s : [s];
    r.applyUndoableAction(() => ed.moveSymbolsBy(list, dx, dy, ed.viewer), "cpi-helper view move");
    mv.n++;
    if (list.length > 1) refreshSelection(ed);
  }
  // Group = SAP's current selection, reduced to the outermost boxes: moveSymbolsBy moves the
  // children with their box, so passing them as well would move them twice.
  function groupRoots(ed) {
    const sel = (ed && ed.selectedSymbols) || [];
    const out = [];
    for (let i = 0; i < sel.length; i++) {
      const s = sel[i];
      if (s && !s.isLinkSymbol && !(s.parentSymbol && ed.isSymbolSelected(s.parentSymbol))) out.push(s);
    }
    return out;
  }
  // The dashed frame around a multi-selection stays where it was until SAP redraws it.
  function refreshSelection(ed) {
    try {
      const t = ed.multiSelectionTracker;
      if (t && t.showAllSelection) t.showAllSelection();
    } catch (e) {
      LOG("selection frame", e);
    }
  }
  // Shift+click with Move on: add or remove the box, like Shift+click in SAP with Move off.
  function toggleSelected(ed, s) {
    try {
      const sel = ed.selectedSymbols;
      if (sel.indexOf(s) >= 0) {
        // SAP selected the box's steps with it; drop them too, or they would drag on their own
        const inside = (x) => {
          for (let p = x; p; p = p.parentSymbol) if (p === s) return true;
          return false;
        };
        const drop = [];
        for (let i = 0; i < sel.length; i++) if (inside(sel[i])) drop.push(sel[i]);
        ed.unselectSymbols(drop);
      } else ed.selectSymbols([s]);
      // like SAP's own Shift+click: the box only, its steps count as selected through it
      refreshSelection(ed);
    } catch (e) {
      LOG("select", e);
      API.lastError = String(e);
    }
  }
  function resetMoves() {
    const m = mv;
    mv = null;
    if (!m || !m.n || res(m.ed) !== m.r) return;
    // diagram was rebuilt by SAP: nothing of ours left
    let acts = [];
    for (let i = 0; i < m.n && m.r.canUndo(); i++) {
      const a = m.r.undo();
      if (a) acts = acts.concat(a);
    }
    try {
      // redraw like a drag does: boxes only get their transform back (same elements, trace colours
      // stay), lines are redrawn. A full SAP redraw would recreate the step elements.
      m.ed.getUndoRedoSymbols(acts).updated.forEach((s) => {
        if (s.isLinkSymbol) {
          if (s.isDrawn) s.drawSymbol(m.ed.viewer);
        } else if (s.shape && s.shape.isDrawn) {
          s.shape.x = s.x;
          s.shape.y = s.y;
          s.shape.updateDrawing(m.ed.viewer, undefined, ["groupTransform"]);
        }
      });
    } catch (e) {
      LOG("redraw failed", e);
      API.lastError = String(e);
    }
    if (!m.base) m.r.clearUndoRedo();
    // back to SAP's clean state (isModified false)
    renderBar();
  }
  const hasMoves = () => !!(mv && mv.n && res(mv.ed) === mv.r);
  function ensureMoveCss() {
    if (document.getElementById("cpi-us-move-css")) return;
    const st = document.createElement("style");
    st.id = "cpi-us-move-css";
    st.textContent = ".cpiUsMoveOn svg.svgRoot { user-select: none; } .cpiUsMoveOn svg.svgRoot g.sapGalileiSymbolNode { cursor: move; }";
    document.head.appendChild(st);
  }
  function setMoveClass() {
    const c = ctl("--galileiEditor"),
      d = c && c.getDomRef && c.getDomRef();
    if (d) d.classList.toggle("cpiUsMoveOn", moveOn);
  }
  function toggleMove() {
    moveOn = !moveOn;
    if (moveOn) ensureMoveCss();
    setMoveClass();
    renderBar();
  }
  function symAt(ed, t) {
    const root = ed.viewer && ed.viewer.svgRoot;
    if (!root || !t || !t.closest || !root.contains(t)) return null;
    // main diagram only, not the minimap
    const g = t.closest("g.sapGalileiSymbolNode,g.sapGalileiSymbolLink");
    let s = g && g.id ? ed.findSymbolById(g.id) : null;
    if (s && s.isLinkSymbol) s = s.parentSymbol;
    // a line inside a pool drags the pool
    return s || null;
  }
  function dragStep() {
    const d = drag;
    if (!d) return;
    d.raf = 0;
    const k = (d.ed.viewer && d.ed.viewer.zoomScale) || 1;
    const dx = Math.round((d.cx - d.x) / k - d.px),
      dy = Math.round((d.cy - d.y) / k - d.py);
    if (!dx && !dy) return;
    moveSym(d.ed, d.s, dx, dy);
    d.px += dx;
    d.py += dy;
  }
  function endDrag(e) {
    const d = drag;
    if (!d || (e && e.pointerId !== d.id)) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      d.cx = e.clientX;
      d.cy = e.clientY;
    }
    if (d.raf) cancelAnimationFrame(d.raf);
    if (d.moved) dragStep();
    else if (d.shift && (!e || e.type !== "pointercancel")) toggleSelected(d.ed, d.hit);
    drag = null;
    setTimeout(() => {
      swallowClick = false;
    }, 0);
    // the click, if any, comes right after pointerup
    renderBar();
  }
  // document capture phase: runs before SAP's handlers on the diagram. A cancelled pointerdown also
  // stops the compatibility mousedown/mouseup, so SAP neither selects nor pans. Background = SAP pans.
  document.addEventListener(
    "pointerdown",
    (e) => {
      swallowClick = false;
      if (hasMoves() && e.target && e.target.closest) {
        // undo our moves before SAP's Edit can load them into an edit session
        const b = e.target.closest("button,.sapMBtn");
        if (b && /^(Edit|Bearbeiten)$/.test((b.textContent || "").trim())) resetMoves();
      }
      if (!moveOn || drag || e.button !== 0 || !e.isPrimary) return;
      const ed = diagramEditor();
      if (!displayMode(ed)) return;
      const hit = symAt(ed, e.target);
      if (!hit) return;
      const roots = groupRoots(ed);
      let s = hit;
      if (roots.length > 1 && ed.isSymbolSelected(hit)) s = roots;
      // a box in a multi-selection drags the whole selection
      else if (e.shiftKey) while (s.parentSymbol) s = s.parentSymbol;
      e.preventDefault();
      e.stopPropagation();
      swallowClick = true;
      drag = { ed, s, hit, shift: e.shiftKey, id: e.pointerId, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, px: 0, py: 0, moved: false, raf: 0 };
      try {
        ed.viewer.svgRoot.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    },
    true
  );
  document.addEventListener(
    "pointermove",
    (e) => {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;
      e.preventDefault();
      e.stopPropagation();
      d.cx = e.clientX;
      d.cy = e.clientY;
      if (!d.moved && Math.abs(d.cx - d.x) + Math.abs(d.cy - d.y) < 4) return;
      // tiny jitter is not a drag
      d.moved = true;
      if (!d.raf) d.raf = requestAnimationFrame(dragStep);
    },
    true
  );
  document.addEventListener("pointerup", endDrag, true);
  document.addEventListener("pointercancel", endDrag, true);
  document.addEventListener(
    "click",
    (e) => {
      if (!swallowClick) return;
      // the click that ends a Move-mode press must not reach SAP
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  // ---------------- editor page: dock the property panel ----------------
  let applying = false;
  function applyDock(force) {
    const sp = ctl("--iflowSplitter");
    if (!sp) return;
    const prop = sp.getContentAreas().find((a) => /--iflowPropMain$/.test(a.getId()));
    if (!prop) return;
    const want = ls.get(DOCK) || defaultDock();
    const vert = want === "bottom" || want === "top";
    // top and bottom: panel above or below the diagram; left and right: beside it
    const ori = vert ? "Vertical" : "Horizontal";
    const idx = sp.getContentAreas().indexOf(prop);
    const wantIdx = want === "left" || want === "top" ? 0 : sp.getContentAreas().length - 1;
    if (!force && sp.getOrientation() === ori && idx === wantIdx && sp.__cpiDock === want) return;
    if (!force && want === "bottom" && !sp.__cpiDock) return; // SAP default, leave untouched
    applying = true;
    try {
      if (idx !== wantIdx) {
        sp.removeContentArea(prop);
        sp.insertContentArea(prop, wantIdx);
      }
      sp.setOrientation(ori);
      const ld = prop.getLayoutData();
      if (ld && ld.setSize) {
        if (sp.__cpiBottomSize === undefined) sp.__cpiBottomSize = ld.getSize(); // remember SAP's height once, before the first change
        if (vert) {
          if (sp.__cpiBottomSize) ld.setSize(sp.__cpiBottomSize);
        } else ld.setSize(ls.get(DOCKW) || "30%");
      }
      sp.__cpiDock = want;
      if (!sp.__cpiResizeHooked) {
        sp.__cpiResizeHooked = true;
        sp.attachResize(() => {
          // remember the side width the user drags to
          if (applying || /^(bottom|top)$/.test(ls.get(DOCK) || defaultDock())) return;
          const l = prop.getLayoutData();
          const w = l && l.getSize && l.getSize();
          if (w && /px|%/.test(w) && parseFloat(w) > 120) ls.set(DOCKW, w);
        });
      }
    } catch (e) {
      LOG("dock failed", e);
      API.lastError = String(e);
    }
    setTimeout(() => {
      applying = false;
    }, 500);
  }
  // After a panel move the diagram area has a new size but SAP keeps the old zoom: Fit once the
  // area stops resizing (same size in 2 samples 100 ms apart, at most 1.5 s).
  function fitWhenSettled() {
    let last = "",
      same = 0,
      n = 0;
    const step = () => {
      const ed = diagramEditor(),
        svg = ed && ed.viewer && ed.viewer.svgRoot;
      const r = svg && svg.getBoundingClientRect ? svg.getBoundingClientRect() : null;
      const k = r ? Math.round(r.width) + "x" + Math.round(r.height) : "";
      same = k === last ? same + 1 : 0;
      last = k;
      if ((same >= 2 && n >= 3) || n >= 15) {
        fillFights = 0;
        fillPanel();
        fitAll();
        return;
      }
      n++;
      setTimeout(step, 100);
    };
    setTimeout(step, 100);
  }
  // Docked left, right or top, the panel should use its full height. SAP pins the property sheet's
  // scroll area to a pixel height computed for the bottom layout (measured: 671px inside a 1299px
  // side panel) and does not recompute it. Stretch it to the panel's bottom; keep SAP's value to
  // restore at the bottom. SAP may write its height back: a style watch re-applies, and gives up
  // for this tick if the two keep fighting.
  let fillObs = null,
    fillEl = null,
    fillFights = 0;
  function fillPanel() {
    try {
      fillPanelNow();
    } catch (e) {
      LOG("fill panel", e);
    }
  }
  function fillPanelNow() {
    const sc = document.querySelector('[id$="--propertySheetScrollContainer"]'),
      main = document.querySelector('[id$="--iflowPropMain"]');
    if (!sc || !main) return;
    const want = ls.get(DOCK) || defaultDock();
    if (want === "bottom") {
      if (sc.dataset.cpiSapH !== undefined) {
        sc.style.height = sc.dataset.cpiSapH;
        delete sc.dataset.cpiSapH;
      }
      return;
    }
    if (!main.offsetParent || fillFights > 5) return;
    const h = Math.floor(main.getBoundingClientRect().bottom - sc.getBoundingClientRect().top - 4);
    if (h < 200) return;
    if (sc.dataset.cpiSapH === undefined) sc.dataset.cpiSapH = sc.style.height || "";
    if (Math.abs((parseFloat(sc.style.height) || 0) - h) > 3) {
      sc.style.height = h + "px";
      fillFights++;
    }
    if (fillEl !== sc && typeof MutationObserver === "function") {
      if (fillObs) fillObs.disconnect();
      fillEl = sc;
      fillObs = new MutationObserver(() => fillPanel());
      fillObs.observe(sc, { attributes: true, attributeFilter: ["style"] });
    }
  }
  function setDock(where) {
    ls.set(DOCK, where);
    applyDock(true);
    renderBar();
    fitWhenSettled();
  }

  // ---------------- coexistence: CPI Helper "Settings Pane Resizer" plugin ----------------
  // settingsPaneResizer.js sets inline px heights on <splitter>-content-0 / -1 (it assumes the
  // panel is the lower area) and settingsPaneResizer-inject.js sets layout data on content
  // areas [0] / [1] by index. When we dock left or right the splitter is Horizontal: UI5 sizes
  // widths only, so an inline height on a content area is never UI5's own. Remove it at once
  // (MutationObserver) and on every tick. Does nothing while docked at the bottom.
  const hGuarded = new WeakSet();
  function sideDocked(sp) {
    return !!(sp && sp.getOrientation && sp.getOrientation() === "Horizontal" && (sp.__cpiDock === "left" || sp.__cpiDock === "right"));
  }
  function stripHeight(el) {
    if (!el || !el.style.height) return;
    const sp = byId(el.id.replace(/-content-\d+$/, ""));
    if (sideDocked(sp)) el.style.height = "";
  }
  const hObs = typeof MutationObserver === "function" ? new MutationObserver((recs) => recs.forEach((r) => stripHeight(r.target))) : null;
  function guardSideHeights() {
    const sp = ctl("--iflowSplitter");
    if (!sideDocked(sp)) return;
    for (let i = 0; i < sp.getContentAreas().length; i++) {
      const el = document.getElementById(sp.getId() + "-content-" + i);
      if (!el) continue;
      stripHeight(el);
      if (hObs && !hGuarded.has(el)) {
        hGuarded.add(el);
        hObs.observe(el, { attributes: true, attributeFilter: ["style"] });
      }
    }
  }

  // ---------------- editor page: full parameter values ----------------
  // Columns: Name, Default Value, (hidden label), Configured Value, (hidden label), Description
  // Modes: 'wrap' = value text wraps inside wider columns (one screenshot shows all)
  //        'line' = value text on one line, table scrolls horizontally, Description after scroll
  // Both modes: auto table layout, Name on one line, 13px text. Hidden label columns collapsed.
  const FULL_WIDTHS = ["", "", "1px", "", "1px", "4rem"];
  function ensureFullCss() {
    if (document.getElementById("cpi-us-full-css")) return;
    const st = document.createElement("style");
    st.id = "cpi-us-full-css";
    st.textContent =
      ".cpiUsFullMode .sapMText, .cpiUsFullMode .sapMLabel, .cpiUsFullMode .cpi-us-full { font-size: .8125rem !important; }" +
      ".cpiUsFullMode .cpiUsName, .cpiUsFullMode .cpiUsName * { white-space: nowrap !important; }" +
      ".cpiUsFullMode .sapMListTblCell { padding-top: .25rem; padding-bottom: .25rem; }";
    document.head.appendChild(st);
  }
  const fullMode = () => {
    const v = ls.get(FULL) || defaultFull();
    return v === "wrap" || v === "line" ? v : v === "1" ? "wrap" : "off";
  };
  // panel = a field in the other panel tabs: its mirror is the next sibling, and line mode scrolls per field
  function mirrorInput(c, mode, panel) {
    const d = c.getDomRef();
    if (!d || !d.parentNode) return;
    let m = panel ? (ownNode(d.nextSibling) ? d.nextSibling : null) : d.parentNode.querySelector(":scope > .cpi-us-full");
    if (mode === "off" || c.__cpiSkip || (c.getType && c.getType() === "Password")) {
      if (m) m.remove();
      d.style.display = "";
      return;
    }
    const val = c.getValue ? c.getValue() : "";
    const ph = !val && c.getPlaceholder ? c.getPlaceholder() : "";
    if (!m) {
      m = document.createElement("div");
      m.className = panel ? "cpi-us-full cpi-us-pfull" : "cpi-us-full";
      m.title = "Click to edit in the SAP field";
      m.addEventListener("click", () => {
        c.__cpiSkip = true;
        mirrorInput(c, fullMode(), panel);
        try {
          c.focus();
        } catch (e) {
          /* ignore */
        }
      });
      d.parentNode.insertBefore(m, d.nextSibling);
    }
    const editable = c.getEditable() && c.getEnabled();
    if (m.textContent !== (val || ph)) m.textContent = val || ph;
    // panel line mode: form cells clip, so each mirror scrolls sideways on its own
    const lineCss = panel ? "white-space:pre;overflow-x:auto;max-width:100%;" : "white-space:pre;width:max-content;min-width:100%;";
    const wrapCss = mode === "wrap" ? "white-space:pre-wrap;overflow-wrap:anywhere;" : lineCss;
    m.style.cssText =
      wrapCss +
      "min-height:1.5rem;box-sizing:border-box;padding:.25rem .5rem;border:1px solid #bcc3ca;border-radius:.25rem;" +
      "font-family:inherit;line-height:1.3;cursor:text;" +
      "background:" +
      (editable ? "#fff" : "#eaecee") +
      ";color:" +
      (val ? "#1d2d3e" : "#8396a8") +
      ";font-style:" +
      (val ? "normal" : "italic");
    d.style.display = "none";
  }
  function restoreTable(t) {
    const f = t.__cpiFull;
    if (!f) return;
    t.__cpiFull = null;
    t.getColumns().forEach((c, i) => c.setWidth(f.w[i] || ""));
    t.setFixedLayout(f.fixed);
    t.removeStyleClass("cpiUsFullMode");
    t.getItems().forEach((it) => {
      const n = it.getCells()[0];
      if (n && n.removeStyleClass) n.removeStyleClass("cpiUsName");
    });
    if (t.getDomRef()) t.getDomRef().style.overflowX = "";
  }
  function applyFull() {
    const t = ctl("--externalizeParametersTable");
    if (!t) return;
    const mode = fullMode();
    if (mode === "off" && !t.__cpiFull) return;
    if (t.__cpiFull && t.__cpiFull.mode !== mode) restoreTable(t);
    const cols = t.getColumns();
    if (mode !== "off" && !t.__cpiFull) {
      t.__cpiFull = { mode, w: cols.map((c) => c.getWidth()), fixed: t.getFixedLayout() };
      ensureFullCss();
      if (cols.length === 6) cols.forEach((c, i) => c.setWidth(FULL_WIDTHS[i]));
      t.setFixedLayout(false);
      t.addStyleClass("cpiUsFullMode");
      t.getItems().forEach((it) =>
        it.getCells().forEach((c) => {
          c.__cpiSkip = false;
        })
      );
    }
    if (mode === "line" && t.getDomRef()) t.getDomRef().style.overflowX = "auto"; // horizontal scroll
    t.getItems().forEach((it) => {
      const cells = it.getCells();
      if (mode !== "off" && cells[0] && cells[0].addStyleClass && !cells[0].hasStyleClass("cpiUsName")) cells[0].addStyleClass("cpiUsName");
      cells.forEach((c) => {
        if (c.isA && c.isA("sap.m.InputBase")) mirrorInput(c, mode);
      });
    });
    if (mode !== "off" && !t.__cpiFullHooked) {
      // re-apply right after SAP re-renders rows
      t.__cpiFullHooked = true;
      t.attachUpdateFinished(() => setTimeout(applyFull, 50));
      t.addEventDelegate({ onAfterRendering: () => setTimeout(applyFull, 50) });
    }
  }
  function toggleFull() {
    const next = { off: "wrap", wrap: "line", line: "off" }[fullMode()];
    ls.set(FULL, next);
    applyAllFull();
    setTimeout(applyAllFull, 300);
    renderBar();
  }

  // ---------------- editor page: full values in the other panel tabs ----------------
  // Full also covers the text fields of the other Integration Flow panel tabs (General, Runtime
  // Configuration, step and adapter tabs). Tab content renders under an element whose id ends with
  // --blCenterArea. SAP makes new tab and field ids on every render, so fields are found by control
  // type under that root: sap.m.Input, sap.m.TextArea and SAP's CustomMultiInput (outer field only).
  // A field gets a mirror only when its value is cut off: some element inside it is wider than its
  // box (input text, clipped token text) or a TextArea is taller than its box. A mirrored field
  // stays mirrored until SAP renders it again (the hidden field cannot be measured). Empty fields,
  // password fields and the Externalized Parameters table (code above) are left alone.
  // View only: values are read with getValue(), never set.
  const PANEL_ROOT = "--blCenterArea";
  const panelCtls = new Set();
  let panelObs = null,
    panelObsRoot = null,
    panelTimer = 0,
    panelLast = "off";
  function panelRoot() {
    for (const el of document.querySelectorAll('[id$="' + PANEL_ROOT + '"]')) if (el.offsetParent) return el;
    return null;
  }
  const inside = (el, root) => {
    for (let e = el; e; e = e.parentNode) if (e === root) return true;
    return false;
  };
  const ownNode = (n) => !!(n && n.nodeType === 1 && /\bcpi-us-full\b/.test(n.className || ""));
  function panelField(c) {
    if (!c || !c.isA || !c.getDomRef) return false;
    const md = c.getMetadata && c.getMetadata(),
      n = md && md.getName ? md.getName() : "";
    return c.isA("sap.m.Input") || c.isA("sap.m.TextArea") || /\.CustomMultiInput$/.test(n);
  }
  function panelSkip(c) {
    // inner inputs of a CustomMultiInput, and parameter table cells
    for (let p = c.getParent && c.getParent(); p; p = p.getParent && p.getParent()) {
      if (p.isA && p.isA("sap.m.InputBase")) return true;
      if (p.getId && /--externalizeParametersTable$/.test(p.getId())) return true;
    }
    return false;
  }
  function cutOff(el) {
    // Only elements that hold the text itself: an input, a textarea, or a leaf with text (a token's
    // label). Layout boxes are skipped: SAP's token container is always ~2 px wider than its field
    // (measured 1843/1841 with a 21-character value), which would mark every field as cut off.
    // Boxes of 1-2 px are screen-reader-only text (clipped on purpose), not a cut-off value.
    const tag = el.tagName,
      leaf = !(el.children && el.children.length) && /\S/.test(el.textContent || "");
    if ((tag === "INPUT" || tag === "TEXTAREA" || leaf) && el.clientWidth > 2 && el.scrollWidth > el.clientWidth + 1) return true;
    if (tag === "TEXTAREA" && el.scrollHeight > el.clientHeight + 1) return true;
    for (const k of el.children || []) if (cutOff(k)) return true;
    return false;
  }
  function watchPanel(root) {
    // one observer; it moves to a new root when SAP replaces the element. Own mirror changes are ignored.
    if (root === panelObsRoot || typeof MutationObserver !== "function") return;
    if (!panelObs) {
      panelObs = new MutationObserver((recs) => {
        if (fullMode() === "off" && !panelCtls.size) return;
        const theirs = recs.some((r) => !ownNode(r.target) && ![...r.addedNodes, ...r.removedNodes].every(ownNode));
        if (!theirs) return;
        clearTimeout(panelTimer);
        panelTimer = setTimeout(applyPanelFull, 80);
      });
    } else panelObs.disconnect();
    panelObsRoot = root;
    panelObs.observe(root, { childList: true, subtree: true });
  }
  function applyPanelFull() {
    const mode = fullMode(),
      reset = mode !== panelLast;
    panelLast = mode;
    if (mode === "off" && !panelCtls.size) return;
    const root = panelRoot();
    for (const c of panelCtls) {
      const d = c.getDomRef && c.getDomRef();
      if (d && (mode === "off" || !root || !inside(d, root))) mirrorInput(c, "off", true);
      if (!d || mode === "off" || !root || !inside(d, root)) panelCtls.delete(c);
    }
    if (mode === "off" || !root) return;
    watchPanel(root);
    controls(panelField).forEach((c) => {
      const d = c.getDomRef();
      if (!d || !d.parentNode || !inside(d, root) || panelSkip(c)) return;
      if (reset) c.__cpiSkip = false;
      const n = d.nextSibling,
        m = ownNode(n) ? n : null;
      const val = c.getValue ? c.getValue() : "";
      if (!val || c.__cpiSkip) {
        if (m) mirrorInput(c, "off", true);
        return;
      }
      if (!m && (!d.offsetParent || (c.getVisible && !c.getVisible()) || inside(document.activeElement, d) || !cutOff(d))) return;
      // a field the user is typing in is never swapped for a mirror
      mirrorInput(c, mode, true);
      panelCtls.add(c);
    });
  }
  function applyAllFull() {
    applyFull();
    applyPanelFull();
  }

  // ---------------- the bar ----------------
  let bar,
    barMode = "";
  const BTN = "border:1px solid #0a6ed1;background:#fff;color:#0a6ed1;border-radius:6px;padding:3px 9px;cursor:pointer;font:inherit";
  const BAR_FONT = 'font:12px "72",Arial,sans-serif;color:#32363a';
  const BAR_FLOAT =
    "position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:30;width:max-content;display:flex;gap:5px;align-items:center;padding:5px 8px;background:#fff;border:1px solid #0a6ed1;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.2);" +
    BAR_FONT;
  // width:0 + min-width:100%: the bar adds nothing to the CPI Helper panel's max-content width, then fills and wraps
  const BAR_DOCKED = "position:static;transform:none;width:0;min-width:100%;box-sizing:border-box;display:flex;flex-wrap:wrap;gap:7px 5px;align-items:center;padding:2px 0 0;background:transparent;border:0;" + BAR_FONT;
  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "cpi-us-bar";
    bar.style.cssText = BAR_FLOAT;
    barMode = "floating";
    bar.innerHTML =
      '<span data-a="grip" style="cursor:move;padding:2px 3px 2px 1px;color:#0a6ed1;font-weight:bold;letter-spacing:-1px;user-select:none;touch-action:none">::</span>' +
      '<button data-a="prev">&lt; Prev</button><span data-a="pos" style="min-width:60px;text-align:center"></span>' +
      '<button data-a="next">Next &gt;</button><button data-a="list" title="Back to the filtered list">List</button>' +
      '<span data-g="dia" style="display:flex;gap:5px;align-items:center"><span data-sep="1" style="color:#999">|</span>' +
      '<button data-a="fit" title="Zoom to show the whole iFlow (view only)">Fit</button>' +
      '<button data-a="map" title="Toggle minimap (view only)">Map</button>' +
      '<span data-br="1" style="display:none"></span><button data-a="move">Move</button><button data-a="reset" title="Put all boxes back where SAP drew them">Reset</button><button data-a="pop">Popup</button>' +
      '<button data-a="full" title="Show full values in the Integration Flow panel: Externalized Parameters, General, Runtime Configuration, step tabs (for screenshots)">Full</button>' +
      '<span data-sep="1" style="color:#999">|</span><span data-br="1" style="display:none"></span><span>Panel</span>' +
      '<span data-g="dpad" style="display:flex;gap:5px;align-items:center"><button data-a="dock-left" title="Dock Integration Flow panel on the left">L</button>' +
      '<button data-a="dock-top" title="Dock panel at the top">T</button>' +
      '<button data-a="dock-bottom" title="Dock panel at the bottom (SAP default)">B</button>' +
      '<button data-a="dock-right" title="Dock panel on the right">R</button></span></span>';
    bar.querySelectorAll("button").forEach((b) => {
      b.style.cssText = BTN;
    });
    bar.addEventListener("click", (e) => {
      const a = e.target && e.target.getAttribute && e.target.getAttribute("data-a");
      if (a === "prev") go(-1);
      else if (a === "next") go(1);
      else if (a === "list") toList();
      else if (a === "pos" && barMode === "docked" && e.target.dataset.link) toList();
      else if (a === "fit") fitAll();
      else if (a === "map") toggleMap();
      else if (a === "full") toggleFull();
      else if (a === "move") toggleMove();
      else if (a === "reset") resetMoves();
      else if (a === "pop") togglePop();
      else if (a && a.startsWith("dock-")) setDock(a.slice(5));
    });
    hookGrip(bar.querySelector('[data-a="grip"]'));
    document.body.appendChild(bar);
    return bar;
  }
  // bar position: home = inside the CPI Helper panel when it is there and visible, else bottom centre;
  // after a drag outside the panel, explicit left/top kept inside the viewport
  function readPos() {
    try {
      const p = JSON.parse(ls.get(BARPOS) || "null");
      return p && isFinite(p.fx) && isFinite(p.fy) ? p : null;
    } catch (e) {
      return null;
    }
  }
  let gripDrag = null;
  // The CPI Helper panel gets a new host on every open, so look the host up each time.
  function hostEl() {
    const h = document.getElementById(HOST_ID);
    return h && (h.offsetParent || (h.getClientRects && h.getClientRects().length)) ? h : null;
  }
  function overHost(x, y) {
    const h = hostEl();
    if (!h) return false;
    const r = ((h.closest && (h.closest(".cpiHelper_floatingToolbar_panel") || h.closest("fieldset"))) || h).getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  // Each mode writes all of its styles, so a switch fully restores the other mode's look.
  function styleBar(mode) {
    if (barMode === mode) return;
    barMode = mode;
    const shown = bar.style.display;
    bar.style.cssText = mode === "docked" ? BAR_DOCKED : BAR_FLOAT;
    if (shown) bar.style.display = shown;
    const dia = bar.querySelector('[data-g="dia"]');
    if (dia) dia.style.flexWrap = mode === "docked" ? "wrap" : "";
    bar.querySelectorAll("[data-sep]").forEach((x) => {
      x.style.display = mode === "docked" ? "none" : "";
    });
    // docked: no frame, rows below, sized to the CPI Helper panel's width
    const d = mode === "docked";
    bar.querySelectorAll("button").forEach((x) => {
      x.style.padding = d ? "3px 8px" : "3px 9px";
      x.style.borderRadius = d ? "5px" : "6px";
    });
    if (dia) dia.style.gap = d ? "7px 5px" : "5px";
    const pos = bar.querySelector('[data-a="pos"]'),
      pv = bar.querySelector('[data-a="prev"]'),
      nx = bar.querySelector('[data-a="next"]');
    if (pos && !d) pos.style.cssText = "min-width:60px;text-align:center";
    if (pv) pv.textContent = d ? "<" : "< Prev";
    if (nx) nx.textContent = d ? ">" : "Next >";
    const grip = bar.querySelector('[data-a="grip"]'),
      pop = bar.querySelector('[data-a="pop"]');
    if (grip) grip.style.display = d ? "none" : "";
    if (pop) {
      pop.textContent = d ? "Popup" : "Popin";
      pop.title = d ? "Take the bar out of the CPI Helper panel" : "Put the bar back in the CPI Helper panel";
    }
    // docked rows: nav | Fit Map Full | Move Reset | Panel L B R. Floating: one line, original order.
    bar.querySelectorAll("[data-br]").forEach((x) => {
      x.style.cssText = d ? "flex-basis:100%;height:0" : "display:none";
    });
    if (dia) dia.style.flexBasis = d ? "100%" : "";
    // docked Panel buttons: a D-pad (T on top, L and R beside, B below); floating: one line L T B R
    const dpad = bar.querySelector('[data-g="dpad"]');
    if (dpad) {
      dpad.style.cssText = d ? 'display:grid;grid-template-columns:repeat(3,auto);grid-template-areas:". t ." "l . r" ". b .";gap:3px;margin-left:6px' : "display:flex;gap:5px;align-items:center";
      [
        ["left", "l"],
        ["top", "t"],
        ["bottom", "b"],
        ["right", "r"],
      ].forEach(([k, g]) => {
        const x = dpad.querySelector('[data-a="dock-' + k + '"]');
        if (x) x.style.gridArea = d ? g : "";
      });
    }
    const fb = bar.querySelector('[data-a="full"]'),
      mb = bar.querySelector('[data-a="move"]'),
      rb = bar.querySelector('[data-a="reset"]');
    if (fb && mb && rb) {
      if (d) mb.parentNode.insertBefore(fb, mb.previousSibling);
      else rb.parentNode.insertBefore(fb, rb.nextSibling);
    }
  }
  // Only the CPI Helper plugin copy has a socket in the CPI Helper panel (API.loadedBy is set only there).
  const socket = () => !!API.loadedBy;
  function togglePop() {
    if (!bar) return;
    if (barMode === "docked") {
      // out: bottom centre, remembered like a dragged position
      if (bar.parentNode !== document.body) document.body.appendChild(bar);
      styleBar("floating");
      Object.assign(bar.style, { left: "50%", top: "", bottom: "14px", transform: "translateX(-50%)" });
      const r = bar.getBoundingClientRect();
      ls.set(BARPOS, JSON.stringify({ fx: +(r.left / innerWidth).toFixed(4), fy: +(r.top / innerHeight).toFixed(4) }));
    } else ls.del(BARPOS);
    renderBar();
  }
  function placeBar(p) {
    if (!bar || (gripDrag && !p)) return;
    // no stored-position refresh while the grip is being dragged
    const grip = bar.querySelector('[data-a="grip"]');
    const tip = socket() ? "Drag to move this bar. Popin, a drop on the CPI Helper panel or a double-click here puts it back in the panel" : "Drag to move this bar. Double-click: back to bottom centre";
    if (grip && grip.title !== tip) grip.title = tip;
    p = p || readPos();
    const host = p ? null : hostEl();
    if (host) {
      // re-parent after the panel was rebuilt (the bar was detached with the old content); style first
      styleBar("docked");
      if (bar.parentNode !== host) host.appendChild(bar);
      host.removeAttribute("data-out");
      return;
    }
    if (!p && socket()) {
      bar.style.display = "none";
      return;
    }
    // plugin copy, panel closed: the bar closes with it, like the other CPI Helper plugin panels
    const socketEl = socket() && document.getElementById(HOST_ID);
    if (socketEl) socketEl.setAttribute("data-out", "1");
    // the panel shows its "popped out" hint only now
    styleBar("floating");
    if (bar.parentNode !== document.body) document.body.appendChild(bar);
    if (!p) {
      Object.assign(bar.style, { left: "50%", top: "", bottom: "14px", transform: "translateX(-50%)" });
      return;
    }
    const w = bar.offsetWidth,
      h = bar.offsetHeight;
    if (!w) return;
    // hidden: clamp on the next render
    const x = Math.max(0, Math.min(innerWidth - w, p.fx * innerWidth)),
      y = Math.max(0, Math.min(innerHeight - h, p.fy * innerHeight));
    Object.assign(bar.style, { left: Math.round(x) + "px", top: Math.round(y) + "px", bottom: "auto", transform: "none" });
  }
  // Moving the bar to another parent (out of the panel) drops pointer capture, so while a drag runs
  // it listens on the document in the capture phase, and captures the pointer again after the move.
  function hookGrip(g) {
    const move = (e) => {
      const d = gripDrag;
      if (!d || e.pointerId !== d.id) return;
      e.preventDefault();
      e.stopPropagation();
      if (!d.moved && Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 3) return;
      d.moved = true;
      const wasDocked = bar.parentNode !== document.body;
      placeBar({ fx: (e.clientX - d.ox) / innerWidth, fy: (e.clientY - d.oy) / innerHeight });
      if (wasDocked) {
        try {
          g.setPointerCapture(d.id);
        } catch (err) {
          /* ignore */
        }
      }
    };
    const up = (e) => {
      const d = gripDrag;
      if (!d || e.pointerId !== d.id) return;
      e.stopPropagation();
      gripDrag = null;
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
      if (!d.moved) return;
      if (e.type === "pointerup" && overHost(e.clientX, e.clientY)) {
        ls.del(BARPOS);
        placeBar();
        return;
      }
      // dropped on the CPI Helper panel: dock it again
      const r = bar.getBoundingClientRect();
      ls.set(BARPOS, JSON.stringify({ fx: +(r.left / innerWidth).toFixed(4), fy: +(r.top / innerHeight).toFixed(4) }));
    };
    g.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !e.isPrimary) return;
      e.preventDefault();
      e.stopPropagation();
      const r = bar.getBoundingClientRect();
      gripDrag = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, x: e.clientX, y: e.clientY, moved: false };
      try {
        g.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      document.addEventListener("pointermove", move, true);
      document.addEventListener("pointerup", up, true);
      document.addEventListener("pointercancel", up, true);
    });
    g.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      ls.del(BARPOS);
      placeBar();
    });
  }
  if (window.addEventListener)
    window.addEventListener("resize", () => {
      placeBar();
      fillFights = 0;
      fillPanel();
    });
  // the CPI Helper panel just rendered our host: dock now, before the browser paints the empty panel
  document.addEventListener("cpiPanelMover:host", () => renderBar());
  // (window.addEventListener is absent only in the offline test harness)
  function blocked() {
    const bl = document.getElementById("sap-ui-blocklayer-popup");
    return !!(bl && bl.offsetParent && getComputedStyle(bl).visibility !== "hidden");
  }
  function renderBar() {
    const s = state();
    if (!s || blocked()) {
      if (bar) bar.style.display = "none";
      return;
    }
    const b = ensureBar();
    b.style.display = "flex";
    const pos = b.querySelector('[data-a="pos"]'),
      prev = b.querySelector('[data-a="prev"]'),
      next = b.querySelector('[data-a="next"]');
    if (!s.list) {
      pos.textContent = "open list first";
      prev.disabled = next.disabled = true;
    } else if (s.i < 0) {
      pos.textContent = "not in filter";
      prev.disabled = next.disabled = true;
    } else {
      pos.textContent = s.i + 1 + " / " + s.list.length;
      prev.disabled = s.i === 0;
      next.disabled = s.i === s.list.length - 1;
      const p = s.list[s.i - 1],
        n = s.list[s.i + 1];
      prev.title = p ? "Previous: " + p.d + " (Alt+Shift+Left)" : "";
      next.title = n ? "Next: " + n.d + " (Alt+Shift+Right)" + (SEGMENT[n.t] ? "" : " [opens via list]") : "";
    }
    const link = !s.list || s.i < 0;
    pos.dataset.link = link ? "1" : "";
    if (barMode === "docked") {
      // in the CPI Helper panel: the list hint is a button that opens the list
      if (link) {
        pos.textContent = s.list ? "Not in filter" : "Open list";
        pos.title = "Go to the package list";
        pos.style.cssText = BTN + ";padding:3px 8px;border-radius:5px";
      } else {
        pos.title = "";
        pos.style.cssText = "text-align:center";
      }
    }
    // the list button is redundant while the hint itself opens the list
    b.querySelector('[data-a="list"]').style.display = barMode === "docked" && link ? "none" : "";
    const isIflow = s.u.seg === "integrationflows";
    b.querySelector('[data-g="dia"]').style.display = isIflow ? "flex" : "none";
    const dock = ls.get(DOCK) || defaultDock();
    b.querySelectorAll('[data-a^="dock-"]').forEach((x) => {
      const on = x.getAttribute("data-a") === "dock-" + dock;
      x.style.background = on ? "#0a6ed1" : "#fff";
      x.style.color = on ? "#fff" : "#0a6ed1";
    });
    const fb = b.querySelector('[data-a="full"]'),
      fm = fullMode();
    fb.textContent = fm === "off" ? "Full" : "Full: " + fm;
    fb.title = "Values in the Integration Flow panel (Externalized Parameters and the other tabs): off > wrap (all visible) > line (one line, scroll sideways). Click to cycle.";
    fb.style.background = fm !== "off" ? "#0a6ed1" : "#fff";
    fb.style.color = fm !== "off" ? "#fff" : "#0a6ed1";
    const mb = b.querySelector('[data-a="move"]'),
      rb = b.querySelector('[data-a="reset"]');
    mb.textContent = moveOn && barMode !== "docked" ? "Move: on" : "Move";
    // in the panel the label keeps its width (the fill colour shows on), so Popup stays on its row
    mb.title = moveOn
      ? "Drag boxes now (view only, never saved). Shift+drag = outer pool. Shift+click = select several, then drag one to move them together. Click to stop moving; the layout stays until Reset or reload."
      : "Drag boxes to arrange the view for a screenshot (display mode only, never saved)";
    mb.style.background = moveOn ? "#0a6ed1" : "#fff";
    mb.style.color = moveOn ? "#fff" : "#0a6ed1";
    rb.disabled = !hasMoves();
    [prev, next, rb].forEach((x) => {
      x.style.opacity = x.disabled ? ".4" : "1";
      x.style.cursor = x.disabled ? "default" : "pointer";
    });
    b.querySelector('[data-a="pop"]').style.display = socket() ? "" : "none";
    placeBar();
  }

  // keyboard: only outside text inputs and code editors, no auto-repeat
  document.addEventListener(
    "keydown",
    (e) => {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || (t.closest && t.closest(".ace_editor,.monaco-editor,.CodeMirror")))) return;
      const s = state();
      if (!s || !s.list || s.i < 0) return;
      e.preventDefault();
      go(e.key === "ArrowRight" ? 1 : -1);
    },
    true
  );

  // ---------------- main loop ----------------
  function tick() {
    try {
      if (!ui5Ready()) return;
      const u = parse();
      if (u && !u.name) hookList();
      if (u && u.seg === "integrationflows") {
        applyDock(false);
        guardSideHeights();
        fillFights = 0;
        fillPanel();
        applyAllFull();
        const ed = diagramEditor();
        if ((moveOn || hasMoves()) && ed && !displayMode(ed)) {
          moveOn = false;
          resetMoves();
        } // edit mode (e.g. Edit via keyboard): drop view moves
        if (moveOn) setMoveClass(); // SAP may re-render the editor DOM
      }
      renderBar();
    } catch (e) {
      console.warn("[cpi-helper-us] tick failed", e);
      API.lastError = String(e);
    }
  }
  Object.assign(API, { tick, state, fitAll, toggleMap, setDock, applyDock, applyFull, applyPanelFull, toggleFull, toggleMove, resetMoves });
  // a cheap URL compare once a second (CPI navigates with pushState, which fires no event), plus the full tick every 2 s
  let last = "";
  setInterval(() => {
    if (location.href !== last) {
      last = location.href;
      setTimeout(tick, 600);
      setTimeout(tick, 2500);
    }
  }, 1000);
  setInterval(tick, 2000);
  tick();
  LOG("loaded", API.version);
})();
