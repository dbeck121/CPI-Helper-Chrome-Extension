if (!window.groovyDebugSendToIDE) {
  window.groovyDebugSendToIDE = async function (debugDataOverride) {
    const settings = await getPluginSettings("groovyDebugger");
    const ideSelection = settings["groovyDebugger---ideSelection"] || "";

    if (!ideSelection) {
      showToast("No IDE selected. Please choose an IDE from the GroovyDebugX plugin settings.", "Groovy Debugger", "Error");
      return;
    }

    const customUrl = settings["groovyDebugger---customIdeUrl"] || "";
    const ideUrl = ideSelection === "custom" ? customUrl.trim() || "https://groovyide.com/cpi/share/v1/" : ideSelection;
    let domain;
    try {
      domain = new URL(ideUrl).hostname;
    } catch (e) {
      showToast("Invalid IDE URL: " + ideUrl, "Groovy Debugger", "Error");
      return;
    }

    const [_body, _script, _props, _hdrs] = await Promise.all([
      getStorageValue("groovyDebugger", "transferBody", "browser"),
      getStorageValue("groovyDebugger", "transferScript", "browser"),
      getStorageValue("groovyDebugger", "transferProperties", "browser"),
      getStorageValue("groovyDebugger", "transferHeaders", "browser"),
    ]);
    const prefs = {
      body: _body !== "" ? !!_body : true,
      script: _script !== "" ? !!_script : true,
      properties: _props !== "" ? !!_props : false,
      headers: _hdrs !== "" ? !!_hdrs : false,
    };

    const popupContent = `
      <div class="ui warning message">
        <div class="header">
          <i class="exclamation triangle icon"></i>
          Data Transfer Confirmation
        </div>
        <div class="ui info message">
          <i class="info circle icon"></i>
          <strong>Privacy Notice:</strong> The selected data may contain sensitive business information. Proceed with caution.
        </div>
        <p><strong>Destination:</strong> ${htmlEscape(domain)}</p>
        <p>Select which data you want to transfer to the external Groovy WebIDE:</p>
        <div class="ui form">
          <div class="grouped fields">
            <div class="field">
              <div class="ui toggle checkbox" id="transfer-body">
                <input type="checkbox" name="transfer-body" ${prefs.body ? "checked" : ""}>
                <label>Message Body <em>(may contain sensitive data)</em></label>
              </div>
            </div>
            <div class="field">
              <div class="ui toggle checkbox" id="transfer-script">
                <input type="checkbox" name="transfer-script" ${prefs.script ? "checked" : ""}>
                <label>Groovy Script <em>(source code)</em></label>
              </div>
            </div>
            <div class="field">
              <div class="ui toggle checkbox" id="transfer-properties">
                <input type="checkbox" name="transfer-properties" ${prefs.properties ? "checked" : ""}>
                <label>Properties <em>(may contain configuration data)</em></label>
              </div>
            </div>
            <div class="field">
              <div class="ui toggle checkbox" id="transfer-headers">
                <input type="checkbox" name="transfer-headers" ${prefs.headers ? "checked" : ""}>
                <label>Headers <em>(may contain security & metadata)</em></label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    showBigPopup(popupContent, "Confirm Data Transfer", {
      fullscreen: false,
      large: false,
      callback: () => {
        let actionsDiv = $("#cpiHelper_semanticui_modal .actions");
        actionsDiv.empty();

        let cancelBtn = $('<div class="ui button">Cancel</div>');
        cancelBtn.on("click", () => {
          $("#cpiHelper_semanticui_modal").modal("hide");
        });
        actionsDiv.append(cancelBtn);

        let continueBtn = $('<div class="ui positive button"><i class="rocket icon"></i>Continue</div>');

        const updateContinueButton = () => {
          const anyChecked = $("#transfer-body input").prop("checked") || $("#transfer-properties input").prop("checked") || $("#transfer-headers input").prop("checked") || $("#transfer-script input").prop("checked");
          continueBtn.toggleClass("disabled", !anyChecked).prop("disabled", !anyChecked);
        };

        $("#cpiHelper_semanticui_modal .ui.checkbox").checkbox({
          onChange: updateContinueButton,
        });

        updateContinueButton();

        continueBtn.on("click", async () => {
          const transferOptions = {
            body: $("#transfer-body input").prop("checked"),
            properties: $("#transfer-properties input").prop("checked"),
            headers: $("#transfer-headers input").prop("checked"),
            script: $("#transfer-script input").prop("checked"),
          };

          await Promise.all([
            syncChromeStoragePromise(getStoragePath("groovyDebugger", "transferBody", "browser"), transferOptions.body),
            syncChromeStoragePromise(getStoragePath("groovyDebugger", "transferScript", "browser"), transferOptions.script),
            syncChromeStoragePromise(getStoragePath("groovyDebugger", "transferProperties", "browser"), transferOptions.properties),
            syncChromeStoragePromise(getStoragePath("groovyDebugger", "transferHeaders", "browser"), transferOptions.headers),
          ]);

          // Re-read settings so any IDE change made while the dialog was open takes effect
          const latestSettings = await getPluginSettings("groovyDebugger");
          const latestIdeSelection = latestSettings["groovyDebugger---ideSelection"] || "";

          $("#cpiHelper_semanticui_modal").modal("hide");

          if (!latestIdeSelection) {
            showToast("No IDE selected. Please choose an IDE from the GroovyDebugX plugin settings.", "Groovy Debugger", "Error");
            return;
          }

          const debugData = debugDataOverride || window.currentGroovyDebugData;
          if (!debugData) {
            showToast("No debug data available. Please click a Groovy step first.", "Groovy Debugger", "Error");
            return;
          }
          try {
            if (latestIdeSelection === "https://ide.contiva.com/cpi/script/debug") {
              await sendToContivaIDE(latestSettings, debugData, transferOptions);
            } else {
              await sendToExternalIDE(latestSettings, debugData, transferOptions);
            }
            showToast("Debug data sent to IDE", "Success");
          } catch (e) {
            log.error("Error sending to IDE:", e);
            showToast("Failed to send to IDE: " + e.message, "Groovy Debugger", "Error");
          }
        });
        actionsDiv.append(continueBtn);
      },
    });
  };
}

var plugin = {
  metadataVersion: "1.0.0",
  id: "groovyDebugger",
  name: "GroovyDebugX IDE",
  version: "1.0.0",
  author: "Sunil Pharswan",
  email: "sunilpharswan4198@gmail.com",
  website: "https://linkedin.com/in/sunilph",
  description:
    "<b>GroovyDebugX</b> streamlines Groovy debugging by automating runtime trace extraction. With visual step highlighting and one-click data transfer to <b>Groovy WebIDE</b>, it eliminates manual data entry and accelerates your integration development.<br><br><b>Note</b>: Requires the message to be processed in <b>Trace Mode</b> to capture and transfer runtime data.",
  settings: {
    ideSelection: {
      text: "External Groovy IDE",
      type: "radio",
      scope: "browser",
      options: [
        { value: "https://groovyide.com/cpi/share/v1/", label: "GroovyIDE (groovyide.com)", default: true },
        { value: "https://ide.contiva.com/cpi/script/debug", label: "Contiva IDE (ide.contiva.com)" },
        { value: "custom", label: "Custom URL" },
      ],
    },
    customIdeUrl: {
      text: "Custom IDE URL",
      type: "textinput",
      scope: "browser",
      placeholder: "https://your-custom-ide.com/share/",
      showWhen: { key: "ideSelection", value: "custom" },
    },
  },
  messageSidebarButton: {
    icon: { text: "{}", type: "text" },
    title: "Debug Groovy Steps",
    onClick: async (pluginHelper, settings, runInfo, active) => {
      resetGroovyHighlighting();

      if (!active) {
        return;
      }

      let artifactId;
      try {
        artifactId = await getArtifactIdDirectly();
      } catch (error) {
        log.error("Groovy Debugger: error fetching artifactId:", error);
        showToast("Could not fetch iFlow structure - " + error.message, "Groovy Debugger", "Error");
        return;
      }
      log.log("Groovy Debugger: artifactId=" + artifactId);

      if (!artifactId) {
        showToast("Could not fetch iFlow structure - make sure you're on an integration flow page", "Groovy Debugger", "Error");
        return;
      }

      showWaitingPopup("Fetching iFlow data, trace information and highlighting Groovy steps with data...", "ui blue");

      try {
        const iFlowUrl = "https://" + pluginHelper.tenant + "/api/1.0/iflows/" + artifactId;

        const response = await fetch(iFlowUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const iFlowData = await response.json();

        const groovyElements = extractGroovyElements(iFlowData);

        if (groovyElements.length === 0) {
          $("#cpiHelper_waiting_model").modal("hide");
          showToast("No Groovy Script steps found in this integration flow", "Groovy Debugger", "Warning");
          return;
        }

        log.log("Groovy Debugger: Found " + groovyElements.length + " groovy script elements");

        resetGroovyHighlighting();

        await createInlineTraceElements(runInfo.messageGuid, false);
        // Snapshot: inlineTraceElements is a global that other calls can mutate
        const traceElementsCopy = [...inlineTraceElements];
        if (!traceElementsCopy.length) {
          $("#cpiHelper_waiting_model").modal("hide");
          showToast("No trace data found for this message", "Groovy Debugger", "Warning");
          return;
        }

        const groovyElementsWithTrace = groovyElements.filter((element) => {
          const matchingTraceElements = traceElementsCopy.filter((traceElement) => {
            const traceId = traceElement.StepId || traceElement.ModelStepId;
            return traceId === element.id;
          });
          return matchingTraceElements.length > 0;
        });

        if (groovyElementsWithTrace.length === 0) {
          $("#cpiHelper_waiting_model").modal("hide");
          showToast("No Groovy steps with trace data found in this message", "Groovy Debugger", "Warning");
          return;
        }

        applyGroovyHighlighting(groovyElementsWithTrace);

        window.groovyDebuggerData = {
          settings: settings,
          runInfo: runInfo,
          groovyElements: groovyElementsWithTrace,
          iFlowData: iFlowData,
          iFlowUrl: iFlowUrl,
          artifactId: artifactId,
          inlineTraceElements: traceElementsCopy,
        };

        setupGroovyClickHandlers(settings, runInfo, groovyElementsWithTrace, iFlowData, artifactId, pluginHelper.tenant);

        $("#cpiHelper_waiting_model").modal("hide");
        showToast("Groovy steps with data highlighted - click on any highlighted Groovy step to debug", "Success");
      } catch (error) {
        log.error("Error in Groovy Debugger:", error);
        showToast("Error: " + error.message, "Groovy Debugger", "Error");
        $("#cpiHelper_waiting_model").modal("hide");
      }
    },
    condition: (pluginHelper, settings, runInfo) => {
      var date = new Date();
      date.setHours(date.getHours() - 1);
      return runInfo.logLevel === "trace" && runInfo.logStart > date;
    },
  },
};

// Map to preserve SAP's native onclick handlers before we overwrite them
const groovyOriginalHandlers = new Map();

function resetGroovyHighlighting() {
  document.querySelectorAll("g[id^='BPMNShape_'] rect.activity").forEach((rect) => {
    rect.style.fill = "";
  });
  document.querySelectorAll("g[id^='BPMNShape_']").forEach((element) => {
    element.style.cursor = "";
    element.onclick = groovyOriginalHandlers.get(element.id) || null;
  });
  groovyOriginalHandlers.clear();
}

async function getArtifactIdDirectly() {
  try {
    const listResponse = await makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListCommand", false, null, null, null, null, true);
    const listData = new XmlToJson().parse(listResponse)["com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListResponse"];
    const artifact = Array.isArray(listData.artifactInformations)
      ? listData.artifactInformations.find((e) => e.symbolicName === cpiData.integrationFlowId)
      : listData.artifactInformations?.symbolicName === cpiData.integrationFlowId
        ? listData.artifactInformations
        : null;

    if (!artifact) {
      throw new Error("Integration Flow not found in list");
    }

    if (cpiData.cpiPlatform === "neo") {
      const detailResponse = await makeCallPromise(
        "GET",
        "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentDetailCommand?artifactId=" + artifact.id,
        60,
        "application/json",
        null,
        null,
        null,
        true
      );
      return JSON.parse(detailResponse).artifactInformation.id;
    }

    return artifact.id;
  } catch (error) {
    log.error("Error getting artifactId directly:", error);
    throw error;
  }
}

function extractGroovyElements(iFlowData) {
  if (!iFlowData.propertyViewModel?.listOfDefaultFlowElementModel) {
    return [];
  }

  return iFlowData.propertyViewModel.listOfDefaultFlowElementModel
    .filter((element) => element.displayName === "Groovy Script")
    .map((element) => ({
      id: element.id,
      displayName: element.displayName,
      scriptFunction: element.allAttributes?.scriptFunction?.value || "processData",
      script: element.allAttributes?.script?.value || "",
    }));
}

function applyGroovyHighlighting(groovyElements) {
  groovyElements.forEach((element) => {
    const selector = `g#BPMNShape_${element.id}`;
    const targetElement = document.querySelector(selector);

    if (targetElement) {
      const rectElement = targetElement.querySelector("rect.activity");
      if (rectElement) {
        rectElement.style.fill = "#13af00";
      }
    }
  });
}

function setupGroovyClickHandlers(settings, runInfo, groovyElements, iFlowData, artifactId, tenant) {
  groovyElements.forEach((element) => {
    const selector = `g#BPMNShape_${element.id}`;
    const targetElement = document.querySelector(selector);

    if (targetElement) {
      if (!groovyOriginalHandlers.has(targetElement.id)) {
        groovyOriginalHandlers.set(targetElement.id, targetElement.onclick);
      }
      targetElement.style.cursor = "pointer";
      targetElement.onclick = async (event) => {
        event.stopPropagation();
        event.preventDefault();

        try {
          let debugData = await tryGetTraceDataForElement(runInfo, element, window.groovyDebuggerData.inlineTraceElements);

          if (!debugData) {
            debugData = {
              messageGuid: runInfo.messageGuid,
              stepId: element.id,
              scriptName: element.displayName,
              groovyScript: "// Script content not available",
              scriptFunction: element.scriptFunction || "processData",
              timestamp: new Date().toISOString(),
            };
          } else {
            debugData.groovyScript = "// Script content not available";
          }

          // Lazy-load script info so click handler can fetch Groovy source on demand
          debugData.scriptInfo = {
            tenant: tenant,
            artifactId: artifactId,
            scriptPath: element.script,
          };

          showBigPopup(await createGroovyDebugContent(debugData), `Groovy Debug Data - ${element.displayName || element.id}`, {
            fullscreen: false,
            callback: () => {
              let actionsDiv = $("#cpiHelper_semanticui_modal .actions");
              let debugBtn = $('<div class="ui positive button"><i class="rocket icon"></i>Debug Externally</div>');
              debugBtn.on("click", () => window.groovyDebugSendToIDE(debugData));
              actionsDiv.prepend(debugBtn);
            },
          });
        } catch (error) {
          log.error("Error in groovy click handler:", error);
          showToast("Error: " + error.message, "Error");
        }
      };
    }
  });
}

async function tryGetTraceDataForElement(runInfo, element, inlineTraceElements) {
  try {
    if (!inlineTraceElements?.length) {
      return null;
    }

    const matchingTraceElements = inlineTraceElements.filter((traceElement) => {
      const traceId = traceElement.StepId || traceElement.ModelStepId;
      return traceId === element.id;
    });

    if (matchingTraceElements.length === 0) {
      return null;
    }

    return await fetchGroovyDebugData(runInfo, matchingTraceElements[0], element.scriptFunction);
  } catch (error) {
    log.error("Error getting trace data for element:", error);
    return null;
  }
}

async function fetchGroovyDebugData(runInfo, groovyStep, scriptFunction) {
  try {
    var messageGuid = runInfo.messageGuid;
    var runId = groovyStep.RunId;
    var childCount = groovyStep.ChildCount;

    var traceData = JSON.parse(
      await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + runId + "',ChildCount=" + childCount + ")/TraceMessages?$format=json", true)
    ).d.results;

    var traceInfo = traceData.find((trace) => trace.TraceId);

    if (!traceInfo) {
      return null;
    }

    var traceId = traceInfo.TraceId;

    var properties = {};
    try {
      var propsData = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + traceId + ")/ExchangeProperties?$format=json", true)).d.results;
      propsData.forEach((prop) => {
        properties[prop.Name] = prop.Value;
      });
    } catch (e) {
      log.log("No properties for this step");
    }

    // RunStepProperties contains the Log tab data; $expand fetches it in one call
    var runStepData = {};
    try {
      runStepData = JSON.parse(
        await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + runId + "',ChildCount=" + childCount + ")/?$expand=RunStepProperties&$format=json", true)
      ).d;
    } catch (e) {
      log.log("No run step data for this step");
    }

    var groovyScript = "// Script content not available";

    return {
      messageGuid: messageGuid,
      stepId: groovyStep.StepId,
      runId: runId,
      childCount: childCount,
      traceId: traceId,
      properties: properties,
      runStepData: runStepData,
      groovyScript: groovyScript,
      scriptFunction: scriptFunction || "processData",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    log.error("Error fetching debug data:", error);
    return null;
  }
}

async function createGroovyDebugContent(data) {
  let bodyContent = async () => {
    try {
      let payload = await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + data.traceId + ")/$value", true);
      // Cache fetched payload on debugData so IDE transfer can reuse it
      if (typeof payload === "string" && payload) {
        data.payload = payload;
      }
      return formatTrace(payload || "No payload", "groovyDebugBody", null, "payload.txt");
    } catch (error) {
      log.error("Error fetching body content:", error);
      return "<div>No body data available</div>";
    }
  };

  let headersContent = async () => {
    try {
      let headersData = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + data.traceId + ")/Properties?$format=json", true)).d.results;
      let headers = {};
      headersData.forEach((header) => {
        headers[header.Name] = header.Value;
      });
      data.headers = headers;
      return formatHeadersAndPropertiesToTable(
        Object.keys(headers)
          .sort()
          .map((key) => ({ Name: key, Value: headers[key] }))
      );
    } catch (error) {
      log.error("Error fetching headers content:", error);
      return "<div>No headers data available</div>";
    }
  };

  let propertiesContent = formatHeadersAndPropertiesToTable(
    data.properties
      ? Object.keys(data.properties)
          .sort()
          .map((key) => ({ Name: key, Value: data.properties[key] }))
      : []
  );

  let scriptContent = async () => {
    try {
      const scriptUrl = resolveScriptUrl(data.scriptInfo);
      let groovyScriptContent = "// Script content not available";
      if (scriptUrl) {
        const scriptResponse = await fetch(scriptUrl);
        if (scriptResponse.ok) {
          const scriptData = await scriptResponse.json();
          if (scriptData.content) {
            groovyScriptContent = scriptData.content;
            data.groovyScript = groovyScriptContent;
          }
        }
      }
      return formatTrace(groovyScriptContent, "groovyDebugScript", null, "script.groovy");
    } catch (error) {
      log.error("Error fetching script content:", error);
      return formatTrace("// Error loading script content", "groovyDebugScript", null, "script.groovy");
    }
  };

  let logContent = formatLogContent(data.runStepData?.RunStepProperties?.results || []);

  let infoContent = formatInfoContent(data.runStepData || {});

  let objects = [
    { label: "Properties", content: propertiesContent, active: true },
    { label: "Headers", content: headersContent, active: false },
    { label: "Body", content: bodyContent, active: false },
    { label: "Script", content: scriptContent, active: false },
    { label: "Log", content: logContent, active: false },
    { label: "Info", content: infoContent, active: false },
  ];

  let tabsContent = await createTabHTML(objects, "groovyDebugTabs");

  window.currentGroovyDebugData = data;

  return tabsContent;
}

function formatLogContent(inputList) {
  inputList = inputList.sort(function (a, b) {
    return a.Name.toLowerCase() > b.Name.toLowerCase() ? 1 : -1;
  });
  let result = `<table class='ui basic striped selectable compact table'>
  <thead><tr class="blue"><th>Name</th><th>Value</th></tr></thead>
  <tbody>`;
  inputList.forEach((item) => {
    result += "<tr><td>" + htmlEscape(item.Name) + '</td><td style="word-break: break-all;">' + htmlEscape(item.Value) + "</td></tr>";
  });
  result += "</tbody></table>";
  return result;
}

function formatInfoContent(inputList) {
  const valueList = [];

  if (!inputList?.StepStart) {
    return "<div class='ui message'>No execution info available for this step.</div>";
  }

  // CPI timestamps are OData /Date(epoch)/ format
  var stepStart = new Date(parseInt(inputList.StepStart.substr(6, 13)));

  valueList.push({
    Name: "Start Time",
    Value: stepStart.toISOString().substr(0, 23),
  });

  if (inputList.StepStop) {
    var stepStop = new Date(parseInt(inputList.StepStop.substr(6, 13)));
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

  let result = `<table class='ui basic striped selectable compact table'><thead><tr class="blue"><th>Name</th><th>Value</th></tr></thead>
  <tbody>`;
  valueList.forEach((item) => {
    result += "<tr><td>" + htmlEscape(item.Name) + '</td><td style="word-break: break-all;">' + htmlEscape(String(item.Value)) + "</td></tr>";
  });
  result += "</tbody></table>";
  return result;
}

// Handles /script/v2/ path variant used by newer iFlow versions
function resolveScriptUrl(scriptInfo) {
  if (!scriptInfo?.scriptPath) return null;
  let scriptPath = scriptInfo.scriptPath;
  const isV2Path = scriptPath.includes("/v2/");
  const versionParam = isV2Path ? "?scriptVersion=v2" : "";
  scriptPath = isV2Path ? scriptPath.replace("/script/v2/", "/") : scriptPath.replace(/^\/script\//, "/");
  return `https://${scriptInfo.tenant}/api/1.0/iflows/${scriptInfo.artifactId}/script/${scriptPath}${versionParam}`;
}

async function resolveTransferData(debugData, transferOptions) {
  let groovyScript = "";
  if (transferOptions.script) {
    groovyScript = debugData.groovyScript || "";
    if (!groovyScript || groovyScript === "// Script content not available") {
      const scriptUrl = resolveScriptUrl(debugData.scriptInfo);
      if (scriptUrl) {
        try {
          const scriptResponse = await fetch(scriptUrl);
          if (scriptResponse.ok) {
            const scriptData = await scriptResponse.json();
            groovyScript = scriptData.content || "";
          }
        } catch (e) {
          log.error("Error fetching script for IDE:", e);
        }
      }
    }
  }

  let payload = "";
  if (transferOptions.body) {
    payload = debugData.payload || "";
    if (!payload && debugData.traceId) {
      try {
        const result = await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + debugData.traceId + ")/$value", true);
        if (typeof result === "string") {
          payload = result;
        }
      } catch (e) {
        log.error("Error fetching payload for IDE:", e);
      }
    }
  }

  let headers = {};
  if (transferOptions.headers) {
    headers = debugData.headers || {};
    if (Object.keys(headers).length === 0 && debugData.traceId) {
      try {
        const headersData = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + debugData.traceId + ")/Properties?$format=json", true)).d.results;
        headersData.forEach((h) => {
          headers[h.Name] = h.Value;
        });
      } catch (e) {
        log.error("Error fetching headers for IDE:", e);
      }
    }
  }

  const properties = transferOptions.properties ? debugData.properties || {} : {};

  return { groovyScript, payload, headers, properties };
}

async function sendToExternalIDE(settings, debugData, transferOptions = { body: true, properties: true, headers: true, script: true }) {
  const ideSelection = settings["groovyDebugger---ideSelection"] || "https://groovyide.com/cpi/share/v1/";
  const customUrl = settings["groovyDebugger---customIdeUrl"] || "";
  const ideUrl = ideSelection === "custom" ? customUrl.trim() || "https://groovyide.com/cpi/share/v1/" : ideSelection;

  if (typeof pako === "undefined") {
    showToast("Compression library not loaded. Please reload the page.", "Groovy Debugger", "Error");
    return;
  }

  const { groovyScript, payload, headers, properties } = await resolveTransferData(debugData, transferOptions);

  const dataObject = {
    input: { body: payload, headers: headers, properties: properties },
    script: { code: groovyScript, function: debugData.scriptFunction || "processData" },
  };

  let encoded = await compressToBase64(JSON.stringify(dataObject));
  encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  window.open(ideUrl + encoded, "_blank");
}

// Contiva encoding: JSON -> ZIP (JSZip) -> Gzip (pako) -> standard Base64 -> URL-encode
async function sendToContivaIDE(settings, debugData, transferOptions = { body: true, properties: true, headers: true, script: true }) {
  const contivaUrl = settings["groovyDebugger---ideSelection"] || "https://ide.contiva.com/cpi/script/debug";

  if (typeof pako === "undefined" || typeof JSZip === "undefined") {
    showToast("Compression libraries not loaded. Please reload the page.", "Groovy Debugger", "Error");
    return;
  }

  const { groovyScript, payload, headers, properties } = await resolveTransferData(debugData, transferOptions);

  const contivaData = {
    currentSessionType: "groovy",
    scriptInput: payload,
    script: groovyScript,
    functionName: debugData.scriptFunction || "processData",
    headers: headers,
    properties: properties,
  };

  const encoded = await compressToContivaBase64(contivaData);
  window.open(contivaUrl + "?data=" + encoded, "_blank");
}

async function compressToContivaBase64(contivaData) {
  const jsonString = JSON.stringify(contivaData);

  // epoch date for deterministic ZIP output
  const zip = new JSZip();
  zip.file("data.json", jsonString, { date: new Date(0) });
  const zipBytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  // mtime: 0 for deterministic gzip header
  const gzipped = pako.gzip(zipBytes, { level: 9, mtime: 0 });

  // Standard Base64 (NOT URL-safe) — Contiva expects + and /
  let binary = "";
  for (let i = 0; i < gzipped.length; i++) {
    binary += String.fromCharCode(gzipped[i]);
  }
  let base64 = btoa(binary);

  const paddingNeeded = (4 - (base64.length % 4)) % 4;
  base64 += "=".repeat(paddingNeeded);

  return encodeURIComponent(base64);
}

function compressToBase64(dataString) {
  const dataBytes = new TextEncoder().encode(dataString);

  const compressedBytes = pako.deflateRaw(dataBytes, { level: 9 });

  return uint8ArrayToBase64Url(compressedBytes);
}

function uint8ArrayToBase64Url(bytes) {
  let binaryString = "";
  bytes.forEach((byte) => {
    binaryString += String.fromCharCode(byte);
  });

  let base64 = btoa(binaryString);
  let base64Url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return base64Url;
}

pluginList.push(plugin);