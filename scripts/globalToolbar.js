// Global part of the floating toolbar: navigation that works on every CPI page, also without an open artifact.
// Jump to (fixed targets of common/jump-targets.js and the open artifact), Recent (visit history with favorites)
// and the failed messages badge. The command palette lives in scripts/commandPalette.js.

// "" on Integration Suite hosts, "/itspaces" on classic Neo tenants
function cpihTenantBase() {
  return location.pathname.startsWith("/itspaces") ? "/itspaces" : "";
}

function cpihIsMac() {
  return /mac/i.test(navigator.userAgentData?.platform || navigator.platform || "");
}

// same key as the history in the browser popup
function cpihTenantKey() {
  return location.host.split(".")[0];
}

function cpihHistoryStorageKey() {
  return "visitedIflows_" + cpihTenantKey();
}

// an artifact editor in edit mode shows Save instead of Edit (English and German UI). Leaving it through the
// router drops the changes without asking and leaves the CPI with a busy indicator that never ends
const CPIH_SAVE_TITLES = ["save", "speichern"];
const CPIH_EDIT_TITLES = ["edit", "bearbeiten"];

function cpihEditorInEditMode() {
  if (!cpiData.currentArtifactId || cpiData.currentArtifactType === "Package") return false;
  const visibleTitles = [...document.querySelectorAll("button")].filter((button) => button.offsetParent).map((button) => String(button.title || button.textContent).trim().toLowerCase());
  return visibleTitles.some((title) => CPIH_SAVE_TITLES.includes(title)) && !visibleTitles.some((title) => CPIH_EDIT_TITLES.includes(title));
}

// "design", "monitoring", ... of /shell/<area>/..., also below /itspaces
function cpihShellArea(pathname) {
  return pathname.match(/^(?:\/itspaces)?\/shell\/([^/?]+)/)?.[1] || "";
}

// navigates inside the CPI app without a page reload: the UI5 router follows pushState plus popstate. That only
// works inside one area: the shell keeps an app it loaded once and ignores popstate into it from another area
// (design -> monitoring after monitoring was open before), so a change of the area loads the page.
// A click with a modifier or the middle button is left to the browser, so the link opens in a new tab.
// In edit mode nothing happens in this tab, the changes have to be saved or cancelled first
function cpihNavigate(url, event) {
  if (event && (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return false;
  event?.preventDefault();
  if (cpihEditorInEditMode()) {
    showToast(`Save or cancel your changes first. ${cpihIsMac() ? "⌘" : "Ctrl"}+click opens the page in a new tab.`, "You are editing", "warning");
    return false;
  }
  const target = new URL(url, location.href);
  if (target.origin !== location.origin || cpihShellArea(target.pathname) !== cpihShellArea(location.pathname)) {
    location.href = target.href;
    return true;
  }
  if (target.href !== location.href) {
    history.pushState({}, "", target.pathname + target.search + target.hash);
    dispatchEvent(new PopStateEvent("popstate", { state: {} }));
    // updates cpiData right away, the heartbeat then rebuilds the toolbar for the new page
    checkURLchange().catch((error) => log.error("checkURLchange after navigation failed", error));
  }
  return true;
}

// context of the artifact that is open, empty on pages without one and on the package page itself
function cpihCurrentArtifactContext() {
  if (!cpiData.currentArtifactId || cpiData.currentArtifactType === "Package") return null;
  return {
    artifactId: cpiData.currentArtifactId,
    artifactType: cpiData.currentArtifactType,
    packageId: cpiData.currentPackageId,
    runtimeLocationId: cpiData.runtimeLocationId,
  };
}

function cpihArtifactLabel() {
  const name = cpiData.currentIflowName;
  return name && name !== "undefined" ? name : cpiData.currentArtifactId;
}

/////////////////////////////////////////////////////////////// jump to

function addJumpToolbarButton(toolbar) {
  const button = addFloatingToolbarMenuButton(toolbar, {
    id: "__cpih_jump",
    icon: "jump",
    title: "Jump to",
    getItems: () => {
      statistic("toolbar_btn_jump_click");
      const base = cpihTenantBase();
      const link = (target) => ({
        label: target.label,
        icon: target.icon,
        href: base + target.path,
        detail: target.path === CPIH_FAILED_MESSAGES_PATH && cpihFailedMessages.count > 0 ? String(cpihFailedMessages.count) : undefined,
        onClick: (event) => cpihNavigate(base + target.path, event),
      });
      const items = [];
      const context = cpihCurrentArtifactContext();
      const contextTargets = context ? cpihArtifactJumpTargets(context) : [];
      if (contextTargets.length > 0) {
        items.push({ header: cpihArtifactLabel() }, ...contextTargets.map(link));
      }
      // tenant targets grouped by the area of the CPI, in the order of the shared list
      const toolbarTargets = CPIH_JUMP_TARGETS.filter((target) => target.toolbar);
      for (const area of [...new Set(toolbarTargets.map((target) => target.area))]) {
        items.push({ header: area }, ...toolbarTargets.filter((target) => target.area === area).map(link));
      }
      return items;
    },
  });
  applyFailedMessagesBadge();
  return button;
}

/////////////////////////////////////////////////////// failed messages badge

// failed messages of the past hour, tenant wide, on the Jump to button. Checked every 5 minutes while the tab is visible
const CPIH_FAILED_REFRESH_INTERVAL = 5 * 60 * 1000;
var cpihFailedMessages = { count: null, time: 0, loading: false };

async function refreshFailedMessagesBadge(force = false) {
  if (cpihFailedMessages.loading || (!force && (document.hidden || Date.now() - cpihFailedMessages.time < CPIH_FAILED_REFRESH_INTERVAL))) return;
  cpihFailedMessages.loading = true;
  try {
    const enabled = (await chrome.storage.sync.get(["failedMessagesBadge"])).failedMessagesBadge ?? true;
    cpihFailedMessages.count = enabled ? await fetchFailedMessagesCount() : null;
  } catch (error) {
    log.debug("failed messages count not available", error);
    cpihFailedMessages.count = null;
  } finally {
    cpihFailedMessages.time = Date.now();
    cpihFailedMessages.loading = false;
  }
  applyFailedMessagesBadge();
}

async function fetchFailedMessagesCount() {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 19);
  const filter = encodeURIComponent(`Status eq 'FAILED' and LogEnd gt datetime'${since}'`);
  const response = await fetch(`${cpihTenantBase()}/odata/api/v1/MessageProcessingLogs/$count?$filter=${filter}`, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`status ${response.status}`);
  const count = parseInt(await response.text(), 10);
  return Number.isFinite(count) ? count : null;
}

function applyFailedMessagesBadge() {
  const button = document.getElementById("__cpih_jump");
  if (!button) return;
  const count = cpihFailedMessages.count || 0;
  setFloatingToolbarBadge(button, count, true);
  const hint = count > 0 ? `Jump to (${count} failed message${count === 1 ? "" : "s"} in the past hour)` : "Jump to";
  button.dataset.cpiHint = hint;
  button.setAttribute("aria-label", hint);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.failedMessagesBadge) refreshFailedMessagesBadge(true);
});

//////////////////////////////////////////////////////////////// recent

const CPIH_RECENT_TYPE_ICONS = {
  IFlow: "trace",
  Package: "package",
  "Value Mapping": "variable",
  "Script Collection": "logs",
  Script: "logs",
  "Message Mapping": "layers",
  M_Mapping: "layers",
  "Operation Mapping": "layers",
  XSLT: "layers",
  "ODATA API": "plug",
  "REST API": "plug",
  "SOAP API": "plug",
  API: "plug",
  "MCP Server": "plug",
};

function addRecentToolbarButton(toolbar) {
  const key = cpihHistoryStorageKey();
  let container = null;
  const onChange = (changes, area) => {
    if (area === "sync" && changes[key] && container?.isConnected) renderRecentList(container, changes[key].newValue);
  };
  chrome.storage.onChanged.addListener(onChange);
  onFloatingToolbarRemoved(toolbar, () => chrome.storage.onChanged.removeListener(onChange));

  return addFloatingToolbarPanelButton(toolbar, {
    id: "__cpih_recent",
    icon: "history",
    title: "Recent",
    render: async () => {
      statistic("toolbar_btn_recent_click");
      container = document.createElement("div");
      container.className = "cpiHelper_recent";
      let entries = [];
      try {
        entries = (await chrome.storage.sync.get([key]))[key];
      } catch (error) {
        log.debug("history not readable", error);
      }
      renderRecentList(container, entries);
      return container;
    },
  });
}

function renderRecentList(container, entries) {
  const current = cpiData.currentArtifactId ? { name: cpiData.currentArtifactId, type: cpiData.currentArtifactType } : null;
  const view = cpihBuildHistoryView(entries, current);
  container.replaceChildren();
  if (view.favorites.length === 0 && view.recent.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cpiHelper_recent_empty";
    empty.textContent = "Open an iFlow or a package, it will show up here.";
    container.append(empty);
    return;
  }
  for (const [title, items] of [
    ["Favorites", view.favorites],
    ["Recent", view.recent],
  ]) {
    if (items.length === 0) continue;
    // without favorites the panel title "Recent" is heading enough
    if (view.favorites.length > 0) {
      const heading = document.createElement("div");
      heading.className = "cpiHelper_recent_heading";
      heading.textContent = title;
      container.append(heading);
    }
    const list = document.createElement("ul");
    list.className = "cpiHelper_recent_list";
    list.append(...items.map(createRecentRow));
    container.append(list);
  }
}

function createRecentRow(item) {
  const row = document.createElement("li");
  const link = document.createElement("a");
  link.className = "cpiHelper_recent_item";
  link.href = item.url;
  link.title = item.label === String(item.name) ? item.label : `${item.label} (${item.name})`;
  if (item.current) {
    link.classList.add("cpiHelper_recent_current");
    link.setAttribute("aria-current", "page");
  }
  link.addEventListener("click", (event) => {
    if (cpihNavigate(item.url, event)) closeFloatingToolbarMenu(getFloatingToolbar());
  });

  const icon = document.createElement("span");
  icon.className = "cpiHelper_recent_icon";
  icon.innerHTML = floatingToolbarIcon(CPIH_RECENT_TYPE_ICONS[item.type] || "jump");
  const text = document.createElement("span");
  text.className = "cpiHelper_recent_text";
  const name = document.createElement("span");
  name.className = "cpiHelper_recent_name";
  name.textContent = item.label;
  const type = document.createElement("span");
  type.className = "cpiHelper_recent_type";
  type.textContent = item.type || "";
  text.append(name, type);

  // not a <button>: the panel styles every button of plugin content as a big one
  const star = document.createElement("span");
  star.className = "cpiHelper_recent_star";
  star.setAttribute("role", "button");
  star.tabIndex = 0;
  star.setAttribute("aria-pressed", String(!!item.favorit));
  star.setAttribute("aria-label", item.favorit ? "Remove from favorites" : "Add to favorites");
  star.title = item.favorit ? "Remove from favorites" : "Add to favorites";
  star.innerHTML = floatingToolbarIcon(item.favorit ? "starFilled" : "star");
  const toggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleRecentFavorite(item);
  };
  star.addEventListener("click", toggle);
  star.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") toggle(event);
  });

  link.append(icon, text, star);
  row.append(link);
  return row;
}

async function toggleRecentFavorite(item) {
  const key = cpihHistoryStorageKey();
  try {
    const result = cpihToggleFavorite((await chrome.storage.sync.get([key]))[key], item);
    if (!result.ok) {
      showToast(result.error, "Favorites", "warning");
      return;
    }
    statistic("toolbar_recent_favorite", result.entries.find((entry) => entry.name === item.name && entry.type === item.type)?.favorit ? "on" : "off");
    // the storage listener of the panel renders the new list
    await chrome.storage.sync.set({ [key]: result.entries });
  } catch (error) {
    log.error("favorite could not be saved", error);
    showToast(String(error?.message || error), "Favorite not saved", "error");
  }
}

// the navigation group of the toolbar, on every page
function addGlobalNavigationButtons(toolbar) {
  addPaletteToolbarButton(toolbar);
  addJumpToolbarButton(toolbar);
  addRecentToolbarButton(toolbar);
}
