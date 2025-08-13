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

//opens a new window with the Trace for a MessageGuid
function openTrace(MessageGuid) {
  log.debug("MessageGuid");
  //we have to get the RunID first
  makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogs('" + MessageGuid + "')/Runs?$format=json", false)
    .then((responseText) => {
      var resp = JSON.parse(responseText);
      var status = resp.d.results[0].OverallState;
      if (resp.d.results.length > 1 && status != "COMPLETED") {
        var runId = resp.d.results[1].Id;
      } else {
        var runId = resp.d.results[0].Id;
      }

      let url =
        "/" +
        cpiData.urlExtension +
        'shell/monitoring/MessageProcessingRun/%7B"parentContext":%7B"MessageMonitor":%7B"artifactKey":"__ALL__MESSAGE_PROVIDER","artifactName":"All%20Artifacts"%7D%7D,"messageProcessingLog":"' +
        MessageGuid +
        '","RunId":"' +
        runId +
        '"%7D';
      window.open(url, "_blank");
    })
    .catch((e) => {
      log.error("Error while opening Trace: " + e);
    });
}

cpiData.functions.openTrace = openTrace;

//open new window for infos
function openInfo(url) {
  window.open(url, "_blank");
}

//refresh the logs in message window
var getLogsTimer;
var activeInlineItem;

//fill the message sidebar
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
        "odata/api/v1/MessageProcessingLogs?$filter=IntegrationFlowName eq '" +
        iflowId +
        "' and LogStart gt datetime'1900-01-01T01:02:50' and Status ne 'DISCARDED'&$top=" +
        numberEntries +
        "&$format=json&$orderby=LogEnd desc"
    );

    resp = JSON.parse(responseText);
    resp = resp.d.results;
  } catch (e) {
    log.error("There was a faulty message from CI-API. CPI Helper will ignore it: " + e);
  }
  //    document.getElementById('iflowName').innerText = cpiData.integrationFlowId;

  let updatedText = document.getElementById("updatedText");

  updatedText.innerHTML =
    '<span style="padding-left: 0px; padding-top: 0px;">Update: ' +
    new Date().toLocaleTimeString("de-DE") +
    "</span>" +
    `<button id="cpiHelper_sidebar_refresh" title="Refresh" style="background:none;border:none;cursor:pointer;vertical-align:middle;margin-left:0.5em;">
      <i class="sync alternate icon"></i>
    </button>`;

  // Refresh-Button Event
  const refreshBtn = document.getElementById("cpiHelper_sidebar_refresh");
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      nextMessageSidebarRefreshCount = 0;
    };
  }

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
        var count = parseInt(document.querySelector("head > meta[name='cpi-count']") !== null ? document.querySelector("head > meta[name='cpi-count']").content : resp.length);

        for (var i = 0; i < count; i++) {
          //var logStart = resp[i].LogStart == null ? "-" : resp[i].LogStart;
          thisMessageHashList.push(resp[i].MessageGuid + resp[i].LogStart + resp[i].LogEnd + resp[i].Status);
          runInfoElement[thisMessageHash] = {};
          runInfoElement[thisMessageHash].messageHash = resp[i].MessageGuid + resp[i].LogStart + resp[i].LogEnd + resp[i].Status;
          runInfoElement[thisMessageHash].messageGuid = resp[i].MessageGuid;
          runInfoElement[thisMessageHash].logStart = new Date(parseInt(resp[i].LogStart.match(/\d+/)[0]));
          runInfoElement[thisMessageHash].logEnd = new Date(parseInt(resp[i].LogEnd.match(/\d+/)[0]));
          runInfoElement[thisMessageHash].status = resp[i].Status;
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
            openInfo(url);
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
  var messageSidebarTimerTime = 3;

  //if tab hidden, set timer to 60 seconds
  if (lastTabHidden > 9) {
    log.log("Tab is hidden, set timer to 30 seconds");
    return 10;
  }

  //if tab hidden for a long time, set timer to 60 seconds
  if (lastTabHidden > 100) {
    log.log("Tab is hidden, set timer to 5 minutes");
    return 100;
  }

  if (lastDurationRefresh > 2000) {
    log.debug("Last rendering took more than 2000ms, set timer to 60 seconds");
    messageSidebarTimerTime = 20;
    return messageSidebarTimerTime;
  }
  if (lastDurationRefresh > 1000) {
    log.debug("Last rendering took more than 1000ms, set timer to 30 seconds");
    messageSidebarTimerTime = 10;
    return messageSidebarTimerTime;
  }
  if (lastDurationRefresh > 700) {
    log.debug("Last rendering took more than 700ms, set timer to 21 seconds");
    messageSidebarTimerTime = 7;
    return messageSidebarTimerTime;
  }
  if (lastDurationRefresh > 500) {
    log.debug("Last rendering took more than 500ms, set timer to 15 seconds");
    messageSidebarTimerTime = 5;
    return messageSidebarTimerTime;
  }
  if (lastDurationRefresh > 400) {
    log.debug("Last rendering took more than 400ms, set timer to 12 seconds");
    messageSidebarTimerTime = 4;
    return messageSidebarTimerTime;
  }
  if (lastDurationRefresh > 300) {
    log.debug("Last rendering took more than 300ms, set timer to 9 seconds");
    messageSidebarTimerTime = 3;
    return messageSidebarTimerTime;
  }

  log.debug("Set timer to " + messageSidebarTimerTime + " counts");
  return messageSidebarTimerTime;
}

var inlineTraceRunning = false;
async function clickTrace(e) {
  $("[ch_inline_active]").removeAttr("ch_inline_active");
  if (inlineTraceRunning) {
    return;
  }
  if ($(".cpiHelper_inlineInfo").length === 0) {
    showToast("Inline trace has been turned off");
    return;
  }
  inlineTraceRunning = true;
  showWaitingPopup();

  var formatLogContent = function (inputList) {
    inputList = inputList.sort(function (a, b) {
      return a.Name.toLowerCase() > b.Name.toLowerCase() ? 1 : -1;
    });
    result = `<table class='ui basic striped selectable compact table'>
    <thead><tr class="blue"><th>Name</th><th>Value</th></tr></thead>
    <tbody>`;
    inputList.forEach((item) => {
      result += "<tr><td>" + item.Name + '</td><td style="word-break: break-all;">' + item.Value + "</td></tr>";
    });
    result += "</tbody></table>";
    return result;
  };

  var formatInfoContent = function (inputList) {
    valueList = [];

    var stepStart = new Date(parseInt(inputList.StepStart.substr(6, 13)));
    stepStart.setTime(stepStart.getTime() - stepStart.getTimezoneOffset() * 60 * 1000);

    valueList.push({
      Name: "Start Time",
      Value: stepStart.toISOString().substr(0, 23),
    });

    if (inputList.StepStop) {
      var stepStop = new Date(parseInt(inputList.StepStop.substr(6, 13)));
      stepStop.setTime(stepStop.getTime() - stepStop.getTimezoneOffset() * 60 * 1000);
      valueList.push({
        Name: "End Time",
        Value: stepStop.toISOString().substr(0, 23),
      });
      valueList.push({
        Name: "Duration in milliseconds",
        Value: stepStop - stepStart,
      });
      valueList.push({
        Name: "Duration in seconds",
        Value: (stepStop - stepStart) / 1000,
      });
      valueList.push({
        Name: "Duration in minutes",
        Value: (stepStop - stepStart) / 1000 / 60,
      });
    }

    valueList.push({ Name: "BranchId", Value: inputList.BranchId });

    valueList.push({ Name: "RunId", Value: inputList.RunId });

    valueList.push({ Name: "StepId", Value: inputList.StepId });

    valueList.push({ Name: "ModelStepId", Value: inputList.ModelStepId });

    valueList.push({ Name: "ChildCount", Value: inputList.ChildCount });

    result = `<table class='ui basic striped selectable compact table'><thead><tr class="blue"><th>Name</th><th>Value</th></tr></thead>
    <tbody>`;
    valueList.forEach((item) => {
      result += "<tr><td>" + item.Name + '</td><td style="word-break: break-all;">' + item.Value + "</td></tr>";
    });
    result += "</tbody></table>";
    return result;
  };

  //get the content for a tab in a trace popup
  var getTraceTabContent = async function (object) {
    var traceData = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + object.runId + "',ChildCount=" + object.childCount + ")/TraceMessages?$format=json", true)).d.results;
    var trace = traceData.sort((a, b) => {
      return a.TraceId - b.TraceId;
    })[0];
    if (!trace) {
      showToast("it is already deleted or not in trace mode.", "No trace exists", "warning");
      return "No trace for this step exists, it is already deleted or not in trace mode.";
      //   throw new Error("no trace found");
    }
    var traceId = trace.TraceId;
    let html = "";
    if (object.traceType == "properties") {
      let elements = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/TraceMessages(" + traceId + ")/ExchangeProperties?$format=json", true)).d.results;
      html = formatHeadersAndPropertiesToTable(elements);
    }
    if (object.traceType == "headers") {
      let elements = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/TraceMessages(" + traceId + ")/Properties?$format=json", true)).d.results;
      html = formatHeadersAndPropertiesToTable(elements);
    }

    if (object.traceType == "trace") {
      let elements = await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/TraceMessages(" + traceId + ")/$value", true);
      html = formatTrace(elements, object.runId + "_" + object.childCount, traceId);
    }

    if (object.traceType == "logContent") {
      let elements = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + object.runId + "',ChildCount=" + object.childCount + ")/?$expand=RunStepProperties&$format=json", true)).d
        .RunStepProperties.results;
      html = formatLogContent(elements);
    }

    if (object.traceType == "info") {
      let elements = JSON.parse(
        await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + object.runId + "',ChildCount=" + object.childCount + ")/?$expand=RunStepProperties&$format=json", true)
      ).d;
      html = formatInfoContent(elements);
    }

    return html;
  };

  var id = this.id.replace(/BPMN[a-zA-Z-]+_/, "");

  var targetElements = inlineTraceElements.filter((element) => {
    return element.StepId == id || element.ModelStepId == id;
  });
  e.target.setAttribute("ch_inline_active", true);
  //trace level check
  var messageguid = document
    .querySelector(".cpiHelper_inlineInfo-button.cpiHelper_inlineInfo-active")
    .className.replace("flash", "")
    .replace(/cpiHelper_inlineInfo-[A-z]+|\s+/g, "")
    .trim();
  var logleveldata = JSON.parse(await makeCallPromise("GET", `/${cpiData.urlExtension}odata/api/v1/MessageProcessingLogs('${messageguid}')?$format=json`, true)).d;

  if (logleveldata.LogLevel != "TRACE") {
    $("#cpiHelper_waiting_model").modal("hide");
    showToast("Trace is not enabled", "your log level is" + logleveldata.LogLevel, "warning");
  } else if (logleveldata.LogLevel == "TRACE" && new Date(parseInt(logleveldata.LogEnd.replace(/\D/g, "")) + 1.05 * 60 * 60000) < new Date()) {
    $("#cpiHelper_waiting_model").modal("hide");
    showToast("Trace is expired", "1 hour is already passed", "warning");
  } else {
    //Trace
    //https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/odata/api/v1/TraceMessages(7875L)/$value

    //Properties
    //https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/odata/api/v1/TraceMessages(7875L)/ExchangeProperties?$format=json

    //Headers
    //https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/odata/api/v1/TraceMessages(7875L)/Properties?$format=json

    //TraceID
    //https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/odata/api/v1/MessageProcessingLogRunSteps(RunId='AF57ga2G45vKDTfn7zqO0zwJ9n93',ChildCount=17)/TraceMessages?$format=json
    async function loginformation() {
      {
        var runs = [];
        for (var n = targetElements.length - 1; n >= 0; n--) {
          var childCount = targetElements[n].ChildCount;
          var runId = targetElements[n].RunId;
          var branch = targetElements[n].BranchId;
          try {
            // var traceId = JSON.parse(await makeCallPromise("GET", "/"+cpiData.urlExtension+"odata/api/v1/MessageProcessingLogRunSteps(RunId='" + runId + "',ChildCount=" + childCount + ")/TraceMessages?$format=json", true)).d.results[0].TraceId;
            var objects = [
              {
                label: "Properties",
                content: getTraceTabContent,
                active: true,
                childCount: childCount,
                runId: runId,
                traceType: "properties",
              },
              {
                label: "Headers",
                content: getTraceTabContent,
                active: false,
                childCount: childCount,
                runId: runId,
                traceType: "headers",
              },
              {
                label: "Body",
                content: getTraceTabContent,
                active: false,
                childCount: childCount,
                runId: runId,
                traceType: "trace",
              },
              {
                label: "Log",
                content: getTraceTabContent,
                active: false,
                childCount: childCount,
                runId: runId,
                traceType: "logContent",
              },
              {
                label: "Info",
                content: getTraceTabContent,
                active: false,
                childCount: childCount,
                runId: runId,
                traceType: "info",
              },
            ];
            if (targetElements[n].Error) {
              let innerContent = document.createElement("div");
              innerContent.classList.add("cpiHelper_traceText");
              innerContent.innerText = targetElements[n].Error;
              innerContent.style.display = "block";
              objects.push({
                label: "Error",
                content: innerContent,
                active: false,
              });
            }
            let label = "" + branch;
            let content = await createTabHTML(objects, "tracetab-" + childCount);
            if (content) {
              runs.push({
                label,
                content,
              });
            }
          } catch (error) {
            log.log("error catching trace");
          }
        }
        if (runs.length == 0) {
          showToast("No Trace Found", "", "warning");
          return;
        }
        return runs.length == 1 ? runs[0].content : await createTabHTML(runs, "runstab", 0);
      }
    }
    let childindex = Array.from(document.querySelectorAll(".cpiHelper_onclick[inline_cpi_child]"), (e) => parseInt(e.getAttribute("inline_cpi_child"), 10)).sort((a, b) => a - b);
    //console.log(e.target.parentNode.parentNode)
    childindex = childindex.indexOf(parseInt(e.target.parentNode.parentNode.getAttribute("inline_cpi_child")));
    showBigPopup(await loginformation, "Content Before Step", { fullscreen: true, callback: null }, childindex, document.querySelectorAll(".cpiHelper_onclick[inline_cpi_child]").length, String(e.pointerType));
  }
  inlineTraceRunning = false;
}

async function hideInlineTrace() {
  activeInlineItem = null;
  $("[ch_inline_active]").removeAttr("ch_inline_active");
  $("[inline_cpi_child]").removeAttr("inline_cpi_child");

  var classesToBeDeleted = [".cpiHelper_inlineInfo", ".cpiHelper_inlineInfo_error", ".cpiHelper_avg", ".cpiHelper_belowavg", ".cpiHelper_inlineInfo-active", ".cpiHelper_aboveavg", ".cpiHelper_max", ".cpiHelper_min"];
  onClicKElements.forEach((element) => (element.onclick = null));
  onClicKElements = [];
  const elementsToProcess = new Set();
  classesToBeDeleted.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      elementsToProcess.add(element);
    });
  });
  elementsToProcess.forEach((element) => {
    element.onclick = null;
    classesToBeDeleted.forEach((selector) => {
      element.classList.remove(selector.substring(1));
    });
  });
}

function timenodediff(e) {
  return {
    StepId: e.StepId,
    ModelStepId: e.ModelStepId,
    CH_stats: parseInt(e.StepStop.match(/\d+/)[0]) - parseInt(e.StepStart.match(/\d+/)[0]),
  };
}

function maxNode(arr) {
  return arr.reduce((max, curr) => (curr > max ? curr : max), arr[0]);
}

var inlineTraceElements;
let cpi_timediff_list;
let cpi_max_node;
async function createInlineTraceElements(MessageGuid, checked) {
  return new Promise(async (resolve, reject) => {
    inlineTraceElements = [];

    var logRuns = await getMessageProcessingLogRuns(MessageGuid, false);

    if (logRuns == null || logRuns.length == 0) {
      return resolve(0);
    }
    logRuns.forEach((run) => {
      inlineTraceElements.push({
        StepId: run.StepId,
        ModelStepId: run.ModelStepId,
        ChildCount: run.ChildCount,
        StepStop: run.StepStop,
        StepStart: run.StepStart,
        RunId: run.RunId,
        BranchId: run.BranchId,
        Error: run.Error,
      });
    });
    // res is dataXHR request....
    if (await getStorageValue("traceModifer", "isActive", null)) {
      if (Array.isArray(logRuns) && checked) {
        cpi_sorted_nodes = [];
        cpi_nodes = logRuns
          .filter((e) => {
            return e.StepStart != null && e.StepStop != null ? true : false;
          })
          .map(timenodediff);
        cpi_sorted_nodes = cpi_nodes.toSorted((a, b) => a.CH_stats - b.CH_stats);
        cpi_timediff_list = [];
        for (i in cpi_nodes) {
          cpi_timediff_list.includes(cpi_nodes[i].CH_stats) ? "" : cpi_timediff_list.push(cpi_nodes[i].CH_stats);
        }
        cpi_group_node = Object.groupBy(cpi_sorted_nodes, (e) => {
          return e.ModelStepId;
        });
        cpi_max_node = [];
        for (const key in cpi_group_node) {
          cpi_max_node.push(maxNode(cpi_group_node[key]));
        }
      }
    }
    return resolve(logRuns.length);
  });
}

var onClicKElements = [];
async function showInlineTrace(MessageGuid, checked = false) {
  return new Promise(async (resolve, reject) => {
    var observerInstalled = false;
    var logRuns = await createInlineTraceElements(MessageGuid, checked);
    var Trace_bool = await getStorageValue("traceModifer", "isActive", null);
    if (logRuns == null || logRuns == 0) {
      return resolve(null);
    }

    inlineTraceElements.forEach((run) => {
      try {
        let target;
        let element;
        let flag = true;
        //    let target = element.children[getChild(element, ["g"])];
        //    target = target.children[getChild(target, ["rect", "circle", "path"])];

        if (/StartEvent/.test(run.ModelStepId)) {
          element = document.getElementById("BPMNShape_" + run.ModelStepId);
          target = element.children[0].children[0];
          flag = false;
        }

        if (/EndEvent/.test(run.StepId)) {
          element = document.getElementById("BPMNShape_" + run.StepId);
          target = element.children[0].children[0];
        }

        if (/ServiceTask/.test(run.StepId)) {
          element = document.getElementById("BPMNShape_" + run.StepId);
          target = element.children[getChild(element, ["g"])].children[0];
        }

        if (/CallActivity/.test(run.StepId)) {
          element = document.getElementById("BPMNShape_" + run.StepId);
          target = element.children[getChild(element, ["g"])].children[0];
        }

        if (/MessageFlow_\d+/.test(run.ModelStepId) && /#/.test(run.ModelStepId) != true) {
          element = document.getElementById("BPMNEdge_" + run.ModelStepId);
          target = element.children[getChild(element, ["text"], "shapeText")];
        }

        if (/ExclusiveGateway/.test(run.ModelStepId)) {
          element = document.getElementById("BPMNShape_" + run.ModelStepId);
          target = element.children[getChild(element, ["g"])].children[0];
        }

        if (/ParallelGateway/.test(run.ModelStepId)) {
          element = document.getElementById("BPMNShape_" + run.ModelStepId);
          target = element.children[getChild(element, ["g"])].children[0];
        }
        element.setAttribute("inline_cpi_child", run.ChildCount);
        target.classList.add("cpiHelper_inlineInfo");
        //     target.addEventListener("onclick", function abc(event) { clickTrace(event); });
        if (flag) {
          element.classList.add("cpiHelper_onclick");
          element.onclick = clickTrace;
          onClicKElements.push(element);
        }
        if (run.Error) {
          target.classList.add("cpiHelper_inlineInfo_error");
        }
        if (Trace_bool && checked) {
          indexofnode = cpi_timediff_list.findIndex((e) => e === cpi_max_node.find((f) => f.ModelStepId === run.ModelStepId).CH_stats);
          if (indexofnode == cpi_timediff_list.length - 1) {
            nodeclass = "cpiHelper_max";
          } else if (indexofnode == 0) {
            nodeclass = "cpiHelper_min";
          } else if (indexofnode == (cpi_timediff_list.length % 2 === 0 ? cpi_timediff_list.length / 2 : Math.round(cpi_timediff_list.length / 2) - 1)) {
            nodeclass = "cpiHelper_avg";
          } else if (indexofnode < cpi_timediff_list.length / 2) {
            nodeclass = "cpiHelper_belowavg";
          } else if (indexofnode > cpi_timediff_list.length / 2) {
            nodeclass = "cpiHelper_aboveavg";
          }
          target.classList.add(nodeclass);
        }
        if (!observerInstalled) {
          observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              const el = mutation.target;
              if (!mutation.target.classList.contains("cpiHelper_onclick")) {
                hideInlineTrace();
                observer.disconnect();
              }
            });
          });

          observer.observe(document.getElementById(element.id), {
            attributes: true,
            attributeFilter: ["class"],
          });
          observerInstalled = true;
        }
      } catch (e) {
        log.log("no element found for " + run.StepId);
        log.log(run, e);
      }

      return resolve(true);
    });
  });
}

function getChild(node, childNames, childClass = null) {
  let index;
  for (var i = 0; i < node.children.length; i++) {
    if (childNames.indexOf(node.children[i].localName) > -1) {
      if (childClass != null) {
        if (node.children[i].classList.contains(childClass)) {
          return i;
        }
      } else {
        return i;
      }
    }
  }
  return null;
}

//makes a http call to set the log level to trace
async function setLogLevel(logLevel, iflowId) {
  /* if (!cpiData.runtimeLocationWithActiveIFlow || cpiData.runtimeLocationWithActiveIFlow == 0) {
    await getIflowInfo();
    if (cpiData.runtimeLocationWithActiveIFlow == 0) {
      showToast("No active IFlow found", "Please open an IFlow to activate trace", "warning");
      log.log("No active IFlow found");
      return;
    }
  } */

  // seems like bug on sap side is fixed. So we can use the runtimeLocationId in all casws
  let locID = ', "runtimeLocationId":"cloudintegration"'; // default for cloudintegration

  /* // if runtimeLocations length = 1 and id is cloudintegration
  if (cpiData.runtimeLocations.length == 1 && cpiData.runtimeLocations[0].id == "cloudintegration") {
    locID = "";
  }
  // if runtimeLocations length > 1
  if (cpiData.runtimeLocations.length > 1 && cpiData.runtimeLocationId) {
    locID = cpiData.runtimeLocationId ? ', "runtimeLocationId": "' + cpiData.runtimeLocationId + '"' : "";
  }

  */

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
  makeCallPromise("POST", "/" + cpiData.urlExtension + "Operations/com.sap.it.nm.commands.deploy.DeleteContentCommand", false, null, "artifactIds=" + artifactId + "&tenantId=" + tenant, true, "application/x-www-form-urlencoded; charset=UTF-8")
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
async function buildButtonBar() {
  //check if the header object is ready
  let area = document.querySelector("[id*='--iflowObjectPageHeader-actions']");

  if (!area) {
    log.error("header object not ready");
    return;
  }

  try {
    var headerBar = document.getElementById("__xmlview0--iflowObjectPageHeader-identifierLine");
    headerBar.style.paddingBottom = "0px";
  } catch (e) {
    log.error("error when trying to set padding-bottom of headerbar");
  }

  // get status of powertrace button
  var powertraceText = await refreshPowerTrace();
  if (!document.getElementById("__buttonxx")) {
    whatsNewCheck();

    //timer for recruiting popup in some seconds
    if (recrutingTimerSet == false) {
      setTimeout(() => {
        recrutingPopup();
      }, 600000);
      recrutingTimerSet = true;
    }

    var logsbutton = createElementFromHTML(
      `<button id="__button_log" accesskey="1" data-sap-ui="__buttonxx" title="Logs Kbd : 1" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; margin-left: 0px; float: right;"><span id="__buttonxx-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button134345-content"><bdi id="button134345-BDI-content" class="sapMBtnContent">Logs</bdi></span></span></button>`
    );
    var tracebutton = createElementFromHTML(
      `<button id="__buttonxx" accesskey="2" data-sap-ui="__buttonxx" title="Enable traces Kbd : 2" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxx-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button134345-content"><bdi id="button134345-BDI-content" class="${powertraceText}">Trace</bdi></span></span></button>`
    );
    //Create Toggle Message Bar Button
    var messagebutton = createElementFromHTML(
      ' <button id="__buttonxy" accesskey="3" data-sap-ui="__buttonxy" title="Messages Kbd : 3" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxy-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button13-content"><bdi id="__button18778-BDI-content">Messages</bdi></span></span></button>'
    );
    var infobutton = createElementFromHTML(
      ' <button id="__buttoninfo" accesskey="4" data-sap-ui="__buttoninfo" title="Info Kbd : 4" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxy-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button13-content"><bdi id="__button134343-BDI-content">Info</bdi></span></span></button>'
    );
    var pluginbutton = createElementFromHTML(
      ' <button id="__buttonplugin" accesskey="5" data-sap-ui="__buttoninfo" title="plugins Kbd : 5" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxy-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button13-content"><bdi id="__button134343-BDI-content">Plugins</bdi></span></span></button>'
    );

    area.style.textAlign = "right";
    var breakLine = document.createElement("br");
    document.querySelector("[id*='--searchStep-I']").accessKey = "s";
    area = document.querySelector("[id*='--iflowObjectPageHeader-actions']");
    area.addEventListener("click", () => {
      document.querySelector("[id*='--searchStep-I']").accessKey = "s";
    });
    area.appendChild(breakLine);
    area.appendChild(pluginbutton);
    area.appendChild(infobutton);
    area.appendChild(messagebutton);
    area.appendChild(tracebutton);
    area.appendChild(logsbutton);

    tracebutton.addEventListener("click", async () => {
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
    infobutton.addEventListener("click", (btn) => {
      statistic("headerbar_btn_info_click");
      openIflowInfoPopup();
    });
    logsbutton.addEventListener("click", async (btn) => {
      statistic("headerbar_btn_logs_click");
      // the logs popup opens and it shows the sidebar. the sidebar elements are updated
      showBigPopup(await createContentNodeForLogs(null, true), "Logs");
      updateArtifactList();
      updateLogList();
    });

    pluginbutton.addEventListener("click", async (btn) => {
      statistic("headerbar_btn_plugins_click");
      // the logs popup opens and it shows the sidebar. the sidebar elements are updated
      showBigPopup(await createContentNodeForPlugins(), "Plugins");
    });

    log.debug("Artifect from checks for sidebar", cpiData.currentArtifactType);
    if ((sidebar.active == null || sidebar.active == false) && cpiData.currentArtifactType) {
      chrome.storage.sync.get(["openMessageSidebarOnStartup"], function (result) {
        var openMessageSidebarOnStartupValue;
        // default mode is open
        if (result["openMessageSidebarOnStartup"] === undefined) {
          chrome.storage.sync.set({
            openMessageSidebarOnStartup: false,
          });
          openMessageSidebarOnStartupValue = false;
        } else {
          openMessageSidebarOnStartupValue = result["openMessageSidebarOnStartup"];
        }

        openMessageSidebarOnStartupValue = result["openMessageSidebarOnStartup"];
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
  let cacheValue = 120;
  if (cache) {
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
    cpiData.runtimeLocations = cpiData.runtimeLocations.filter((loc) => loc.state == "ACTIVE");

    //iterate all runtime locations to find the ones that have active iflows
    cpiData.runtimeLocationWithActiveIFlow = [];

    // Fehler: await in forEach! Besser for...of verwenden:
    for (const loc of cpiData.runtimeLocations) {
      const locIdParam = "?runtimeLocationId=" + loc.id;
      const resp = await makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListCommand" + locIdParam, 120, null, null, null, null, !silent);
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
    }

    if (cpiData.runtimeLocationWithActiveIFlow.length == 0) {
      throw "Integration Flow was not found. Probably it is not deployed.";
    }

    // 4. Detaildaten holen
    const detailResp = await makeCallPromise(
      "GET",
      "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentDetailCommand?artifactId=" + cpiData.runtimeLocationWithActiveIFlow[0].artifact.id,
      60,
      "application/json",
      null,
      null,
      null,
      !silent
    );
    const detail = JSON.parse(detailResp);
    cpiData.flowData = detail;
    cpiData.flowData.lastUpdate = new Date().toISOString();
    cpiData.tenantId = detail?.artifactInformation?.tenantId;
    cpiData.artifactId = detail?.artifactInformation?.id;
    cpiData.version = detail?.artifactInformation?.version;

    if (callback) callback();
  } catch (error) {
    if (!silent) showToast("Error: " + JSON.stringify(error));
  }
}

async function getIflowInfoNeo(callback, silent = false, cache = true) {
  let cacheValue = 120;
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

//opens the popup that is triggered bei the info button
async function openIflowInfoPopup() {
  async function getInfoContent() {
    await getIflowInfo(null, false, false);

    var x = document.createElement("div");
    x.classList.add("cpiHelper_infoPopUp_content");
    x.innerHTML = "";

    var deployedOn = cpiData?.flowData?.artifactInformation?.deployedOn;
    if (deployedOn) {
      let date = new Date(deployedOn);
      //handle time zone differences
      date.setTime(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
      deployedOn = date.toLocaleString();
    }

    var textElement = `
      <h4 class="ui horizontal divider left aligned header">
        <i class="info icon"></i>
        iFlow Info
      </h4>
      `;
    x.appendChild(createElementFromHTML(textElement));
    textElement = `<div class="cpiHelper_infoPopUp_items">
      <div>Name: ${cpiData?.flowData?.artifactInformation?.name}</div>
      <div>SymbolicName: ${cpiData?.flowData?.artifactInformation?.symbolicName}</div>
      <div>Trace: ${cpiData?.flowData?.logConfiguration?.traceActive}</div>
      <div>DeployedVersion: ${cpiData?.flowData?.artifactInformation?.version}</div>
      <div>DeployedOn: ${deployedOn}</div>
      <div>DeploymentState: ${cpiData?.flowData?.artifactInformation?.deployState}</div>
      <div>SemanticState: ${cpiData?.flowData?.artifactInformation?.semanticState}</div>
      <div>DeployedBy: ${cpiData?.flowData?.artifactInformation?.deployedBy}</div>
    </div>`;

    x.appendChild(createElementFromHTML(textElement));

    if (cpiData?.flowData?.endpointInformation && cpiData?.flowData?.endpointInformation.length > 0) {
      cpiData.flowData.endpointInformation.forEach((element) => {
        if (element.endpointInstances && element.endpointInstances.length > 0) {
          var e = document.createElement("div");
          e.classList.add("cpiHelper_infoPopUp_items");
          e.innerHTML = `<div>Endpoints:</div>`;
          x.appendChild(e);
          for (var i = 0; i < element.endpointInstances.length; i++) {
            let f = document.createElement("div");
            f.className = "contentText";
            f.innerText = `${element.endpointInstances[i]?.endpointCategory}: ${element.endpointInstances[i]?.endpointUrl}`;
            var quickCopyToClipboardButton = createElementFromHTML(
              "<button class='cpiHelper_inlineInfo-button' ><span data-sap-ui-icon-content='' data-text='" +
                `${element.endpointInstances[i]?.endpointUrl}` +
                "' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>"
            );
            quickCopyToClipboardButton.onclick = (event) => {
              copyText(event.srcElement.getAttribute("data-text"));
            };
            f.appendChild(quickCopyToClipboardButton);
            e.appendChild(f);
          }
        }
      });
    }
    //JSON?
    // List Variables
    // GET https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/Operations/com.sap.esb.monitoring.datastore.access.command.ListDataStoreEntriesCommand?storeName=sap_global_store&allStores=true&maxNum=100000

    async function createTableForVariables() {
      var variableList = await makeCallPromise(
        "GET",
        "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.ListDataStoreEntriesCommand?storeName=sap_global_store&allStores=true&maxNum=100000",
        false,
        "application/json",
        null,
        false
      );

      variableList = JSON.parse(variableList).entries;

      //check if variables exist
      if (variableList == null || variableList.length == 0) {
        return document.createElement("div");
      }

      //filter only global variables or variables from this flow
      variableList = variableList.filter((element) => !element.qualifier || element.qualifier == cpiData?.flowData?.artifactInformation?.symbolicName);

      //check if array is now empty
      if (variableList == null || variableList.length == 0) {
        return document.createElement("div");
      }

      //if not, build table
      var result = document.createElement("table");
      result.classList.add("cpiHelper_infoPopUp_Table");

      tr0 = document.createElement("tr");
      tr0th1 = document.createElement("th");
      tr0th1.innerText = "Store";
      tr0th2 = document.createElement("th");
      tr0th2.innerText = "Name";
      tr0th2.style.width = "100%";

      tr0.appendChild(document.createElement("td"));
      tr0.appendChild(tr0th1);
      tr0.appendChild(tr0th2);
      result.appendChild(tr0);

      var even = "";
      variableList.forEach((item) => {
        let tr = document.createElement("tr");
        tr.id = item.id + item.storeName;
        tr.className = even;

        let tdfunctions = document.createElement("td");
        tdfunctions.style.whiteSpace = "nowrap";

        let showButton = createElementFromHTML("<button><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");

        tdfunctions.appendChild(showButton);

        let downloadButton = createElementFromHTML("<button><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");
        tdfunctions.appendChild(downloadButton);

        let deleteButton = createElementFromHTML("<button><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");
        tdfunctions.appendChild(deleteButton);

        tr.appendChild(tdfunctions);

        let td1 = document.createElement("td");
        td1.innerText = item.qualifier == null ? "global" : "local";
        tr.appendChild(td1);

        let td2 = document.createElement("td");
        td2.innerText = item.id;
        tr.appendChild(td2);

        downloadButton.onclick = async (element) => {
          let payload = { storeName: item.storeName, id: item.id };
          if (item.qualifier) {
            payload.qualifier = item.qualifier;
          }
          var response = await makeCallPromise("POST", "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStorePayloadCommand", false, "", JSON.stringify(payload), true, "application/json;charset=UTF-8");
          var value = response.match(/<payload>(.*)<\/payload>/gs)[0];
          value = value.substring(9, value.length - 10);

          window.open("data:application/zip;base64," + value);
        };

        showButton.onclick = async (element) => {
          text = document.getElementById(item.id + item.storeName + "_value");

          if (text.classList.contains("cpiHelper_infoPopUp_TR_hide")) {
            try {
              let payload = {
                storeName: item.storeName,
                id: item.id,
              };
              if (item.qualifier) {
                payload.qualifier = item.qualifier;
              }

              var response = await makeCallPromise(
                "POST",
                "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStoreVariableCommand",
                false,
                "",
                JSON.stringify(payload),
                true,
                "application/json;charset=UTF-8"
              );
              var value = response.match(/<value>(.*)<\/value>/gs)[0];

              //aggressive mode means we look into the zip file from variable
              var agressiveMode = false;
              if (!value) {
                aggressiveMode = true;
                function base64ToBuffer(str) {
                  str = window.atob(str); // creates a ASCII string
                  var buffer = new ArrayBuffer(str.length),
                    view = new Uint8Array(buffer);
                  for (var i = 0; i < str.length; i++) {
                    view[i] = str.charCodeAt(i);
                  }
                  return buffer;
                }

                var response = await makeCallPromise(
                  "POST",
                  "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStorePayloadCommand",
                  false,
                  "",
                  JSON.stringify(payload),
                  true,
                  "application/json;charset=UTF-8"
                );
                var base = response.match(/<payload>(.*)<\/payload>/gs)[0];
                base = base.substring(9, base.length - 10);

                var new_zip = new JSZip();
                await new_zip.loadAsync(base64ToBuffer(base));

                value = await new_zip.files[Object.keys(new_zip.files)[0]].async("string");
              } else {
                //when no aggressive mode, data has still to be transformed from base64
                value = atob(value.substring(7, value.length - 8));
              }

              let valueTd = document.createElement("td");
              valueTd.colSpan = 4;

              valueTd.innerText = value;
              text.innerHTML = "";
              text.appendChild(valueTd);
              if (agressiveMode) {
                showToast("Aggressive mode was used to show variable");
              }

              text.classList.remove("cpiHelper_infoPopUp_TR_hide");
            } catch (error) {
              showToast("It was not possible to extract the data.", "Please download and try manually.");
            }
          } else {
            text.classList.add("cpiHelper_infoPopUp_TR_hide");
            text.innerHTML = "<td colspan=4>Please wait...</td>";
          }
        };

        deleteButton.onclick = async (element) => {
          var doDelete = getConfirmation(`Do you really want to delete variable \"${item.id}\"? You can not undo this.`);
          if (doDelete) {
            //delete Variable
            try {
              let payload = {
                storeName: item.storeName,
                ids: [item.id],
              };
              if (item.qualifier) {
                payload.qualifier = item.qualifier;
              }
              var response = await makeCallPromise(
                "POST",
                "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.DeleteDataStoreEntryCommand",
                false,
                "",
                JSON.stringify(payload),
                true,
                "application/json;charset=UTF-8"
              );
              showToast("Variable deleted.");
              let cpiHelper_infoPopUp_Variables = document.getElementById("cpiHelper_infoPopUp_Variables");

              cpiHelper_infoPopUp_Variables.appendChild(await createTableForVariables());
              cpiHelper_infoPopUp_Variables.children[0].remove();
            } catch (err) {
              showToast("Do you have sufficient rights?", "Can not delete variable", "error");
            }
          }
        };

        let trShowButton = document.createElement("tr");
        trShowButton.className = even;
        trShowButton.classList.add("cpiHelper_infoPopUp_TR_hide");
        trShowButton.id = item.id + item.storeName + "_value";
        trShowButton.innerHTML = "<td colspan=4>Please wait...</td>";

        result.appendChild(tr);
        result.appendChild(trShowButton);

        even = even == "even" ? "" : "even";
      });

      return result;
    }

    var variablesDiv = document.createElement("div");
    variablesDiv.id = "cpiHelper_infoPopUp_Variables";
    variablesDiv.classList.add("cpiHelper_infoPopUp_items");
    variablesDiv.appendChild(await createTableForVariables());
    x.appendChild(variablesDiv);

    //Get Variable XCSRF
    //https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStoreVariableCommand
    // {"storeName":"sap_global_store","id":"keywordsSinceIds","qualifier":"Sentiment_Engagement_-_Twitter_Keywords_Search_Integration_Flow"}

    //delete variables XCSRF
    // POST https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/Operations/com.sap.esb.monitoring.datastore.access.command.DeleteDataStoreEntryCommand
    // {"storeName":"sap_global_store","ids":["dateglobal"]}

    //undeploy button
    if (deployedOn) {
      var undeploybutton = document.createElement("button");
      undeploybutton.classList.add("ui");
      undeploybutton.classList.add("button");

      undeploybutton.innerText = "Undeploy this IFlow";
      undeploybutton.id = "undeploybutton";
      undeploybutton.addEventListener("click", (a) => {
        undeploy(cpiData?.flowData?.artifactInformation?.tenantId, cpiData?.flowData?.artifactInformation?.id);
      });
      x.appendChild(undeploybutton);
    }
    var textElement2 = `
<h4 class="ui horizontal divider left aligned header">
  <i class="envelope icon"></i>
  News
</h4>
`;
    x.appendChild(createElementFromHTML(textElement2));
    //more information about cpi helper
    textElement2 = `<div class="cpiHelper_infoPopUp_items">

  <p>For news and interesting blog posts about SAP CI, <b>please follow our company <a href="https://www.linkedin.com/company/kangoolutions" target="_blank">LinkedIn-Page</a></b>.</p>
  <div><p>We are a bunch of passionate SAP CI developers from Cologne, Germany. If you want to work with us then you can reach us through our website <a href="https://kangoolutions.com" target="_blank">kangoolutions.com</a>. Or maybe you want to become part of the team? Then have a look <a href="https://ich-will-zur.kangoolutions.com/" target="_blank">here</a> (German only). Unfortunately, we can only consider applicants with german residence due to legal reasons.</p></div>
  <h4 class="ui horizontal divider left aligned header">
  <i class="envelope icon"></i>
  General Information
</h4>
  <div>Created by: Dominic Beckbauer and Kangoolutions.com</div>
  <div>License: <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">GNU GPL v3</a></div>
  <div>Please also check our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">Github
  Page</a>.</div>
  </div>`;

    x.appendChild(createElementFromHTML(textElement2));

    var whatsNewButton = document.createElement("button");
    whatsNewButton.classList.add("ui");
    whatsNewButton.classList.add("button");

    whatsNewButton.innerText = "Whats New?";
    whatsNewButton.addEventListener("click", (a) => {
      whatsNewCheck(false);
      $("#cpiHelper_semanticui_modal").modal({ autoShow: true, detachable: false, blurring: true }).modal("show");
      statistic("info_popup_whatsnew_click");
    });
    x.appendChild(whatsNewButton);

    //add a new "become part of the team" button
    var recrutingButton = document.createElement("button");
    recrutingButton.classList.add("ui");
    recrutingButton.classList.add("button");

    var lang = navigator.language || navigator.userLanguage;

    if (lang == "de-DE") {
      recrutingButton.innerText = "Werde Berater bei Kangoolutions";
      recrutingButton.addEventListener("click", (a) => {
        recrutingPopup(true);
        $("#cpiHelper_semanticui_modal")
          .modal({
            autoShow: true,
            detachable: false,
            blurring: true,
          })
          .modal("show");
        statistic("info_popup_recruting_click");
      });
      x.appendChild(recrutingButton);
    }
    return x;
  }

  showBigPopup(getInfoContent, "General Information", { fullscreen: false });
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
        <div style="padding-left:0px" id="updatedText" class="contentText"></div>
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
  ///MessageProcessingLogRuns('AF5eUbNwAc1SeL_vdh09y4njOvwO')/RunSteps?$inlinecount=allpages&$format=json&$top=500
  var resp = await getMessageProcessingLogRuns(MessageGuid, false);
  var customHeaders = await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogs('" + MessageGuid + "')?$format=json&$expand=CustomHeaderProperties", false);
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
  console.log(top_mode_count);
  return makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogs('" + MessageGuid + "')/Runs?$inlinecount=allpages&$format=json&$top=200", store)
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
      return makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogRuns('" + runId + "')/RunSteps?$inlinecount=allpages&$format=json" + top_mode_count, store);
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
    log.log("Highlighted Artifact: " + artifactType + ": " + result);
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

function getIflowId() {
  var url = window.location.href;
  var result;

  //try {
  let groups = "";

  if (cpiIflowUriRegexp.test(url) === true) {
    groups = url.match(cpiIflowUriRegexp).groups;
    result = groups.artifactId;
  }

  if (result != undefined) {
    log.log("Found IFlow: " + result);
    cpiData.currentIflowId = result;
    cpiData.lastVisitedIflowId = result;
  } else {
    cpiData.currentIflowId = null;
    log.log("no iflow found");
  }
  return result;
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

  //check current artifact
  await storeVisitedIflowsForPopup();

  getPackageId();
  getIflowId();

  collectDataOfCurrentArtifact();

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
          if (dataRegexp[1] == "Package") {
            urlext = "?section=ARTIFACTS";
          }

          //put the current flow to the last element. last position indicates last visited element
          visitedIflows.push({
            name: `${cpiArtifactId}`,
            url: document.location.href + urlext,
            favorit: false,
            type: `${dataRegexp[1]}`,
          });

          //delete the first one when there are more than 10 iflows in visited list
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

  //check if message sidebar should be refreshed
  if (!refreshActive && sidebar.active && (nextMessageSidebarRefreshCount <= 0 || (lastTabHidden > 0 && document.hidden == false))) {
    log.debug("refresh message sidebar");
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
    log.debug("refresh message sidebar done");
    var end = new Date();
    lastDurationRefresh = end - start;
    log.debug("refresh message sidebar took " + lastDurationRefresh + "ms");
    nextMessageSidebarRefreshCount = calculateMessageSidebarTimerTime(lastTabHidden, lastDurationRefresh);
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
