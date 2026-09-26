//GNU GPL v3
//Please visit our github page: https://github.com/dbeck121/CPI-Helper-Chrome-Extension

"use strict";

var host = ""; // "https://<tenant>.../itspaces" - empty when the active tab is not a CPI tab
var tenant = ""; // short tenant name, used for the visited artifacts storage key
var activeTabId = null;
var contentScriptAlive = false;

const ARTIFACT_TYPES = ["Package", "IFlow", "Message Mapping", "Script Collection", "Value Mapping", "SOAP API", "REST API", "ODATA API", "API"];
const CPI_HOST_REGEXP = /^https:\/\/[^/]+\.(hana\.ondemand\.com|platform\.sapcloud\.cn)\//i;
const DEFAULT_ZOOM = 85;

// Tab favicon variants, keyed by the file name under images/favicons.
const TAB_ICONS = { default: "Default", 1: "Blue", 2: "Green", 3: "Red", 4: "Purple", 5: "Yellow", 6: "Orange" };

const LOG_MODES = { warn: "Warning", info: "Info", log: "Log" };
const LOG_MODE_ICONS = { warn: "alert", info: "info", log: "terminal" };

// Keys match the data-tab values of the popup tab bar.
const START_TABS = { one: "Last Visited (Default)", two: "Links", three: "Settings", four: "Info" };
const START_TAB_ICONS = { one: "history", two: "link", three: "cog", four: "info" };

const PRESET_COLORS = {
  blue: "#2185d0",
  green: "#21ba45",
  purple: "#a333c8",
  red: "#db2828",
  yellow: "#fbbd08",
  orange: "#f2711c",
  grey: "#767676",
};

// Icon name -> fomantic icon classes. The glyph of every class used here is copied into popup.css,
// a new icon needs its rule from lib/semanticui/semantic.min.css there as well.
const ICONS = {
  bolt: "bolt",
  activity: "heartbeat",
  sliders: "sliders horizontal",
  partners: "handshake",
  book: "book",
  external: "external alternate",
  link: "linkify",
  info: "info circle",
  server: "server",
  cog: "cog",
  history: "history",
  archive: "archive",
  package: "box",
  iflow: "project diagram",
  mapping: "exchange alternate",
  script: "code",
  table: "table",
  envelope: "envelope",
  rest: "cloud",
  database: "database",
  alert: "exclamation triangle",
  donut: "chart pie",
  layers: "layer group",
  shield: "shield alternate",
  shieldCheck: "user shield",
  key: "key",
  lock: "lock",
  fileLock: "unlock",
  plug: "plug",
  variable: "square root alternate",
  queue: "stream",
  hash: "hashtag",
  addressBook: "address book",
  userCheck: "user check",
  barChart: "chart bar",
  lineChart: "chart area",
  fileText: "file alternate",
  fileCheck: "file signature",
  fileStack: "copy",
  flask: "flask",
  building: "building",
  shuffle: "random",
  sitemap: "sitemap",
  helpCircle: "question circle",
  terminal: "terminal",
  newspaper: "newspaper",
  list: "list",
};

const ARTIFACT_ICONS = {
  Package: "package",
  IFlow: "iflow",
  "Message Mapping": "mapping",
  "Script Collection": "script",
  "Value Mapping": "table",
  "SOAP API": "envelope",
  "REST API": "rest",
  "ODATA API": "database",
  API: "plug",
};

// <details> dropdowns - a <select> cannot render an image or an icon per option.
function dropdown(id, options, renderOption) {
  const items = Object.entries(options)
    .map(([value, label]) => `<button type="button" class="dd-option" data-value="${value}" aria-pressed="false">${renderOption(value, label)}</button>`)
    .join("");
  return `<details class="dd" id="${id}"><summary></summary><div class="dd-menu">${items}</div></details>`;
}

// Renders the current value into the summary, marks the picked option and reports every pick.
function wireDropdown(id, options, renderOption, current, onPick) {
  const root = qs(`#${id}`);
  const optionButtons = qsa(`#${id} .dd-option`);
  const show = (value) => {
    const picked = value in options ? value : Object.keys(options)[0];
    root.querySelector("summary").innerHTML = renderOption(picked, options[picked]);
    optionButtons.forEach((option) => option.setAttribute("aria-pressed", String(option.dataset.value === picked)));
    return picked;
  };

  show(current);
  optionButtons.forEach((option) =>
    option.addEventListener("click", () => {
      root.open = false;
      onPick(show(option.dataset.value));
    })
  );

  // <details> stays open on outside clicks - close it like a real dropdown would
  document.addEventListener("click", (event) => {
    if (root.open && !root.contains(event.target)) root.open = false;
  });
}

function tabIconOption(value, label) {
  return `<img src="/images/favicons/${value}.png" alt="" width="16" height="16"/><span>${label}</span>`;
}

function logModeOption(value, label) {
  return `${icon(LOG_MODE_ICONS[value])}<span>${label}</span>`;
}

function startTabOption(value, label) {
  return `${icon(START_TAB_ICONS[value])}<span>${label}</span>`;
}

function icon(name) {
  return ICONS[name] ? `<i class="${ICONS[name]} icon" aria-hidden="true"></i>` : "";
}

function groupTitle(name, label, { html = false } = {}) {
  return `<h2 class="group-title">${icon(name)}${html ? label : esc(label)}</h2>`;
}

// The popup reloads on every click on the browser action, so everything that happens before the
// first paint is paid every single time. The zoom level is applied through a stylesheet instead of
// touching document.body later, which would relayout the whole popup after it is already visible.
(function applyStoredZoom() {
  const stored = parseInt(localStorage.getItem("zoomlevel"), 10);
  const style = document.createElement("style");
  style.id = "cpiHelper_zoom";
  style.textContent = zoomCss(isNaN(stored) ? DEFAULT_ZOOM : clamp(stored, 60, 120));
  document.head.appendChild(style);
})();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// A browser action popup is capped at 600 physical pixels, so the scroll area has to shrink when the
// user zooms in - otherwise the popup grows a second, outer scrollbar.
function zoomCss(zoom) {
  return `body{zoom:${zoom}%}main{max-height:${Math.floor(58000 / zoom) - 50}px}`;
}

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

////////////////////////////////////////////////////////////////////// chrome

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs && tabs[0] ? tabs[0] : null));
  });
}

// The content script is the only source for the tenant settings. It is not injected on every page,
// so a missing answer is expected and must not end up as an unchecked runtime error.
function askContentScript(tabId, message) {
  return new Promise((resolve) => {
    if (tabId == null) return resolve(null);
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        void chrome.runtime.lastError;
        resolve(response || null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

function saveHostData(hostData) {
  askContentScript(activeTabId, { save: hostData });
}

async function statistic(event, value = null, value2 = null) {
  return null;
}

//////////////////////////////////////////////////////////////////////// tabs

function activateTab(name) {
  qsa(".tab-btn").forEach((button) => button.classList.toggle("active", button.dataset.tab === name));
  qsa(".panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.tab === name));
}

function initTabs() {
  qsa(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
    // hover switches tabs like the popup always did, read on every hover so the setting applies without reopening
    button.addEventListener("mouseenter", () => {
      if (localStorage.getItem("cpi_tab_click_mode") !== "true") activateTab(button.dataset.tab);
    });
  });
  const stored = localStorage.getItem("tab-choice-select") || "one";
  activateTab(qs(`.tab-btn[data-tab="${stored}"]`) ? stored : "one");
}

function setVersion() {
  qsa(".cpihelper_version").forEach((e) => (e.textContent = "v" + chrome.runtime.getManifest().version));
}

/////////////////////////////////////////////////////////////////////// theme

function applyTheme(isLightTheme) {
  document.documentElement.classList.toggle("ch_dark", !isLightTheme);
  document.documentElement.classList.toggle("ch_light", !!isLightTheme);
}

// The header takes the tenant color, so the label on top of it has to follow the color and not the
// theme - a yellow tenant with white text was unreadable before.
function applyAccentColor(hex) {
  const root = document.documentElement;
  root.style.setProperty("--cpi-custom-color", hex);
  const lightness = parseInt(hexToHsl(hex, true).split(" ")[2], 10);
  root.style.setProperty("--cpi-text-color", lightness > 62 ? "#1b1f25" : "#ffffff");
}

/////////////////////////////////////////////////////// tab 1 - last visited

function renderLastVisited(visitedIflows, compact) {
  const container = qs("#lastVisitedIflows");

  if (!tenant) {
    container.innerHTML = `<div class="notice">Please visit a SAP Cloud Integration page to see last visited artifacts.</div>`;
    return;
  }
  if (!visitedIflows || visitedIflows.length === 0) {
    container.innerHTML = `<div class="empty">No artifacts visited on tenant <b>${esc(tenant)}</b> yet.</div>`;
    return;
  }

  // last element of the list is the most recently visited one
  const grouped = {};
  for (let i = visitedIflows.length - 1; i > -1; i--) {
    const item = visitedIflows[i];
    const key = item.type || "noheader";
    (grouped[key] = grouped[key] || []).push(item);
  }

  let html = groupTitle("history", `Last visited &middot; ${esc(tenant)}`, { html: true });
  ARTIFACT_TYPES.forEach((type) => {
    if (grouped[type]) html += renderArtifactGroup(type, grouped[type], compact, ARTIFACT_ICONS[type]);
  });
  if (grouped["noheader"]) html += renderArtifactGroup("CPI Helper old version items", grouped["noheader"], compact, "archive");

  container.innerHTML = html;
}

function renderArtifactGroup(title, items, compact, iconName) {
  const entries = items
    .map((item) => {
      const url = String(item.url).replace("?section=ARTIFACTS?section=ARTIFACTS", "?section=ARTIFACTS");
      const fullName = item.fullName && item.fullName !== "undefined" ? item.fullName : item.name;
      if (compact) {
        return `<a class="card chip" target="_blank" rel="noreferrer" href="${esc(url)}" title="${esc(fullName)}">${esc(fullName)}</a>`;
      }
      const sub = fullName !== item.name ? `<span class="sub">${esc(item.name)}</span>` : "";
      return `<a class="card row" target="_blank" rel="noreferrer" href="${esc(url)}" title="${esc(fullName)}"><span class="name">${esc(fullName)}</span>${sub}</a>`;
    })
    .join("");

  return `<div class="section">
      ${groupTitle(iconName, title)}
      <div class="${compact ? "link-grid chips" : "card-list"}">${entries}</div>
    </div>`;
}

/////////////////////////////////////////////////////////// tab 2 - links

function linkCard(path, label, iconName, accent) {
  const classes = accent ? `card accent ${accent}` : "card";
  return `<a class="${classes}" target="_blank" rel="noreferrer" href="${esc(host + path)}">${icon(iconName)}<span>${esc(label)}</span></a>`;
}

function linkGroup(iconName, title, titlePath, links, columns) {
  const heading = titlePath ? `<a href="${esc(host + titlePath)}" target="_blank" rel="noreferrer">${esc(title)}</a>` : esc(title);
  const cards = links.map(([path, label, cardIcon]) => linkCard(path, label, cardIcon)).join("");
  return `<div class="section">
      ${groupTitle(iconName, heading, { html: true })}
      <div class="link-grid${columns === 2 ? " cols-2" : ""}">${cards}</div>
    </div>`;
}

function renderTenantLinks() {
  const container = qs("#tenantUrls");
  if (!host) {
    container.innerHTML = "";
    return;
  }

  const failedMessages = "/shell/monitoring/Messages/%7B%22status%22%3A%22FAILED%22%2C%22time%22%3A%22PASTHOUR%22%2C%22type%22%3A%22INTEGRATION_FLOW%22%7D";

  container.innerHTML = `
    <div class="section">
      ${groupTitle("bolt", "Main Links")}
      <div class="link-grid">
        ${linkCard("/shell/monitoring/Messages/", "All Messages", "envelope", "green")}
        ${linkCard(failedMessages, "Failed Messages", "alert", "red")}
        ${linkCard("/shell/monitoring/MessageStatusOverview", "Status Overview", "donut", "yellow")}
        ${linkCard("/shell/monitoring/Artifacts/", "Integration Content", "layers", "grey")}
        ${linkCard("/shell/design", "Packages", "package", "blue")}
      </div>
    </div>
    ${linkGroup("activity", "Monitoring", "/shell/monitoring/Overview", [
      ["/shell/monitoring/SecurityMaterials", "Security Material", "shield"],
      ["/shell/monitoring/Keystore", "Keystore", "key"],
      ["/shell/monitoring/AccessPolicies", "Access Policies", "shieldCheck"],
      ["/shell/monitoring/JdbcMaterial", "JDBC Material", "database"],
      ["/shell/monitoring/Connectivity", "Connectivity Tests", "plug"],
      ["/shell/monitoring/DataStores", "Data Stores", "archive"],
      ["/shell/monitoring/Variables", "Variables", "variable"],
      ["/shell/monitoring/MessageQueues", "Message Queues", "queue"],
      ["/shell/monitoring/NumberRangeObject", "Number Ranges", "hash"],
      ["/shell/monitoring/PartnerDirectory", "Partner Directory", "addressBook"],
      ["/shell/monitoring/UserRoles", "User Roles", "userCheck"],
      ["/shell/monitoring/MessageUsage", "Message Usage", "barChart"],
      ["/shell/monitoring/SystemLogs", "System Logs", "fileText"],
      ["/shell/monitoring/Locks", "Message Locks", "lock"],
      ["/shell/monitoring/DesigntimeLocks", "Designtime Artifact Locks", "fileLock"],
    ])}
    ${linkGroup("sliders", "API Management", "/shell/settings", [
      ["/shell/configure", "Configure APIs", "cog"],
      ["/shell/testconsole", "Test APIs", "flask"],
      ["/shell/analytics", "Analyze APIs", "lineChart"],
    ])}
    ${linkGroup("partners", "Trading Partner Management", "/shell/tpm/companyProfile", [
      ["/shell/b2bmonitor/landing", "B2B Monitor", "activity"],
      ["/shell/tpm/companyProfile", "Company Profile", "building"],
      ["/shell/tpm/agreementTemplates", "Agreement Templates", "fileStack"],
      ["/shell/tpm/agreements", "Agreements", "fileCheck"],
      ["/shell/tpm/tradingPartners", "Trading Partners", "partners"],
      ["/shell/tpm/pdContent", "Partner Directory Data", "addressBook"],
      ["/shell/tpm/crossActions", "Cross Actions", "shuffle"],
    ])}
    ${linkGroup(
      "book",
      "Integration Advisor",
      "/shell/migs",
      [
        ["/shell/migs", "MIGs (Message Implementation Guidelines)", "book"],
        ["/shell/mags", "MAGs (Mapping Guidelines)", "mapping"],
        ["/shell/customtypesystems", "Custom Type Systems", "sitemap"],
      ],
      2
    )}`;
}

//////////////////////////////////////////////////////////// tab 3 - settings

function segmented(id, label, onLabel, offLabel, isOn) {
  return `<div class="label">${esc(label)}</div>
    <div class="control">
      <div class="segmented" id="${id}">
        <button type="button" data-value="true" class="${isOn ? "active" : ""}">${esc(onLabel)}</button>
        <button type="button" data-value="false" class="${isOn ? "" : "active"}">${esc(offLabel)}</button>
      </div>
    </div>`;
}

// Only rendered on a CPI tab - without the content script there is no tenant to configure.
function tenantSettingsFields() {
  return `
  <div class="settings" id="tenantSettingsFields">
    <div class="label">Name for tab<span class="hint">$iflow.name is replaced by the current artifact, or by the app name outside of design time</span></div>
    <div class="control">
      <input type="text" name="tenantName" id="tenantName" placeholder="Cloud Integration"/>
      <button type="button" class="btn" id="nameFromIflow">Current Iflow</button>
      <button type="button" class="btn" id="nameReset">Reset</button>
    </div>

    <div class="label">No. of last executions<span class="hint">messages shown in the sidebar</span></div>
    <div class="control">
      <input type="number" min="1" max="20" name="setCount" id="setCount"/>
    </div>

    <div class="label">Tab icon</div>
    <div class="control">
      ${dropdown("icon-picker", TAB_ICONS, tabIconOption)}
    </div>

    <div class="label">Default log mode</div>
    <div class="control">
      ${dropdown("log-picker", LOG_MODES, logModeOption)}
    </div>

    <div class="label">Theme color<span class="hint">light colors are darkened automatically</span></div>
    <div class="control">
      <input type="color" name="color" id="colorSelect"/>
      <div class="swatches">
        ${Object.entries(PRESET_COLORS)
          .map(([name, value]) => `<button type="button" class="swatch" data-variation="${name}" title="${name}" style="background:${value}"></button>`)
          .join("")}
      </div>
      <button type="button" class="btn" id="colorReset">Reset</button>
    </div>
  </div>`;
}

function renderSettings(state) {
  const compact = localStorage.getItem("modecpi_compact_mode") === "true";
  const helpOpen = localStorage.getItem("cpi_help_mode") !== "true"; // "true" means compressed
  const zoom = parseInt(localStorage.getItem("zoomlevel"), 10) || DEFAULT_ZOOM;

  qs("#tenantSettings").innerHTML = `
    ${groupTitle("server", "Tenant Settings")}
    ${contentScriptAlive ? tenantSettingsFields() : `<div class="notice">Open a SAP Cloud Integration tab to change the tenant settings.</div>`}

    ${groupTitle("plug", "Plugins")}
    ${
      contentScriptAlive
        ? `<div class="settings"><div class="label">Plugin settings<span class="hint">opens in the CPI tab - the plugin page needs the full window</span></div><div class="control"><button type="button" class="btn" id="openPlugins">Open plugins</button></div></div>`
        : `<div class="notice">Open a SAP Cloud Integration tab to manage plugins.</div>`
    }

    ${groupTitle("cog", "CPI Helper Settings")}
    <div class="settings">
      <div class="label">Trace global count<span class="hint">0 shows all steps - may freeze the browser</span></div>
      <div class="control">
        <input type="number" min="0" id="cpi_top_mode" value="${esc(state.traceCount)}"/>
        <span class="unit">steps</span>
      </div>

      <div class="label">Zoom level</div>
      <div class="control">
        <input type="number" min="60" max="120" id="zoomInput" value="${zoom}"/>
        <span class="unit">%</span>
        <button type="button" class="btn" id="zoomReset">Reset</button>
      </div>

      <div class="label">Tab shown on start</div>
      <div class="control">
        ${dropdown("tab-choice-select", START_TABS, startTabOption)}
      </div>

      <div class="divider"></div>

      ${segmented("openMessageSidebarOnStartup", "Open message sidebar on start", "Yes", "No", !!state.openMessageSidebarOnStartup)}
      ${segmented("refreshMessageSidebar", "Auto-refresh message sidebar", "On", "Off", state.autoRefreshMessageSidebar)}
      ${segmented("openSidebarOnStartup", "Plugin page as separate sidebar", "Yes", "No", !!state.openSidebarOnStartup)}
      ${segmented("cpi_compact_mode", "Layout of last visited", "Compact", "Cozy", compact)}
      ${segmented("cpi_tab_click_mode", "Switch tabs on", "Hover", "Click", localStorage.getItem("cpi_tab_click_mode") !== "true")}
    </div>

    <details class="help" id="cpi_help_mode" ${helpOpen ? "open" : ""}>
      <summary>Need more help / details?</summary>
      <div class="help-body">
        <h3>I-flow page shortcuts</h3>
        <p>Press <kbd>Alt</kbd> (Chrome/Edge) or <kbd>Alt</kbd> + <kbd>Shift</kbd> (Firefox) together with:</p>
        <div class="shortcuts">
          <span>Logs <kbd>1</kbd></span>
          <span>Trace <kbd>2</kbd></span>
          <span>Messages <kbd>3</kbd></span>
          <span>Info <kbd>4</kbd></span>
          <span>Plugins <kbd>5</kbd></span>
          <span>Search <kbd>S</kbd></span>
        </div>

        <h3>Tenant settings</h3>
        <ul>
          <li><b>Name for tab:</b> custom browser tab name. <span class="warn">CH_$iflow.name</span> adds the prefix <span class="warn">CH_</span> in front of the artifact name, or in front of the app name (for example <span class="warn">Message Status Overview</span>) on pages without an artifact.</li>
          <li><b>No. of last executions:</b> <span class="warn">1 to 20</span> messages in the sidebar.</li>
          <li><b>Theme color:</b> color of the CPI header. Prefer a darker color - light colors are darkened automatically so the text stays readable.</li>
          <li><b>Default log mode:</b> log level of the tab, <span class="ok">Warning</span> by default.</li>
          <li><b>Tab icon:</b> favicon of the tenant tab.</li>
        </ul>

        <h3>CPI Helper settings</h3>
        <ul>
          <li><b>Trace global count:</b> <span class="ok">300</span> by default, 0 means all steps. <span class="warn">This might freeze the browser - use with caution.</span></li>
          <li><b>Zoom level:</b> zoom of this popup. Min 60%, max 120%, <span class="ok">default 85%</span>.</li>
          <li><b>Tab shown on start:</b> <span class="ok">Last Visited</span> by default.</li>
          <li><b>Open message sidebar on start:</b> Yes / <span class="ok">No (default)</span>.</li>
          <li><b>Auto-refresh message sidebar:</b> <span class="ok">On (default)</span> / Off.</li>
          <li><b>Plugin page as separate sidebar:</b> Yes (separate and closed) / <span class="ok">No (default, joint and open)</span>.</li>
          <li><b>Layout of last visited:</b> <span class="ok">Cozy (default)</span> shows one artifact per row, Compact fits more artifacts on the screen.</li>
          <li><b>Switch tabs on:</b> <span class="ok">Hover (default)</span> switches the tab as soon as the mouse is over it, Click only on a click.</li>
        </ul>
      </div>
    </details>`;

  wireSettings(state);
}

function wireSettings(state) {
  // --- zoom
  const zoomInput = qs("#zoomInput");
  const applyZoom = () => {
    const value = clamp(parseInt(zoomInput.value, 10) || DEFAULT_ZOOM, 60, 120);
    zoomInput.value = value;
    localStorage.setItem("zoomlevel", value);
    qs("#cpiHelper_zoom").textContent = zoomCss(value);
  };
  zoomInput.addEventListener("change", applyZoom);
  qs("#zoomReset").addEventListener("click", () => {
    zoomInput.value = DEFAULT_ZOOM;
    applyZoom();
  });

  // --- trace step count
  qs("#cpi_top_mode").addEventListener("change", (event) => {
    chrome.storage.local.set({ cpi_top_mode: event.target.value });
  });

  // --- start tab
  wireDropdown("tab-choice-select", START_TABS, startTabOption, localStorage.getItem("tab-choice-select") || "one", (value) => localStorage.setItem("tab-choice-select", value));

  // --- help panel state
  const help = qs("#cpi_help_mode");
  help.addEventListener("toggle", () => localStorage.setItem("cpi_help_mode", String(!help.open)));

  // --- on/off controls
  wireSegmented("#openMessageSidebarOnStartup", (value) => chrome.storage.sync.set({ openMessageSidebarOnStartup: value }));
  wireSegmented("#refreshMessageSidebar", (value) => chrome.storage.sync.set({ autoRefreshMessageSidebar: value }));
  wireSegmented("#openSidebarOnStartup", (value) => chrome.storage.sync.set({ openSidebarOnStartup: value }));
  wireSegmented("#cpi_compact_mode", (value) => {
    localStorage.setItem("modecpi_compact_mode", String(value));
    renderLastVisited(state.visitedIflows, value);
  });
  wireSegmented("#cpi_tab_click_mode", (hover) => localStorage.setItem("cpi_tab_click_mode", String(!hover)));

  wireTenantSettings(state);

  // --- plugins: the plugin UI lives in the page, the popup only triggers it
  const openPlugins = qs("#openPlugins");
  if (openPlugins)
    openPlugins.addEventListener("click", () => {
      statistic("popup_btn_plugins_click");
      askContentScript(activeTabId, { openPlugins: true });
      window.close();
    });
}

function wireSegmented(selector, onChange) {
  const group = qs(selector);
  group.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.classList.contains("active")) return;
    qsa("button", group).forEach((b) => b.classList.toggle("active", b === button));
    onChange(button.dataset.value === "true");
  });
}

// Tenant settings are owned by the content script - read them once, write them back on change.
function wireTenantSettings(state) {
  if (!contentScriptAlive) return; // the fields are not rendered outside a CPI tab

  const hostData = state.hostData ? Object.assign({}, state.hostData) : {};
  const tenantName = qs("#tenantName");
  const tenantCount = qs("#setCount");
  const tenantColor = qs("#colorSelect");

  tenantName.value = hostData.title || "";
  tenantCount.value = hostData.count || "";
  tenantColor.value = hostData.color || "#354a5f";

  wireDropdown("icon-picker", TAB_ICONS, tabIconOption, hostData.icon || "default", (value) => {
    hostData.icon = value;
    saveHostData(hostData);
  });

  wireDropdown("log-picker", LOG_MODES, logModeOption, hostData.loglevel || "warn", (value) => {
    hostData.loglevel = value;
    saveHostData(hostData);
  });

  const debounced = (fn) => {
    let timeoutId;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(fn, 1000);
    };
  };

  tenantName.addEventListener(
    "input",
    debounced(() => {
      hostData.title = tenantName.value;
      saveHostData(hostData);
    })
  );

  tenantCount.addEventListener(
    "input",
    debounced(() => {
      const value = clamp(parseInt(tenantCount.value, 10) || 10, 1, 20);
      tenantCount.value = value;
      hostData.count = String(value);
      saveHostData(hostData);
    })
  );

  tenantColor.addEventListener("change", () => {
    tenantColor.value = adjustColorLimiter(tenantColor.value, state.isLightTheme ? 20 : 80, 25, !state.isLightTheme);
    hostData.color = tenantColor.value;
    applyAccentColor(tenantColor.value);
    saveHostData(hostData);
  });

  qsa(".swatch").forEach((swatch) =>
    swatch.addEventListener("click", () => {
      tenantColor.value = PRESET_COLORS[swatch.dataset.variation];
      tenantColor.dispatchEvent(new Event("change"));
    })
  );

  qs("#nameFromIflow").addEventListener("click", () => {
    tenantName.value = "$iflow.name";
    tenantName.dispatchEvent(new Event("input"));
  });
  qs("#nameReset").addEventListener("click", () => {
    tenantName.value = "Cloud Integration";
    tenantName.dispatchEvent(new Event("input"));
  });
  qs("#colorReset").addEventListener("click", () => {
    tenantColor.value = state.isLightTheme ? "#ffffff" : "#354a5f";
    tenantColor.dispatchEvent(new Event("change"));
  });
}

////////////////////////////////////////////////////////////////////// colors

function adjustColorLimiter(ihex, limit, dim, abovelimit = false) {
  /**
   * Adjusts a hex color based on the threshold specified by @abovelimit.
   * If @abovelimit is true, adjusts the color darker by @dim; if false, adjusts lighter.
   * @param {string} hexColor - The input hex color (e.g., '#RRGGBB' or '#RGB').
   * @param {number} limit - The threshold limit for adjusting the color.
   * @param {number} dim - The amount of lightness to adjust (positive for lighter, negative for darker).Reccomanded to use Flag.
   * @param {boolean} abovelimit - Indicates whether to adjust the color above or below the limit.
   * @returns {string} - The adjusted hex color.
   */
  let h, s, l, ohex;
  var list = hexToHsl(ihex, true).split(" ");
  h = parseInt(list[0]);
  s = parseInt(list[1]);
  l = parseInt(list[2]);
  l = Math.max(0, Math.min(l > limit === abovelimit ? l + dim * (abovelimit ? -1 : 1) : l, 100));
  ohex = hslToHex(h, s, l);
  return ohex;
}

function hslToHex(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex, values = false) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return values ? "0 0 0" : "hsl(0deg 0% 0%)";
  var r = parseInt(result[1], 16);
  var g = parseInt(result[2], 16);
  var b = parseInt(result[3], 16);
  var cssString = "";
  ((r /= 255), (g /= 255), (b /= 255));
  var max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  var h,
    s,
    l = (max + min) / 2;
  if (max == min) {
    h = s = 0; // achromatic
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  cssString = values ? `${h} ${s} ${l}` : `hsl(${h}deg ${s}% ${l}%)`;
  return cssString;
}

//////////////////////////////////////////////////////////////////////// main

function resolveHost(url) {
  if (!url || !CPI_HOST_REGEXP.test(url)) return { host: "", tenant: "" };
  const hostname = url.split("/")[2];
  const base = "https://" + hostname + (url.match(/.*\.integrationsuite(-trial)?.*/) ? "" : "/itspaces");
  return { host: base, tenant: hostname.split(".")[0] };
}

async function main() {
  setVersion();
  initTabs();

  const tab = await getActiveTab();
  activeTabId = tab ? tab.id : null;
  const resolved = resolveHost(tab ? tab.url : "");
  host = resolved.host;
  tenant = resolved.tenant;

  // one round trip each instead of a chain of nested callbacks - the popup is rebuilt on every open
  const visitedKey = tenant ? "visitedIflows_" + tenant : "__none__";
  const [sync, local, hostData] = await Promise.all([
    chrome.storage.sync.get([visitedKey, "openMessageSidebarOnStartup", "openSidebarOnStartup", "autoRefreshMessageSidebar", "CPIhelperThemeInfo"]),
    chrome.storage.local.get(["cpi_top_mode"]),
    askContentScript(activeTabId, "get"),
  ]);

  contentScriptAlive = !!hostData;

  const state = {
    visitedIflows: sync[visitedKey],
    openMessageSidebarOnStartup: sync.openMessageSidebarOnStartup,
    openSidebarOnStartup: sync.openSidebarOnStartup,
    autoRefreshMessageSidebar: sync.autoRefreshMessageSidebar ?? true,
    // no CPI page visited yet - fall back to the operating system preference
    isLightTheme: sync.CPIhelperThemeInfo === undefined ? !window.matchMedia("(prefers-color-scheme: dark)").matches : !!sync.CPIhelperThemeInfo,
    traceCount: local.cpi_top_mode ? local.cpi_top_mode : 300,
    hostData: hostData,
  };

  applyTheme(state.isLightTheme);
  if (hostData && hostData.color) {
    // keep the stored color in sync with the theme, same rule as the CPI header itself
    hostData.color = adjustColorLimiter(hostData.color, state.isLightTheme ? 20 : 80, 25, !state.isLightTheme);
    applyAccentColor(hostData.color);
  }

  renderTenantLinks();
  renderSettings(state);
  renderLastVisited(state.visitedIflows, localStorage.getItem("modecpi_compact_mode") === "true");

  statistic("popup_open");
}

// the theme follows the CPI tab, so it can flip while the popup is open
chrome.storage.onChanged.addListener((changes) => {
  if (changes.CPIhelperThemeInfo) applyTheme(!!changes.CPIhelperThemeInfo.newValue);
});

document.addEventListener("DOMContentLoaded", () => {
  main().catch((e) => console.error(e));
});
