// ============================================================================
// CPI Helper — content script · bootstrap
// Extracted from scripts/contentScript.js lines 1693-2039 during the
// 2026-05-26 contentScript decomposition refactor. Behaviour unchanged.
// ============================================================================

var oldURL = "";
async function checkURLchange() {
  var currentURL = window.location.href;
  var urlChanged = false;
  if (currentURL != oldURL) {
    urlChanged = true;
    log.log("url changed! to " + currentURL);
    oldURL = currentURL;
    await handleUrlChange();
  }
  oldURL = window.location.href;
  return urlChanged;
}

//this function is fired when the url changes
async function handleUrlChange() {
  //check if powertrace button was on / set correct button status
  await refreshPowerTrace();

  // Reset message sidebar data when URL changes

  lastMessageResponses = [];
  lastCompletedLogStart = getLastCompletedLogStart();

  getPackageId();
  collectDataOfCurrentArtifact();
  await getArtifactFullName();

  //init
  var xsltCount = 0;
  var scriptCount = 0;
  var scriptCollectionCount = 0;
  setDocumentTitle(hostData.title);

  if (cpiData.currentArtifactType == "IFlow") {
    //check type of tenant
    if (!document.location.host.match(cpiTypeRegexp)) {
      cpiData.classicUrl = true;
      cpiData.urlExtension = "itspaces/";
    }
  } else if (cpiData.currentArtifactType == "Script") {
    //iterate plugins and create buttons
    var buttonsForPlugins = await createPluginButtons("scriptButton");
    if (buttonsForPlugins.length > 0) {
      //wait until id is available and then append buttons. Try again and wait if not available
      var interval = setInterval(() => {
        var pluginArea = document.querySelector('span[id$="--scriptPageContainerHeader-identifierLineContainer"]');
        if (!pluginArea) {
          pluginArea = document.querySelector('span[id$="--scriptPageHeaderTitle-identifierLineContainer"]');
        }
        if ((pluginArea && scriptCount > 10) || cpiData.currentArtifactType != "Script") {
          clearInterval(interval);
          scriptCount = 0;
          return;
        }
        buttons = document.getElementsByClassName("cpiHelper_pluginButton_scriptButton");
        if (pluginArea && buttons.length == 0) {
          scriptCount++;
          buttonsForPlugins.forEach((element) => {
            pluginArea.appendChild(element);
          });
        } else {
          scriptCount++;
        }
      }, 1000);
    }
  } else if (cpiData.currentArtifactType == "Script Collection") {
    var buttonsForPlugins = await createPluginButtons("scriptCollectionButton");
    if (buttonsForPlugins.length > 0) {
      //wait until id is available and then append buttons. Try again and wait if not available
      var interval = setInterval(() => {
        var pluginArea = document.querySelector('span[id$="--objectPageHeader-identifierLineContainer"]');
        if ((pluginArea && scriptCollectionCount > 10) || cpiData.currentArtifactType != "Script Collection") {
          clearInterval(interval);
          scriptCollectionCount = 0;
          return;
        }
        buttons = document.getElementsByClassName("cpiHelper_pluginButton_scriptCollectionButton");
        if (pluginArea && buttons.length == 0) {
          scriptCollectionCount++;
          buttonsForPlugins.forEach((element) => {
            pluginArea.appendChild(element);
          });
        } else {
          scriptCollectionCount++;
        }
      }, 1000);
    }
  } else if (cpiData.currentArtifactType == "XSLT") {
    var buttonsForPlugins = await createPluginButtons("xsltButton");
    if (buttonsForPlugins.length > 0) {
      //wait until id is available and then append buttons. Try again and wait if not available
      var interval = setInterval(() => {
        var pluginArea = document.querySelector('span[id$="--resourcePageContainerHeader-identifierLineContainer"]');

        if ((pluginArea && xsltCount > 10) || cpiData.currentArtifactType != "XSLT") {
          clearInterval(interval);
          scriptCollectionCount = 0;
          return;
        }

        buttons = document.getElementsByClassName("cpiHelper_pluginButton_xsltButton");
        if (pluginArea && buttons.length == 0) {
          xsltCount++;
          buttonsForPlugins.forEach((element) => {
            pluginArea.appendChild(element);
          });
        } else {
          xsltCount++;
        }
      }, 1000);
    }
  } else if (cpiData.currentArtifactType == "M_Mapping") {
    var buttonsForPlugins = await createPluginButtons("messageMappingButton");
    if (buttonsForPlugins.length > 0) {
      //wait until id is available and then append buttons. Try again and wait if not available
      var interval = setInterval(() => {
        var pluginArea = document.querySelector('span[id$="--mappingPageHeaderTitle-identifierLineContainer"]');

        if ((pluginArea && xsltCount > 10) || cpiData.currentArtifactType != "M_Mapping") {
          clearInterval(interval);
          scriptCollectionCount = 0;
          return;
        }

        buttons = document.getElementsByClassName("cpiHelper_pluginButton_messageMappingButton");
        if (pluginArea && buttons.length == 0) {
          xsltCount++;
          buttonsForPlugins.forEach((element) => {
            pluginArea.appendChild(element);
          });
        } else {
          xsltCount++;
        }
      }, 1000);
    }
  }
}

//Visited IFlows are stored to show in the popup that appears when pressing the button in browser bar
async function storeVisitedIflowsForPopup() {
  var url = window.location.href;
  var tenant = url.split("/")[2].split(".")[0];
  var name = "visitedIflows_" + tenant;

  for (const dataRegexp of cpiArtifactURIRegexp) {
    if (dataRegexp[0].test(url) === true) {
      let groups = url.match(dataRegexp[0]);
      if (groups.length >= 2) {
        let cpiArtifactId = groups.groups.artifactId;
        chrome.storage.sync.get([name], function (result) {
          var visitedIflows = result[name];

          if (!visitedIflows) {
            visitedIflows = [];
          }

          //filter out the current flow
          if (visitedIflows.length > 0) {
            visitedIflows = visitedIflows.filter((element) => {
              return !(element.name == String(cpiArtifactId) && dataRegexp[1] == element.type);
            });
          }

          let urlext = "";
          if (dataRegexp[1] == "Package" && !document.location.href.includes("?section=ARTIFACTS")) {
            urlext = "?section=ARTIFACTS";
          }

          //put the current flow to the last element. last position indicates last visited element
          visitedIflows.push({
            name: `${cpiArtifactId}`,
            fullName: `${cpiData.currentIflowName}`,
            url: document.location.href + urlext,
            favorit: false,
            type: `${dataRegexp[1]}`,
          });

          //delete the first one when there are more than 15 iflows in visited list
          if (visitedIflows.length > 15) {
            visitedIflows.shift();
          }

          var obj = {};
          obj[name] = visitedIflows;

          chrome.storage.sync.set(obj, function () {});
        });
      }
    }
  }
}

async function refreshPowerTrace() {
  //get last run from store and check if it is less than 11 minutes ago, then reapply trace button status

  var powertraceText = "";

  var objName = `${cpiData.integrationFlowId}_${cpiData.runtimeLocationId}_powertraceLastRefresh`;
  var timeAsStringOrNull = await storageGetPromise(objName);

  if (timeAsStringOrNull != null && timeAsStringOrNull != undefined) {
    var now = new Date().getTime();
    var time = now - parseInt(timeAsStringOrNull);
    if (time != NaN && time < 1000 * 60 * 11) {
      log.debug("update powertrace button status");
      powertraceText = "cpiHelper_powertrace";

      // if button list already exists (e.g. after url change), reapply class to button
      var btn = document.getElementById("button134345-BDI-content");
      if (btn != undefined && !btn.classList.contains("cpiHelper_powertrace")) {
        btn.classList.add("cpiHelper_powertrace");
      }
    }
  } else {
    // if button list already exists (e.g. after url change), reapply class to button
    var btn = document.getElementById("button134345-BDI-content");
    if (btn != undefined && !btn.classList.contains("cpiHelper_powertrace")) {
      btn.classList.remove("cpiHelper_powertrace");
    }
  }

  return powertraceText;
}

//start
checkURLchange();
onInitStatistic();

var nextMessageSidebarRefreshCount = 0;
var lastTabHidden = 0; //counts how long tab is hidden
var lastDurationRefresh = 0; //time for a refresh of the sidebar mostly because of network in ms
var refreshActive = false;

//CPI Helper Heartbeat
setInterval(async function () {
  await checkURLchange(window.location.href);

  //check if sidebar should be deactivated because we are not on a suitable page
  // not allowed type of artifact and buildbutton is not visible then deactivate.
  AllowedTypes = ["IFlow", "ODATA API", "REST API", "SOAP API"].includes(cpiData.currentArtifactType);
  if (!AllowedTypes && sidebar.active && !document.getElementById("__buttonxx")) {
    sidebar.deactivate();
  }

  //add button bar and breadcrumbs if page rendered
  if (AllowedTypes) {
    buildButtonBar();
    addBreadcrumbs();
  }
  // theme information synchronous storage
  const isHtmlDark = document.documentElement.classList.contains("sapUiTheme-sap_horizon_dark");
  if (callChromeStoragePromise("CPIhelperThemeInfo") == isHtmlDark) {
    await syncChromeStoragePromise("CPIhelperThemeInfo", isHtmlDark);
  }
  log.debug("check for button bar");
  try {
    navigationButton();
  } catch (error) {
    log.error(error);
  }

  //new update message sidebar
  if (!refreshActive) {
    nextMessageSidebarRefreshCount--;
  }
  if (refreshActive) {
    log.log("refresh active. Will not refresh message sidebar");
  }

  const autoRefreshEnabled = (await chrome.storage.sync.get(["autoRefreshMessageSidebar"])["autoRefreshMessageSidebar"]) ?? true; // default to true if not set

  //check if message sidebar should be refreshed
  if (autoRefreshEnabled) {
    if (nextMessageSidebarRefreshCount <= 0 || (lastTabHidden > 0 && document.hidden == false)) {
      await refreshMessageSidebar(true);
    }
  }

  //check if trace should be refreshed again
  //check if value in storage exists and time is longer than 9 (overlap) and less than 20 minutes (upper limit in order to not auto-reactivate the trace after a longer break)
  var objName = `${cpiData.integrationFlowId}_${cpiData.runtimeLocationId}_powertraceLastRefresh`;
  var timeAsStringOrNull = await storageGetPromise(objName);
  if (timeAsStringOrNull != null && timeAsStringOrNull != undefined) {
    var now = new Date().getTime();
    var time = now - parseInt(timeAsStringOrNull);
    if (time != NaN && time > 1000 * 60 * 9 && time < 1000 * 60 * 20) {
      log.log("set trace via API call");
      setLogLevel("TRACE", cpiData.integrationFlowId);
      var objectToStore = {};
      objectToStore[objName] = new Date().getTime().toString();
      await storageSetPromise(objectToStore);
    }
  }

  if (document.hidden == true) {
    lastTabHidden++;
    log.debug("tab is hidden ", lastTabHidden);
  } else {
    lastTabHidden = 0;
  }
  if (sidebar.active == false) {
    nextMessageSidebarRefreshCount = 0;
  }

  //run heartbeat function of plugins
  runPluginHeartbeat();
}, 3000);

var refreshbutton = null;
async function refreshMessageSidebar(cache = true) {
  if (!refreshActive && sidebar.active) {
    log.debug("refresh message sidebar");

    //if there is an refresh button, deactivate it
    const refreshBtn = document.getElementById("cpiHelper_sidebar_refresh_icon");
    if (refreshBtn) {
      refreshBtn.classList.add("cpiHelper_sidebar_refresh_icon_spin");
    }

    //count time in ms of reload and rendering of sidebar in ms
    var start = new Date();
    refreshActive = true;
    log.debug("refresh message sidebar");
    try {
      await renderMessageSidebar(cache);
    } catch (err) {
      log.error(err);
    }
    refreshActive = false;
    if (refreshBtn) {
      refreshBtn.classList.add("cpiHelper_sidebar_refresh_icon_inactive");

      //become inactive for 3 seconds
      refreshbutton = setTimeout(() => {
        refreshBtn.classList.remove("cpiHelper_sidebar_refresh_icon_inactive");
        refreshBtn.classList.remove("cpiHelper_sidebar_refresh_icon_spin");
      }, 3000);
    }

    log.debug("refresh message sidebar done");
    var end = new Date();
    lastDurationRefresh = end - start;
    log.debug("refresh message sidebar took " + lastDurationRefresh + "ms");
    nextMessageSidebarRefreshCount = calculateMessageSidebarTimerTime(lastTabHidden, lastDurationRefresh);
  }
}
