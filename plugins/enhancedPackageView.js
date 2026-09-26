// state of the package view: id and type of the artifacts of the open package (the table only shows the name,
// while the editor url needs the id), the runtime artifacts for the deploy status and the housekeeping of both calls
var epvState = { packageKey: null, artifactsByName: {}, artifactsFetching: null, artifactsNextFetchAt: 0, runtimeByName: new Map(), runtimeRequested: new Set(), runtimeRunning: 0, runtimeFailedAt: 0 };

var plugin = {
  metadataVersion: "1.0.0",
  id: "enhancedPackageView",
  name: "Enhanced Package View",
  version: "1.0.0",
  author: "Alexander Aigner, snap Consulting, Austria",
  email: "alexander.aigner@snapconsult.com",
  website: "https://www.linkedin.com/in/alexander-aigner-at/",
  description: "Adds the deployment status and two small icons (open in a new tab, copy the name) to the artifact list of a package.",

  settings: {
    icon: { type: "icon", src: "/images/plugin_logos/snapconsult-at.png" },
    info: {
      text: "Every part can be switched on separately. Deploy status: the status is read per artifact from /api/1.0/deployedartifacts, once per artifact of the opened package and then kept until the package is left, the refresh button next to the search field refreshes it; the version column is colored too (green: the deployed version is the current one, orange: the deployed version is older, red: nothing is deployed) every runtime the artifact is deployed to gets its own status label (cloud icon: Cloud Integration, server icon: Edge Integration Cell), and the version and the labels show runtime, deployed version, date and user on hover. Open in a new tab: the icon next to the name opens the artifact in a new browser tab, a normal click on the row keeps navigating in the current tab; id and type of the artifacts are read from the workspace API in the background, so the icon appears as soon as the artifact is resolved. Copy the name: the copy icon copies the name of the artifact to the clipboard. Switching a part off removes its icons, the color of the version column stays until the page is reloaded.",
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
  },

  heartbeat: async (pluginHelper, settings) => {
    var rows = epvRows();
    if (rows.length === 0) {
      return;
    }

    var deployStatus = settings["enhancedPackageView---deployStatus"] === true;
    var openInNewTab = settings["enhancedPackageView---openInNewTab"] === true;
    var copyName = settings["enhancedPackageView---copyName"] === true;

    var key = pluginHelper.currentPackageId || window.location.hash;
    if (epvState.packageKey !== key) {
      epvState.packageKey = key;
      epvState.artifactsByName = {};
      epvState.artifactsNextFetchAt = 0;
      epvState.runtimeByName = new Map();
      epvState.runtimeRequested = new Set();
      // calls of the package left behind stop writing, so their share of the counter is dropped here
      epvState.runtimeRunning = 0;
      epvUpdateRefreshButton();
    }

    // id and type of the artifacts are read in the background: the runtime call asks by id and the new tab icon needs the id for its url
    if (deployStatus || openInNewTab) {
      epvEnsureArtifacts(pluginHelper.currentPackageId);
    }
    if (!openInNewTab) {
      epvRemove(".cpiHelper_epvOpen");
    }

    if (deployStatus) {
      epvAddRefreshButton();
      // the table loads its rows lazily while scrolling, so ask only for the names not asked for yet
      var missing = epvNames(rows).filter((name) => !epvState.runtimeRequested.has(name));
      // after a failed call wait a minute, otherwise a broken tenant is called every 3 seconds
      if (missing.length > 0 && Date.now() - epvState.runtimeFailedAt > 60000) {
        epvLoadRuntime(missing);
      }
    } else {
      epvRemove(".cpiHelper_epvDeployStatus, .cpiHelper_epvRefresh");
    }

    if (!copyName) {
      epvRemove(".cpiHelper_epvCopy");
    }

    for (var row of rows) {
      epvRenderRow(row, deployStatus, openInNewTab, copyName);
    }
  },
};

function epvRows() {
  return document.querySelectorAll('div[id$="--artifactTable"] tbody tr.sapMListTblRow');
}

function epvName(row) {
  return row.querySelector(".sapMObjectIdentifierTitle")?.textContent.trim();
}

function epvNames(rows = epvRows()) {
  return [...new Set([...rows].map(epvName).filter(Boolean))];
}

function epvRemove(selector) {
  for (var element of document.querySelectorAll(selector)) {
    element.remove();
  }
}

function epvRenderRow(row, deployStatus, openInNewTab, copyName) {
  var nameElement = row.querySelector(".sapMObjectIdentifierTitle");
  if (!nameElement) {
    return;
  }
  var name = nameElement.textContent.trim();

  if (copyName) {
    // copyText shows the toast itself
    epvAddIcon(row, nameElement, "cpiHelper_epvCopy", "copy outline", "Copy the name to the clipboard (CPI Helper)", () => copyText(name));
  }

  if (openInNewTab) {
    var url = epvArtifactUrl(name);
    // without a resolved artifact there is no url to open, so the icon is added once the artifacts are read
    if (url) {
      epvAddIcon(row, nameElement, "cpiHelper_epvOpen", "share square outline", "Open in a new tab (CPI Helper)", () => window.open(url, "_blank"));
    }
  }

  if (deployStatus) {
    epvRenderDeployStatus(row);
  }
}

// the icons sit inside the row and a click on the row navigates to the artifact, so the click must not reach the row
function epvAddIcon(row, nameElement, className, iconName, title, action) {
  if (row.querySelector("." + className)) {
    return;
  }

  var icon = document.createElement("i");
  // "link" gives the fomantic icon the pointer cursor and the hover effect, "small" keeps it below the size of the name
  icon.className = `${iconName} small link icon ${className}`;
  icon.title = title;
  icon.style.marginLeft = "0.4rem";
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

// artifact type of the workspace API -> path segment of the editor url
var epvPaths = {
  IFlow: "integrationflows",
  ValueMapping: "valuemappings",
  ScriptCollection: "scriptcollections",
  MessageMapping: "messagemappings",
  RestAPI: "restapis",
  SoapAPI: "soapapis",
  ODataService: "odataservices",
};

function epvArtifactUrl(name) {
  var packageUrl = window.location.href.match(/^(.*\/contentpackage\/[^/?#]+)/);
  var artifact = epvState.artifactsByName[name];
  var path = artifact ? epvPaths[artifact.type] : null;

  if (!packageUrl || !path) {
    return null;
  }

  return `${packageUrl[1]}/${path}/${encodeURIComponent(artifact.id)}`;
}

// one workspace call at a time, throttled: every caller gets the running call instead of starting a second one
function epvEnsureArtifacts(packageId) {
  if (epvState.artifactsFetching) {
    return epvState.artifactsFetching;
  }
  if (!packageId || Date.now() < epvState.artifactsNextFetchAt) {
    return Promise.resolve();
  }

  epvState.artifactsFetching = epvFetchArtifacts(packageId).finally(() => {
    epvState.artifactsFetching = null;
    // back off when the tenant answered nothing usable, so a package we cannot resolve is not polled every minute
    epvState.artifactsNextFetchAt = Date.now() + (Object.keys(epvState.artifactsByName).length > 0 ? 60000 : 600000);
  });
  return epvState.artifactsFetching;
}

// the design time OData API is not available on every tenant, the workspace API of the web ui is
async function epvFetchArtifacts(packageId) {
  var workspaceUrl = "/" + cpiData.urlExtension + "api/1.0/workspace/";

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

  var artifactResp = await makeCallPromiseV2("GET", `${workspaceUrl}${workspace.id}/artifacts/`, 60, "application/json", null, null, null, false);
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

  epvState.artifactsByName = artifactsByName;
  log.info(`enhancedPackageView: ${Object.keys(artifactsByName).length} artifacts read for package ${packageId}`);
}

// the runtime API of the web ui answers for a single artifact, so only the artifacts of the open package are
// asked for instead of pulling the runtime artifacts of the whole tenant (IntegrationRuntimeArtifacts does not
// support $filter, so the OData way would always mean reading every deployed artifact of the tenant)
function epvRuntimeUrl(artifact) {
  return `/${cpiData.urlExtension}api/1.0/deployedartifacts?bundleType=${epvBundleTypes[artifact.type]}&id=${encodeURIComponent(artifact.id)}&artifactType=${artifact.type}`;
}

// artifact type of the workspace API -> bundle type of the runtime API. no status is asked for and no label is shown
// for a type missing here: message mapping, and script collection, which is deployable but the runtime API does not
// answer for it with "ScriptCollection" as bundle type and the web ui never asks it for one. the type comes from the
// API, not from the type column, so a translated tenant works the same
var epvBundleTypes = {
  IFlow: "IntegrationFlow",
  RestAPI: "IntegrationFlow",
  SoapAPI: "IntegrationFlow",
  ODataService: "IntegrationFlow",
  ValueMapping: "ValueMapping",
};

// how many artifacts are asked for at the same time, a package can hold far more rows than the tenant likes to answer at once
var epvRuntimeParallel = 4;

var epvGreen = "#107e3e";
var epvOrange = "#e9730c";
var epvRed = "#bb0000";

// runtime status -> fomantic label color
var epvStatusColors = {
  STARTED: "green",
  DEPLOYED: "green",
  STARTING: "orange",
  STORED: "orange",
  STOPPED: "grey",
  ERROR: "red",
  NOT_DEPLOYED: "red",
};

// fomantic label color -> icon and light background of the basic label. the background is a tint of the fomantic
// color, so it works on the light and the dark SAP theme
var epvLabelStyles = {
  green: { icon: "check circle", background: "rgba(33, 186, 69, 0.1)" },
  orange: { icon: "exclamation circle", background: "rgba(242, 113, 28, 0.1)" },
  red: { icon: "times circle", background: "rgba(219, 40, 40, 0.1)" },
  grey: { icon: "minus circle", background: "rgba(118, 118, 118, 0.1)" },
};

async function epvLoadRuntime(names, notify = false) {
  // the runtime API asks by id while the table only shows the name, so the workspace call has to be done first
  await epvEnsureArtifacts(cpiData.currentPackageId);

  // mark before awaiting, otherwise the next heartbeat asks for the same names again. names without a resolved
  // artifact stay unmarked on purpose, they are asked for again once the workspace call answered
  var queue = names.filter((name) => !epvState.runtimeRequested.has(name) && epvBundleTypes[epvState.artifactsByName[name]?.type]);
  queue.forEach((name) => epvState.runtimeRequested.add(name));

  if (queue.length === 0) {
    if (notify) {
      showToast("No deployable artifact found in this package", "Deploy status", "info");
    }
    return;
  }

  epvState.runtimeRunning += queue.length;
  epvUpdateRefreshButton();

  // answers of a package that was left in the meantime must not land in the state of the package now open
  var packageKey = epvState.packageKey;

  var pending = queue.slice();
  var failed = 0;

  var worker = async () => {
    var name;
    while ((name = pending.shift())) {
      var entry;
      try {
        entry = await epvFetchRuntime(name);
      } catch (error) {
        // a tenant answering html instead of json must not leave the plugin waiting for this call forever
        log.warn(`enhancedPackageView: reading the deploy status of ${name} failed: ${error}`);
      }

      if (epvState.packageKey !== packageKey) {
        return;
      }

      if (entry === undefined) {
        // nothing was read, so this name must not stay marked as "asked for, nothing found"
        epvState.runtimeRequested.delete(name);
        epvState.runtimeFailedAt = Date.now();
        failed++;
      } else {
        epvState.runtimeByName.set(name, entry);
      }

      epvState.runtimeRunning--;
      epvUpdateRefreshButton();
      // render on every answer, so the labels appear one by one instead of after the last call
      for (var row of epvRows()) {
        epvRenderDeployStatus(row);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(epvRuntimeParallel, queue.length) }, worker));

  // only the manual refresh gets a toast, the fetch on opening a package stays silent
  if (notify) {
    var deployed = queue.filter((name) => epvState.runtimeByName.get(name)?.length > 0).length;
    if (failed === queue.length) {
      showToast("Could not refresh the deploy status, check the log for details", "Deploy status", "error");
    } else {
      showToast(`Deploy status refreshed, ${deployed} of ${queue.length} artifacts are deployed` + (failed > 0 ? `, ${failed} could not be read` : ""), "Deploy status", "success");
    }
  }
}

// the runtime entries of one artifact, one per runtime location it is deployed to, undefined when the call failed
async function epvFetchRuntime(name) {
  var artifact = epvState.artifactsByName[name];

  // useCache false: the refresh button has to see the current state, not the cached one
  var resp = await makeCallPromiseV2("GET", epvRuntimeUrl(artifact), false, "application/json", null, null, null, false);
  if (!resp.successful) {
    log.warn(`enhancedPackageView: could not read the deploy status of ${name}: ${resp.status} ${resp.statusText}`);
    return undefined;
  }

  // one entry per runtime location, an artifact that was never deployed still answers with an entry saying NOT_DEPLOYED
  var entries = JSON.parse(resp.responseText);
  return entries.filter((entry) => entry.deployState && entry.deployState.toUpperCase() !== "NOT_DEPLOYED");
}

function epvUpdateRefreshButton() {
  var button = document.querySelector(".cpiHelper_epvRefresh");
  if (button) {
    button.disabled = epvState.runtimeRunning > 0;
    button.querySelector("i.icon")?.classList.toggle("loading", epvState.runtimeRunning > 0);
  }
}

// refresh button in the toolbar of the artifact list, next to search / sort / filter / group
function epvAddRefreshButton() {
  // UI5 keeps pages that were left hidden in the dom, their search fields included, so only the visible one counts
  var searchField = [...document.querySelectorAll("div.sapMHBox.sapMBarChild .sapMSF")].find((element) => element.offsetParent);
  var toolbar = searchField?.closest("div.sapMHBox.sapMBarChild");
  if (!toolbar || toolbar.querySelector(".cpiHelper_epvRefresh")) {
    return;
  }
  // a button left behind in the toolbar of a hidden page
  epvRemove(".cpiHelper_epvRefresh");

  // the shell of a SAP toolbar button, so it lines up with its neighbours, with the fomantic icon inside
  var button = document.createElement("button");
  button.className = "sapMBtnBase sapMBtn sapUiTinyMarginBegin cpiHelper_epvRefresh";
  button.title = "Refresh deploy status (CPI Helper)";
  button.innerHTML = '<span class="sapMBtnInner sapMBtnHoverable sapMFocusable sapMBtnDefault"><span class="sapMBtnContent"><i class="sync alternate fitted icon"></i></span></span>';
  button.addEventListener("click", () => {
    epvState.runtimeByName = new Map();
    epvState.runtimeRequested = new Set();
    epvState.runtimeFailedAt = 0;
    // the ids may be stale too, the package can have been changed somewhere else since it was opened
    epvState.artifactsNextFetchAt = 0;
    epvLoadRuntime(epvNames(), true);
  });
  toolbar.appendChild(button);
  epvUpdateRefreshButton();
}

// runtime location -> fomantic icon. an integration cell in the cloud is not known yet, it keeps the icon of its status
function epvRuntimeIcon(entry) {
  if (entry.runtimeLocationId === "cloudintegration") {
    return "cloud";
  }
  // the design time profile of an edge integration cell is "edge-<runtime location id>"
  if (entry.additionalProperties?.designTimeProfileId?.startsWith("edge-")) {
    return "server";
  }
  return null;
}

function epvRenderDeployStatus(row) {
  var name = epvName(row);
  var infoElement = row.querySelector(".cntPkgResourceInfoPipes");
  // without an answer for this name "not deployed" would be a guess, so leave the row alone
  if (!name || !infoElement || !epvState.runtimeByName.has(name)) {
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
    return { text: epvStatusLabel(status), color, icon: epvRuntimeIcon(entry) || epvLabelStyles[color].icon, tooltip, versionDiffers };
  });
  if (labels.length === 0) {
    labels.push({ text: "Not deployed", color: "red", icon: epvLabelStyles.red.icon, tooltip: "No deployed runtime artifact found for this artifact", versionDiffers: false });
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
      label.className = `ui basic ${entry.color} label`;
      // sized relative to the text of the info line and with little padding, so the label is not taller than its neighbours
      label.style.cssText = `background: ${epvLabelStyles[entry.color].background}; font-size: 0.8em; padding: 0.15em 0.45em;`;
      label.innerHTML = `<i class="${entry.icon} icon" style="margin: 0 0.3em 0 0;"></i>`;
      label.append(entry.text);
      label.title = entry.tooltip;
      return label;
    }),
  );
}

function epvStatusLabel(status) {
  // NOT_DEPLOYED -> Not deployed
  return status ? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ") : "-";
}

pluginList.push(plugin);
