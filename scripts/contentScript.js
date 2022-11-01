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
cpiArtifactURIRegexp = [
  /\/integrationflows\/(?<artifactId>[0-9a-zA-Z_\-.]+)/,
  /\/odataservices\/(?<artifactId>[0-9a-zA-Z_\-.]+)/,
  /\/restapis\/(?<artifactId>[0-9a-zA-Z_\-.]+)/,
  /\/soapapis\/(?<artifactId>[0-9a-zA-Z_\-.]+)/,
  /\/valuemappings\/(?<artifactId>[0-9a-zA-Z_\-.]+)/,
  /\/scriptcollections\/(?<artifactId>[0-9a-zA-Z_\-.]+)/,
  /\/messagemappings\/(?<artifactId>[0-9a-zA-Z_\-.]+)/
];

//opens a new window with the Trace for a MessageGuid
function openTrace(MessageGuid) {

  //we have to get the RunID first
  makeCall("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogs('" + MessageGuid + "')/Runs?$format=json", false, "", (xhr) => {
    if (xhr.readyState == 4) {
      var resp = JSON.parse(xhr.responseText);
      var runId = resp.d.results[0].Id;

      let url = '/' + cpiData.urlExtension + 'shell/monitoring/MessageProcessingRun/%7B"parentContext":%7B"MessageMonitor":%7B"artifactKey":"__ALL__MESSAGE_PROVIDER","artifactName":"All%20Artifacts"%7D%7D,"messageProcessingLog":"' + MessageGuid + '","RunId":"' + runId + '"%7D';
      window.open(url, '_blank');
    }
  })
}
cpiData.functions.openTrace = openTrace;

//open new window for infos
function openInfo(url) {
  window.open(url, '_blank');
}

//refresh the logs in message window
var getLogsTimer;
var activeInlineItem;
var numberEntries = 10

//fill the message sidebar
async function renderMessageSidebar() {

  var createRow = function (elements) {
    var tr = document.createElement("tr");
    elements.forEach(element => {
      let td = document.createElement("td");
      elements.length == 1 ? td.colSpan = 3 : null;
      typeof (element) == "object" ? td.appendChild(element) : td.innerHTML = element;
      tr.appendChild(td);
    });
    return tr;
  }

  //check if iflowid exists
  iflowId = cpiData.integrationFlowId;
  if (!iflowId) {
    return;
  }


  getIflowInfo((data) => {
    let deploymentText = document.getElementById('deploymentText');
    if (deploymentText) {



      let statusColor = "#000";

      if (cpiData?.flowData?.artifactInformation?.deployState == "DEPLOYED") {
        statusColor = "#008000";
      }

      if (cpiData?.flowData?.artifactInformation?.deployState == "STARTING") {
        statusColor = "#FFC300"; trace
      }

      if (cpiData?.flowData?.artifactInformation?.deployState == "STORED") {
        statusColor = "#FFC300";
      }

      if (cpiData?.flowData?.artifactInformation?.deployState == "FAILED") {
        statusColor = "#FF0000";

      }

      deploymentText.innerHTML = "State: <span style='color: " + statusColor + "'>" + cpiData?.flowData?.artifactInformation?.deployState + "</span>";
    }
  }, true)


  //get the messagelogs for current iflow
  makeCall("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogs?$filter=IntegrationFlowName eq '" + iflowId + "' and Status ne 'DISCARDED'&$top=" + numberEntries + "&$format=json&$orderby=LogEnd desc", false, "", async (xhr) => {

    if (xhr.readyState == 4 && sidebar.active) {

      var resp = JSON.parse(xhr.responseText);
      resp = resp.d.results;

      //    document.getElementById('iflowName').innerText = cpiData.integrationFlowId;

      let updatedText = document.getElementById('updatedText');

      updatedText.innerHTML = "<span>Updated: " + new Date().toLocaleTimeString("de-DE") + "</span>";

      let thisMessageHash = "";
      if (resp.length != 0) {

        //stores information for this run to be used with plugin engine
        var runInfoElement = {}
        thisMessageHash = resp[0].MessageGuid + resp[0].LogStart + resp[0].LogEnd + resp[0].Status;

        if (thisMessageHash != cpiData.messageSidebar.lastMessageHashList[0]) {

          let thisMessageHashList = [];

          let messageList = document.getElementById('messageList');
          messageList.innerHTML = "";
          var lastDay;

          for (var i = 0; i < resp.length; i++) {
            thisMessageHashList.push(resp[i].MessageGuid + resp[i].LogStart + resp[i].LogEnd + resp[i].Status);
            runInfoElement[thisMessageHash] = {}
            runInfoElement[thisMessageHash].messageHash = resp[i].MessageGuid + resp[i].LogStart + resp[i].LogEnd + resp[i].Status;
            runInfoElement[thisMessageHash].messageGuid = resp[i].MessageGuid;
            runInfoElement[thisMessageHash].logStart = new Date(parseInt(resp[i].LogStart.match(/\d+/)[0]))
            runInfoElement[thisMessageHash].logEnd = new Date(parseInt(resp[i].LogEnd.match(/\d+/)[0]))
            runInfoElement[thisMessageHash].status = resp[i].Status;
            runInfoElement[thisMessageHash].message = resp[i].LogLevel;

            //write date if necessary
            let date = new Date(parseInt(resp[i].LogEnd.match(/\d+/)[0]));


            //add offset to utc time. The offset is not correct anymore but isostring can be used to show local time
            date.setTime(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
            runInfoElement[thisMessageHash].timeZoneOffset = date.getTimezoneOffset()
            date = date.toISOString();


            if (date.substr(0, 10) != lastDay) {
              messageList.appendChild(createRow([date.substr(0, 10)]));
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

            let traceButton = createElementFromHTML("<button title='jump to trace page' id='trace--" + i + "' class='" + resp[i].MessageGuid + flash + "'>" + loglevel.substr(0, 1).toUpperCase() + "</button>");

            if (loglevel.toLowerCase() === "trace") {
              var quickInlineTraceButton = createElementFromHTML("<button title='activate inline trace for debugging' class='" + resp[i].MessageGuid + flash + " cpiHelper_inlineInfo-button' style='cursor: pointer;'><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");
            } else {
              var quickInlineTraceButton = createElementFromHTML("<span />")
            }

            let infoButton = createElementFromHTML("<button title='show logs in new tab' id='info--" + i + "' class='" + (cpiData.urlExtension ? resp[i].AlternateWebLink.replace("443/shell", "443/" + cpiData.urlExtension + "shell") : resp[i].AlternateWebLink) + flash + "'><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");
            let logButton = createElementFromHTML("<button title='show log viewer on this page' id='logs--" + i + "' class='" + resp[i].MessageGuid + flash + "'><span data-sap-ui-icon-content=\"\" class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");

            //let listItem = document.createElement("div");
            //listItem.classList.add("cpiHelper_messageListItem")
            let statusColor = "#008000";
            let statusIcon = "";
            if (resp[i].Status == "PROCESSING") {
              statusColor = "#FFC300";
              statusIcon = "";
            }
            if (resp[i].Status == "FAILED") {
              statusColor = "#C70039";
              statusIcon = "";
            }


            //listItem.style["color"] = statusColor;

            let timeButton = createElementFromHTML("<button class='" + resp[i].MessageGuid + flash + " cpiHelper_inlineInfo-button' style='cursor: pointer;'>" + date.substr(11, 8) + "</button>");

            activeInlineItem == quickInlineTraceButton.classList[0] && quickInlineTraceButton.classList.add("cpiHelper_inlineInfo-active");


            let statusicon = createElementFromHTML("<button class='" + resp[i].MessageGuid + " cpiHelper_sidebar_iconbutton'><span data-sap-ui-icon-content='" + statusIcon + "' class='" + resp[i].MessageGuid + " sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem; color:" + statusColor + ";'> </span></button>");

            statusicon.onmouseover = (e) => {

              errorPopupOpen(e.currentTarget.classList[0]);
              errorPopupSetTimeout(null);
            };
            statusicon.onmouseout = (e) => {
              errorPopupSetTimeout(2000);
            };

            quickInlineTraceButton.onmouseup = async (e) => {
              var mytarget = e.currentTarget
              if (activeInlineItem == e.currentTarget.classList[0]) {

                hideInlineTrace();
                showSnackbar("Inline Debugging Deactivated");


              } else {
                hideInlineTrace();
                var inlineTrace = await showInlineTrace(e.currentTarget.classList[0]);
                if (inlineTrace) {
                  showSnackbar("Inline Debugging Activated");
                  mytarget.classList.add("cpiHelper_inlineInfo-active");
                  activeInlineItem = mytarget.classList[0];
                } else {
                  activeInlineItem = null;
                  showSnackbar("Inline debugging not possible. No data found.");
                }
              }
            };

            var pluginButtons = await createPluginButtonsInMessageSidebar(runInfoElement[thisMessageHash], i, flash);

            messageList.appendChild(createRow([statusicon, timeButton, logButton, infoButton, traceButton, quickInlineTraceButton, ...pluginButtons]));

            infoButton.addEventListener("click", (a) => {
              openInfo(a.currentTarget.classList[0]);
            });

            logButton.addEventListener("click", async (a) => {

              await showBigPopup(await createContentNodeForLogs(a.currentTarget.classList[0], false), "Logs (beta feature)");

            });


            traceButton.addEventListener("click", (a) => {

              openTrace(a.currentTarget.classList[0]);

            });


            cpiData.messageSidebar.lastMessageHashList = thisMessageHashList;
          }

          /*       var moreButton = document.getElementById('showmore');
       
                 moreButton.onclick = (a) => {
                   if (numberEntries == 10) {
                     numberEntries = 20
                     cpiData.messageSidebar.lastMessageHashList = []
                     a.currentTarget.innerText = "show less"
       
                   } else {
       
                     cpiData.messageSidebar.lastMessageHashList = []
                     numberEntries = 10;
                     a.currentTarget.innerText = "show more"
                   }
                 }
       
                 */




        }
      }
      await messageSidebarPluginContent();
      //new update in 3 seconds
      if (sidebar.active) {
        var getLogsTimer = setTimeout(renderMessageSidebar, 3000);
      }
    }
  }, null, false);//
}

var inlineTraceRunning = false;
async function clickTrace(e) {

  if (inlineTraceRunning) {
    return;
  }

  inlineTraceRunning = true;


  var formatLogContent = function (inputList) {
    inputList = inputList.sort(function (a, b) { return a.Name.toLowerCase() > b.Name.toLowerCase() ? 1 : -1 });
    result = "<table><tr><th>Name</th><th>Value</th></tr>"
    var even = "";
    inputList.forEach(item => {
      result += "<tr class=\"" + even + "\"><td>" + item.Name + "</td><td style=\"word-break: break-all;\">" + item.Value + "</td></tr>"
      if (even == "even") {
        even = "";
      } else {
        even = "even";
      }
    });
    result += "</table>";
    return result;
  }

  var formatInfoContent = function (inputList) {

    valueList = [];

    var stepStart = new Date(parseInt(inputList.StepStart.substr(6, 13)));
    stepStart.setTime(stepStart.getTime() - stepStart.getTimezoneOffset() * 60 * 1000);

    valueList.push({ Name: "Start Time", Value: stepStart.toISOString().substr(0, 23) });

    if (inputList.StepStop) {
      var stepStop = new Date(parseInt(inputList.StepStop.substr(6, 13)));
      stepStop.setTime(stepStop.getTime() - stepStop.getTimezoneOffset() * 60 * 1000);
      valueList.push({ Name: "End Time", Value: stepStop.toISOString().substr(0, 23) });
      valueList.push({ Name: "Duration in milliseconds", Value: (stepStop - stepStart) });
      valueList.push({ Name: "Duration in seconds", Value: (stepStop - stepStart) / 1000 });
      valueList.push({ Name: "Duration in minutes", Value: (stepStop - stepStart) / 1000 / 60 });
    }

    valueList.push({ Name: "BranchId", Value: inputList.BranchId });

    valueList.push({ Name: "RunId", Value: inputList.RunId });

    valueList.push({ Name: "StepId", Value: inputList.StepId });

    valueList.push({ Name: "ModelStepId", Value: inputList.ModelStepId });

    valueList.push({ Name: "ChildCount", Value: inputList.ChildCount });


    result = "<table><tr><th>Name</th><th>Value</th></tr>"
    var even = "";
    valueList.forEach(item => {
      result += "<tr class=\"" + even + "\"><td>" + item.Name + "</td><td style=\"word-break: break-all;\">" + item.Value + "</td></tr>"
      if (even == "even") {
        even = "";
      } else {
        even = "even";
      }
    });
    result += "</table>";
    return result;
  }


  //get the content for a tab in a trace popup
  var getTraceTabContent = async function (object) {
    var traceData = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + object.runId + "',ChildCount=" + object.childCount + ")/TraceMessages?$format=json", true)).d.results;
    var trace = traceData.sort((a, b) => {
      return a.TraceId - b.TraceId;
    })[0];
    if (!trace) {
      showSnackbar("No trace for this step exists, it is already deleted or not in trace mode.");
      return "No trace for this step exists, it is already deleted or not in trace mode.";
      //   throw new Error("no trace found");
    }
    var traceId = trace.TraceId
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
      let elements = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + object.runId + "',ChildCount=" + object.childCount + ")/?$expand=RunStepProperties&$format=json", true)).d.RunStepProperties.results;
      html = formatLogContent(elements);
    }

    if (object.traceType == "info") {
      let elements = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + object.runId + "',ChildCount=" + object.childCount + ")/?$expand=RunStepProperties&$format=json", true)).d;
      html = formatInfoContent(elements);
    }

    return html;
  }

  var id = this.id.replace(/BPMN[a-zA-Z-]+_/, "");

  var targetElements = inlineTraceElements.filter((element) => {
    return element.StepId == id || element.ModelStepId == id;
  })

  var runs = [];

  for (var n = targetElements.length - 1; n >= 0; n--) {
    var childCount = targetElements[n].ChildCount;
    var runId = targetElements[n].RunId;
    var branch = targetElements[n].BranchId
    try {

      // var traceId = JSON.parse(await makeCallPromise("GET", "/"+cpiData.urlExtension+"odata/api/v1/MessageProcessingLogRunSteps(RunId='" + runId + "',ChildCount=" + childCount + ")/TraceMessages?$format=json", true)).d.results[0].TraceId;

      var objects = [{
        label: "Properties",
        content: getTraceTabContent,
        active: true,
        childCount: childCount,
        runId: runId,
        traceType: "properties"
      }, {
        label: "Headers",
        content: getTraceTabContent,
        active: false,
        childCount: childCount,
        runId: runId,
        traceType: "headers"
      }, {
        label: "Body",
        content: getTraceTabContent,
        active: false,
        childCount: childCount,
        runId: runId,
        traceType: "trace"
      }, {
        label: "Log",
        content: getTraceTabContent,
        active: false,
        childCount: childCount,
        runId: runId,
        traceType: "logContent"
      },
      {
        label: "Info",
        content: getTraceTabContent,
        active: false,
        childCount: childCount,
        runId: runId,
        traceType: "info"
      }
      ]

      if (targetElements[n].Error) {
        let innerContent = document.createElement("div");
        innerContent.classList.add("cpiHelper_traceText");
        innerContent.innerText = targetElements[n].Error;
        innerContent.style.display = "block";

        objects.push({
          label: "Error",
          content: innerContent,
          active: false
        }
        );
      }

      let label = "" + branch
      let content = await createTabHTML(objects, "tracetab-" + childCount)

      if (content) {

        runs.push({
          label,
          content
        });

      }


    } catch (error) {
      console.log("error catching trace");

    }



  }

  //Trace
  //https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/odata/api/v1/TraceMessages(7875L)/$value

  //Properties
  //https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/odata/api/v1/TraceMessages(7875L)/ExchangeProperties?$format=json

  //Headers
  //https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/odata/api/v1/TraceMessages(7875L)/Properties?$format=json

  //TraceID
  //https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/odata/api/v1/MessageProcessingLogRunSteps(RunId='AF57ga2G45vKDTfn7zqO0zwJ9n93',ChildCount=17)/TraceMessages?$format=json

  if (runs.length == 0) {
    showSnackbar("No Trace Found.");
    return;
  }

  if (runs.length == 1) {
    showBigPopup(runs[0].content, "Content Before Step");
  } else {
    showBigPopup(await createTabHTML(runs, "runstab", 0), "Content Before Step");
  }
  inlineTraceRunning = false;
}

async function hideInlineTrace() {

  activeInlineItem = null;

  var classesToBedeleted = ["cpiHelper_inlineInfo", "cpiHelper_inlineInfo_error", "cpiHelper_inlineInfo-active"]

  onClicKElements.forEach((element) => {
    if (element.onclick) {
      element.onclick = null;
    }
  });

  onClicKElements = [];

  classesToBedeleted.forEach((element) => {
    let elements = document.getElementsByClassName(element);
    for (let i = (elements.length - 1); i >= 0; i--) {
      if (elements[i].onclick) {
        elements[i].onclick = null;
        //elements[i].removeEventListener('onclick', clickTrace);
      }
      elements[i].classList.remove(element)

    }
  });
}

var inlineTraceElements;
async function createInlineTraceElements(MessageGuid) {
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
        RunId: run.RunId,
        BranchId: run.BranchId,
        Error: run.Error
      });
    });

    return resolve(logRuns.length);
  });
}


var onClicKElements = [];
async function showInlineTrace(MessageGuid) {
  return new Promise(async (resolve, reject) => {
    var observerInstalled = false;
    var logRuns = await createInlineTraceElements(MessageGuid);

    if (logRuns == null || logRuns == 0) {
      return resolve(null);
    }

    inlineTraceElements.forEach((run) => {
      try {
        let target;
        let element;
        //    let target = element.children[getChild(element, ["g"])];
        //    target = target.children[getChild(target, ["rect", "circle", "path"])];



        if (/EndEvent/.test(run.StepId)) {
          element = document.getElementById("BPMNShape_" + run.StepId);
          target = element.children[0].children[0];
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

        target.classList.add("cpiHelper_inlineInfo");
        //     target.addEventListener("onclick", function abc(event) { clickTrace(event); });
        element.classList.add("cpiHelper_onclick");
        element.onclick = clickTrace;
        onClicKElements.push(element);

        if (run.Error) {
          target.classList.add("cpiHelper_inlineInfo_error");
        }

        if (!observerInstalled) {

          observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              const el = mutation.target;
              if (!mutation.target.classList.contains('cpiHelper_onclick')) {
                hideInlineTrace();
                observer.disconnect();
              }
            });
          });

          observer.observe(document.getElementById(element.id), {
            attributes: true,
            attributeFilter: ['class']
          });
          observerInstalled = true;
        }

      } catch (e) {
        console.log("no element found for " + run.StepId);
        console.log(run);
      }

      return resolve(true);

    })
  })
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
function setLogLevel(logLevel, iflowId) {



  makeCall("POST", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentSetMplLogLevelCommand", true, '{"artifactSymbolicName":"' + iflowId + '","mplLogLevel":"' + logLevel.toUpperCase() + '","nodeType":"IFLMAP"}', (xhr) => {
    if (xhr.readyState == 4 && xhr.status == 200) {
      showSnackbar("Trace is activated");
    }
    else {
      showSnackbar("Error activating Trace");
    }
  }, 'application/json;charset=UTF-8');
}

//makes a http call to set the log level to trace
function undeploy(tenant = null, artifactId = null) {
  tenant ??= cpiData.tenantId;
  artifactId ??= cpiData.artifactId;
  makeCall("POST", "/" + cpiData.urlExtension + "Operations/com.sap.it.nm.commands.deploy.DeleteContentCommand", true, 'artifactIds=' + artifactId + '&tenantId=' + tenant, (xhr) => {
    if (xhr.readyState == 4 && xhr.status == 200) {
      showSnackbar("Undeploy triggered");
    }
    else {
      showSnackbar("Error triggering undeploy");
    }
  }, "application/x-www-form-urlencoded; charset=UTF-8");
}
cpiData.functions.undeploy = undeploy;




//injected buttons are created here
var powertraceflow = null
var powertrace = null;
function buildButtonBar() {
  try {
    var headerBar = document.getElementById('__xmlview0--iflowObjectPageHeader-identifierLine');
    headerBar.style.paddingBottom = "0px";
  } catch (e) {

  }

  if (!document.getElementById("__buttonxx")) {
    whatsNewCheck();
    //create Trace Button
    var powertraceText = ""
    if (powertrace != null && powertraceflow == cpiData.integrationFlowId) {
      powertraceText = "cpiHelper_powertrace"

    }

    var logsbutton = createElementFromHTML(`<button id="__button_log" data-sap-ui="__buttonxx" title="Logs" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; margin-left: 0px; float: right;"><span id="__buttonxx-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button134345-content"><bdi id="button134345-BDI-content" class="sapMBtnContent">Logs</bdi></span></span></button>`);

    var tracebutton = createElementFromHTML(`<button id="__buttonxx" data-sap-ui="__buttonxx" title="Enable traces" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxx-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button134345-content"><bdi id="button134345-BDI-content" class="${powertraceText}">Trace</bdi></span></span></button>`);

    //Create Toggle Message Bar Button
    var messagebutton = createElementFromHTML(' <button id="__buttonxy" data-sap-ui="__buttonxy" title="Messages" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxy-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button13-content"><bdi id="__button18778-BDI-content">Messages</bdi></span></span></button>');
    var infobutton = createElementFromHTML(' <button id="__buttoninfo" data-sap-ui="__buttoninfo" title="Info" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxy-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button13-content"><bdi id="__button134343-BDI-content">Info</bdi></span></span></button>');
    var pluginbutton = createElementFromHTML(' <button id="__buttonplugin" data-sap-ui="__buttoninfo" title="plugins" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxy-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button13-content"><bdi id="__button134343-BDI-content">Plugins</bdi></span></span></button>');
    //append buttons
    area = document.querySelector("[id*='--iflowObjectPageHeader-actions']");

    if (area) {
      area.style.textAlign = "right";
      var breakLine = document.createElement('br');

      area.appendChild(breakLine);
      area.appendChild(pluginbutton);
      area.appendChild(infobutton);
      area.appendChild(messagebutton);
      area.appendChild(tracebutton);
      area.appendChild(logsbutton);
    }


    tracebutton.addEventListener("click", () => {
      btn = document.getElementById("button134345-BDI-content")
      btn.classList.toggle("cpiHelper_powertrace")
      if (btn.classList.contains("cpiHelper_powertrace")) {
        setLogLevel("TRACE", cpiData.integrationFlowId);
        powertraceflow = cpiData.integrationFlowId;
        powertrace = setInterval(function () {
          btn = document.getElementById("button134345-BDI-content")
          if (btn && btn.classList.contains("cpiHelper_powertrace") || cpiData.integrationFlowId == powertraceflow) {
            setLogLevel("TRACE", cpiData.integrationFlowId);
          } else {
            powertraceflow = null;
            clearInterval(powertrace)

            powertrace = null;
          }
        }, 60 * 1000 * 5)
      } else {
        showSnackbar("Trace will not be retriggered anymore.");
      }

    });
    messagebutton.addEventListener("click", (btn) => {
      numberEntries = 15;

      if (sidebar.active) {
        sidebar.deactivate();
      }
      else {
        sidebar.init();
      }
    });
    infobutton.addEventListener("click", (btn) => {
      getIflowInfo(openIflowInfoPopup);
    });
    logsbutton.addEventListener("click", async (btn) => {
      // the logs popup opens and it shows the sidebar. the sidebar elements are updated
      showBigPopup(await createContentNodeForLogs(null, true), "Logs");
      updateArtifactList()
      updateLogList()
    });

    pluginbutton.addEventListener("click", async (btn) => {
      // the logs popup opens and it shows the sidebar. the sidebar elements are updated
      showBigPopup(await createContentNodeForPlugins(), "Plugins");

    });



    if (sidebar.active == null) {
      chrome.storage.sync.get(["openMessageSidebarOnStartup"], function (result) {
        var openMessageSidebarOnStartupValue = result["openMessageSidebarOnStartup"];
        if (openMessageSidebarOnStartupValue) {

          sidebar.init();
        }
      }
      );
    }
  }


}

//Collect Infos to Iflow
async function getIflowInfo(callback, silent = false) {

  return makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListCommand", false, null, null, null, null, !silent).then((response) => {
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
    if (!resp) {
      throw "Integration Flow was not found. Probably it is not deployed.";
    }
    return makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentDetailCommand?artifactId=" + resp.id, false, 'application/json', null, null, null, !silent);
  }).then((response) => {
    var resp = JSON.parse(response);
    cpiData.flowData = resp;
    cpiData.flowData.lastUpdate = new Date().toISOString();
    cpiData.tenantId = cpiData?.flowData?.artifactInformation?.tenantId
    cpiData.artifactId = cpiData?.flowData?.artifactInformation?.id;
    cpiData.version = cpiData?.flowData?.artifactInformation?.version;
    callback();
    return;
  }).catch((error) => {
    if (!silent) {
      showSnackbar(JSON.stringify(error));
    }
  });
}

//opens the popup that is triggered bei the info button
async function openIflowInfoPopup() {

  var x = document.createElement('div');
  x.classList.add("cpiHelper_infoPopUp_content");
  x.innerHTML = "";

  var deployedOn = cpiData?.flowData?.artifactInformation?.deployedOn;
  if (deployedOn) {
    let date = new Date(deployedOn);
    //handle time zone differences
    date.setTime(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
    deployedOn = date.toLocaleString();
  }

  var textElement = `<div class="cpiHelper_infoPopUp_items">
  <h2>iFlow Info</h2>
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

  if (cpiData.flowData.endpointInformation && cpiData.flowData.endpointInformation.length > 0) {
    cpiData.flowData.endpointInformation.forEach(element => {
      if (element.endpointInstances && element.endpointInstances.length > 0) {
        var e = document.createElement('div');
        e.classList.add("cpiHelper_infoPopUp_items");
        e.innerHTML = `<div>Endpoints:</div>`;
        x.appendChild(e);
        for (var i = 0; i < element.endpointInstances.length; i++) {
          let f = document.createElement('div');
          f.className = "contentText";
          f.innerText = `${element.endpointInstances[i]?.endpointCategory}: ${element.endpointInstances[i]?.endpointUrl}`;
          var quickCopyToClipboardButton = createElementFromHTML("<button class='cpiHelper_inlineInfo-button' style='cursor: pointer;'><span data-sap-ui-icon-content='' data-text='" + `${element.endpointInstances[i]?.endpointUrl}` + "' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");
          quickCopyToClipboardButton.onclick = (event) => {
            copyText(event.srcElement.getAttribute('data-text'));
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
    var variableList =
      await makeCallPromise(
        "GET",
        "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.ListDataStoreEntriesCommand?storeName=sap_global_store&allStores=true&maxNum=100000",
        false,
        "application/json", null, false

      )

    variableList = JSON.parse(variableList).entries;

    //check if variables exist
    if (variableList == null || variableList.length == 0) { return document.createElement("div"); }

    //filter only global variables or variables from this flow
    variableList = variableList.filter(element => !element.qualifier || element.qualifier == cpiData?.flowData?.artifactInformation?.symbolicName);

    //check if array is now empty
    if (variableList == null || variableList.length == 0) { return document.createElement("div"); }

    //if not, build table
    var result = document.createElement("table");
    result.classList.add("cpiHelper_infoPopUp_Table")

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
    variableList.forEach(item => {
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
      td1.innerText = (item.qualifier == null ? "global" : "local");
      tr.appendChild((td1));

      let td2 = document.createElement("td");
      td2.innerText = item.id;
      tr.appendChild((td2));

      downloadButton.onclick = async (element) => {
        let payload = { "storeName": item.storeName, "id": item.id };
        if (item.qualifier) {
          payload.qualifier = item.qualifier;
        }
        var response = await makeCallPromise("POST", "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStorePayloadCommand", false, "", JSON.stringify(payload), true, "application/json;charset=UTF-8");
        var value = response.match(/<payload>(.*)<\/payload>/sg)[0];
        value = value.substring(9, value.length - 10)

        window.open("data:application/zip;base64," + value);
      }


      showButton.onclick = async (element) => {
        text = document.getElementById(item.id + item.storeName + "_value");

        if (text.classList.contains("cpiHelper_infoPopUp_TR_hide")) {

          try {

            let payload = { "storeName": item.storeName, "id": item.id };
            if (item.qualifier) {
              payload.qualifier = item.qualifier;
            }


            var response = await makeCallPromise("POST", "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStoreVariableCommand", false, "", JSON.stringify(payload), true, "application/json;charset=UTF-8");



            var value = response.match(/<value>(.*)<\/value>/sg)[0];

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

              var response = await makeCallPromise("POST", "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStorePayloadCommand", false, "", JSON.stringify(payload), true, "application/json;charset=UTF-8");
              var base = response.match(/<payload>(.*)<\/payload>/sg)[0];
              base = base.substring(9, base.length - 10)

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
              showSnackbar("Aggressive mode was used to show variable");
            }

            text.classList.remove("cpiHelper_infoPopUp_TR_hide");
          } catch (error) {
            showSnackbar("It was not possible to extract the data. Please download and try manually.");
          }
        } else {
          text.classList.add("cpiHelper_infoPopUp_TR_hide");
          text.innerHTML = '<td colspan=4>Please wait...</td>';
        }
      }

      deleteButton.onclick = async (element) => {
        var doDelete = getConfirmation(`Do you really want to delete variable \"${item.id}\"? You can not undo this.`);
        if (doDelete) {
          //delete Variable
          try {
            let payload = { "storeName": item.storeName, "ids": [item.id] };
            if (item.qualifier) {
              payload.qualifier = item.qualifier;
            }
            var response = await makeCallPromise("POST", "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.DeleteDataStoreEntryCommand", false, "", JSON.stringify(payload), true, "application/json;charset=UTF-8");
            showSnackbar("Variable deleted.");
            let cpiHelper_infoPopUp_Variables = document.getElementById("cpiHelper_infoPopUp_Variables")

            cpiHelper_infoPopUp_Variables.appendChild(await createTableForVariables());
            cpiHelper_infoPopUp_Variables.children[0].remove();

          } catch (err) {
            showSnackbar("Can not delete variable. Do you have sufficient rights?");
          }

        }

      }





      let trShowButton = document.createElement("tr");
      trShowButton.className = even;
      trShowButton.classList.add("cpiHelper_infoPopUp_TR_hide")
      trShowButton.id = item.id + item.storeName + "_value";
      trShowButton.innerHTML = '<td colspan=4>Please wait...</td>';

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
    var undeploybutton = document.createElement('button');
    undeploybutton.innerText = "Undeploy";
    undeploybutton.id = "undeploybutton";
    undeploybutton.addEventListener("click", (a) => {
      undeploy(cpiData?.flowData?.artifactInformation?.tenantId, cpiData?.flowData?.artifactInformation?.id);
    });
    x.appendChild(undeploybutton);
  }

  //more information about cpi helper
  var textElement2 = `<div class="cpiHelper_infoPopUp_items">
  <h3>News</h3>
  <div><p>For news and interesting blog posts about SAP CI, <b>please follow our company <a href="https://www.linkedin.com/company/kangoolutions" target="_blank">LinkedIn-Page</a></b>.</p></div>
  <div><p>We are a bunch of passionate SAP CI developers from Cologne, Germany. If you want to do a CPI project with us then you can reach us through our website <a href="https://kangoolutions.com" target="_blank">kangoolutions.com</a>. Or maybe you want to become part of the team? Then have a look <a href="https://ich-will-zur.kangoolutions.com/" target="_blank">here</a> (German only). Unfortunately, we can only consider applicants with german residence due to legal reasons.</p></div>
  <div>Created by: Dominic Beckbauer and Kangoolutions.com</div>
  <div>License: <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">GNU GPL v3</a></div>
  <div>Please also check our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">Github
  Page</a>.</div>
  </div>`;

  x.appendChild(createElementFromHTML(textElement2));

  var whatsNewButton = document.createElement('button');
  whatsNewButton.innerText = "Whats New?";
  whatsNewButton.addEventListener("click", (a) => {
    whatsNewCheck(false)
  });
  x.appendChild(whatsNewButton);

  showBigPopup(x, "General Information");
}

function copyText(input) {
  navigator.clipboard.writeText(input).then(function () {
    showSnackbar("Copied!")
    console.log('Async: Copying to clipboard was successful!');
  }, function (err) {
    console.error('Async: Could not copy text: ', err);
  })
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

    //create sidebar div
    var elem = document.createElement('div');
    elem.innerHTML = `
    <div id="cpiHelper_contentheader">CPI Helper<span id='sidebar_modal_close' style="float:right;" class='cpiHelper_closeButton_sidebar'>X</span></div> 
    <div id="outerFrame">
    <div id="updatedText" class="contentText"></div>
    <div id="deploymentText" class="contentText">State: </div>
    <div><table id="messageList" class="contentText"></table></div>
    <!--<button id="showmore">show more</button>-->
    <div id="cpiHelper_messageSidebar_pluginArea"></div>
    </div>
    `;
    elem.id = "cpiHelper_content";
    elem.classList.add("cpiHelper");
    document.body.appendChild(elem);

    //add close button
    var span = document.getElementById("sidebar_modal_close");
    span.onclick = (element) => {
      sidebar.deactivate();
    };

    //activate dragging for message bar
    dragElement(document.getElementById("cpiHelper_content"));

    //lastMessageHashList must be empty when message sidebar is created
    cpiData.messageSidebar.lastMessageHashList = [];

    //refresh messages
    renderMessageSidebar();
  }
};



function injectCss(cssStyle, id, className) {
  var style = document.createElement('style');
  style.type = 'text/css';
  style.appendChild(document.createTextNode(cssStyle));
  id && (style.id = id);
  className && style.classList.add(className);
  document.getElementsByTagName('head')[0].appendChild(style);
}

function removeElementsWithId(name) {
  document.getElementById(name).remove();
  return true;
}

function removeElementsWithClass(classToDelete) {
  let elements = document.getElementsByClassName(classToDelete);
  for (let i = (elements.length - 1); i >= 0; i--) {
    elements[i].remove(element)
  }
  return true;
}


async function errorPopupOpen(MessageGuid) {
  var x = document.getElementById("cpiHelper_sidebar_popup");
  if (!x) {
    x = document.createElement('div');
    x.id = "cpiHelper_sidebar_popup";
    x.onmouseover = (e) => {
      errorPopupSetTimeout(null);
    };
    x.onmouseout = (e) => {
      errorPopupSetTimeout(3000);
    };
    document.body.appendChild(x);
  }

  x.innerText = "Please wait...";
  x.className = "show";

  ///MessageProcessingLogRuns('AF5eUbNwAc1SeL_vdh09y4njOvwO')/RunSteps?$inlinecount=allpages&$format=json&$top=500
  var resp = await getMessageProcessingLogRuns(MessageGuid, false)


  y = document.createElement('div');
  y.innerText = "";

  try {
    var customHeaders = await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogs('" + MessageGuid + "')?$format=json&$expand=CustomHeaderProperties", false)
    customHeaders = JSON.parse(customHeaders).d

    //Duration
    var stepStart = new Date(parseInt(customHeaders.LogStart.substr(6, 13)));
    stepStart.setTime(stepStart.getTime() - stepStart.getTimezoneOffset() * 60 * 1000);

    var stepStop = new Date(parseInt(customHeaders.LogEnd.substr(6, 13)));
    stepStop.setTime(stepStop.getTime() - stepStop.getTimezoneOffset() * 60 * 1000);


    let status = document.createElement("div");
    status.className = "contentText";
    status.innerText = "Status: " + customHeaders.CustomStatus
    y.appendChild(status)


    let text = document.createElement("div");
    text.className = "contentText";
    text.innerText = "Duration: " + ((stepStop - stepStart) / 1000).toFixed(2) + " seconds"
    y.appendChild(text)

    let text2 = document.createElement("div");
    text2.className = "contentText";
    text2.innerText = "Duration: " + ((stepStop - stepStart) / 1000 / 60).toFixed(2) + " minutes"
    y.appendChild(text2)

    //custom Headers and Properties
    customHeaders?.CustomHeaderProperties?.results.forEach(
      (element) => {
        let text = document.createElement("div");
        text.className = "contentText";
        text.innerText = element?.Name + ": " + element?.Value?.substr(0, 150)
        y.appendChild(text)
      }
    )
  } catch (err) {
    console.log(err + "no custom headers available")
  }


  if (resp == null || resp.length == 0) {
    let text = document.createElement("div");
    text.className = "contentText";
    text.innerText = "No Errormessage found."
    y.appendChild(text)

  } else {


    let error = false;
    for (var i = 0; i < resp.length; i++) {
      if (resp[i].Error) {
        error = true;
        let errorText = createErrorMessageElement(resp[i].Error);
        y.appendChild(errorText);
      }
    }
    if (!error || resp.length == 0) {
      let errorText = document.createElement("div");
      errorText.className = "contentText";
      y.appendChild(errorText);
    }
  }
  x.innerHTML = "";
  x.appendChild(y)

};

function lookupError(message) {
  if (/unable to find valid certification path to requested target/.test(message)) {
    return "Probably you did not add a certificate for the https host that you are caling to the keystore";
  }

  return null;
}

function createErrorMessageElement(message) {
  let errorElement = document.createElement("div");
  errorElement.style.color = "red";
  errorElement.className = "contentText";
  errorElement.innerText = message;

  let errorContainer = document.createElement("div");
  errorContainer.appendChild(errorElement);

  let explain = lookupError(message);
  if (explain) {
    errorContainer.appendChild(createElementFromHTML("<div>Possible explanation: " + explain + "</div>"));
  }
  return errorContainer;
}

//to check for errors and inline trace
async function getMessageProcessingLogRuns(MessageGuid, store = true) {
  return makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogs('" + MessageGuid + "')/Runs?$inlinecount=allpages&$format=json&$top=200", store).then((responseText) => {
    var resp = JSON.parse(responseText);
    return resp.d.results[0].Id;
  }).then((runId) => {
    return makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogRuns('" + runId + "')/RunSteps?$inlinecount=allpages&$format=json&$top=300", store);
  }).then((response) => {
    return JSON.parse(response).d.results;
  }).catch((e) => {
    console.log(e);
    return null;
  });
}

var timeOutTimer;
function errorPopupSetTimeout(milliseconds) {
  if (milliseconds) {
    timeOutTimer = setTimeout(() => {
      errorPopupClose();
    }, milliseconds);
  } else {
    clearTimeout(timeOutTimer);
  }
}

function errorPopupClose() {
  var x = document.getElementById("cpiHelper_sidebar_popup");
  if (x) {
    x.className = "hide_popup";
  }
}

//function to get the iFlow name from the URL
function getIflowName() {
  var url = window.location.href;
  var result;

  try {
    let groups = "";

    for (const dataRegexp of cpiArtifactURIRegexp) {
      if (dataRegexp.test(url) === true) {
        groups = url.match(dataRegexp).groups;
        result = groups.artifactId;
      }
    }

    console.log("Found artifact: " + result);

  } catch (e) {
    cpiData.integrationFlowId = null;
    console.log(e);
    console.log("no integrationflow found");
  }

  cpiData.integrationFlowId = result;
  return result;
}

//we have to check for url changes to deactivate sidebar and to inject buttons, when on iflow site.
var oldURL = "";
function checkURLchange() {
  var currentURL = window.location.href;
  var urlChanged = false;
  if (currentURL != oldURL) {
    urlChanged = true;
    console.log("url changed! to " + currentURL);
    oldURL = currentURL;
    handleUrlChange();
  }
  oldURL = window.location.href;
  return urlChanged;
}

//this function is fired when the url changes
function handleUrlChange() {
  storeVisitedIflowsForPopup();
  if (getIflowName()) {
    //if iflow found, inject buttons   
    setDocumentTitle(hostData.title)

    //check type of tenant
    if (!document.location.host.match(/.*\.integrationsuite(-trial){0,1}\..*/)) {
      cpiData.classicUrl = true
      cpiData.urlExtension = "itspaces/"
    }

  } else {
    setDocumentTitle(hostData.title)
    //deactivate sidebar if not on iflow page
    if (sidebar.active) {
      sidebar.deactivate();
    }
  }
}

//function that handles the dragging 
function dragElement(elmnt) {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
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

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    /* stop moving when mouse button is released:*/
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

async function storageGetPromise(name) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([name], function (result) {
      resolve(result[name]);
    });
  })
}



//Visited IFlows are stored to show in the popup that appears when pressing the button in browser bar
function storeVisitedIflowsForPopup() {
  var url = window.location.href;
  var tenant = url.split("/")[2].split(".")[0];
  var name = 'visitedIflows_' + tenant;

  for (const dataRegexp of cpiArtifactURIRegexp) {
    if (dataRegexp.test(url) === true) {
      let groups = url.match(dataRegexp);
      if (groups.length === 2) {
        let cpiArtifactId = groups.groups.artifactId;
        chrome.storage.sync.get([name], function (result) {
          var visitedIflows = result[name];

          if (!visitedIflows) {
            visitedIflows = [];
          }

          //filter out the current flow
          if (visitedIflows.length > 0) {
            visitedIflows = visitedIflows.filter((element) => {
              return element.name != cpiArtifactId;
            });
          }

          //put the current flow to the last element. last position indicates last visited element
          visitedIflows.push({ name: cpiArtifactId, "url": document.location.href, "favorit": false });

          //delete the first one when there are more than 10 iflows in visited list
          if (visitedIflows.length > 10) {
            visitedIflows.shift();
          }

          var obj = {};
          obj[name] = visitedIflows;

          chrome.storage.sync.set(obj, function () {
          });
        });
      }
    }
  }
}

//start
checkURLchange();
setInterval(function () {
  var elements = document.querySelectorAll("[id$='-BDI-content']");
  for (var i = 0; i < elements.length; i++) {
    if (elements[i].innerHTML == "Deploy") {
      buildButtonBar();
    }
  }
  checkURLchange(window.location.href);
}, 3000);





