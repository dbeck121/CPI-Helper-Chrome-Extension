/*

    * This file is part of the CPI Helper Chrome Extension. It collects everything for the inline trace

*/

var inlineTraceRunning = false;
async function clickTrace(e) {
  cpihQsa("[ch_inline_active]").forEach((element) => element.removeAttribute("ch_inline_active"));
  if (inlineTraceRunning) {
    return;
  }
  if (!document.querySelector(".cpiHelper_inlineInfo")) {
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
      result += "<tr><td>" + htmlEscape(item.Name) + '</td><td style="word-break: break-all;">' + htmlEscape(String(item.Value ?? "")) + "</td></tr>";
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
      result += "<tr><td>" + htmlEscape(item.Name) + '</td><td style="word-break: break-all;">' + htmlEscape(String(item.Value ?? "")) + "</td></tr>";
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
      let elements = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + traceId + ")/ExchangeProperties?$format=json", true)).d.results;
      html = formatHeadersAndPropertiesToTable(elements);
    }
    if (object.traceType == "headers") {
      let elements = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + traceId + ")/Properties?$format=json", true)).d.results;
      html = formatHeadersAndPropertiesToTable(elements);
    }

    if (object.traceType == "trace") {
      let elements = await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + traceId + ")/$value", true);
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
    cpihModal.hide("#cpiHelper_waiting_model");
    showToast("Trace is not enabled", "your log level is" + logleveldata.LogLevel, "warning");
  } else if (logleveldata.LogLevel == "TRACE" && new Date(parseInt(logleveldata.LogEnd.replace(/\D/g, "")) + 1.05 * 60 * 60000) < new Date()) {
    cpihModal.hide("#cpiHelper_waiting_model");
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
    // one tab set (Properties, Headers, Body, Log, Info) per execution of the step. a step behind a splitter can run
    // thousands of times: the tab sets are built only when a run is opened, with many runs a run picker replaces the tabs
    const runTabs = (element) => {
      const objects = [
        { label: "Properties", content: getTraceTabContent, active: true, childCount: element.ChildCount, runId: element.RunId, traceType: "properties" },
        { label: "Headers", content: getTraceTabContent, active: false, childCount: element.ChildCount, runId: element.RunId, traceType: "headers" },
        { label: "Body", content: getTraceTabContent, active: false, childCount: element.ChildCount, runId: element.RunId, traceType: "trace" },
        { label: "Log", content: getTraceTabContent, active: false, childCount: element.ChildCount, runId: element.RunId, traceType: "logContent" },
        { label: "Info", content: getTraceTabContent, active: false, childCount: element.ChildCount, runId: element.RunId, traceType: "info" },
        { label: 'Changes <span class="cpiHelper_experimental" title="Experimental, feedback welcome">experimental</span>', content: async () => createStepChanges(element), active: false },
      ];
      if (element.Error) {
        let innerContent = document.createElement("div");
        innerContent.classList.add("cpiHelper_traceText");
        innerContent.innerText = element.Error;
        innerContent.style.display = "block";
        objects.push({ label: "Error", content: innerContent, active: false });
      }
      return createTabHTML(objects, "tracetab-" + element.ChildCount);
    };

    async function loginformation() {
      // newest run first, like before
      const runsOfStep = [...targetElements].reverse();
      if (runsOfStep.length == 0) {
        showToast("No Trace Found", "", "warning");
        return;
      }
      if (runsOfStep.length == 1) {
        return runTabs(runsOfStep[0]);
      }
      if (runsOfStep.length <= INLINE_TRACE_MAX_RUN_TABS) {
        // a function as content: createTabHTML loads it when the tab is opened, only the active one right away
        const runs = runsOfStep.map((element, index) => ({ label: "" + element.BranchId, active: index === 0, content: async () => runTabs(element) }));
        return createTabHTML(runs, "runstab", 0);
      }
      return createRunPicker(runsOfStep, runTabs);
    }
    let childindex = Array.from(document.querySelectorAll(".cpiHelper_onclick[inline_cpi_child]"), (e) => parseInt(e.getAttribute("inline_cpi_child"), 10)).sort((a, b) => a - b);
    childindex = childindex.indexOf(parseInt(e.target.parentNode.parentNode.getAttribute("inline_cpi_child")));
    showBigPopup(await loginformation, "Content Before Step", { fullscreen: true, callback: null }, childindex, document.querySelectorAll(".cpiHelper_onclick[inline_cpi_child]").length, String(e.pointerType));
  }
  inlineTraceRunning = false;
}

async function hideInlineTrace() {
  activeInlineItem = null;
  inlineTraceGeneration++;
  cpihQsa("[ch_inline_active]").forEach((element) => element.removeAttribute("ch_inline_active"));
  cpihQsa("[inline_cpi_child]").forEach((element) => element.removeAttribute("inline_cpi_child"));

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
// bumped on every new or hidden inline trace, a background load of more run steps stops when it changed
var inlineTraceGeneration = 0;

function toInlineTraceElement(run) {
  return {
    StepId: run.StepId,
    ModelStepId: run.ModelStepId,
    ChildCount: run.ChildCount,
    StepStop: run.StepStop,
    StepStart: run.StepStart,
    RunId: run.RunId,
    BranchId: run.BranchId,
    Error: run.Error,
  };
}

// onMoreElements(elements, loaded, total): optional, called for every page that loads in the background
async function createInlineTraceElements(MessageGuid, checked, onMoreElements) {
  return new Promise(async (resolve, reject) => {
    inlineTraceElements = [];
    const generation = inlineTraceGeneration;

    var logRuns = await getMessageProcessingLogRuns(MessageGuid, false, {
      isStale: () => generation !== inlineTraceGeneration,
      onMorePages: onMoreElements
        ? (runs, loaded, total) => {
            const elements = runs.map(toInlineTraceElement);
            inlineTraceElements.push(...elements);
            onMoreElements(elements, loaded, total);
          }
        : null,
    });

    if (logRuns == null || logRuns.length == 0) {
      return resolve(0);
    }
    logRuns.forEach((run) => {
      inlineTraceElements.push(toInlineTraceElement(run));
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

// marks one executed step in the diagram. ctx: { traceModifier, checked, observerInstalled }
function markInlineTraceRun(run, ctx) {
  try {
    const resolved = resolveInlineTraceNode(run);
    if (!resolved) {
      log.log("no diagram element found for " + run.StepId + " / " + run.ModelStepId);
      return;
    }
    const element = resolved.element;
    const target = resolved.target;
    const flag = resolved.clickable;

    element.setAttribute("inline_cpi_child", run.ChildCount);
    target.classList.add("cpiHelper_inlineInfo");
    if (flag && !element.classList.contains("cpiHelper_onclick")) {
      element.classList.add("cpiHelper_onclick");
      element.onclick = clickTrace;
      onClicKElements.push(element);
    }
    if (run.Error) {
      target.classList.add("cpiHelper_inlineInfo_error");
    }
    if (ctx.traceModifier && ctx.checked && cpi_timediff_list && cpi_max_node) {
      const maxOfStep = cpi_max_node.find((f) => f.ModelStepId === run.ModelStepId);
      if (maxOfStep) {
        indexofnode = cpi_timediff_list.findIndex((e) => e === maxOfStep.CH_stats);
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
    }
    if (element.id.indexOf("BPMNEdge_") === 0) {
      markAdapterShape(element, target);
    }
    if (!ctx.observerInstalled) {
      observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
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
      ctx.observerInstalled = true;
    }
  } catch (e) {
    log.log("no element found for " + run.StepId);
    log.log(run, e);
  }
}

async function showInlineTrace(MessageGuid, checked = false) {
  return new Promise(async (resolve, reject) => {
    inlineTraceGeneration++;
    const generation = inlineTraceGeneration;
    const ctx = { traceModifier: await getStorageValue("traceModifer", "isActive", null), checked, observerInstalled: false };
    let progress = null;

    // steps that load in the background after the first page get marked as they come
    const onMoreElements = (elements, loaded, total) => {
      if (generation !== inlineTraceGeneration) return;
      elements.forEach((run) => markInlineTraceRun(run, ctx));
      const text = loaded >= total ? `All ${total.toLocaleString()} steps of this message loaded.` : `Loading steps: ${loaded.toLocaleString()} of ${total.toLocaleString()}`;
      if (!progress) progress = cpihToast({ message: text, displayTime: 0, position: "bottom right", showProgress: false });
      else progress.element.querySelector(".message").textContent = text;
      if (loaded >= total) setTimeout(() => progress?.close(), 3000);
    };

    var logRuns = await createInlineTraceElements(MessageGuid, checked, onMoreElements);
    if (logRuns == null || logRuns == 0) {
      return resolve(null);
    }

    inlineTraceElements.forEach((run) => markInlineTraceRun(run, ctx));
    // e.g. the overview of an API: the steps are there, the diagram is on another tab
    if (!document.querySelector(".cpiHelper_inlineInfo")) {
      showToast("Open the tab with the process diagram (for APIs: Policies) and activate the inline trace again.", "No diagram on this page", "warning");
    }
    return resolve(true);
  });
}

/**
 * Resolves the diagram element and the SVG element to highlight for one trace step.
 *
 * The node type used to be derived with regexes over the step id (/ServiceTask/,
 * /CallActivity/, /ExclusiveGateway/, ...). That only holds for the ids SAP
 * generates automatically. As soon as an iFlow uses custom element ids
 * (CA_DSGet, GW_Ready, MF_SG) no regex matches, `element` stays undefined and
 * nothing gets highlighted, even though the elements are present in the DOM.
 *
 * The element is now looked up by id, and the highlight target is derived from
 * the SVG structure, which is the same for every node type.
 *
 * @param {object} run - a trace step (StepId, ModelStepId, ...).
 * @returns {{element: Element, target: Element, clickable: boolean}|null} null when the step has no counterpart in the diagram.
 */
function resolveInlineTraceNode(run) {
  const candidates = [];
  const addCandidate = function (prefix, raw) {
    if (raw === null || raw === undefined) {
      return;
    }
    const value = String(raw);
    if (!value) {
      return;
    }
    candidates.push(prefix + value);
    //some step ids carry an instance suffix, e.g. "MF_SG#1787289935763"
    if (value.indexOf("#") > -1) {
      candidates.push(prefix + value.split("#")[0]);
    }
  };

  addCandidate("BPMNShape_", run.ModelStepId);
  addCandidate("BPMNShape_", run.StepId);
  addCandidate("BPMNEdge_", run.ModelStepId);
  addCandidate("BPMNEdge_", run.StepId);

  let element = null;
  for (const id of candidates) {
    element = document.getElementById(id);
    if (element) {
      break;
    }
  }
  if (!element) {
    return null;
  }

  let target = null;
  if (element.id.indexOf("BPMNEdge_") === 0) {
    //on message flows the text label is the element that gets coloured
    let index = getChild(element, ["text"], "shapeText");
    if (index === null) {
      index = getChild(element, ["text"]);
    }
    target = index === null ? null : element.children[index];
  } else {
    //on shapes the first <g> child wraps the rect/circle that gets coloured.
    //a <title> child is not always present, so a fixed index is not reliable.
    const groupIndex = getChild(element, ["g"]);
    if (groupIndex !== null && element.children[groupIndex].children.length > 0) {
      target = element.children[groupIndex].children[0];
    } else {
      const shapeIndex = getChild(element, ["rect", "circle", "path", "polygon"]);
      target = shapeIndex === null ? null : element.children[shapeIndex];
    }
  }
  if (!target) {
    return null;
  }

  //the start event opens no popup: there is no content "before" the start of the flow
  return { element: element, target: target, clickable: !/StartEvent/i.test(element.id) };
}

/**
 * The step a message flow hangs on (Request Reply, Send, Poll Enrich, Content Enricher).
 *
 * Such a step has no run step of its own, the trace only has the message flow. The SVG of the
 * flow carries no reference to its source or target, so the step is found by geometry: one end
 * of the flow line sits on the border of the step's rect.
 *
 * @param {Element} edge - the BPMNEdge_ group of a message flow.
 * @returns {Element|null} the BPMNShape_ group, null for flows that end on a participant or event.
 */
function findAdapterShape(edge) {
  const path = typeof edge.querySelector === "function" ? edge.querySelector("path.messageFlow") : null;
  const matrix = path?.getScreenCTM?.();
  if (!matrix) return null;
  const length = path.getTotalLength();
  const ends = [path.getPointAtLength(0), path.getPointAtLength(length)].map((point) => new DOMPoint(point.x, point.y).matrixTransform(matrix));
  const tolerance = 4;
  for (const shape of document.querySelectorAll("[id^='BPMNShape_']")) {
    //only activities, participants (sender, receiver) and events have no rect.activity
    const rect = shape.querySelector("rect.activity");
    if (!rect) continue;
    const box = rect.getBoundingClientRect();
    const hit = ends.some((p) => p.x >= box.left - tolerance && p.x <= box.right + tolerance && p.y >= box.top - tolerance && p.y <= box.bottom + tolerance);
    if (hit) return shape;
  }
  return null;
}

// colours the step behind a message flow like the flow and opens the trace of the flow on click
function markAdapterShape(edge, edgeTarget) {
  const shape = findAdapterShape(edge);
  //a step with run steps of its own keeps its own trace
  if (!shape || shape.hasAttribute("inline_cpi_child")) return;
  const groupIndex = getChild(shape, ["g"]);
  const shapeTarget = groupIndex === null ? null : shape.children[groupIndex].children[0];
  if (!shapeTarget) return;
  edgeTarget.classList.forEach((name) => {
    if (name.indexOf("cpiHelper_") === 0) shapeTarget.classList.add(name);
  });
  shape.onclick = () => edgeTarget.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  if (!onClicKElements.includes(shape)) onClicKElements.push(shape);
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

// above this number of executions a step gets a run picker instead of one tab per run
const INLINE_TRACE_MAX_RUN_TABS = 20;

// picker for steps with many executions (e.g. after a splitter): select with every run plus previous / next,
// only the selected run is loaded
function createRunPicker(runs, renderRun) {
  const container = document.createElement("div");
  container.className = "cpiHelper_runPicker";
  container.innerHTML = `
    <div class="cpiHelper_runPicker_bar">
      <button type="button" class="ui small icon button" data-step="-1" title="Previous run" aria-label="Previous run"><i class="angle left icon"></i></button>
      <select class="ui dropdown" aria-label="Run"></select>
      <button type="button" class="ui small icon button" data-step="1" title="Next run" aria-label="Next run"><i class="angle right icon"></i></button>
      <span class="cpiHelper_runPicker_count"></span>
    </div>
    <div class="cpiHelper_runPicker_content"></div>`;
  const select = container.querySelector("select");
  const content = container.querySelector(".cpiHelper_runPicker_content");
  const errors = runs.filter((run) => run.Error).length;
  container.querySelector(".cpiHelper_runPicker_count").textContent = `${runs.length} runs of this step${errors ? `, ${errors} with error` : ""}`;
  const fragment = document.createDocumentFragment();
  runs.forEach((run, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `Run ${index + 1}${run.BranchId != null ? ` · branch ${run.BranchId}` : ""}${run.Error ? " · error" : ""}`;
    fragment.appendChild(option);
  });
  select.appendChild(fragment);

  let loading = 0;
  const show = async (index) => {
    const ticket = ++loading;
    select.value = String(index);
    container.querySelector('[data-step="-1"]').classList.toggle("disabled", index <= 0);
    container.querySelector('[data-step="1"]').classList.toggle("disabled", index >= runs.length - 1);
    content.innerHTML = '<div class="cpiHelper_infoPopUp_content">Please Wait...</div>';
    const node = await renderRun(runs[index]);
    // a newer selection wins when the user clicks faster than the trace loads
    if (ticket === loading) content.replaceChildren(node);
  };
  select.addEventListener("change", () => show(Number(select.value)));
  container.querySelectorAll("[data-step]").forEach((button) =>
    button.addEventListener("click", () => {
      const next = Number(select.value) + Number(button.dataset.step);
      if (next >= 0 && next < runs.length) show(next);
    })
  );
  show(0);
  return container;
}

/* ------------------------------------------------------------------ changes of a step */

// trace of one run step: body, headers and properties before the step, null when there is no trace
async function getRunStepTrace(runId, childCount) {
  const base = "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/";
  const traces = JSON.parse(await makeCallPromise("GET", base + "MessageProcessingLogRunSteps(RunId='" + runId + "',ChildCount=" + childCount + ")/TraceMessages?$format=json", true)).d.results;
  const trace = traces.sort((a, b) => a.TraceId - b.TraceId)[0];
  if (!trace) return null;
  const [body, headers, properties] = await Promise.all([
    makeCallPromise("GET", base + "TraceMessages(" + trace.TraceId + ")/$value", true),
    makeCallPromise("GET", base + "TraceMessages(" + trace.TraceId + ")/Properties?$format=json", true).then((response) => JSON.parse(response).d.results),
    makeCallPromise("GET", base + "TraceMessages(" + trace.TraceId + ")/ExchangeProperties?$format=json", true).then((response) => JSON.parse(response).d.results),
  ]);
  return { body: body || "", headers, properties };
}

// the step that ran next in the same branch (or at all), its "content before" is what this step produced
function findNextRunStep(element) {
  const later = inlineTraceElements.filter((run) => run.RunId === element.RunId && run.ChildCount > element.ChildCount).sort((a, b) => a.ChildCount - b.ChildCount);
  return later.filter((run) => run.BranchId === element.BranchId).concat(later.filter((run) => run.BranchId !== element.BranchId));
}

function stepLabel(run) {
  const shape = resolveInlineTraceNode(run)?.element;
  // the shape also carries an invisible "Step Id = ..." text for screen readers
  const text = shape?.textContent?.replace(/\s+/g, " ").replace(/^Step Id = \S+\s*/, "").trim();
  return text || run.ModelStepId || run.StepId;
}

// "Changes" tab: what the step did to body, headers and properties, as a side by side diff
async function createStepChanges(element) {
  const container = document.createElement("div");
  container.className = "cpiHelper_changes";
  container.innerHTML = '<div class="cpiHelper_infoPopUp_content">Please Wait...</div>';

  const before = await getRunStepTrace(element.RunId, element.ChildCount).catch(() => null);
  if (!before) {
    container.innerHTML = '<div class="ui info message">No trace for this step, nothing to compare.</div>';
    return container;
  }
  let after = null;
  let nextStep = null;
  // the next steps may have no trace (e.g. an end event), look a few further
  for (const candidate of findNextRunStep(element).slice(0, 5)) {
    after = await getRunStepTrace(candidate.RunId, candidate.ChildCount).catch(() => null);
    if (after) {
      nextStep = candidate;
      break;
    }
  }
  if (!after) {
    container.innerHTML = '<div class="ui info message">This is the last traced step of the run, there is no following step to compare with.</div>';
    return container;
  }

  const lines = (list) =>
    [...list]
      .sort((a, b) => a.Name.localeCompare(b.Name))
      .map((item) => `${item.Name}: ${item.Value ?? ""}`)
      .join("\n");
  const bodyType = cpihDetectPayloadType(before.body || after.body);
  const views = {
    body: { a: cpihPrettifyPayload(before.body).text, b: cpihPrettifyPayload(after.body).text, mode: bodyType },
    headers: { a: lines(before.headers), b: lines(after.headers), mode: "text" },
    properties: { a: lines(before.properties), b: lines(after.properties), mode: "text" },
  };

  container.innerHTML = `
    <div class="cpiHelper_changes_bar">
      <div class="cpiHelper_payload_segmented" role="group" aria-label="Compare">
        <button type="button" data-view="body">Body</button>
        <button type="button" data-view="headers">Headers</button>
        <button type="button" data-view="properties">Properties</button>
      </div>
      <span class="cpiHelper_changes_info"></span>
    </div>
    <div class="cpiHelper_changes_labels"><span>Before this step</span><span></span></div>
    <div class="cpiHelper_changes_diff"><div class="cpiHelper_changes_side"></div><div class="cpiHelper_changes_side"></div></div>`;
  container.querySelector(".cpiHelper_changes_labels span:last-child").textContent = `After this step (before "${stepLabel(nextStep)}")`;
  const info = container.querySelector(".cpiHelper_changes_info");
  const summary = Object.entries(views)
    .filter(([, view]) => view.a !== view.b)
    .map(([name]) => name);
  info.textContent = summary.length ? `Changed: ${summary.join(", ")}` : "No changes in body, headers or properties";
  container.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("cpiHelper_changes_changed", views[button.dataset.view].a !== views[button.dataset.view].b));

  const sides = container.querySelectorAll(".cpiHelper_changes_side");
  let editors = null;
  let diffView = null;
  const show = (name) => {
    const view = views[name];
    container.querySelectorAll("[data-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === name)));
    editors.forEach((editor, index) => {
      editor.session.setMode("ace/mode/" + (["xml", "json", "sql"].includes(view.mode) ? view.mode : "text"));
      editor.session.setValue(index === 0 ? view.a : view.b);
    });
  };
  const init = () => {
    const theme = cpihIsDark() ? "ace/theme/github_dark" : "ace/theme/textmate";
    editors = [...sides].map((side) => ace.edit(side, { readOnly: true, useWorker: false, theme, fontSize: 13, showPrintMargin: false, wrap: true }));
    diffView = ace.require("ace/ext/diff").createDiffView({ editorA: editors[0], editorB: editors[1] });
    // start with the part that changed, the body if nothing did
    show(summary[0] || "body");
  };
  container.querySelector(".cpiHelper_changes_bar").addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (button && editors) show(button.dataset.view);
  });
  // Ace needs a visible element, the tab content is inserted before it is shown
  const observer = new ResizeObserver(() => {
    if (!container.isConnected || !sides[0].offsetWidth || !sides[0].offsetHeight) return;
    observer.disconnect();
    requestAnimationFrame(init);
  });
  observer.observe(sides[0]);
  return container;
}
