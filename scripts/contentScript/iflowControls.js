// ============================================================================
// CPI Helper — content script · iflowControls
// Extracted from scripts/contentScript.js lines 372-457 during the
// 2026-05-26 contentScript decomposition refactor. Behaviour unchanged.
// ============================================================================

async function setLogLevel(logLevel, iflowId) {
  // Use selected runtime location ID
  let selectedRuntimeLocation = cpiData.runtimeLocationId;

  let locID = "";
  if (selectedRuntimeLocation) {
    locID = ', "runtimeLocationId":"' + selectedRuntimeLocation + '"';
  }

  makeCallPromise(
    "POST",
    "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentSetMplLogLevelCommand",
    false,
    null,
    '{"artifactSymbolicName":"' + iflowId + '","mplLogLevel":"' + logLevel.toUpperCase() + '","nodeType":"IFLMAP"' + locID + "}",
    true,
    "application/json;charset=UTF-8"
  )
    .then((res) => {
      showToast("Trace is activated");
      log.log("Trace activated");
    })
    .catch((e) => {
      showToast("Error activating Trace", "", "error");
      log.log("Error activating trace");
    });
}

//undeploy IFlow via API call
async function undeploy(tenant = null, artifactId = null) {
  //to get tenant and artifactid.
  await getIflowInfoExtended();
  tenant ??= cpiData.tenantId;
  artifactId ??= cpiData.artifactUuid;
  edgeExtension = cpiData.runtimeLocationId != "cloudintegration" ? `&runtimeLocationId=${cpiData.runtimeLocationId}` : "";
  makeCallPromise(
    "POST",
    "/" + cpiData.urlExtension + "Operations/com.sap.it.nm.commands.deploy.DeleteContentCommand",
    false,
    null,
    "artifactIds=" + artifactId + "&tenantId=" + tenant + edgeExtension,
    true,
    "application/x-www-form-urlencoded; charset=UTF-8"
  )
    .then((res) => {
      showToast("Undeploy triggered");
      log.log("Undeploy triggered");
      //wait some seconds and update the IFlow information to reflect the undeploy in the extension
      setTimeout(async () => {
        await getIflowInfo(null, true, false);
      }, 10000);
    })
    .catch((e) => {
      log.error("Error triggering undeploy");
      showToast("Error triggering undeploy", "", "error");
    });
}
cpiData.functions.undeploy = undeploy;

// inject breadcrumbs for package if missing
function addBreadcrumbs() {
  const breadcrumbsNav = document.querySelector('nav[id*="breadcrumbs"]');
  if (!breadcrumbsNav) return;
  const ol = breadcrumbsNav.querySelector("ol");
  if (!ol) return;
  const crumbs = ol.querySelectorAll("li");
  if (crumbs.length === 1) {
    const regex = /(.+\/contentpackage\/)(.+?)\/.*/;
    const url = document.location.href;
    var regexMatch;
    var packageUrl;
    var packageName;
    if ((regexMatch = regex.exec(url)) !== null) {
      packageUrl = regexMatch[1] + regexMatch[2] + "?section=ARTIFACTS";
      packageUrl = regexMatch[1] + regexMatch[2];
      if (!packageUrl.includes("?section=ARTIFACTS")) {
        packageUrl += "?section=ARTIFACTS";
      }
      packageName = regexMatch[2];
    }
    const newLi = createElementFromHTML(`<li class="sapMBreadcrumbsItem"><a href="${packageUrl}" tabindex="0" class="sapMLnk sapMLnkMaxWidth">${packageName}</a><span class="sapMBreadcrumbsSeparator">/</span></li>`);
    crumbs[0].insertAdjacentElement("afterbegin", newLi);
  }
}

//injected buttons are created here
