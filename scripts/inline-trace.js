/*

    * This file is part of the CPI Helper Chrome Extension. It collects everything for the inline trace

*/

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
    var traceData = JSON.parse(
      await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + object.runId + "',ChildCount=" + object.childCount + ")/TraceMessages?$format=json", true)
    ).d.results;
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
      let elements = JSON.parse(
        await makeCallPromise(
          "GET",
          "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + object.runId + "',ChildCount=" + object.childCount + ")/?$expand=RunStepProperties&$format=json",
          true
        )
      ).d.RunStepProperties.results;
      html = formatLogContent(elements);
    }

    if (object.traceType == "info") {
      let elements = JSON.parse(
        await makeCallPromise(
          "GET",
          "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + object.runId + "',ChildCount=" + object.childCount + ")/?$expand=RunStepProperties&$format=json",
          true
        )
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
  var logleveldata = JSON.parse(await makeCallPromise("GET", `/${cpiData.urlExtension}${cpiData.runtimePathExtension}odata/api/v1/MessageProcessingLogs('${messageguid}')?$format=json`, true)).d;

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
