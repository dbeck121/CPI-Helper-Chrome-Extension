// state of the package view: id and type of the artifacts of the open package (the table only shows the name,
// while the editor url needs the id), the deployed artifacts of the tenant, the runtime entries per name for the deploy
// status (null until read) and the housekeeping of both calls. settings and heartbeatAt are for the entries of the
// action sheet, which are added outside of the heartbeat
var epvState = { settings: {}, heartbeatAt: 0, sheetListener: false, packageKey: null, artifactsByName: {}, artifactsFetching: null, artifactsNextFetchAt: 0, deployed: null, runtimeByName: null, runtimeLoading: false, runtimeFailedAt: 0 };

var plugin = {
  metadataVersion: "1.0.0",
  id: "enhancedPackageView",
  name: "Enhanced Package View",
  version: "1.0.0",
  author: "Alexander Aigner, snap Consulting, Austria",
  email: "alexander.aigner@snapconsult.com",
  website: "https://www.linkedin.com/in/alexander-aigner-at/",
  description: "Adds the deployment status, small icons (open in a new tab, copy the name, open the messages) and entries in the ... menu to the artifact list of a package.",

  settings: {
    icon: { type: "icon", src: "/images/plugin_logos/snapconsult-at.png" },
    info: {
      text: "Every part can be switched on separately. Deploy status: the status is read from the list of the Integration Content monitor, one call per runtime location when a package is opened, and then kept until the package is left, the refresh button next to the search field refreshes it; the version column is colored too (green: the deployed version is the current one, orange: the deployed version is older, red: nothing is deployed), every runtime the artifact is deployed to gets its own status label (cloud icon: Cloud Integration, server icon: Edge Integration Cell), and the version and the labels show runtime, deployed version, date and user on hover. Open in a new tab: the icon next to the name opens the artifact in a new browser tab, a normal click on the row keeps navigating in the current tab; id and type of the artifacts are read from the workspace API in the background, so the icon appears as soon as the artifact is resolved. Copy the name: the copy icon copies the name of the artifact to the clipboard. Messages: the envelope button next to the search field opens the messages of the package in the Message Monitor, the envelope icon next to the name the messages of the artifact (for artifacts that write messages), both in a new tab and for the past hour. The ... menu of every row gets the enabled actions below a separator, plus the deployment status in the Integration Content monitor. Show the actions as: icons next to the name, entries in the ... menu or both (the messages button of the package stays in the toolbar). Switching a part off removes its icons, the color of the version column stays until the page is reloaded.",
      type: "label",
    },
    deployStatus: {
      text: "Show the deployment status of every artifact",
      type: "checkbox",
      scope: "browser",
    },
    openInNewTab: {
      text: "Show an icon that opens the artifact in a new tab",
      type: "checkbox",
      scope: "browser",
    },
    copyName: {
      text: "Show an icon that copies the name of the artifact",
      type: "checkbox",
      scope: "browser",
    },
    monitorMessages: {
      text: "Show icons that open the messages of the package or the artifact in the Message Monitor",
      type: "checkbox",
      scope: "browser",
    },
    actionPlacement: {
      text: "Show the actions as",
      type: "select",
      scope: "browser",
      options: [
        { value: "both", label: "Icons and menu entries", default: true },
        { value: "icons", label: "Icons next to the name" },
        { value: "menu", label: "Entries in the ... menu" },
      ],
    },
  },

  heartbeat: async (pluginHelper, settings) => {
    var rows = epvRows();
    if (rows.length === 0) {
      return;
    }

    var deployStatus = settings["enhancedPackageView---deployStatus"] === true;
    var openInNewTab = settings["enhancedPackageView---openInNewTab"] === true;
    var copyName = settings["enhancedPackageView---copyName"] === true;
    var monitorMessages = settings["enhancedPackageView---monitorMessages"] === true;
    // unset until the select is changed once, then the default
    var placement = settings["enhancedPackageView---actionPlacement"] || "both";
    var icons = placement !== "menu";
    var menu = placement !== "icons";
    epvState.settings = { openInNewTab: openInNewTab && menu, copyName: copyName && menu, monitorMessages: monitorMessages && menu };
    epvState.heartbeatAt = Date.now();
    if (!epvState.sheetListener) {
      epvState.sheetListener = true;
      // capture, so the row is known before UI5 opens the sheet
      document.addEventListener("click", epvOnRowClick, true);
    }

    var key = pluginHelper.currentPackageId || window.location.hash;
    if (epvState.packageKey !== key) {
      epvState.packageKey = key;
      epvState.artifactsByName = {};
      epvState.artifactsNextFetchAt = 0;
      epvState.deployed = null;
      epvState.runtimeByName = null;
    }

    // id and type of the artifacts are read in the background: the deploy status is matched by id and the new tab icon needs the id for its url
    if (deployStatus || openInNewTab || monitorMessages) {
      epvEnsureArtifacts(pluginHelper.currentPackageId);
    }
    if (!openInNewTab || !icons) {
      epvRemove(".cpiHelper_epvOpen");
    }

    if (deployStatus) {
      epvAddRefreshButton();
      // read once per package, the refresh button reads again. after a failed call wait a minute
      if (!epvState.runtimeByName && !epvState.runtimeLoading && Date.now() - epvState.runtimeFailedAt > 60000) {
        epvLoadRuntime();
      }
    } else {
      epvRemove(".cpiHelper_epvDeployStatus, .cpiHelper_epvRefresh");
    }

    if (!copyName || !icons) {
      epvRemove(".cpiHelper_epvCopy");
    }

    if (monitorMessages && pluginHelper.currentPackageId) {
      var packageMessagesUrl = cpihTenantBase() + cpihPackageMessagesPath(pluginHelper.currentPackageId, cpiData.runtimeLocationId);
      epvAddToolbarButton("cpiHelper_epvPackageMessages", "envelope outline", "Messages of this package in the Message Monitor (CPI Helper)", () => window.open(packageMessagesUrl, "_blank"));
    } else {
      epvRemove(".cpiHelper_epvPackageMessages");
    }
    if (!monitorMessages || !icons) {
      epvRemove(".cpiHelper_epvMessages");
    }

    for (var row of rows) {
      epvRenderRow(row, deployStatus, openInNewTab && icons, copyName && icons, monitorMessages && icons);
    }
  },
};

function epvRows() {
  return document.querySelectorAll('div[id$="--artifactTable"] tbody tr.sapMListTblRow');
}

function epvName(row) {
  return row.querySelector(".sapMObjectIdentifierTitle")?.textContent.trim();
}

function epvRemove(selector) {
  for (var element of document.querySelectorAll(selector)) {
    element.remove();
  }
}

function epvRenderRow(row, deployStatus, openInNewTab, copyName, monitorMessages) {
  var nameElement = row.querySelector(".sapMObjectIdentifierTitle");
  if (!nameElement) {
    return;
  }
  var name = nameElement.textContent.trim();

  if (copyName) {
    // copyText shows the toast itself
    epvAddIcon(row, nameElement, "cpiHelper_epvCopy", "copy", "Copy the name to the clipboard (CPI Helper)", () => copyText(name));
  }

  if (openInNewTab) {
    var url = epvArtifactUrl(name);
    // without a resolved artifact there is no url to open, so the icon is added once the artifacts are read
    if (url) {
      epvAddIcon(row, nameElement, "cpiHelper_epvOpen", "external alternate", "Open in a new tab (CPI Helper)", () => window.open(url, "_blank"));
    }
  }

  if (monitorMessages) {
    // only artifacts that write messages get the icon, and only once the artifact is resolved
    var messages = epvJumpTargets(name).find((target) => target.path.startsWith("/shell/monitoring/Messages/"));
    if (messages) {
      epvAddIcon(row, nameElement, "cpiHelper_epvMessages", "envelope outline", "Messages of this artifact in the Message Monitor (CPI Helper)", () => window.open(messages.url, "_blank"));
    }
  }

  if (deployStatus) {
    epvRenderDeployStatus(row);
  }
}

// messages and deployment status of an artifact in the monitor, empty until the artifact is resolved
function epvJumpTargets(name) {
  var artifact = epvState.artifactsByName[name];
  var artifactType = CPIH_WORKSPACE_TYPES[artifact?.type]?.type;
  if (!artifactType) {
    return [];
  }
  // an artifact deployed to one runtime only opens the monitor of that runtime, otherwise the one selected in the extension
  var locations = new Set((epvState.runtimeByName?.get(name) || []).map((entry) => entry.runtimeLocationId));
  var runtimeLocationId = locations.size === 1 ? [...locations][0] : cpiData.runtimeLocationId;
  return cpihArtifactJumpTargets({ artifactId: artifact.id, artifactType, packageId: null, runtimeLocationId }).map((target) => ({ ...target, url: cpihTenantBase() + target.path }));
}

// the ... button of a row opens a UI5 action sheet outside of the table, so the row is taken from the click and the
// entries are added once the sheet is rendered
function epvOnRowClick(event) {
  // the plugin was switched off, the listener stays until the page is reloaded
  if (Date.now() - epvState.heartbeatAt > 10000) {
    return;
  }
  var row = event.target.closest?.('div[id$="--artifactTable"] tbody tr.sapMListTblRow');
  var name = row && event.target.closest("button") ? epvName(row) : null;
  if (name) {
    setTimeout(() => epvAddSheetEntries(name), 100);
  }
}

function epvAddSheetEntries(name, tries = 10) {
  // UI5 keeps closed popovers hidden in the dom, only the open one is visible
  var sheet = [...document.querySelectorAll(".sapMActionSheetPopover .sapMActionSheet")].find((element) => element.offsetParent);
  if (!sheet) {
    if (tries > 0) {
      setTimeout(() => epvAddSheetEntries(name, tries - 1), 100);
    }
    return;
  }

  var settings = epvState.settings;
  var entries = settings.monitorMessages ? epvJumpTargets(name).map((target) => ({ text: target.label, action: () => window.open(target.url, "_blank") })) : [];
  var url = settings.openInNewTab ? epvArtifactUrl(name) : null;
  if (url) {
    entries.push({ text: "Open in a new tab", action: () => window.open(url, "_blank") });
  }
  if (settings.copyName) {
    entries.push({ text: "Copy the name", action: () => copyText(name) });
  }

  // the sheet is reused for every row, so the entries of the row opened before go
  sheet.querySelectorAll(".cpiHelper_epvSheet").forEach((element) => element.remove());
  if (entries.length === 0) {
    return;
  }

  var separator = document.createElement("div");
  separator.className = "cpiHelper_epvSheet";
  // a line with the logo and the name in the middle, so the entries below are known to come from the extension
  separator.style.cssText = "display: flex; align-items: center; gap: 0.4rem; margin: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--sapContent_LabelColor, #6a6d70);";
  var line = '<span style="flex: 1; border-top: 1px solid var(--sapList_BorderColor, #d9d9d9);"></span>';
  separator.innerHTML = `${line}<img src="${chrome.runtime.getURL("images/v5/32.png")}" alt="" style="width: 14px; height: 14px;"><span>CPI Helper</span>${line}`;
  sheet.appendChild(separator);

  for (var entry of entries) {
    sheet.appendChild(epvSheetButton(sheet, entry));
  }
}

// the markup of the SAP entries above, so it looks the same
function epvSheetButton(sheet, entry) {
  var button = document.createElement("button");
  button.className = "sapMBtnBase sapMBtn sapMBtnInverted sapMActionSheetButtonNoIcon sapMActionSheetButton cpiHelper_epvSheet";
  button.title = `${entry.text} (CPI Helper)`;
  button.innerHTML = '<span class="sapMBtnInner sapMBtnHoverable sapMFocusable sapMBtnText sapMBtnTransparent"><span class="sapMBtnContent"><bdi></bdi></span></span>';
  button.querySelector("bdi").textContent = entry.text;
  button.addEventListener("click", () => {
    // UI5 does not know this button, so the sheet is closed like with the escape key
    sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    entry.action();
  });
  return button;
}

// the icons sit inside the row and a click on the row navigates to the artifact, so the click must not reach the row
function epvAddIcon(row, nameElement, className, iconName, title, action) {
  if (row.querySelector("." + className)) {
    return;
  }

  var icon = document.createElement("i");
  icon.className = `${iconName} icon ${className}`;
  icon.title = title;
  // a bit smaller than the name, with the pointer cursor of a link
  icon.style.cssText = "margin-left: 0.4rem; font-size: 0.7em; cursor: pointer;";
  icon.addEventListener("mousedown", epvStopEvent);
  icon.addEventListener("click", (event) => {
    epvStopEvent(event);
    action();
  });

  nameElement.parentElement.appendChild(icon);
}

function epvStopEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

// keyword in the artifact type of the workspace API -> path segment of the editor url. the type is compared in lower
// case without separators, so spellings like "ODataService" or "ODATA_SERVICE" end up on the same path
var epvPaths = [
  ["iflow", "integrationflows"],
  ["integrationflow", "integrationflows"],
  ["valuemapping", "valuemappings"],
  ["scriptcollection", "scriptcollections"],
  ["messagemapping", "messagemappings"],
  ["rest", "restapis"],
  ["soap", "soapapis"],
  ["odata", "odataservices"],
  ["serviceinterface", "serviceinterfaces"],
  // the generic api artifact, last so the rest, soap and odata apis above keep their own editor
  ["api", "apis"],
];
var epvUnknownTypes = new Set();
// editor paths of design time only artifacts, they get no deploy status
var epvNotDeployable = new Set(["serviceinterfaces"]);

function epvPath(type) {
  var normalized = (type || "").toLowerCase().replace(/[^a-z]/g, "");
  var match = epvPaths.find(([keyword]) => normalized.includes(keyword));
  if (!match && type && !epvUnknownTypes.has(type)) {
    epvUnknownTypes.add(type);
    log.warn(`enhancedPackageView: no editor url known for artifact type ${type}`);
  }
  return match ? match[1] : null;
}

function epvArtifactUrl(name) {
  var packageUrl = window.location.href.match(/^(.*\/contentpackage\/[^/?#]+)/);
  var artifact = epvState.artifactsByName[name];
  var path = artifact ? epvPath(artifact.type) : null;

  if (!packageUrl || !path) {
    return null;
  }

  return `${packageUrl[1]}/${path}/${encodeURIComponent(artifact.id)}`;
}

// one workspace call at a time, throttled: every caller gets the running call instead of starting a second one
function epvEnsureArtifacts(packageId, cache = 60) {
  if (epvState.artifactsFetching) {
    return epvState.artifactsFetching;
  }
  if (!packageId || Date.now() < epvState.artifactsNextFetchAt) {
    return Promise.resolve();
  }

  epvState.artifactsFetching = epvFetchArtifacts(packageId, cache).finally(() => {
    epvState.artifactsFetching = null;
    // back off when the tenant answered nothing usable, so a package we cannot resolve is not polled every minute
    epvState.artifactsNextFetchAt = Date.now() + (Object.keys(epvState.artifactsByName).length > 0 ? 60000 : 600000);
  });
  return epvState.artifactsFetching;
}

// the design time OData API is not available on every tenant, the workspace API of the web ui is
async function epvFetchArtifacts(packageId, cache) {
  var workspaceUrl = "/" + cpiData.urlExtension + "api/1.0/workspace/";
  var packageKey = epvState.packageKey;

  var workspaceResp = await makeCallPromiseV2("GET", workspaceUrl, 300, "application/json", null, null, null, false);
  if (!workspaceResp.successful) {
    log.warn(`enhancedPackageView: could not read the workspace list: ${workspaceResp.status} ${workspaceResp.statusText}`);
    return;
  }

  var workspace = JSON.parse(workspaceResp.responseText).find((entry) => entry.technicalName === packageId);
  if (!workspace) {
    log.warn(`enhancedPackageView: package ${packageId} not found in the workspace list`);
    return;
  }

  // the refresh button reads without the cache, otherwise an artifact created in the last minute is missing
  var artifactResp = await makeCallPromiseV2("GET", `${workspaceUrl}${workspace.id}/artifacts/`, cache, "application/json", null, null, null, false);
  if (!artifactResp.successful) {
    log.warn(`enhancedPackageView: could not read the artifacts of ${packageId}: ${artifactResp.status} ${artifactResp.statusText}`);
    return;
  }

  var artifactsByName = {};
  for (var artifact of JSON.parse(artifactResp.responseText)) {
    // name is the text of the Name column, tooltip is the id the editor url needs
    if (artifact.name && artifact.tooltip) {
      artifactsByName[artifact.name] = { id: artifact.tooltip, type: artifact.type };
    }
  }

  // a package that was left in the meantime must not overwrite the artifacts of the package now open
  if (epvState.packageKey !== packageKey) {
    return;
  }
  epvState.artifactsByName = artifactsByName;
  // an artifact created since the last read gets its status from the list already read
  epvMatchRuntime();
  log.info(`enhancedPackageView: ${Object.keys(artifactsByName).length} artifacts read for package ${packageId}`);
}

// runtime entries per name of the open package, from the deployed artifacts of the tenant matched by id
function epvMatchRuntime() {
  if (!epvState.deployed) {
    return;
  }
  var runtimeByName = new Map();
  for (var [name, artifact] of Object.entries(epvState.artifactsByName)) {
    // a service interface is never deployed, a runtime entry with its id belongs to another artifact
    if (epvNotDeployable.has(epvPath(artifact.type))) {
      continue;
    }
    runtimeByName.set(
      name,
      epvState.deployed.filter((entry) => entry.symbolicName === artifact.id)
    );
  }
  epvState.runtimeByName = runtimeByName;
}

var epvGreen = "#107e3e";
var epvOrange = "#e9730c";
var epvRed = "#bb0000";

// runtime status -> label color
var epvStatusColors = {
  STARTED: "green",
  DEPLOYED: "green",
  STARTING: "orange",
  STORED: "orange",
  STOPPED: "grey",
  ERROR: "red",
  NOT_DEPLOYED: "red",
};

// label color -> text and border color and light background of the basic label. ui.css only colors the filled red
// label, so the colors are set here. the background is a tint of the color, so it works on the light and the dark SAP theme
var epvLabelStyles = {
  green: { color: "#21ba45", background: "rgba(33, 186, 69, 0.1)" },
  orange: { color: "#f2711c", background: "rgba(242, 113, 28, 0.1)" },
  red: { color: "#db2828", background: "rgba(219, 40, 40, 0.1)" },
  grey: { color: "#767676", background: "rgba(118, 118, 118, 0.1)" },
};

async function epvLoadRuntime(notify = false) {
  epvState.runtimeLoading = true;
  epvUpdateRefreshButton();
  // answers of a package that was left in the meantime must not land in the state of the package now open
  var packageKey = epvState.packageKey;

  try {
    // the refresh button has to see the current state, the load on opening a package may share the answers of the last minute
    var cache = notify ? false : 60;
    if (notify) {
      // a read started by the heartbeat may have come from the cache, so wait for it and read again
      await epvState.artifactsFetching;
      epvState.artifactsNextFetchAt = 0;
    }

    // the list is matched by id while the table only shows the name, so the workspace call has to be done first
    await epvEnsureArtifacts(cpiData.currentPackageId, cache);
    if (Object.keys(epvState.artifactsByName).length === 0) {
      throw "the artifacts of the package could not be resolved";
    }

    var deployed = await epvFetchDeployed(cache);
    if (epvState.packageKey !== packageKey) {
      return;
    }

    epvState.deployed = deployed;
    epvMatchRuntime();
    var runtimeByName = epvState.runtimeByName;

    for (var row of epvRows()) {
      epvRenderDeployStatus(row);
    }

    // only the manual refresh gets a toast, the load on opening a package stays silent
    if (notify) {
      var count = [...runtimeByName.values()].filter((entries) => entries.length > 0).length;
      showToast(`Deploy status refreshed, ${count} of ${runtimeByName.size} artifacts are deployed`, "Deploy status", "success");
    }
  } catch (error) {
    // after a failed call the heartbeat waits a minute, otherwise a broken tenant is called every 3 seconds
    epvState.runtimeFailedAt = Date.now();
    log.warn(`enhancedPackageView: reading the deploy status failed: ${error}`);
    if (notify) {
      showToast("Could not refresh the deploy status, check the log for details", "Deploy status", "error");
    }
  } finally {
    epvState.runtimeLoading = false;
    epvUpdateRefreshButton();
  }
}

// every deployed artifact of the tenant, read with the list of the Integration Content monitor: one call per runtime
// location instead of one per artifact, so the traffic does not grow with the size of the package
async function epvFetchDeployed(cache) {
  var operations = "/" + cpiData.urlExtension + "Operations/";

  // neo has no runtime locations, there the list without a location is the whole runtime
  var locations = [null];
  if (cpiData.cpiPlatform !== "neo") {
    var locationResp = await makeCallPromiseV2("GET", operations + "com.sap.it.op.srv.web.cf.RuntimeLocationListCommand", 300, null, null, null, null, false);
    if (!locationResp.successful) {
      throw `could not read the runtime locations: ${locationResp.status} ${locationResp.statusText}`;
    }
    var locationList = new XmlToJson().parse(locationResp.responseText)["com.sap.it.op.srv.web.cf.RuntimeLocationListResponse"].runtimeLocations;
    // a single element is not wrapped in an array by the xml parser
    locations = []
      .concat(locationList || [])
      .filter((location) => location.state?.toUpperCase() === "ACTIVE")
      .map((location) => location.id);
  }

  var lists = await Promise.all(
    locations.map(async (locationId) => {
      var resp = await makeCallPromiseV2("GET", operations + "com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListCommand" + (locationId ? "?runtimeLocationId=" + locationId : ""), cache, null, null, null, null, false);
      // a missing location would show its artifacts as not deployed, so a failed one fails the whole status
      if (!resp.successful) {
        throw `could not read the deployed artifacts of ${locationId || "the runtime"}: ${resp.status} ${resp.statusText}`;
      }
      var list = new XmlToJson().parse(resp.responseText)["com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListResponse"].artifactInformations;
      return [].concat(list || []).map((entry) => ({ ...entry, runtimeLocationId: locationId || "cloudintegration" }));
    })
  );
  return lists.flat();
}

function epvUpdateRefreshButton() {
  var button = document.querySelector(".cpiHelper_epvRefresh");
  if (button) {
    button.disabled = epvState.runtimeLoading;
    button.querySelector("i.icon")?.classList.toggle("loading", epvState.runtimeLoading);
  }
}

function epvAddRefreshButton() {
  epvAddToolbarButton("cpiHelper_epvRefresh", "sync alternate", "Refresh deploy status (CPI Helper)", () => {
    epvState.runtimeFailedAt = 0;
    // the ids may be stale too, the package can have been changed somewhere else since it was opened
    epvState.artifactsNextFetchAt = 0;
    epvLoadRuntime(true);
  });
  epvUpdateRefreshButton();
}

// button in the toolbar of the artifact list, next to search / sort / filter / group
function epvAddToolbarButton(className, iconName, title, action) {
  // UI5 keeps pages that were left hidden in the dom, their search fields included, so only the visible one counts
  var searchField = [...document.querySelectorAll("div.sapMHBox.sapMBarChild .sapMSF")].find((element) => element.offsetParent);
  var toolbar = searchField?.closest("div.sapMHBox.sapMBarChild");
  if (!toolbar || toolbar.querySelector("." + className)) {
    return;
  }
  // a button left behind in the toolbar of a hidden page
  epvRemove("." + className);

  // the shell of a SAP toolbar button, so it lines up with its neighbours, with the icon of the extension inside
  var button = document.createElement("button");
  button.className = `sapMBtnBase sapMBtn sapUiTinyMarginBegin ${className}`;
  button.title = title;
  button.innerHTML = `<span class="sapMBtnInner sapMBtnHoverable sapMFocusable sapMBtnDefault"><span class="sapMBtnContent"><i class="${iconName} icon" style="margin: 0;"></i></span></span>`;
  button.addEventListener("click", action);
  toolbar.appendChild(button);
}

// runtime location -> icon, every location besides the cloud runtime is an edge integration cell
function epvRuntimeIcon(entry) {
  return entry.runtimeLocationId === "cloudintegration" ? "cloud" : "server";
}

function epvRenderDeployStatus(row) {
  var name = epvName(row);
  var infoElement = row.querySelector(".cntPkgResourceInfoPipes");
  // without an answer for this name "not deployed" would be a guess, so leave the row alone
  if (!name || !infoElement || !epvState.runtimeByName?.has(name)) {
    return;
  }

  // one entry per runtime location the artifact is deployed to, empty when it is deployed nowhere
  var entries = epvState.runtimeByName.get(name);
  var versionElement = row.querySelector('td[id$="-cell2"]');
  var designVersion = versionElement?.textContent.trim();

  var labels = entries.map((entry) => {
    // deployState says whether the artifact reached the runtime, semanticState whether the flow itself is running
    var status = (entry.semanticState || entry.deployState || "").toUpperCase();
    var versionDiffers = !!(entry.version && designVersion && entry.version !== designVersion);
    // a started artifact running an old version is not really green
    var color = versionDiffers && status === "STARTED" ? "orange" : epvStatusColors[status] || "grey";
    var tooltip = [
      `Runtime: ${entry.runtimeLocationName || entry.runtimeLocationId || "-"}`,
      `Deployed version: ${entry.version || "-"}` + (versionDiffers ? ` (design time version: ${designVersion})` : " (current)"),
      `Status: ${epvStatusLabel(status)}`,
      `Deploy state: ${epvStatusLabel((entry.deployState || "").toUpperCase())}`,
      `Deployed on: ${entry.deployedOn || "-"}`,
      `Deployed by: ${entry.deployedBy || "-"}`,
    ].join("\n");
    return { text: epvStatusLabel(status), color, icon: epvRuntimeIcon(entry), tooltip, versionDiffers };
  });
  if (labels.length === 0) {
    labels.push({ text: "Not deployed", color: "red", icon: "times circle", tooltip: "No deployed runtime artifact found for this artifact", versionDiffers: false });
  }

  // green when every runtime runs the current version, orange when one drifted, red when nothing is deployed
  var versionColor = entries.length === 0 ? epvRed : labels.some((label) => label.versionDiffers) ? epvOrange : epvGreen;
  var tooltip = labels.map((label) => label.tooltip).join("\n\n");

  // the heartbeat runs every 3 seconds, so touch the dom only when something actually changed
  var container = row.querySelector(".cpiHelper_epvDeployStatus");
  var signature = versionColor + JSON.stringify(labels);
  if (container && row.dataset.cpiHelperEpv === signature) {
    return;
  }
  row.dataset.cpiHelperEpv = signature;

  if (versionElement) {
    // in a development package the version is a link, and the link color of the theme beats the color of the cell
    for (var element of [versionElement, ...versionElement.querySelectorAll(".sapMLnk, .sapMLnkText, .sapMText")]) {
      element.style.color = versionColor;
      element.style.fontWeight = "bold";
      // same details as the labels, so hovering the version number is enough
      element.title = tooltip;
    }
  }

  if (!container) {
    container = document.createElement("span");
    container.className = "cpiHelper_epvDeployStatus";
    container.style.marginLeft = "0.5rem";
    // the help cursor tells that hovering shows details
    container.style.cursor = "help";
    infoElement.appendChild(container);
  }

  // one basic label (colored border and text) on a light tint of its color per runtime, lighter than a filled label
  container.replaceChildren(
    ...labels.map((entry) => {
      var label = document.createElement("span");
      label.className = "ui basic label";
      var style = epvLabelStyles[entry.color];
      // sized relative to the text of the info line and with little padding, so the label is not taller than its neighbours
      label.style.cssText = `color: ${style.color}; border-color: ${style.color}; background: ${style.background}; font-size: 0.8em; padding: 0.15em 0.45em;`;
      label.innerHTML = `<i class="${entry.icon} icon" style="margin: 0 0.3em 0 0;"></i>`;
      label.append(entry.text);
      label.title = entry.tooltip;
      return label;
    })
  );
}

function epvStatusLabel(status) {
  // NOT_DEPLOYED -> Not deployed
  return status ? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ") : "-";
}

pluginList.push(plugin);
