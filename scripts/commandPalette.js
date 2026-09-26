// Command palette (Cmd/Ctrl+K or the Search button of the toolbar): one search over the artifacts and packages of the
// tenant, the jump targets and the visit history. The artifact list comes from the design time workspace api
// (one call per package) and is cached per tenant in chrome.storage.local; a stale list is shown at once and refreshed
// in the background. Ranking: common/palette-search.js.

const CPIH_PALETTE_ID = "cpiHelper_palette";
const CPIH_PALETTE_INDEX_TTL = 15 * 60 * 1000;
const CPIH_PALETTE_PARALLEL_REQUESTS = 6;
var cpihPaletteIndexRefresh = null;

function cpihPaletteIndexKey() {
  return "cpiHelper_paletteIndex_" + cpihTenantKey();
}

async function cpihFetchJson(path) {
  const response = await fetch(cpihTenantBase() + path, { headers: { Accept: "application/json" }, credentials: "same-origin" });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json();
}

// { time, packages: [{ id, name }], artifacts: [{ id, name, type, pkg, pkgName }] }; type is the workspace api type
async function cpihFetchPaletteIndex() {
  const workspaces = await cpihFetchJson("/api/1.0/workspace");
  const packages = workspaces.map((workspace) => ({ id: workspace.technicalName, name: workspace.title || workspace.technicalName, workspace: workspace.id }));
  const artifacts = [];
  let failed = 0;
  const queue = [...packages];
  const worker = async () => {
    for (let pkg = queue.shift(); pkg; pkg = queue.shift()) {
      try {
        for (const artifact of await cpihFetchJson(`/api/1.0/workspace/${pkg.workspace}/artifacts/`)) {
          if (CPIH_WORKSPACE_TYPES[artifact.type]) artifacts.push({ id: artifact.tooltip, name: artifact.name, type: artifact.type, pkg: pkg.id, pkgName: pkg.name });
        }
      } catch (error) {
        failed++;
        log.debug(`palette: artifacts of package ${pkg.id} not readable`, error);
      }
    }
  };
  await Promise.all(Array.from({ length: CPIH_PALETTE_PARALLEL_REQUESTS }, worker));
  if (failed > 0 && failed === packages.length) throw new Error("no package could be read");
  return { time: Date.now(), packages: packages.map(({ id, name }) => ({ id, name })), artifacts };
}

async function cpihReadPaletteIndex() {
  try {
    return (await chrome.storage.local.get([cpihPaletteIndexKey()]))[cpihPaletteIndexKey()] || null;
  } catch (error) {
    log.debug("palette index not readable", error);
    return null;
  }
}

// one refresh at a time, also when the palette is opened again while it runs
function cpihRefreshPaletteIndex() {
  if (!cpihPaletteIndexRefresh) {
    cpihPaletteIndexRefresh = cpihFetchPaletteIndex()
      .then(async (index) => {
        try {
          await chrome.storage.local.set({ [cpihPaletteIndexKey()]: index });
        } catch (error) {
          log.debug("palette index not stored", error);
        }
        return index;
      })
      .finally(() => {
        cpihPaletteIndexRefresh = null;
      });
  }
  return cpihPaletteIndexRefresh;
}

// the Deploy button of the CPI editor has no stable id, it is found by its title (English and German UI)
const CPIH_DEPLOY_TITLES = ["deploy", "bereitstellen"];

function cpihFindDeployButton() {
  return [...document.querySelectorAll("button")].find(
    (button) => button.offsetParent && !button.disabled && button.getAttribute("aria-disabled") !== "true" && CPIH_DEPLOY_TITLES.includes(String(button.title || button.textContent).trim().toLowerCase())
  );
}

// UI5 buttons fire press on its own tap handling, a plain click() is not enough
function cpihPressUi5Button(button) {
  if (!button) return;
  const options = { bubbles: true, cancelable: true, button: 0, pointerId: 1, isPrimary: true, pointerType: "mouse" };
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
    button.dispatchEvent(type.startsWith("pointer") ? new PointerEvent(type, options) : new MouseEvent(type, options));
  }
}

// the toolbar buttons of the page as palette actions: trace, messages, info, logs, plugins, ... plus deploy wherever
// the CPI shows a Deploy button. Deploy presses that button, so its confirmation dialog still asks first
function cpihPageActions() {
  const toolbar = getFloatingToolbar();
  if (!toolbar) return [];
  const actions = [];
  const traceButton = document.getElementById("__buttonxx");
  const traceActive = traceButton?.classList.contains("cpiHelper_floatingToolbar_button_active");
  const deployButton = cpihFindDeployButton();

  if (traceButton) {
    actions.push({ key: "trace", label: traceActive ? "Stop trace" : "Start trace", keywords: "trace on off activate deactivate enable disable log level", icon: "trace", run: () => traceButton.click() });
  }
  if (deployButton) {
    actions.push({ key: "deploy", label: "Deploy", keywords: "bereitstellen", icon: "deploy", run: () => cpihPressUi5Button(cpihFindDeployButton()) });
    if (traceButton && !traceActive) {
      actions.push({
        key: "tracedeploy",
        label: "Start trace and deploy",
        keywords: "trace on deploy bereitstellen",
        icon: "deploy",
        run: async () => {
          traceButton.click();
          // the trace button sets the log level asynchronously, the deploy dialog of the CPI comes after it
          await new Promise((resolve) => setTimeout(resolve, 300));
          cpihPressUi5Button(cpihFindDeployButton());
        },
      });
    }
  }
  const messagesButton = document.getElementById("__buttonxy");
  if (messagesButton) {
    actions.push({ key: "sidebar", label: sidebar.active ? "Close message sidebar" : "Open message sidebar", keywords: sidebar.active ? "hide messages" : "show messages", icon: "messages", run: () => messagesButton.click() });
  }
  // every other plain button of the toolbar, with its own label; menus and panels need the toolbar to open
  const skip = new Set(["__buttonxx", "__buttonxy", "__cpih_search"]);
  for (const button of toolbar.querySelectorAll(":scope > .cpiHelper_floatingToolbar_button:not(.cpiHelper_floatingToolbar_toggle):not([aria-haspopup])")) {
    if (skip.has(button.id)) continue;
    const icon = button.querySelector(".cpiHelper_floatingToolbar_buttonIcon");
    actions.push({ key: button.id, label: button.getAttribute("aria-label") || button.textContent.trim(), iconHtml: icon?.innerHTML, run: () => button.click() });
  }
  return actions;
}

// what the palette searches: actions of the artifact page, history (with boost), then the open artifact, jump targets, artifacts and packages
function cpihBuildPaletteItems(index, history) {
  const base = cpihTenantBase();
  const items = new Map();
  const add = (key, item) => {
    if (!items.has(key)) items.set(key, item);
  };

  const view = cpihBuildHistoryView(history, null);
  const historyBoost = new Map();
  view.favorites.forEach((entry) => historyBoost.set(`${entry.type}|${entry.name}`, { boost: 40, favorit: true }));
  view.recent.forEach((entry, position) => historyBoost.set(`${entry.type}|${entry.name}`, { boost: 30 - position }));

  for (const action of cpihPageActions()) {
    add("action|" + action.key, { label: action.label, keywords: action.keywords, detail: cpiData.currentArtifactId ? cpihArtifactLabel() : "", icon: action.icon, iconHtml: action.iconHtml, run: action.run, kind: "Action", boost: 50 });
  }

  const context = cpihCurrentArtifactContext();
  if (context) {
    for (const target of cpihArtifactJumpTargets(context)) {
      add("context|" + target.path, { label: `${target.area} - ${target.label}`, detail: cpihArtifactLabel(), icon: target.icon, href: base + target.path, kind: "Current artifact", boost: 45 });
    }
  }
  for (const entry of [...view.favorites, ...view.recent]) {
    const key = `${entry.type}|${entry.name}`;
    add(key, { label: entry.label, id: entry.name, sub: entry.type, icon: CPIH_RECENT_TYPE_ICONS[entry.type] || "jump", href: entry.url, kind: entry.favorit ? "Favorite" : "Recent", ...historyBoost.get(key) });
  }
  for (const target of CPIH_JUMP_TARGETS) {
    add("jump|" + target.path, { label: `${target.area} - ${target.label}`, sub: "Go to", icon: target.icon, href: base + target.path, kind: "Go to" });
  }
  for (const artifact of index?.artifacts || []) {
    const type = CPIH_WORKSPACE_TYPES[artifact.type].type;
    const path = cpihArtifactPath(artifact.pkg, artifact.type, artifact.id);
    if (!path) continue;
    add(`${type}|${artifact.id}`, { label: artifact.name || artifact.id, id: artifact.id, sub: artifact.pkgName, icon: CPIH_RECENT_TYPE_ICONS[type] || "jump", href: base + path, kind: type, hideWithoutQuery: true });
  }
  for (const pkg of index?.packages || []) {
    add(`Package|${pkg.id}`, { label: pkg.name, id: pkg.id, sub: "Package", icon: "package", href: base + cpihPackagePath(pkg.id), kind: "Package", hideWithoutQuery: true });
  }
  return [...items.values()];
}

function cpihPaletteShortcutLabel() {
  return cpihIsMac() ? "⌘K" : "Ctrl+K";
}

function closeCommandPalette() {
  const palette = document.getElementById(CPIH_PALETTE_ID);
  if (!palette) return;
  palette._cpiHelperCleanup?.();
  palette.remove();
}

async function openCommandPalette() {
  if (document.getElementById(CPIH_PALETTE_ID)) return;
  statistic("command_palette_open");
  const previousFocus = document.activeElement;

  const overlay = document.createElement("div");
  overlay.id = CPIH_PALETTE_ID;
  overlay.innerHTML = `
    <div class="cpiHelper_palette_card" role="dialog" aria-modal="true" aria-label="Search the tenant">
      <div class="cpiHelper_palette_inputRow">
        <span class="cpiHelper_palette_searchIcon">${floatingToolbarIcon("search")}</span>
        <input class="cpiHelper_palette_input" type="text" role="combobox" aria-expanded="true" aria-controls="cpiHelper_palette_list" aria-autocomplete="list"
          placeholder="Search artifacts, packages and pages" spellcheck="false" autocomplete="off" />
        <kbd class="cpiHelper_palette_kbd">Esc</kbd>
      </div>
      <ul class="cpiHelper_palette_list" id="cpiHelper_palette_list" role="listbox" aria-label="Results"></ul>
      <div class="cpiHelper_palette_footer">
        <span class="cpiHelper_palette_status" aria-live="polite"></span>
        <span class="cpiHelper_palette_keys"><kbd>↑</kbd><kbd>↓</kbd> select <kbd>Enter</kbd> open <kbd>${cpihIsMac() ? "⌘" : "Ctrl"}+Enter</kbd> new tab</span>
        <button type="button" class="cpiHelper_palette_reload">Reload list</button>
      </div>
    </div>`;
  document.body.append(overlay);

  const input = overlay.querySelector(".cpiHelper_palette_input");
  const list = overlay.querySelector(".cpiHelper_palette_list");
  const status = overlay.querySelector(".cpiHelper_palette_status");
  const reload = overlay.querySelector(".cpiHelper_palette_reload");
  let items = [];
  let results = [];
  let selected = 0;
  let index = await cpihReadPaletteIndex();
  let history = [];
  try {
    history = (await chrome.storage.sync.get([cpihHistoryStorageKey()]))[cpihHistoryStorageKey()];
  } catch (error) {
    log.debug("history not readable", error);
  }

  const open = (item, newTab) => {
    if (!item) return;
    statistic("command_palette_pick", item.kind);
    closeCommandPalette();
    if (item.run) {
      Promise.resolve(item.run()).catch((error) => log.error(`palette action ${item.label} failed`, error));
    } else if (newTab) {
      window.open(item.href, "_blank");
    } else {
      cpihNavigate(item.href);
    }
  };

  const select = (position) => {
    if (results.length === 0) return;
    selected = (position + results.length) % results.length;
    list.querySelectorAll(".cpiHelper_palette_item").forEach((row, i) => {
      row.setAttribute("aria-selected", String(i === selected));
      if (i === selected) {
        input.setAttribute("aria-activedescendant", row.id);
        row.scrollIntoView({ block: "nearest" });
      }
    });
  };

  const render = () => {
    results = cpihPaletteSearch(items, input.value, 50);
    selected = 0;
    list.replaceChildren(
      ...results.map((item, i) => {
        const row = document.createElement("li");
        row.id = "cpiHelper_palette_item_" + i;
        row.className = "cpiHelper_palette_item";
        row.setAttribute("role", "option");
        // actions are buttons, pages real links (middle click, copy link)
        const link = document.createElement(item.href ? "a" : "button");
        if (item.href) {
          link.href = item.href;
        } else {
          link.type = "button";
        }
        link.tabIndex = -1;
        link.innerHTML = `<span class="cpiHelper_palette_itemIcon">${item.iconHtml || floatingToolbarIcon(item.icon)}</span>`;
        const text = document.createElement("span");
        text.className = "cpiHelper_palette_itemText";
        const label = document.createElement("span");
        label.className = "cpiHelper_palette_itemLabel";
        label.textContent = item.label;
        const sub = document.createElement("span");
        sub.className = "cpiHelper_palette_itemSub";
        // detail is shown but not searched, e.g. the artifact name under its actions
        sub.textContent = item.detail ?? (item.sub && item.sub !== item.kind ? item.sub : item.id && item.id !== item.label ? item.id : "");
        text.append(label, sub);
        const kind = document.createElement("span");
        kind.className = "cpiHelper_palette_itemKind";
        kind.textContent = item.kind || "";
        link.append(text, kind);
        link.addEventListener("click", (event) => {
          if (item.href && (event.metaKey || event.ctrlKey || event.shiftKey || event.button > 0)) {
            closeCommandPalette();
            return;
          }
          event.preventDefault();
          open(item, false);
        });
        row.addEventListener("pointermove", () => {
          if (selected !== i) select(i);
        });
        row.append(link);
        return row;
      })
    );
    if (results.length === 0) {
      const empty = document.createElement("li");
      empty.className = "cpiHelper_palette_empty";
      empty.textContent = index || !input.value ? "Nothing found." : "Nothing found yet, the artifact list is still loading.";
      list.append(empty);
      input.removeAttribute("aria-activedescendant");
    } else {
      select(0);
    }
  };

  const updateStatus = (text) => {
    if (text) {
      status.textContent = text;
    } else if (index) {
      const minutes = Math.round((Date.now() - index.time) / 60000);
      status.textContent = `${index.artifacts.length} artifacts in ${index.packages.length} packages · ${minutes < 1 ? "just loaded" : `loaded ${minutes} min ago`}`;
    } else {
      status.textContent = "";
    }
  };

  const refresh = () => {
    updateStatus("Loading artifacts of the tenant…");
    reload.disabled = true;
    cpihRefreshPaletteIndex()
      .then((fresh) => {
        index = fresh;
        items = cpihBuildPaletteItems(index, history);
        if (document.getElementById(CPIH_PALETTE_ID) === overlay) render();
        updateStatus();
      })
      .catch((error) => {
        log.error("palette: artifact list not loaded", error);
        updateStatus(index ? "Reload failed, showing the last list" : "The artifact list could not be loaded, pages and history still work");
      })
      .finally(() => {
        reload.disabled = false;
      });
  };

  items = cpihBuildPaletteItems(index, history);
  render();
  updateStatus();
  if (!index || Date.now() - index.time > CPIH_PALETTE_INDEX_TTL) refresh();

  input.addEventListener("input", render);
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      select(selected + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      open(results[selected], (event.metaKey || event.ctrlKey) && !!results[selected]?.href);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeCommandPalette();
    }
  });
  reload.addEventListener("click", refresh);
  overlay.addEventListener("pointerdown", (event) => {
    if (event.target === overlay) closeCommandPalette();
  });
  // UI5 listens for keys on the document, the palette keeps its keys to itself
  const stopKeys = (event) => event.stopPropagation();
  overlay.addEventListener("keydown", stopKeys);
  overlay.addEventListener("keyup", stopKeys);
  overlay._cpiHelperCleanup = () => {
    if (previousFocus?.isConnected) previousFocus.focus?.();
  };
  input.focus();
}

function toggleCommandPalette() {
  if (document.getElementById(CPIH_PALETTE_ID)) {
    closeCommandPalette();
  } else {
    openCommandPalette().catch((error) => log.error("command palette failed", error));
  }
}

function addPaletteToolbarButton(toolbar) {
  const button = addFloatingToolbarButton(toolbar, {
    id: "__cpih_search",
    icon: "search",
    title: "Search",
    onClick: () => toggleCommandPalette(),
  });
  button.dataset.cpiHint = `Search (${cpihPaletteShortcutLabel()})`;
  button.setAttribute("aria-keyshortcuts", "Control+K Meta+K");
  return button;
}

// Cmd/Ctrl+K on every CPI page. The code editors keep the key (ace uses Ctrl+K for find next)
document.addEventListener(
  "keydown",
  (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key?.toLowerCase() !== "k") return;
    if (event.target?.closest?.(".ace_editor") && !document.getElementById(CPIH_PALETTE_ID)) return;
    if (!extensionAlive()) return;
    event.preventDefault();
    event.stopPropagation();
    toggleCommandPalette();
  },
  true
);
