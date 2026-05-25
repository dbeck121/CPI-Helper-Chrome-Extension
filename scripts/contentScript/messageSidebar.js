// ============================================================================
// CPI Helper — content script · messageSidebar
// Extracted from scripts/contentScript.js lines 70-371 during the
// 2026-05-26 contentScript decomposition refactor. Behaviour unchanged.
// ============================================================================

//refresh the logs in message window
var getLogsTimer;
var activeInlineItem;

//fill the message sidebar
var lastMessageResponses = [];
function getLastCompletedLogStart() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().substring(0, 19);
}

/*
Render Message Sidebar;
*/
var lastCompletedLogStart = getLastCompletedLogStart();
async function renderMessageSidebar(cache = true) {
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

  await getIflowInfo(null, true, cache);

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
    const filteredlastMessageResponses = lastMessageResponses.filter((item) => !newMessageGuids.has(item.MessageGuid));

    // Combine arrays without duplicates
    resp = [...resp.d.results, ...filteredlastMessageResponses].slice(0, numberEntries);
    lastMessageResponses = resp;
  } catch (e) {
    log.error("There was a faulty message from CI-API. CPI Helper will ignore it: " + e);
  }
  //    document.getElementById('iflowName').innerText = cpiData.integrationFlowId;

  let updatedText = document.getElementById("cpiHelper_sidebar_refresh_text");

  if (updatedText) {
    if (cpiData.runtimeLocationId && cpiData.runtimeLocations && cpiData.runtimeLocations.length > 1) {
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

    await refreshMessageSidebar(false);
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
            `<button title='show logs in new tab' id='info--${i}' class='${resp[i].MessageGuid} ${flash}'><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>`
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
              cpiClearToasts();
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
            let messageGuid = a.currentTarget.classList[0];

            url = "/" + cpiData.urlExtension + "shell/monitoring/Messages/" + encodeURIComponent(JSON.stringify({ edge: { runtimeLocationId: cpiData.runtimeLocationId }, identifier: messageGuid }));

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
