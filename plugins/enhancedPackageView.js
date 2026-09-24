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
      text: "Every part can be switched on separately. Deploy status: the status is read per artifact from /api/1.0/deployedartifacts, once per artifact of the opened package and then kept until the package is left, the refresh button next to the search field refreshes it; the version column is colored too (green: the deployed version is the current one, orange: the deployed version is older, red: nothing is deployed) and the version and the status label show deployed version, date and user on hover. Open in a new tab: the icon next to the name opens the artifact in a new browser tab, a normal click on the row keeps navigating in the current tab; id and type of the artifacts are read from the workspace API in the background, so the icon appears as soon as the artifact is resolved. Copy the name: the copy icon copies the name of the artifact to the clipboard. Switching a part off removes its icons, the color of the version column stays until the page is reloaded.",
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
      epvAddIcon(row, nameElement, "cpiHelper_epvOpen", "external alternate", "Open in a new tab (CPI Helper)", () => window.open(url, "_blank"));
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
  // "link" gives the fomantic icon the pointer cursor and the hover effect
  icon.className = `${iconName} link icon ${className}`;
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

// artifact type of the workspace API -> bundle type of the runtime API. a type missing here is not deployable on
// its own (script collection, message mapping), so no status is asked for and no label is shown for it. the type
// comes from the API, not from the type column, so a translated tenant works the same
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
    var deployed = queue.filter((name) => epvState.runtimeByName.get(name)).length;
    if (failed === queue.length) {
      showToast("Could not refresh the deploy status, check the log for details", "Deploy status", "error");
    } else {
      showToast(`Deploy status refreshed, ${deployed} of ${queue.length} artifacts are deployed` + (failed > 0 ? `, ${failed} could not be read` : ""), "Deploy status", "success");
    }
  }
}

// the runtime entry of one artifact, null when nothing is deployed, undefined when the call failed
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
  return entries.find((entry) => entry.deployState && entry.deployState.toUpperCase() !== "NOT_DEPLOYED") || null;
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
  if (document.querySelector(".cpiHelper_epvRefresh")) {
    return;
  }

  var toolbar = document.querySelector("div.sapMHBox.sapMBarChild .sapMSF")?.closest("div.sapMHBox.sapMBarChild");
  if (!toolbar) {
    return;
  }

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

function epvRenderDeployStatus(row) {
  var name = epvName(row);
  var infoElement = row.querySelector(".cntPkgResourceInfoPipes");
  // without an answer for this name "not deployed" would be a guess, so leave the row alone
  if (!name || !infoElement || !epvState.runtimeByName.has(name)) {
    return;
  }

  var artifact = epvState.runtimeByName.get(name);
  // deployState says whether the artifact reached the runtime, semanticState whether the flow itself is running
  var status = artifact ? (artifact.semanticState || artifact.deployState || "").toUpperCase() : "NOT_DEPLOYED";
  var versionElement = row.querySelector('td[id$="-cell2"]');
  var designVersion = versionElement?.textContent.trim();
  var versionDiffers = artifact?.version && designVersion && artifact.version !== designVersion;

  // green when the deployed version is the current one, orange when it drifted, red when nothing is deployed
  var versionColor = !artifact ? epvRed : versionDiffers ? epvOrange : epvGreen;

  var tooltip = artifact
    ? [
        `Deployed version: ${artifact.version || "-"}` + (versionDiffers ? ` (design time version: ${designVersion})` : " (current)"),
        `Status: ${epvStatusLabel(status)}`,
        `Deploy state: ${epvStatusLabel((artifact.deployState || "").toUpperCase())}`,
        `Deployed on: ${artifact.deployedOn || "-"}`,
        `Deployed by: ${artifact.deployedBy || "-"}`,
        `Runtime: ${artifact.runtimeLocationName || artifact.runtimeLocationId || "-"}`,
      ].join("\n")
    : "No deployed runtime artifact found for this artifact";

  // a started artifact running an old version is not really green
  var labelColor = versionDiffers && status === "STARTED" ? "orange" : epvStatusColors[status] || "grey";

  // the heartbeat runs every 3 seconds, so touch the dom only when something actually changed
  var label = row.querySelector(".cpiHelper_epvDeployStatus");
  var signature = `${status}|${versionColor}|${labelColor}|${tooltip}`;
  if (label && row.dataset.cpiHelperEpv === signature) {
    return;
  }
  row.dataset.cpiHelperEpv = signature;

  if (versionElement) {
    // in a development package the version is a link, and the link color of the theme beats the color of the cell
    for (var element of [versionElement, ...versionElement.querySelectorAll(".sapMLnk, .sapMLnkText, .sapMText")]) {
      element.style.color = versionColor;
      element.style.fontWeight = "bold";
      // same details as the label, so hovering the version number is enough
      element.title = tooltip;
    }
  }

  if (!label) {
    label = document.createElement("div");
    label.style.marginLeft = "0.5rem";
    label.style.cursor = "help";
    infoElement.appendChild(label);
  }

  label.className = `ui mini ${labelColor} label cpiHelper_epvDeployStatus`;
  // the info icon makes it obvious that hovering the label shows details
  label.innerHTML = '<i class="info circle icon"></i>';
  label.append(artifact ? epvStatusLabel(status) : "Not deployed");
  label.title = tooltip;
}

function epvStatusLabel(status) {
  // NOT_DEPLOYED -> Not deployed
  return status ? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ") : "-";
}

pluginList.push(plugin);
