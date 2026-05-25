// ============================================================================
// CPI Helper — content script · artifactContext
// Extracted from scripts/contentScript.js lines 1611-1692 during the
// 2026-05-26 contentScript decomposition refactor. Behaviour unchanged.
// ============================================================================

//function to get the current artifact name from the URL
function collectDataOfCurrentArtifact() {
  var url = window.location.href;
  var result;
  var artifactType;

  //try {
  let groups = "";

  for (const dataRegexp of cpiArtifactURIRegexp) {
    if (dataRegexp[0].test(url) === true) {
      groups = url.match(dataRegexp[0]).groups;
      result = groups.artifactId;
      artifactType = dataRegexp[1];
    }
  }

  if (result != undefined) {
    log.log("Current Artifact: " + artifactType + ": " + result);
    cpiData.integrationFlowId = result; //set integration flow id for legacy reasons
    cpiData.currentArtifactId = result;
    cpiData.currentArtifactType = artifactType;

    if (artifactType == "IFlow") {
      cpiData.currentIflowId = result;
    }
  } else {
    cpiData.integrationFlowId = document.location.pathname.replace("/", "");
    cpiData.currentIflowId = null;
    cpiData.currentArtifactId = null;
    cpiData.currentArtifactType = null;

    log.log("no artifact found", result);
  }
  return result;
}

async function getArtifactFullName() {
  // Get Artifact full name: After page load, wait for the Iflow/package name field to be present in the DOM and extract the full name from it.
  let executionCount = 0;
  let artifactName = undefined;

  const intval2 = setInterval(() => {
    executionCount++;

    artifactName = document.querySelectorAll(".sapUxAPObjectPageHeaderTitleText");
    artifactName = artifactName[artifactName.length - 1]?.innerText; // get last element since some pages contain a hidden, first, page header with wrong text in it.

    if (artifactName != undefined || executionCount >= 30) {
      // Stop the interval once the element is found or after ~30 seconds if not found (then it will use the ID for the history instead)
      clearInterval(intval2); // stop interval
      // get full names if present
      cpiData.currentIflowName = artifactName;
      cpiData.lastVisitedIflowName = artifactName;
      storeVisitedIflowsForPopup(); // store the artifact full name and ID to the history
    }
  }, 1000); // Check every 1s if field is present in DOM (DOMContentLoaded event listener didn't work)

  return artifactName;
}

function getPackageId() {
  var url = window.location.href;
  var result;
  //try {
  let groups = "";
  if (cpiCollectionURIRegexp.test(url) === true) {
    groups = url.match(cpiCollectionURIRegexp).groups;
    result = groups.artifactId;
  }
  if (result != undefined) {
    log.log("Found Package: " + result);
    cpiData.currentPackageId = result;
    cpiData.lastVisitedPackageId = result;
  } else {
    cpiData.currentPackageId = null;
    log.log("no package found");
  }
  return result;
}

//we have to check for url changes to deactivate sidebar and to inject buttons, when on iflow site.
