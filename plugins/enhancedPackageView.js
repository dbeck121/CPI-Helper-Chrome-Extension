// state of the package view: id and type of the artifacts of the open package (the table only shows the name,
// while the editor url needs the id), the runtime artifacts for the deploy status and the housekeeping of both calls
var epvState = { packageKey: null, artifactsByName: {}, artifactsFetching: false, artifactsNextFetchAt: 0, runtimeByName: null, runtimeRequested: new Set(), runtimeFetching: null, runtimeFailedAt: 0 };

var plugin = {
  metadataVersion: "1.0.0",
  id: "enhancedPackageView",
  name: "Enhanced Package View",
  version: "1.0.0",
  author: "Alexander Aigner",
  email: "alexander.aigner@snapconsult.com",
  website: "https://www.linkedin.com/in/alexander-aigner-at/",
  description: "Adds the deployment status and two small icons (open in a new tab, copy the name) to the artifact list of a package.",

  settings: {
    info: {
      text: "Every part can be switched on separately. Deploy status: the status is read from /api/v1/IntegrationRuntimeArtifacts, once per opened package and then kept until the package is left, the ⟳ button next to the search field refreshes it; the version column is colored too (green: the deployed version is the current one, orange: the deployed version is older, red: nothing is deployed) and the version and the ⓘ badge show deployed version, date and user on hover. Open in a new tab: the ↗ icon next to the name opens the artifact in a new browser tab, a normal click on the row keeps navigating in the current tab; id and type of the artifacts are read from the workspace API in the background, so the icon appears as soon as the artifact is resolved. Copy the name: the ⧉ icon copies the name of the artifact to the clipboard. Switching a part off removes its icons, the color of the version column stays until the page is reloaded.",
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
      epvState.runtimeByName = null;
      epvState.runtimeRequested = new Set();
    }

    if (deployStatus) {
      epvAddRefreshButton();
      // the table loads its rows lazily while scrolling, so ask only for the names not asked for yet
      var missing = epvNames(rows).filter((name) => !epvState.runtimeRequested.has(name));
      if (missing.length > 0) {
        if (epvState.runtimeByName) {
          // one call returns the whole tenant, so rows scrolled in later are in the map already
          missing.forEach((name) => epvState.runtimeRequested.add(name));
        } else if (Date.now() - epvState.runtimeFailedAt > 60000) {
          // after a failed call wait a minute, otherwise a broken tenant is called every 3 seconds
          epvLoadRuntime(missing);
        }
      }
    } else {
      epvRemove(".cpiHelper_epvDeployStatus, .cpiHelper_epvRefresh");
    }

    // read the artifacts in the background, the icon must not wait for a request
    if (openInNewTab && pluginHelper.currentPackageId && !epvState.artifactsFetching && Date.now() > epvState.artifactsNextFetchAt) {
      epvState.artifactsFetching = true;
      epvFetchArtifacts(pluginHelper.currentPackageId).finally(() => {
        epvState.artifactsFetching = false;
        // back off when the tenant answered nothing usable, so a package we cannot resolve is not polled every minute
        epvState.artifactsNextFetchAt = Date.now() + (Object.keys(epvState.artifactsByName).length > 0 ? 60000 : 600000);
      });
    } else if (!openInNewTab) {
      epvRemove(".cpiHelper_epvOpen");
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
    epvAddIcon(row, nameElement, "cpiHelper_epvCopy", "⧉", "Copy the name to the clipboard (CPI Helper)", () => copyText(name));
  }

  if (openInNewTab) {
    var url = epvArtifactUrl(name);
    // without a resolved artifact there is no url to open, so the icon is added once the artifacts are read
    if (url) {
      epvAddIcon(row, nameElement, "cpiHelper_epvOpen", "↗", "Open in a new tab (CPI Helper)", () => window.open(url, "_blank"));
    }
  }

  if (deployStatus) {
    epvRenderDeployStatus(row);
  }
}

// the icons sit inside the row and a click on the row navigates to the artifact, so the click must not reach the row
function epvAddIcon(row, nameElement, className, glyph, title, action) {
  if (row.querySelector("." + className)) {
    return;
  }

  var icon = document.createElement("span");
  icon.className = className;
  icon.textContent = glyph;
  icon.title = title;
  icon.style.cssText = "margin-left:0.4rem;cursor:pointer;opacity:0.7;";
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

// only the fields the badge and the tooltip use, the default entity is several times bigger.
// the whole list is read on purpose: IntegrationRuntimeArtifacts does not support $filter, a
// "$filter=Name eq '...'" is answered with 400 on CF, so filtering by the names of the open package
// is not possible. $select works and keeps the response small
var epvRuntimeUrl = "/api/v1/IntegrationRuntimeArtifacts?$format=json&$select=Id,Name,Version,Status,DeployedBy,DeployedOn";

// artifact types that can be deployed. only used to decide whether "not deployed" may be shown,
// so a translated tenant just shows nothing instead of a wrong badge
var epvDeployableTypes = ["integration flow", "value mapping", "rest api", "soap api", "odata api", "odata service"];

var epvGreen = "#107e3e";
var epvOrange = "#e9730c";
var epvRed = "#bb0000";

var epvStatusColors = {
  STARTED: epvGreen,
  STARTING: epvOrange,
  STOPPED: "#6a6d70",
  ERROR: epvRed,
  NOT_DEPLOYED: epvRed,
};

async function epvLoadRuntime(names, notify = false) {
  if (epvState.runtimeFetching) {
    return epvState.runtimeFetching;
  }

  var button = document.querySelector(".cpiHelper_epvRefresh");
  if (button) button.disabled = true;

  // mark before awaiting, otherwise the next heartbeat asks for the same names again
  for (var name of names) {
    epvState.runtimeRequested.add(name);
  }

  var count = null;
  try {
    epvState.runtimeFetching = epvFetchRuntime(names);
    count = await epvState.runtimeFetching;
  } catch (error) {
    // a tenant answering html instead of json must not leave the plugin waiting for this call forever
    log.warn("enhancedPackageView: reading the runtime artifacts failed: " + error);
  } finally {
    epvState.runtimeFetching = null;
  }

  if (count === null) {
    // nothing was read, so these names must not stay marked as "asked for, nothing found"
    for (var failedName of names) {
      epvState.runtimeRequested.delete(failedName);
    }
    epvState.runtimeFailedAt = Date.now();
  }

  if (button) button.disabled = false;
  for (var row of epvRows()) {
    epvRenderDeployStatus(row);
  }

  // only the manual refresh gets a toast, the fetch on opening a package stays silent
  if (notify) {
    if (count === null) {
      showToast("Could not refresh the deploy status, check the log for details", "Deploy status", "error");
    } else {
      showToast(`Deploy status refreshed, ${count} of ${names.length} artifacts are deployed`, "Deploy status", "success");
    }
  }
}

// returns how many of the given names have a runtime artifact, or null when nothing could be read
async function epvFetchRuntime(names) {
  var byName = epvState.runtimeByName || new Map();

  // useCache false: the refresh button has to see the current state, not the cached one
  var resp = await makeCallPromiseV2("GET", epvRuntimeUrl, false, "application/json", null, null, null, false);
  if (!resp.successful) {
    log.warn("enhancedPackageView: could not read runtime artifacts: " + resp.status + " " + resp.statusText);
    return null;
  }

  for (var artifact of JSON.parse(resp.responseText).d?.results || []) {
    // the artifact list shows the name, but id and name are identical in most packages, so index both
    if (artifact.Name) byName.set(artifact.Name, artifact);
    if (artifact.Id) byName.set(artifact.Id, artifact);
  }

  epvState.runtimeByName = byName;
  // this call returns the whole tenant, so count only what was asked for
  return names.filter((name) => byName.has(name)).length;
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

  var button = document.createElement("button");
  button.className = "sapMBtnBase sapMBtn sapUiTinyMarginBegin cpiHelper_epvRefresh";
  button.title = "Refresh deploy status (CPI Helper)";
  // no SAP icon font character, the glyph keeps working if the icon font is not loaded
  button.innerHTML = '<span class="sapMBtnInner sapMBtnHoverable sapMFocusable sapMBtnDefault"><span class="sapMBtnContent">⟳</span></span>';
  button.addEventListener("click", () => {
    epvState.runtimeByName = null;
    epvState.runtimeRequested = new Set();
    epvState.runtimeFailedAt = 0;
    epvLoadRuntime(epvNames(), true);
  });
  toolbar.appendChild(button);
}

function epvRenderDeployStatus(row) {
  var name = epvName(row);
  var typeElement = row.querySelector('td[id$="-cell1"]');
  var infoElement = row.querySelector(".cntPkgResourceInfoPipes");
  if (!name || !typeElement || !infoElement || !epvState.runtimeByName) {
    return;
  }

  var artifact = epvState.runtimeByName.get(name);
  var deployable = epvDeployableTypes.includes(typeElement.textContent.trim().toLowerCase());
  // without a finished call for this name "not deployed" would be a guess, so leave the row alone
  if (!artifact && (!deployable || !epvState.runtimeRequested.has(name))) {
    return;
  }

  var status = artifact ? (artifact.Status || "").toUpperCase() : "NOT_DEPLOYED";
  var versionElement = row.querySelector('td[id$="-cell2"]');
  var designVersion = versionElement?.textContent.trim();
  var versionDiffers = artifact?.Version && designVersion && artifact.Version !== designVersion;

  // green when the deployed version is the current one, orange when it drifted, red when nothing is deployed
  var versionColor = !artifact ? epvRed : versionDiffers ? epvOrange : epvGreen;

  var tooltip = artifact
    ? [
        `Deployed version: ${artifact.Version || "-"}` + (versionDiffers ? ` (design time version: ${designVersion})` : " (current)"),
        `Status: ${epvStatusLabel(status)}`,
        `Deployed on: ${artifact.DeployedOn || "-"}`,
        `Deployed by: ${artifact.DeployedBy || "-"}`,
      ].join("\n")
    : "No deployed runtime artifact found for this name";

  // the heartbeat runs every 3 seconds, so touch the dom only when something actually changed
  var badge = row.querySelector(".cpiHelper_epvDeployStatus");
  var signature = `${status}|${versionColor}|${tooltip}`;
  if (badge && row.dataset.cpiHelperEpv === signature) {
    return;
  }
  row.dataset.cpiHelperEpv = signature;

  if (versionElement) {
    // in a development package the version is a link, and the link color of the theme beats the color of the cell
    for (var element of [versionElement, ...versionElement.querySelectorAll(".sapMLnk, .sapMLnkText, .sapMText")]) {
      element.style.color = versionColor;
      element.style.fontWeight = "bold";
      // same details as the badge, so hovering the version number is enough
      element.title = tooltip;
    }
  }

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "cpiHelper_epvDeployStatus";
    badge.style.marginLeft = "0.5rem";
    badge.style.fontWeight = "bold";
    badge.style.fontSize = "0.8rem";
    badge.style.cursor = "help";
    infoElement.appendChild(badge);
  }

  // the circled i makes it obvious that hovering the badge shows details
  badge.textContent = (artifact ? epvStatusLabel(status) : "Not deployed") + " ⓘ";
  // a started artifact running an old version is not really green
  badge.style.color = versionDiffers && status === "STARTED" ? epvOrange : epvStatusColors[status] || "#6a6d70";
  badge.title = tooltip;
}

function epvStatusLabel(status) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

pluginList.push(plugin);
