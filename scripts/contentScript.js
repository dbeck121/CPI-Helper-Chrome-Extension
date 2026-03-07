//GNU GPL v3
//Please visit our github page: https://github.com/dbeck121/CPI-Helper-Chrome-Extension

//cpiData stores data for this extension and is provided as context element for plugins
var cpiData = {};

//initialize used elements
cpiData.messageSidebar = {};
cpiData.messageSidebar.lastMessageHashList = [];
cpiData.integrationFlowId = "";
cpiData.tenant = document.location.host;
cpiData.urlExtension = "";
cpiData.runtimePathExtension = "";
cpiData.classicUrl = false;
cpiData.functions = {};
cpiData.functions["popup"] = showBigPopup;
cpiData.isEdge = false;
cpiData.runtimeLocationId = "";
cpiData.runtimeLocations = [];
cpiData.runtimeLocationWithActiveIFlow = [];
let regexGetPlatform = /cfapps/;
let regexMatch = regexGetPlatform.exec(document.location.host);
cpiData.cpiPlatform = regexMatch !== null ? "cf" : "neo";

cpiArtifactURIRegexp = [
  //Artifacts
  [/\/integrationflows\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "IFlow"],
  [/\/odataservices\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "ODATA API"],
  [/\/restapis\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "REST API"],
  [/\/soapapis\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "SOAP API"],
  [/\/valuemappings\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "Value Mapping"],
  [/\/scriptcollections\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "Script Collection"],
  [/\/messagemappings\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "Message Mapping"],
  //resources
  [/\/resources\/mapping\/(?<artifactId>[0-9a-zA-Z_\-.]+\.mmap?)/, "M_Mapping"],
  [/\/resources\/mapping\/(?<artifactId>[0-9a-zA-Z_\-.]+\.opmap?)/, "Operation Mapping"],
  [/\/resources\/script\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "Script"],
  [/\/resources\/mapping\/(?<artifactId>[0-9a-zA-Z_\-.]+\.xslt?)/, "XSLT"],
  //packages
  [/\/contentpackage\/(?<artifactId>[0-9a-zA-Z_\-.]+)\/?(\?.*)?$/, "Package"],
];

var cpiTypeRegexp = /^[^\/]*\.integrationsuite(-trial)?.*/;

var cpiCollectionURIRegexp = /\/contentpackage\/(?<artifactId>[0-9a-zA-Z_\-.]+)/;
var cpiIflowUriRegexp = /\/integrationflows\/(?<artifactId>[0-9a-zA-Z_\-.]+)/;

cpiData.functions.openTrace = openTrace;

//refresh the logs in message window
var getLogsTimer;
var activeInlineItem;

//fill the message sidebar
var lastResponses = [];
function getLastCompletedLogStart() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().substring(0, 19);
}

/*
Render Message Sidebar;
*/
var lastCompletedLogStart = getLastCompletedLogStart();
async function renderMessageSidebar() {
  if (!sidebar.active) {
    return;
  }

  var numberEntries = hostData.count || 10;
  var createRow = function (elements, trClass) {
    var tr = document.createElement("tr");
    tr.className = trClass;
    elements.forEach((element) => {
      let td = document.createElement("td");
      elements.length == 1 ? (td.colSpan = 3) : null;
      typeof element == "object" ? td.appendChild(element) : (td.innerHTML = element);
      tr.appendChild(td);
    });
    return tr;
  };

  //check if iflowid exists
  iflowId = cpiData.integrationFlowId;
  if (!iflowId) {
    return;
  }

  await getIflowInfo((data) => {
    let deploymentText = document.getElementById("deploymentText");
    if (deploymentText) {
      let statusColor = getStatusColorCode(cpiData?.flowData?.artifactInformation?.deployState);
      deploymentText.innerHTML = `<span style="color:${statusColor}">${cpiData?.flowData?.artifactInformation?.deployState}</span>`;
    }
  }, true);

  var resp = null;
  try {
    //24-04-2024, On some tenants there are Retry messages hanging without any LogStart and LogEnd date and SAP is unable to discard them, these msgs stops CPI helper to display messages in popup ,using a timestamp from long back helpsso using date from 1900
    var responseText = await makeCallPromise(
      "GET",
      "/" +
        cpiData.urlExtension +
        cpiData.runtimePathExtension +
        "odata/api/v1/MessageProcessingLogs?$filter=IntegrationFlowName eq '" +
        iflowId +
        "' and LogStart gt datetime'" +
        lastCompletedLogStart +
        "' and Status ne 'DISCARDED'&$top=" +
        numberEntries +
        "&$format=json&$orderby=LogEnd desc&$select=Status,LogEnd,LogStart,MessageGuid,LogLevel,AlternateWebLink"
    );

    resp = JSON.parse(responseText);

    const newMessageGuids = new Set(resp.d.results.map((item) => item.MessageGuid));
    const filteredLastResponses = lastResponses.filter((item) => !newMessageGuids.has(item.MessageGuid));

    // Combine arrays without duplicates
    resp = [...resp.d.results, ...filteredLastResponses].slice(0, numberEntries);
    lastResponses = resp;
  } catch (e) {
    log.error("There was a faulty message from CI-API. CPI Helper will ignore it: " + e);
  }
  //    document.getElementById('iflowName').innerText = cpiData.integrationFlowId;

  let updatedText = document.getElementById("cpiHelper_sidebar_refresh_text");

  if (updatedText) {
    if (cpiData.runtimeLocationId && cpiData.runtimeLocationId !== "cloudintegration" && cpiData.runtimeLocationWithActiveIFlow.length == 1) {
      updatedText.innerHTML = "Runtime: " + cpiData.runtimeLocationId + "<br>Update: " + new Date().toLocaleTimeString("de-DE");
    } else {
      // hide runtime info when only cloudintegration is available
      updatedText.innerHTML = "Update: " + new Date().toLocaleTimeString("de-DE");
    }
  }

  // Refresh-Button Event
  const refreshBtn = document.getElementById("cpiHelper_sidebar_refresh_icon");

  refreshBtn.onclick = async () => {
    // check if not cpiHelper_sidebar_refresh_icon_inactive
    if (refreshBtn.classList.contains("cpiHelper_sidebar_refresh_icon_spin")) {
      return;
    }
    await refreshMessageSidebar();
  };

  let thisMessageHash = "";
  if (resp && resp.length != 0) {
    //stores information for this run to be used with plugin engine
    var runInfoElement = {};
    thisMessageHash = resp[0].MessageGuid + resp[0].LogStart + resp[0].LogEnd + resp[0].Status;

    try {
      if (thisMessageHash != cpiData.messageSidebar.lastMessageHashList[0]) {
        let thisMessageHashList = [];

        let messageList = document.getElementById("messageList");
        messageList.innerHTML = "";
        var lastDay;

        //display few :
        // var count = parseInt(document.querySelector("head > meta[name='cpi-count']") !== null ? document.querySelector("head > meta[name='cpi-count']").content : resp.length);

        for (var i = 0; i < resp.length; i++) {
          //var logStart = resp[i].LogStart == null ? "-" : resp[i].LogStart;

          var logStart = new Date(parseInt(resp[i].LogStart.match(/\d+/)[0]));
          var logStartFormatted = logStart.toISOString().substring(0, 19);
          var logEnd = new Date(parseInt(resp[i].LogEnd.match(/\d+/)[0]));
          var status = resp[i].Status;

          if (status != "PROCESSING" && logStartFormatted > lastCompletedLogStart) {
            lastCompletedLogStart = logStartFormatted;
          }

          thisMessageHashList.push(resp[i].MessageGuid + resp[i].LogStart + resp[i].LogEnd + resp[i].Status);
          runInfoElement[thisMessageHash] = {};
          runInfoElement[thisMessageHash].messageHash = resp[i].MessageGuid + resp[i].LogStart + resp[i].LogEnd + resp[i].Status;
          runInfoElement[thisMessageHash].messageGuid = resp[i].MessageGuid;
          runInfoElement[thisMessageHash].logStart = logStart;
          runInfoElement[thisMessageHash].logEnd = logEnd;
          runInfoElement[thisMessageHash].status = status;
          runInfoElement[thisMessageHash].message = resp[i].LogLevel;

          //write date if necessary
          let date = new Date(parseInt(resp[i].LogEnd.match(/\d+/)[0]));

          //add offset to utc time. The offset is not correct anymore but isostring can be used to show local time
          date.setTime(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
          runInfoElement[thisMessageHash].timeZoneOffset = date.getTimezoneOffset();
          date = date.toISOString();

          if (date.substr(0, 10) != lastDay) {
            messageList.appendChild(createRow([date.substr(0, 10)], "contentText"));
            lastDay = date.substr(0, 10);
          }

          //flash animation for new elements
          let flash = "";
          if (cpiData.messageSidebar.lastMessageHashList.length != 0 && !cpiData.messageSidebar.lastMessageHashList.includes(thisMessageHashList[i])) {
            flash = " flash";
          }
          let loglevel = resp[i].LogLevel.toLowerCase();
          // logLevel[0] = logLevel[0].toUpperCase();
          runInfoElement[thisMessageHash].logLevel = loglevel;

          let traceButton = createElementFromHTML(`<button title='jump to trace page' id='trace--${i}' class='${resp[i].MessageGuid} ${flash}'>${loglevel.substr(0, 1).toUpperCase()}</button>`);

          if (loglevel.toLowerCase() === "trace") {
            var quickInlineTraceButton = createElementFromHTML(
              `<button title='activate inline trace for debugging'  id='inlinetrace--${i}' class='${resp[i].MessageGuid} ${flash} cpiHelper_inlineInfo-button'><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>`
            );
          } else {
            var quickInlineTraceButton = createElementFromHTML("<span />");
          }

          let infoButton = createElementFromHTML(
            `<button title='show logs in new tab' id='info--${i}' class='${
              cpiData.urlExtension && !resp[i].AlternateWebLink.replace("https://", "").match(cpiTypeRegexp) ? resp[i].AlternateWebLink.replace("443/shell", "443/" + cpiData.urlExtension + "shell") : resp[i].AlternateWebLink
            } ${flash}'><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>`
          );

          let logButton = createElementFromHTML(
            `<button title='show log viewer on this page' id='logs--${i}' class='${resp[i].MessageGuid} ${flash}'><span data-sap-ui-icon-content=\"\" class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>`
          );

          //let listItem = document.createElement("div");
          //listItem.classList.add("cpiHelper_messageListItem")
          let statusColor = getStatusColorCode(resp[i].Status);
          let statusIcon = "xe05b";
          if (resp[i].Status == "PROCESSING") {
            statusIcon = "xe047";
          }
          if (resp[i].Status == "FAILED") {
            statusIcon = "xe03e";
          }
          if (resp[i].Status.match(/^(ESCALATED|RETRY)$/)) {
            statusIcon = "xe201";
          }
          if (resp[i].Status.match(/^(CANCELLED|ABANDONED)$/)) {
            statusIcon = "xe23e";
          }

          //listItem.style["color"] = statusColor;

          activeInlineItem == quickInlineTraceButton.classList[0] && quickInlineTraceButton.classList.add("cpiHelper_inlineInfo-active");

          let statusicon = createElementFromHTML(
            `<button title='Status Details' class='cpiHelper_inlineInfo-button'><span data-sap-ui-icon-content='&#${statusIcon}' class='${resp[i].MessageGuid}` +
              " sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem; color:" +
              `${statusColor}'></span>` +
              //timeButton here
              `<span style='color:${statusColor};padding-inline-start:0.3em'>${date.substr(11, 8)}</span></button>`
          );

          statusicon.onclick = async (e) => {
            if (e.currentTarget.classList.contains("cpiHelper_sidebar_iconbutton")) {
              $(".ui.toast").toast("close");
              e.currentTarget.classList.remove("cpiHelper_sidebar_iconbutton");
            } else {
              document.querySelectorAll(".cpiHelper_sidebar_iconbutton").forEach((i) => i.classList.remove("cpiHelper_sidebar_iconbutton"));
              apireserror(e.currentTarget.parentNode.parentNode.className);
              e.currentTarget.classList.add("cpiHelper_sidebar_iconbutton");
            }
          };

          quickInlineTraceButton.onmouseup = async (e) => {
            var mytarget = e.currentTarget;
            if (activeInlineItem == e.currentTarget.parentNode.parentNode.className) {
              hideInlineTrace();
              showToast("Inline-Debugging Deactivated");
            } else {
              hideInlineTrace();
              var inlineTrace = await showInlineTrace(e.currentTarget.parentNode.parentNode.className);
              if (inlineTrace) {
                statistic("messagebar_btn_inlinetrace_click");
                showToast("Inline-Debugging Activated");
                mytarget.classList.add("cpiHelper_inlineInfo-active");
                activeInlineItem = mytarget.parentNode.parentNode.className;
              } else {
                activeInlineItem = null;
                showToast("No data found.", "Inline debugging not possible", "warning");
              }
            }
          };

          var pluginButtons = await createPluginButtonsInMessageSidebar(runInfoElement[thisMessageHash], i, flash);

          //timebutton merged in statusicon.
          messageList.appendChild(createRow([statusicon, logButton, infoButton, traceButton, quickInlineTraceButton, ...pluginButtons], resp[i].MessageGuid));
          infoButton.addEventListener("click", (a) => {
            statistic("messagebar_btn_info_click");
            let url = a.currentTarget.classList[0];
            if (url.match(cpiTypeRegexp)) {
              url = url.replace("/itspaces", "");
            }
            window.open(url, "_blank");
          });

          logButton.addEventListener("click", async (a) => {
            statistic("messagebar_btn_logs_click");
            await showBigPopup(await createContentNodeForLogs(a.currentTarget.classList[0], false), "Logs");
          });

          traceButton.addEventListener("click", (a) => {
            statistic("messagebar_btn_trace_click");
            openTrace(a.currentTarget.classList[0]);
          });

          cpiData.messageSidebar.lastMessageHashList = thisMessageHashList;
        }
      }
    } catch (e) {
      log.error("There was an error when processing the log entries. Process aborted. " + e);
    }
  }
  await messageSidebarPluginContent();
}

function calculateMessageSidebarTimerTime(lastTabHidden, lastDurationRefresh) {
  var messageSidebarTimerTime = 5;

  //if tab hidden for a long time, set timer to 60 seconds
  if (lastTabHidden > 5) {
    log.log("Tab is hidden, set timer to 2.5 minutes");
    return 50;
  }

  if (lastDurationRefresh > 2000) {
    log.debug("Last rendering took more than 2000ms, set timer to 90 seconds");
    messageSidebarTimerTime = 30;
    return messageSidebarTimerTime;
  }
  if (lastDurationRefresh > 1000) {
    log.debug("Last rendering took more than 1000ms, set timer to 60 seconds");
    messageSidebarTimerTime = 20;
    return messageSidebarTimerTime;
  }
  if (lastDurationRefresh > 700) {
    log.debug("Last rendering took more than 700ms, set timer to 30 seconds");
    messageSidebarTimerTime = 10;
    return messageSidebarTimerTime;
  }
  if (lastDurationRefresh > 500) {
    log.debug("Last rendering took more than 500ms, set timer to 21 seconds");
    messageSidebarTimerTime = 7;
    return messageSidebarTimerTime;
  }

  log.debug("Set timer to " + messageSidebarTimerTime + " counts");
  return messageSidebarTimerTime;
}

//makes a http call to set the log level to trace
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
function undeploy(tenant = null, artifactId = null) {
  tenant ??= cpiData.tenantId;
  artifactId ??= cpiData.artifactId;
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
    })
    .catch((e) => {
      log.error("Error triggering undeploy");
      showToast("Error triggering undeploy", "", "error");
    });
}
cpiData.functions.undeploy = undeploy;

// inject breadcrumbs for package if missing
function addBreadcrumbs() {
  const crumbs = $('nav[id*="breadcrumbs"]').find("ol:first-child").find("li");
  if (crumbs) {
    if (crumbs.length == 1) {
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
      const newLi = $(`<li class="sapMBreadcrumbsItem"><a href="${packageUrl}" tabindex="0" class="sapMLnk sapMLnkMaxWidth">${packageName}</a><span class="sapMBreadcrumbsSeparator">/</span></li>`);
      crumbs.prepend(newLi);
    }
  }
}

//injected buttons are created here
var powertrace = null;
var recrutingTimerSet = false;

// Function to update runtime location dropdown options
function updateRuntimeLocationDropdown(traceDropdownMenu = null) {
  if (!traceDropdownMenu) {
    traceDropdownMenu = document.getElementById("__trace_dropdown_menu");
  }
  if (!traceDropdownMenu) {
    return; // Dropdown not yet created
  }

  // Determine default selection if not set
  let currentSelection = cpiData.runtimeLocationId;

  // Rebuild dropdown items
  let dropdownItems = "";
  if (cpiData.runtimeLocationWithActiveIFlow && cpiData.runtimeLocationWithActiveIFlow.length > 0) {
    cpiData.runtimeLocationWithActiveIFlow.forEach((location) => {
      const isSelected = location.id === currentSelection;
      const checkmark = isSelected ? "✓ " : "&nbsp;&nbsp;";
      dropdownItems += `<div class="__trace_dropdown_item" data-location-id="${location.id}" style="padding: 4px 10px; cursor: pointer; font-size: 13px; ${isSelected ? "background: #e3f2fd; font-weight: bold;" : ""}">${checkmark}${location.id}</div>`;
    });
  } else {
    dropdownItems = `<div class="__trace_dropdown_item" style="padding: 4px 10px; cursor: default; font-size: 13px; color: #888;">No runtime locations</div>`;
  }

  traceDropdownMenu.innerHTML = dropdownItems;
  log.debug("Runtime location dropdown updated");
}

// Make update function globally accessible
cpiData.functions.updateRuntimeLocationDropdown = updateRuntimeLocationDropdown;

async function buildButtonBar() {
  //check if the header object is ready
  let area = document.querySelector("[id*='--iflowObjectPageHeader-actions']");
  if (!area) {
    area = document.querySelector(".sapUxAPObjectPageHeaderIdentifierActions");
  }

  if (!area) {
    log.error("header object not ready");
    return;
  }

  try {
    var headerBar = document.querySelector("[id*='--iflowObjectPageHeader-identifierLine']");
    headerBar.style.overflow = "visible";
  } catch (e) {
    log.error("error when trying to set padding-bottom of headerbar");
  }

  // Load runtime location info before creating dropdown
  await getIflowInfo(null, true, true);

  // get status of powertrace button
  var powertraceText = await refreshPowerTrace();
  if (!document.getElementById("__buttonxx")) {
    whatsNewCheck();

    //timer for recruiting popup in some seconds
    if (recrutingTimerSet == false) {
      setTimeout(() => {
        //     recrutingPopup();
      }, 600000);
      recrutingTimerSet = true;
    }

    // Create More button
    var moreButton = createElementFromHTML(
      `<button id="__more_button" title="More Options" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right; margin-left: 0px;">
        <span class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable">
          <span class="sapMBtnContent">
            <span class="sapUiIcon sapUiIconMirrorInRTL" style="font-family: SAP-icons; font-size: 1rem;">&#xe1e2;</span>
          </span>
        </span>
      </button>`
    );

    // Create More dropdown menu
    var moreDropdownMenu = createElementFromHTML(
      `<div id="__more_dropdown_menu" style="display: none; position: fixed; background: var(--sapGroup_ContentBackground, #fff); border: 1px solid var(--sapList_BorderColor, #ccc); border-radius: 0.25rem; box-shadow: var(--sapContent_Shadow2); min-width: 140px; z-index: 1000;">
          <div class="__more_dropdown_item" id="__more_logs" style="padding: 0.5rem 1rem; cursor: pointer; font-size: 0.875rem; border-bottom: 1px solid var(--sapList_BorderColor, #eee); display: flex; align-items: center; color: var(--sapList_TextColor, #32363a);"><span class="sapUiIcon sapUiIconMirrorInRTL" style="font-family: SAP-icons; font-size: 1rem; margin-right: 0.5rem;">&#xe011;</span>Logs</div>
          <div class="__more_dropdown_item" id="__more_plugins" style="padding: 0.5rem 1rem; cursor: pointer; font-size: 0.875rem; display: flex; align-items: center; color: var(--sapList_TextColor, #32363a);"><span class="sapUiIcon sapUiIconMirrorInRTL" style="font-family: SAP-icons; font-size: 1rem; margin-right: 0.5rem;">&#xe192;</span>Plugins</div>
      </div>`
    );

    // Create trace button
    var tracebutton = createElementFromHTML(
      `<button id="__buttonxx" accesskey="2" data-sap-ui="__buttonxx" title="Enable traces Kbd : 2" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxx-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button134345-content"><bdi id="button134345-BDI-content" class="${powertraceText}">Trace</bdi></span></span></button>`
    );

    var infobutton = createElementFromHTML(
      ' <button id="__buttoninfo" accesskey="4" data-sap-ui="__buttoninfo" title="Info Kbd : 4" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxy-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button13-content"><bdi id="__button134343-BDI-content">Info</bdi></span></span></button>'
    );
    infobutton.addEventListener("click", (btn) => {
      statistic("headerbar_btn_info_click");
      openIflowInfoPopup();
    });

    var runtimeButton;
    var runtimeButtonContainer;
    // Create runtime button container with dropdown
    if (cpiData.runtimeLocations.length > 1) {
      runtimeButtonContainer = createElementFromHTML(
        `<div id="__runtime_button_container" style="display: inline-block; float: right; position: relative; margin-left: 10px;">
        <button id="__runtime_button" title="Select Runtime Location" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="margin: 0 !important;">
          <span class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable">
            <span class="sapMBtnContent">
              <bdi>Runtime</bdi>
            </span>
          </span>
        </button>
        <div id="__trace_dropdown_menu" style="display: none; position: absolute; top: 100%; right: 0; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 160px; z-index: 1000; margin-top: 2px;">
        </div>
      </div>`
      );
      runtimeButton = runtimeButtonContainer.querySelector("#__runtime_button");
      updateRuntimeLocationDropdown(runtimeButtonContainer.querySelector("#__trace_dropdown_menu"));
      // Close dropdown when clicking outside (registered once)
      document.addEventListener("click", (e) => {
        if (!runtimeButtonContainer.contains(e.target)) {
          runtimeButtonContainer.querySelector("#__trace_dropdown_menu").style.display = "none";
        }
        if (!moreButton.contains(e.target) && !moreDropdownMenu.contains(e.target)) {
          moreDropdownMenu.style.display = "none";
        }
      });

      // Handle dropdown item selection (registered once)
      runtimeButtonContainer.querySelector("#__trace_dropdown_menu").addEventListener("click", (e) => {
        const item = e.target.closest(".__trace_dropdown_item");
        if (item) {
          const locationId = item.getAttribute("data-location-id");
          setRuntimeLocation(cpiData.runtimeLocationWithActiveIFlow.find((loc) => loc.id === locationId));

          // Update visual selection
          updateRuntimeLocationDropdown();

          runtimeButtonContainer.querySelector("#__trace_dropdown_menu").style.display = "none";
        }
      });

      runtimeButton.addEventListener("click", async (e) => {
        e.stopPropagation();

        // Update runtime info on click to ensure fresh data
        await getIflowInfo(null, true, false);
        updateRuntimeLocationDropdown();

        if (!cpiData.runtimeLocationWithActiveIFlow || cpiData.runtimeLocationWithActiveIFlow.length === 0) {
          showToast("No runtime locations available. IFlow not deployed?", "Warning", "warning");
        } else if (!cpiData.runtimeLocationId) {
          showToast("Please select a runtime location", "Info", "info");
        }

        var traceDropdownMenu = runtimeButtonContainer.querySelector("#__trace_dropdown_menu");
        const isVisible = traceDropdownMenu.style.display === "block";
        traceDropdownMenu.style.display = isVisible ? "none" : "block";
      });
    }

    var logsItem = moreDropdownMenu.querySelector("#__more_logs");
    var pluginsItem = moreDropdownMenu.querySelector("#__more_plugins");

    //Create Toggle Message Bar Button
    var messagebutton = createElementFromHTML(
      ' <button id="__buttonxy" accesskey="3" data-sap-ui="__buttonxy" title="Messages Kbd : 3" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxy-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button13-content"><bdi id="__button18778-BDI-content">Messages</bdi></span></span></button>'
    );

    area.style.textAlign = "right";
    var breakLine = document.createElement("br");
    document.querySelector("[id*='--searchStep-I']").accessKey = "s";
    area = document.querySelector("[id*='--iflowObjectPageHeader-actions']");
    if (!area) {
      area = document.querySelector(".sapUxAPObjectPageHeaderIdentifierActions");
    }
    //   area.addEventListener("click", () => {
    //     document.querySelector("[id*='--searchStep-I']").accessKey = "s";
    //   });

    //create div for better alignment of runtime button
    var buttonbarDiv = document.createElement("div");
    // ensure the container sits above other elements and is positioned for its dropdowns
    buttonbarDiv.style.position = "relative";
    buttonbarDiv.style.zIndex = "4";

    //buttonbarDiv.appendChild(breakLine);
    buttonbarDiv.appendChild(moreButton);
    if (runtimeButtonContainer) {
      buttonbarDiv.appendChild(runtimeButtonContainer);
    }
    buttonbarDiv.appendChild(infobutton);
    buttonbarDiv.appendChild(messagebutton);
    buttonbarDiv.appendChild(tracebutton);

    area.appendChild(buttonbarDiv);

    // Append dropdown to body to avoid clipping or relative positioning issues
    document.body.appendChild(moreDropdownMenu);

    // Toggle More dropdown
    moreButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = moreDropdownMenu.style.display === "block";

      if (!isVisible) {
        moreDropdownMenu.style.visibility = "hidden";
        moreDropdownMenu.style.display = "block";
        const rect = moreButton.getBoundingClientRect();
        const width = moreDropdownMenu.offsetWidth;
        moreDropdownMenu.style.top = rect.bottom + 2 + "px";
        moreDropdownMenu.style.left = rect.right - width + "px";
        moreDropdownMenu.style.visibility = "visible";
      } else {
        moreDropdownMenu.style.display = "none";
      }
    });

    tracebutton.addEventListener("click", async () => {
      // Validate runtime location availability
      if (!cpiData.runtimeLocationId) {
        showToast("Please select a runtime location first.", "No runtime location selected", "error");
        return;
      }

      const btn = document.getElementById("button134345-BDI-content");
      btn.classList.toggle("cpiHelper_powertrace");
      const objName = `${cpiData.integrationFlowId}_powertraceLastRefresh`;
      if (btn.classList.contains("cpiHelper_powertrace")) {
        setLogLevel("TRACE", cpiData.integrationFlowId);
        statistic("set_log_level", "TRACE");
        const objectToStore = {};
        objectToStore[objName] = new Date().getTime().toString();
        await storageSetPromise(objectToStore);
        log.log("powertraceLastRefresh saved");
      } else {
        showToast("Trace will not be retriggered anymore.");
        const objectToStore = {};
        objectToStore[objName] = null;
        await storageSetPromise(objectToStore);
        log.log("powertraceLastRefresh Cleared");
      }
    });
    messagebutton.addEventListener("click", (btn) => {
      if (sidebar.active) {
        sidebar.deactivate();
      } else {
        sidebar.init();
        log.debug("headerbar message btn clicked.");
        statistic("headerbar_btn_message_click");
      }
    });

    logsItem.addEventListener("click", async (btn) => {
      statistic("headerbar_btn_logs_click");
      // the logs popup opens and it shows the sidebar. the sidebar elements are updated
      showBigPopup(await createContentNodeForLogs(null, true), "Logs");
      updateArtifactList();
      updateLogList();
      moreDropdownMenu.style.display = "none";
    });

    pluginsItem.addEventListener("click", async (btn) => {
      statistic("headerbar_btn_plugins_click");
      // the logs popup opens and it shows the sidebar. the sidebar elements are updated
      showBigPopup(await createContentNodeForPlugins(), "Plugins");
      moreDropdownMenu.style.display = "none";
    });

    log.debug("Artifect from checks for sidebar", cpiData.currentArtifactType);
    if ((sidebar.active == null || sidebar.active == false) && cpiData.currentArtifactType) {
      chrome.storage.sync.get(["openMessageSidebarOnStartup"], function (result) {
        var openMessageSidebarOnStartupValue;
        // default mode is closed to reduce traffic on backend
        if (result["openMessageSidebarOnStartup"] == undefined || result["openMessageSidebarOnStartup"] == null) {
          chrome.storage.sync.set({
            openMessageSidebarOnStartup: false,
          });
          openMessageSidebarOnStartupValue = false;
        } else {
          openMessageSidebarOnStartupValue = result["openMessageSidebarOnStartup"];
        }

        if (openMessageSidebarOnStartupValue) {
          log.debug("opened sidebar on startup");
          sidebar.init();
        }
      });
    }
  }

  // reapply status of powertrace button (needed after returning from script/message mapping
  await refreshPowerTrace();
}

//Collect Infos to Iflow
async function getIflowInfo(callback, silent = false, cache = true) {
  if (cpiData.cpiPlatform == "cf") {
    return getIflowInfoCf(callback, silent, cache);
  } else if (cpiData.cpiPlatform == "neo") {
    return getIflowInfoNeo(callback, silent, cache);
  }
}

async function getIflowInfoCf(callback, silent = false, cache = true) {
  let cacheValue = 3000;
  if (!cache) {
    cacheValue = false;
  }
  try {
    // 1. Edge-Cell prüfen
    const runtimeLocResp = await makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.srv.web.cf.RuntimeLocationListCommand", cacheValue, null, null, null, null, !silent);
    const runtimeLocJson = new XmlToJson().parse(runtimeLocResp)["com.sap.it.op.srv.web.cf.RuntimeLocationListResponse"];

    //collect list of runtime locations
    if (runtimeLocJson.runtimeLocations?.length) {
      cpiData.runtimeLocations = runtimeLocJson.runtimeLocations.map((loc) => {
        return {
          id: loc.id,
          state: loc.state,
          type: loc.type,
          typeId: loc.typeId,
        };
      });
    } else {
      cpiData.runtimeLocations = [{ id: runtimeLocJson.runtimeLocations.id, state: runtimeLocJson.runtimeLocations.state, type: runtimeLocJson.runtimeLocations.type, typeId: runtimeLocJson.runtimeLocations.typeId }];
    }

    // filter for active runtime locations
    cpiData.runtimeLocations = cpiData.runtimeLocations.filter((loc) => loc.state.toUpperCase() == "ACTIVE");

    if (cpiData.runtimeLocations.length == 0) {
      throw "No active runtime locations found. Please check your environment.";
    }

    if (cpiData.runtimeLocations.length == 1 && cpiData.runtimeLocations[0].id == "cloudintegration") {
      //if only cloud integration runtime is available, set it as default without checking for iflow presence, because there is only this one runtime possible
      cpiData.runtimeLocationWithActiveIFlow = cpiData.runtimeLocations;
      setRuntimeLocation(cpiData.runtimeLocations[0], true);
    }

    //iterate all runtime locations to find the ones that have active iflows
    cacheValue = 500; // default cache value for the next calls
    if (!cpiData.runtimeLocationWithActiveIFlow || cpiData.runtimeLocationWithActiveIFlow.length == 0) {
      cacheValue = 120;
    } else {
      cpiData.runtimeLocationWithActiveIFlow = [];
    }

    //overwrite cache value if no cache
    if (!cache) {
      cacheValue = false;
    }

    for (const loc of cpiData.runtimeLocations) {
      try {
        const locIdParam = "?runtimeLocationId=" + loc.id;
        const resp = await makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListCommand" + locIdParam, cacheValue, null, null, null, null, !silent);
        const respJson = new XmlToJson().parse(resp)["com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListResponse"];
        const artifact = Array.isArray(respJson.artifactInformations)
          ? respJson.artifactInformations.find((e) => e.symbolicName == cpiData.integrationFlowId)
          : respJson.artifactInformations?.symbolicName == cpiData.integrationFlowId
            ? respJson.artifactInformations
            : null;
        if (artifact) {
          cpiData.runtimeLocationWithActiveIFlow.push({
            id: loc.id,
            state: loc.state,
            type: loc.type,
            typeId: loc.typeId,
            artifact: artifact,
          });
        }
      } catch (locError) {
        log.warn("Error fetching runtime location " + loc.id + ": ", locError);
        continue;
      }
    }

    if (cpiData.runtimeLocationWithActiveIFlow.length == 0) {
      log.warn("Integration Flow was not found. Probably it is not deployed.");
      return;
    }

    for (const loc of cpiData.runtimeLocationWithActiveIFlow) {
      try {
        // 4. Detaildaten holen
        const detailResp = await makeCallPromise(
          "GET",
          "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentDetailCommand?artifactId=" + loc.artifact.id + "&runtimeLocationId=" + loc.id,
          90,
          "application/json",
          null,
          null,
          null,
          !silent
        );
        const detail = JSON.parse(detailResp);

        loc["detail"] = detail;
        loc["artifact"] = detail.artifactInformation;
        loc["artifactId"] = detail.artifactInformation?.id;
        loc["tenantId"] = detail.artifactInformation?.tenantId;
        loc["version"] = detail.artifactInformation?.version;
      } catch (detailError) {
        log.warn("Error fetching detail for location " + loc.id + ": ", detailError);
        continue;
      }
    }

    //default
    if (!cpiData.runtimeLocationId) {
      setRuntimeLocation(cpiData.runtimeLocationWithActiveIFlow.find((loc) => loc.id == "cloudintegration") || cpiData.runtimeLocationWithActiveIFlow[0]);
    }

    if (cpiData.runtimeLocationId) {
      if (!cpiData.runtimeLocationWithActiveIFlow.find((loc) => loc.id === cpiData.runtimeLocationId)) {
        showToast("The previously selected runtime location " + cpiData.runtimeLocationId + " is not available anymore. Runtime location switched to " + cpiData.runtimeLocationWithActiveIFlow[0].id, "Runtime location switched", "warning");
        setRuntimeLocation(cpiData.runtimeLocationWithActiveIFlow[0], true);
      } else {
        //update
        setRuntimeLocation(
          cpiData.runtimeLocationWithActiveIFlow.find((loc) => loc.id === cpiData.runtimeLocationId),
          true
        );
      }
    }

    // Update runtime location dropdown if it exists
    if (cpiData.functions.updateRuntimeLocationDropdown) {
      cpiData.functions.updateRuntimeLocationDropdown();
    }

    if (callback) callback();
  } catch (error) {
    log.error("Error getting Iflow Info: ", error);
    if (!silent) showToast("Error: " + JSON.stringify(error));
  }
}

function setRuntimeLocation(location, silent = false) {
  cpiData.runtimeLocationId = location.id;
  if (location.id != "cloudintegration") {
    cpiData.runtimePathExtension = `location/${location.id}/`;
  } else {
    cpiData.runtimePathExtension = "";
  }
  const detail = location.detail;
  //detail might be null

  cpiData.flowData = detail || {};
  cpiData.flowData.lastUpdate = new Date().toISOString();
  cpiData.tenantId = detail?.artifactInformation?.tenantId;
  cpiData.artifactId = detail?.artifactInformation?.id;
  cpiData.version = detail?.artifactInformation?.version;

  log.debug(`Runtime location set to: ${cpiData.runtimeLocationId}`);

  // update sidebar runtime info if sidebar is active
  try {
    const updatedTextElem = document.getElementById("cpiHelper_sidebar_refresh_text");
    if (updatedTextElem) {
      if (cpiData.runtimeLocationId && cpiData.runtimeLocationId !== "cloudintegration" && cpiData.runtimeLocationWithActiveIFlow.length > 1) {
        updatedTextElem.innerHTML = "Runtime: " + cpiData.runtimeLocationId + "<br>Update: Wait for refresh";
      } else {
        updatedTextElem.innerHTML = "Update: Wait for refresh";
      }
      renderMessageSidebar();
    }
  } catch (e) {
    // ignore if DOM not available
    log.debug("sidebar runtime text update failed", e);
  }

  if (!silent) {
    showToast(`Runtime location set to: ${cpiData.runtimeLocationId}`, "info");
  }
}

async function getIflowInfoNeo(callback, silent = false, cache = true) {
  let cacheValue = 500;
  if (cache) {
    cacheValue = false;
  }
  return makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListCommand", cacheValue, null, null, null, null, !silent)
    .then((response) => {
      // load all non-Edge iflows and search the currently opened Iflow
      response = new XmlToJson().parse(response)["com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListResponse"];
      var resp = response.artifactInformations;

      if (resp.length) {
        resp = resp.find((element) => {
          return element.symbolicName == cpiData.integrationFlowId;
        });
      } else {
        if (resp.symbolicName != cpiData.integrationFlowId) {
          resp = null;
        }
      }

      // If no valid response was found (because the flow is not deployed...), throw an error
      if (!resp) {
        throw "Integration Flow was not found. Probably it is not deployed.";
      }

      return resp;
    })
    .then((response) => {
      if (response) {
        return makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentDetailCommand?artifactId=" + response.id, 60, "application/json", null, null, null, !silent);
      }
    })
    .then((response) => {
      var resp = JSON.parse(response);
      cpiData.flowData = resp;
      cpiData.flowData.lastUpdate = new Date().toISOString();
      cpiData.tenantId = cpiData?.flowData?.artifactInformation?.tenantId;
      cpiData.artifactId = cpiData?.flowData?.artifactInformation?.id;
      cpiData.version = cpiData?.flowData?.artifactInformation?.version;

      // Update runtime location dropdown if it exists
      if (cpiData.functions.updateRuntimeLocationDropdown) {
        cpiData.functions.updateRuntimeLocationDropdown();
      }

      if (callback) {
        callback();
      }
      return;
    })
    .catch((error) => {
      if (!silent) {
        showToast("Error: " + JSON.stringify(error));
      }
    });
}

function copyText(input) {
  navigator.clipboard.writeText(input).then(
    function () {
      showToast("Copied to clipboard");
      log.log("Async: Copying to clipboard was successful!");
    },
    function (err) {
      log.error("Async: Could not copy text: ", err);
    }
  );
}

function getConfirmation(message) {
  var retVal = confirm(message);
  if (retVal == true) {
    return true;
  } else {
    return false;
  }
}

//the sidebar that shows messages
var sidebar = {
  //indicator if active or not
  active: null,
  //function to deactivate the sidebar
  deactivate: function () {
    this.active = false;
    clearTimeout(getLogsTimer);
    document.getElementById("cpiHelper_content").remove();
  },

  //function to create and initialise the message sidebar
  init: function () {
    if (this.active == true) {
      return;
    }

    this.active = true;
    var elem = document.createElement("div");
    elem.innerHTML = `
    <div id="cpiHelper_contentheader" style="color:var(--cpi-text-color)" content="${hostData.count}" >
      <span id='sidebar_modal_minimize' class='cpiHelper_closeButton_sidebar'>CPI Helper</span>
      <span id='sidebar_modal_close' data-sap-ui-icon-content="&#xe03e" class='cpiHelper_closeButton_sidebar sapUiIcon sapUiIconMirrorInRTL' style='font-size: 1.2rem;padding-inline-start: 1rem;font-family: SAP-icons'></span>
    </div>
    <div id="outerFrame" >
      <div>
        <div style="padding-left:0px" id="updatedText" class="contentText">
        <span id="cpiHelper_sidebar_refresh_text" style="padding-left: 0px; padding-top: 0px;">
    </span>
    <button id="cpiHelper_sidebar_refresh_icon" title="Refresh" style="background:none;border:none;cursor:pointer;vertical-align:middle;margin-left:0.5em;">
      <i class="sync alternate icon"></i>
    </button>
        </div>
        <div style="padding-left:0px; padding-top:0px" id="deploymentText" class="contentText"></div>
        <div><table id="messageList" class="contentText"></table></div>
      </div>
    </div>
    <div id="cpiHelper_messageSidebar_pluginArea" class="ui vertical fluid menu cpiHelper_hidden" style="color:#000"> 
      <div class="ui centered header cpiHelper_hidden">
      <div class="content">Plugin Page</div>
      <span data-sap-ui-icon-content="&#xe03e" class='cpiHelper_closeButton_sidebar sapUiIcon sapUiIconMirrorInRTL' style='font-size: 1.2rem;padding-inline-start: 1rem;font-family: SAP-icons'></span>
    </div>
    `;
    elem.id = "cpiHelper_content";
    elem.classList.add("cpiHelper");
    elem.setAttribute("hidden", true);
    elem.style = "width:max-content;min-width: 14rem";
    body().appendChild(elem);
    elem.style = "width:max-content;min-width: 14rem";
    // set inital parameters.
    chrome.storage.sync.get(["set_ch_popup_mouse"], function (result) {
      popuparea = document.querySelector("#cpiHelper_content");
      if (result["set_ch_popup_mouse"]) {
        popuparea.style.left = result["set_ch_popup_mouse"].left;
        popuparea.style.top = result["set_ch_popup_mouse"].top;
      }
    });
    //plugin area setup popup+join mode
    chrome.storage.sync.get(["openSidebarOnStartup"], function (result) {
      pluginarea = document.querySelector("#cpiHelper_messageSidebar_pluginArea");
      if (result["openSidebarOnStartup"]) {
        pluginarea.classList.add("sidebar");
        pluginarea.classList.toggle("fluid");
        document.querySelector("#cpiHelper_messageSidebar_pluginArea span").addEventListener("click", () => {
          pluginarea.classList.toggle("fluid");
          twoClasssToggleSwitch(pluginarea, "visible", "cpiHelper_hidden");
          twoClasssToggleSwitch(document.querySelector("#sidebar_Plugin"), "plus", "minus");
        });
      }
    });
    //add minimize button on CPI helper title & color match with tenant color
    var span = document.getElementById("sidebar_modal_minimize");
    var content_header = document.getElementById("cpiHelper_contentheader");
    var outerFrame_element = document.getElementById("outerFrame");
    var borderofouterFrame = getComputedStyle(outerFrame_element).borderRadius.split(" ");
    span.onclick = () => {
      if (outerFrame_element.offsetHeight > 0) {
        content_header.style["min-width"] = getComputedStyle(outerFrame_element).width;
        outerFrame_element.style.display = "none";
        content_header.style["border-bottom-left-radius"] = borderofouterFrame[2];
        content_header.style["border-bottom-right-radius"] = borderofouterFrame[3];
      } else {
        outerFrame_element.style.display = "block";
        content_header.style["border-bottom-left-radius"] = borderofouterFrame[0];
        content_header.style["border-bottom-right-radius"] = borderofouterFrame[1];
      }
    };

    //add close button
    var span = document.getElementById("sidebar_modal_close");
    span.onclick = (element) => {
      sidebar.deactivate();
    };

    //activate dragging for message bar
    dragElement(document.getElementById("cpiHelper_content"));

    //lastMessageHashList must be empty when message sidebar is created
    cpiData.messageSidebar.lastMessageHashList = [];
    setTimeout(() => document.getElementById("cpiHelper_content").removeAttribute("hidden"), 200);
    //refresh messages
    messageSidebarPluginContent(true);
    refreshActive = true;
    renderMessageSidebar()
      .then(() => {
        refreshActive = false;
      })
      .catch(() => {
        refreshActive = false;
      });
  },
};

function injectCss(cssStyle, id, className) {
  var style = document.createElement("style");
  style.type = "text/css";
  style.appendChild(document.createTextNode(cssStyle));
  id && (style.id = id);
  className && style.classList.add(className);
  document.getElementsByTagName("head")[0].appendChild(style);
}

function removeElementsWithId(name) {
  document.getElementById(name).remove();
  return true;
}

function removeElementsWithClass(classToDelete) {
  let elements = document.getElementsByClassName(classToDelete);
  for (let i = elements.length - 1; i >= 0; i--) {
    elements[i].remove(element);
  }
  return true;
}
function formatDuration(durationMs) {
  const h = Math.floor(durationMs / (1000 * 60 * 60)) % 24;
  const m = Math.floor(durationMs / (1000 * 60)) % 60;
  const s = Math.floor(durationMs / 1000) % 60;
  const ms = durationMs % 1000;

  return `${h ? h + "h " : ""}${m ? m + "m " : ""}${s ? s + "s " : ""}${ms}ms`.trim();
}

async function errorPopupOpen(MessageGuid) {
  var resp = await getMessageProcessingLogRuns(MessageGuid, false);

  var customHeaders = await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogs('" + MessageGuid + "')?$format=json&$expand=CustomHeaderProperties", false);
  customHeaders = JSON.parse(customHeaders).d;

  //Duration
  var stepStart = new Date(parseInt(customHeaders.LogStart.substr(6, 13)));
  stepStart.setTime(stepStart.getTime() - stepStart.getTimezoneOffset() * 60 * 1000);
  var stepStop = new Date(parseInt(customHeaders.LogEnd.substr(6, 13)));
  stepStop.setTime(stepStop.getTime() - stepStop.getTimezoneOffset() * 60 * 1000);

  //custom Headers and Properties
  propertyArray = [];
  customHeaders?.CustomHeaderProperties?.results.forEach((element) => propertyArray.push(element?.Name + ": " + element?.Value?.substr(0, 150)));
  // Error Collect
  errorDetails = [];
  if (resp != null || resp.length != 0) {
    let error = false;
    for (var i = 0; i < resp.length; i++) {
      if (resp[i].Error) {
        error = true;
        let logtext = resp[i].Error;
        let explain = lookupError(resp[i].Error);
        if (explain) {
          logtext += "<br>Possible explanation: " + explain;
        }
        errorDetails.push(logtext);
      }
    }
  }
  return {
    status: customHeaders.Status,
    customstatus: customHeaders.CustomStatus,
    duration: formatDuration(stepStop - stepStart),
    errors: errorDetails,
    property: propertyArray,
  };
}
async function popupTable(message) {
  let data = await errorPopupOpen(message);
  log.debug(data);
  let popupHTML = `<table class="ui celled very compact table">
  <tbody>
    <tr class="center aligned">
      <td class="info">Status</td>
      <td class="${getStatusColor(data.status)}">${getStatusIcon(data.status)}${data.status}</td>
    </tr>
    <tr class="center aligned">
      <td class="info">Custom Status</td>
      <td class="${getStatusColor(data.customstatus)}">${getStatusIcon(data.customstatus)}${data.customstatus}</td>
    </tr>
    <tr class="center aligned">
      <td class="info">Duration</td>
      <td>${data.duration}</td>
    </tr>`;

  if (data.errors.length > 0 || data.property.length > 0) {
    popupHTML += `<tr><td colspan="2" style="height: 10vh; padding: 0;">
      <div class="ui fluid scrolling segment" style="text-wrap: pretty;width: unset;word-break: break-word;">`;
    if (data.property.length > 0) {
      popupHTML += data.property.join("<br>");
    }
    if (data.errors.length > 0) {
      popupHTML += `<h5 class="ui horizontal red divider header">Errors</h5>`;
      popupHTML += data.errors.map((e) => `<span class="ui red text">${e}</span>`).join("<div class='ui divider'></div>");
    }
    popupHTML += `</div></td></tr>`;
  }
  popupHTML += `</tbody></table>`;
  return popupHTML;
}
function apireserror(message) {
  $(".ui.toast").toast("close");
  $.toast({
    message: "Please wait while we prepare...",
    position: "bottom right",
    showProgress: "bottom",
    class: $("html").hasClass("sapUiTheme-sap_horizon_dark") ? " ch_dark " : "",
    onVisible: async () =>
      popupTable(message)
        .then((message) => {
          $(".ui.toast").toast("close");
          $.toast({
            closeIcon: true,
            showProgress: "top",
            classProgress: "blue",
            progressUp: true,
            position: "bottom right",
            class: $("html").hasClass("sapUiTheme-sap_horizon_dark") ? " ch_dark " : "",
            displayTime: 5000,
            onRemove: () => {
              document.querySelectorAll(".cpiHelper_sidebar_iconbutton").forEach((i) => i.classList.remove("cpiHelper_sidebar_iconbutton"));
            },
            message: message,
          });
        })
        .catch((error) => {
          log.error("Error loading data:", error);
        }),
  });
}

function lookupError(message) {
  if (/unable to find valid certification path to requested target/.test(message)) {
    return "Probably you did not add a certificate for the https host that you are caling to the keystore";
  }

  return null;
}

//to check for errors and inline trace
async function getMessageProcessingLogRuns(MessageGuid, store = true) {
  var top_mode_count = await storageGetPromise("cpi_top_mode");
  top_mode_count = top_mode_count == null && top_mode_count == undefined ? "&$top=300" : `& $top=${parseInt(top_mode_count)} `; //Default
  if (top_mode_count === "&$top=0") {
    top_mode_count = "";
  }
  //Plugin over-write
  if (await getStorageValue("traceModifer", "isActive", null)) {
    var top_mode_count_flow = await storageGetPromise(`traceModifer_${cpiData.integrationFlowId} `);
    console.debug("traceModifer_flow", cpiData.integrationFlowId, top_mode_count, top_mode_count_flow);
    top_mode_count = (top_mode_count_flow == null && top_mode_count_flow == undefined) || top_mode_count_flow == 0 ? top_mode_count : `& $top=${parseInt(top_mode_count_flow)} `;
  }

  return makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogs('" + MessageGuid + "')/Runs?$inlinecount=allpages&$format=json&$top=200", store)
    .then((responseText) => {
      var resp = JSON.parse(responseText);
      var status = resp.d.results[0].OverallState;
      //take the correct run log (last or second last) for displaying the inline trace, depending on message status.
      if (resp.d.results.length > 1 && status != "COMPLETED" && status != "ESCALATED") {
        return resp.d.results[1].Id;
      } else {
        return resp.d.results[0].Id;
      }
    })
    .then((runId) => {
      return makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogRuns('" + runId + "')/RunSteps?$inlinecount=allpages&$format=json" + top_mode_count, store);
    })
    .then((response) => {
      return JSON.parse(response).d.results.filter((e) => e.StepStop != null);
    })
    .catch((e) => {
      log.log(e);
      return null;
    });
}

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
  lastResponses = [];
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

//function that handles the dragging
function dragElement(elmnt) {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  if (document.getElementById(elmnt.id + "header")) {
    /* if present, the header is where you move the DIV from:*/
    document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
  } else {
    /* otherwise, move the DIV from anywhere inside the DIV:*/
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  let debounceTimeout;
  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // calculate the new top and left positions
    newtop = elmnt.offsetTop - pos2;
    newleft = elmnt.offsetLeft - pos1;
    maxheight = window.innerHeight - document.getElementById("cpiHelper_contentheader").offsetHeight;
    maxwidth = window.innerWidth - document.getElementById("cpiHelper_contentheader").offsetWidth;
    // bounding position based on max top and width. making position relative in case of resize.
    let mouse_top = (elmnt.style.top = ((newtop < 0 || newtop >= maxheight ? (newtop < 0 ? 0 : newtop >= maxheight ? maxheight : newtop) : newtop) * 100) / window.innerHeight + "%");
    let mouse_left = (elmnt.style.left = ((newleft < 0 || newleft >= maxwidth ? (newleft < 0 ? 0 : newleft >= maxwidth ? maxwidth : newleft) : newleft) * 100) / window.innerWidth + "%");
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      syncChromeStoragePromise("set_ch_popup_mouse", {
        top: mouse_top,
        left: mouse_left,
      });
      log.log("popup location is stored!!");
    }, 3000);
  }

  function closeDragElement() {
    /* stop moving when mouse button is released:*/
    document.onmouseup = null;
    document.onmousemove = null;
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

  var objName = `${cpiData.integrationFlowId}_powertraceLastRefresh`;
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
        btn.classList.toggle("cpiHelper_powertrace");
      }
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
  if (callChromeStoragePromise("CPIhelperThemeInfo") == $("html").hasClass("sapUiTheme-sap_horizon_dark")) {
    await syncChromeStoragePromise("CPIhelperThemeInfo", $("html").hasClass("sapUiTheme-sap_horizon_dark"));
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
      await refreshMessageSidebar();
    }
  }

  //check if trace should be refreshed again
  //check if value in storage exists and time is longer than 9 (overlap) and less than 20 minutes (upper limit in order to not auto-reactivate the trace after a longer break)
  var objName = `${cpiData.integrationFlowId}_powertraceLastRefresh`;
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
async function refreshMessageSidebar() {
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
      await renderMessageSidebar();
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
