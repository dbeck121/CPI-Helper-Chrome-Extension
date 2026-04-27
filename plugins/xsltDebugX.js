if (!window.xsltDebugSendToIDE) {
  /**
   * Global function for sending XSLT debug data to an external IDE.
   * Reads the current IDE selection fresh from chrome.storage.sync on every call
   * so changes made in the settings popup take effect immediately without a page reload.
   * Exits early with an error toast if no IDE has been selected in plugin settings.
   * Shows a confirmation dialog letting the user choose which data to transfer
   * (body, script, properties, headers), then dispatches to sendToXSLTIDE.
   * @async
   * @function xsltDebugSendToIDE
   * @global
   * @returns {Promise<void>} Resolves when the IDE tab has been opened, or returns
   *   early if no IDE is selected or no debug data is available.
   */
  window.xsltDebugSendToIDE = async function (debugDataOverride) {
    const settings = await getPluginSettings("xsltDebugX");
    // Default to the built-in IDE if user hasn't visited settings yet
    const ideSelection = settings["xsltDebugX---ideSelection"] || "https://xsltdebugx.pages.dev/";

    const customUrl = settings["xsltDebugX---customIdeUrl"] || "";
    const ideUrl = ideSelection === "custom" ? customUrl.trim() || "https://xsltdebugx.pages.dev/" : ideSelection;
    let domain;
    try {
      domain = new URL(ideUrl).hostname;
    } catch (e) {
      showToast("Invalid IDE URL: " + ideUrl, "XSLT Debugger", "Error");
      return;
    }

    // Load last-used transfer preferences (defaults: body+script on, properties+headers off)
    const [_body, _script, _props, _hdrs] = await Promise.all([
      getStorageValue("xsltDebugX", "transferBody", "browser"),
      getStorageValue("xsltDebugX", "transferScript", "browser"),
      getStorageValue("xsltDebugX", "transferProperties", "browser"),
      getStorageValue("xsltDebugX", "transferHeaders", "browser"),
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
        <p>Select which data you want to transfer to the external XSLT WebIDE:</p>
        <div class="ui form">
          <div class="grouped fields">
            <div class="field">
              <div class="ui toggle checkbox" id="xslt-transfer-body">
                <input type="checkbox" name="xslt-transfer-body" ${prefs.body ? "checked" : ""}>
                <label>Message Body <em>(may contain sensitive data)</em></label>
              </div>
            </div>
            <div class="field">
              <div class="ui toggle checkbox" id="xslt-transfer-script">
                <input type="checkbox" name="xslt-transfer-script" ${prefs.script ? "checked" : ""}>
                <label>XSLT Script <em>(source code)</em></label>
              </div>
            </div>
            <div class="field">
              <div class="ui toggle checkbox" id="xslt-transfer-properties">
                <input type="checkbox" name="xslt-transfer-properties" ${prefs.properties ? "checked" : ""}>
                <label>Properties <em>(may contain configuration data)</em></label>
              </div>
            </div>
            <div class="field">
              <div class="ui toggle checkbox" id="xslt-transfer-headers">
                <input type="checkbox" name="xslt-transfer-headers" ${prefs.headers ? "checked" : ""}>
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
          const anyChecked =
            $("#xslt-transfer-body input").prop("checked") ||
            $("#xslt-transfer-properties input").prop("checked") ||
            $("#xslt-transfer-headers input").prop("checked") ||
            $("#xslt-transfer-script input").prop("checked");
          continueBtn.toggleClass("disabled", !anyChecked).prop("disabled", !anyChecked);
        };

        // Initialize Semantic UI toggle checkboxes
        $("#cpiHelper_semanticui_modal .ui.checkbox").checkbox({
          onChange: updateContinueButton,
        });

        updateContinueButton();

        continueBtn.on("click", async () => {
          const transferOptions = {
            body: $("#xslt-transfer-body input").prop("checked"),
            properties: $("#xslt-transfer-properties input").prop("checked"),
            headers: $("#xslt-transfer-headers input").prop("checked"),
            script: $("#xslt-transfer-script input").prop("checked"),
          };

          await Promise.all([
            syncChromeStoragePromise(getStoragePath("xsltDebugX", "transferBody", "browser"), transferOptions.body),
            syncChromeStoragePromise(getStoragePath("xsltDebugX", "transferScript", "browser"), transferOptions.script),
            syncChromeStoragePromise(getStoragePath("xsltDebugX", "transferProperties", "browser"), transferOptions.properties),
            syncChromeStoragePromise(getStoragePath("xsltDebugX", "transferHeaders", "browser"), transferOptions.headers),
          ]);

          // Re-read settings at click time so any IDE change made while the dialog
          // was open is picked up without requiring a page reload.
          const latestSettings = await getPluginSettings("xsltDebugX");

          $("#cpiHelper_semanticui_modal").modal("hide");

          const debugData = debugDataOverride || window.currentXSLTDebugData;
          if (!debugData) {
            showToast("No debug data available. Please click an XSLT step first.", "XSLT Debugger", "Error");
            return;
          }
          try {
            await sendToXSLTIDE(latestSettings, debugData, transferOptions);
            showToast("Debug data sent to IDE", "Success");
          } catch (e) {
            log.error("Error sending to XSLT IDE:", e);
            showToast("Failed to send to IDE: " + e.message, "XSLT Debugger", "Error");
          }
        });
        actionsDiv.append(continueBtn);
      },
    });
  };
}

const xsltOriginalHandlers = new Map();

var plugin = {
  metadataVersion: "1.0.0",
  id: "xsltDebugX",
  name: "XSLTDebugX IDE",
  version: "1.0.0",
  author: "Sunil Pharswan",
  email: "sunilpharswan4198@gmail.com",
  website: "https://linkedin.com/in/sunilph",
  description:
    "<b>XSLTDebugX</b> streamlines XSLT debugging by automating runtime trace extraction. With visual step highlighting and one-click data transfer to <b>XSLT WebIDE</b>, it eliminates manual data entry and accelerates your integration development.<br><br><b>Note</b>: Requires the message to be processed in <b>Trace Mode</b> to capture and transfer runtime data.",
  settings: {
    ideSelection: {
      text: "External XSLT IDE",
      type: "radio",
      scope: "browser",
      options: [
        { value: "https://xsltdebugx.pages.dev/", label: "XSLTDebugX IDE (xsltdebugx.pages.dev)", default: true },
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
    icon: { text: "<>", type: "text" },
    title: "Debug XSLT Steps",
    onClick: async (pluginHelper, settings, runInfo, active) => {
      resetXSLTHighlighting();

      if (!active) {
        return; // Deselected, just clear and exit
      }

      // Get artifactId directly via API call (function defined in groovyDebugger.js, always loaded)
      if (typeof getArtifactIdDirectly !== "function") {
        showToast("Required helper function not available. Ensure the GroovyDebugX plugin is enabled.", "XSLT Debugger", "Error");
        return;
      }
      let artifactId;
      try {
        artifactId = await getArtifactIdDirectly();
      } catch (error) {
        log.error("XSLT Debugger: error fetching artifactId:", error);
        showToast("Could not fetch iFlow structure - " + error.message, "XSLT Debugger", "Error");
        return;
      }
      log.log("XSLT Debugger: artifactId=" + artifactId);

      if (!artifactId) {
        showToast("Could not fetch iFlow structure - make sure you're on an integration flow page", "XSLT Debugger", "Error");
        return;
      }

      showWaitingPopup("Fetching iFlow data, trace information and highlighting XSLT steps with data...", "ui blue");

      try {
        const iFlowUrl = "https://" + pluginHelper.tenant + "/api/1.0/iflows/" + artifactId;

        // Fetch the iFlow JSON structure
        const response = await fetch(iFlowUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const iFlowData = await response.json();

        // Extract XSLT mapping elements
        const xsltElements = extractXSLTElements(iFlowData);

        if (xsltElements.length === 0) {
          $("#cpiHelper_waiting_model").modal("hide");
          showToast("No XSLT Mapping steps found in this integration flow", "XSLT Debugger", "Warning");
          return;
        }

        log.log("XSLT Debugger: Found " + xsltElements.length + " XSLT mapping elements");

        // Reset any existing highlighting
        resetXSLTHighlighting();

        // Get trace elements to identify which XSLT steps have been executed
        await createInlineTraceElements(runInfo.messageGuid, false);
        const traceElementsCopy = [...inlineTraceElements];
        if (!traceElementsCopy.length) {
          $("#cpiHelper_waiting_model").modal("hide");
          showToast("No trace data found for this message", "XSLT Debugger", "Warning");
          return;
        }

        // Find XSLT elements that have corresponding trace data
        const xsltElementsWithTrace = xsltElements.filter((element) => {
          const matchingTraceElements = traceElementsCopy.filter((traceElement) => {
            const traceId = traceElement.StepId || traceElement.ModelStepId;
            return traceId === element.id;
          });
          return matchingTraceElements.length > 0;
        });

        if (xsltElementsWithTrace.length === 0) {
          $("#cpiHelper_waiting_model").modal("hide");
          showToast("No XSLT steps with trace data found in this message", "XSLT Debugger", "Warning");
          return;
        }

        // Highlight only XSLT mapping elements that have trace data
        applyXSLTHighlighting(xsltElementsWithTrace);

        // Store data for click handling
        window.xsltDebuggerData = {
          settings: settings,
          runInfo: runInfo,
          xsltElements: xsltElementsWithTrace,
          iFlowData: iFlowData,
          iFlowUrl: iFlowUrl,
          artifactId: artifactId,
          inlineTraceElements: traceElementsCopy,
        };

        setupXSLTClickHandlers(settings, runInfo, xsltElementsWithTrace, iFlowData, artifactId, pluginHelper.tenant);

        $("#cpiHelper_waiting_model").modal("hide");
        showToast("XSLT steps with data highlighted - click on any highlighted XSLT step to debug", "Success");
      } catch (error) {
        log.error("Error in XSLT Debugger:", error);
        showToast("Error: " + error.message, "XSLT Debugger", "Error");
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

/**
 * Resets all XSLT highlighting and removes click handlers from BPMN shape elements.
 * Clears the fill color and cursor styles from all elements.
 * @function resetXSLTHighlighting
 */
function resetXSLTHighlighting() {
  document.querySelectorAll("g[id^='BPMNShape_'] rect.activity").forEach((rect) => {
    rect.style.fill = "";
  });
  document.querySelectorAll("g[id^='BPMNShape_']").forEach((element) => {
    element.style.cursor = "";
    element.onclick = xsltOriginalHandlers.get(element.id) || null;
  });
  xsltOriginalHandlers.clear();
}

/**
 * Extracts XSLT mapping elements from the integration flow JSON data.
 * Filters elements to find only those with displayName "XSLT Mapping".
 * @function extractXSLTElements
 * @param {Object} iFlowData - The integration flow JSON structure
 * @returns {Array} Array of XSLT mapping elements with id, displayName, mappingPath, and filename
 */
function extractXSLTElements(iFlowData) {
  if (!iFlowData.propertyViewModel?.listOfDefaultFlowElementModel) {
    return [];
  }

  return iFlowData.propertyViewModel.listOfDefaultFlowElementModel
    .filter((element) => element.displayName === "XSLT Mapping")
    .map((element) => {
      const mappingPath = element.allAttributes?.mappingpath?.value || "";
      const filename = mappingPath.split("/").pop() || mappingPath;
      return {
        id: element.id,
        name: element.name || element.displayName,
        displayName: element.displayName,
        mappingPath: mappingPath,
        filename: filename,
      };
    });
}

/**
 * Applies green highlighting to found XSLT elements on the BPMN diagram.
 * Sets fill color to green (#13af00) for visual indication of debuggable steps.
 * @function applyXSLTHighlighting
 * @param {Array} xsltElements - Array of XSLT mapping elements to highlight
 */
function applyXSLTHighlighting(xsltElements) {
  xsltElements.forEach((element) => {
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

/**
 * Sets up click handlers for highlighted XSLT elements.
 * When clicked, displays debug popup with trace data for the selected XSLT step.
 * @function setupXSLTClickHandlers
 * @param {Object} settings - Plugin settings
 * @param {Object} runInfo - Runtime information for the message
 * @param {Array} xsltElements - Array of XSLT mapping elements
 * @param {Object} iFlowData - Integration flow JSON data
 * @param {string} artifactId - Artifact identifier
 * @param {string} tenant - Tenant name
 */
function setupXSLTClickHandlers(settings, runInfo, xsltElements, iFlowData, artifactId, tenant) {
  xsltElements.forEach((element) => {
    const selector = `g#BPMNShape_${element.id}`;
    const targetElement = document.querySelector(selector);

    if (targetElement) {
      if (!xsltOriginalHandlers.has(targetElement.id)) {
        xsltOriginalHandlers.set(targetElement.id, targetElement.onclick);
      }
      targetElement.style.cursor = "pointer";
      targetElement.onclick = async (event) => {
        event.stopPropagation();
        event.preventDefault();

        try {
          let debugData = await tryGetXSLTTraceDataForElement(runInfo, element, window.xsltDebuggerData.inlineTraceElements);

          if (!debugData) {
            debugData = {
              messageGuid: runInfo.messageGuid,
              stepId: element.id,
              scriptName: element.displayName,
              timestamp: new Date().toISOString(),
            };
          }

          // Store script fetching info for lazy loading
          debugData.scriptInfo = {
            tenant: tenant,
            artifactId: artifactId,
            filename: element.filename,
          };

          showBigPopup(await createXSLTDebugContent(debugData), `XSLT Debug Data - ${element.name || element.displayName || element.id}`, {
            fullscreen: false,
            callback: () => {
              let actionsDiv = $("#cpiHelper_semanticui_modal .actions");
              let debugBtn = $('<div class="ui positive button"><i class="rocket icon"></i>Debug Externally</div>');
              debugBtn.on("click", () => window.xsltDebugSendToIDE(debugData));
              actionsDiv.prepend(debugBtn);
            },
          });
        } catch (error) {
          log.error("Error in XSLT click handler:", error);
          showToast("Error: " + error.message, "Error");
        }
      };
    }
  });
}

/**
 * Attempts to get trace data for a specific XSLT element using pre-fetched trace elements.
 * @async
 * @function tryGetXSLTTraceDataForElement
 * @param {Object} runInfo - Runtime information for the message
 * @param {Object} element - XSLT element to find trace data for
 * @param {Array} inlineTraceElements - Array of pre-fetched trace elements
 * @returns {Promise<Object|null>} Debug data object if found, null otherwise
 */
async function tryGetXSLTTraceDataForElement(runInfo, element, inlineTraceElements) {
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

    return await fetchXSLTDebugData(runInfo, matchingTraceElements[0]);
  } catch (error) {
    log.error("Error getting trace data for XSLT element:", error);
    return null;
  }
}

/**
 * Fetches debug data for a specific XSLT step from the CPI API.
 * Retrieves trace messages, exchange properties, and run step information.
 * @async
 * @function fetchXSLTDebugData
 * @param {Object} runInfo - Runtime information containing message GUID
 * @param {Object} xsltStep - Trace element data for the XSLT step
 * @returns {Promise<Object|null>} Complete debug data object or null if failed
 */
async function fetchXSLTDebugData(runInfo, xsltStep) {
  try {
    var messageGuid = runInfo.messageGuid;
    var runId = xsltStep.RunId;
    var childCount = xsltStep.ChildCount;

    // Get trace messages for this step
    var traceData = JSON.parse(
      await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + runId + "',ChildCount=" + childCount + ")/TraceMessages?$format=json", true)
    ).d.results;

    var traceInfo = traceData.find((trace) => trace.TraceId);

    if (!traceInfo) {
      return null;
    }

    var traceId = traceInfo.TraceId;

    // Get exchange properties
    var properties = {};
    try {
      var propsData = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + traceId + ")/ExchangeProperties?$format=json", true)).d.results;
      propsData.forEach((prop) => {
        properties[prop.Name] = prop.Value;
      });
    } catch (e) {
      log.log("No properties for this XSLT step");
    }

    // Get run step data with properties for Log and Info tabs
    var runStepData = {};
    try {
      runStepData = JSON.parse(
        await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + runId + "',ChildCount=" + childCount + ")/?$expand=RunStepProperties&$format=json", true)
      ).d;
    } catch (e) {
      log.log("No run step data for this XSLT step");
    }

    return {
      messageGuid: messageGuid,
      stepId: xsltStep.StepId,
      runId: runId,
      childCount: childCount,
      traceId: traceId,
      properties: properties,
      runStepData: runStepData,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    log.error("Error fetching XSLT debug data:", error);
    return null;
  }
}

/**
 * Creates the HTML content for the XSLT debug popup with multiple tabs.
 * Uses lazy loading for performance - content is fetched only when tabs are activated.
 * @async
 * @function createXSLTDebugContent
 * @param {Object} data - Debug data object containing trace information
 * @returns {Promise<string>} HTML content for the debug popup tabs
 */
async function createXSLTDebugContent(data) {
  // Lazy load body content when Body tab is activated
  let bodyContent = async () => {
    if (!data.traceId) return "<div>No trace data available for this step.</div>";
    try {
      let payload = await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + data.traceId + ")/$value", true);
      if (typeof payload === "string" && payload) {
        data.payload = payload;
      }
      return formatTrace(payload || "No payload", "xsltDebugBody", null, "payload.txt");
    } catch (error) {
      log.error("Error fetching XSLT body content:", error);
      return "<div>No body data available</div>";
    }
  };

  // Lazy load headers content when Headers tab is activated
  let headersContent = async () => {
    if (!data.traceId) return "<div>No trace data available for this step.</div>";
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
      log.error("Error fetching XSLT headers content:", error);
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

  // Lazy load XSLT script content when Script tab is activated
  let scriptContent = async () => {
    try {
      const scriptUrl = resolveXSLTScriptUrl(data.scriptInfo);
      let xsltScriptContent = "<!-- XSLT script content not available -->";
      if (scriptUrl) {
        const scriptResponse = await fetch(scriptUrl);
        if (scriptResponse.ok) {
          const scriptData = await scriptResponse.json();
          if (scriptData.content) {
            xsltScriptContent = scriptData.content;
            data.xsltScript = xsltScriptContent;
          }
        }
      }
      return formatTrace(xsltScriptContent, "xsltDebugScript", null, "script.xsl");
    } catch (error) {
      log.error("Error fetching XSLT script content:", error);
      return formatTrace("<!-- Error loading XSLT script content -->", "xsltDebugScript", null, "script.xsl");
    }
  };

  // Get Log content from stored run step data
  let logContent = formatXSLTLogContent(data.runStepData?.RunStepProperties?.results || []);

  // Get Info content from stored run step data
  let infoContent = formatXSLTInfoContent(data.runStepData || {});

  let objects = [
    { label: "Properties", content: propertiesContent, active: true },
    { label: "Headers", content: headersContent, active: false },
    { label: "Body", content: bodyContent, active: false },
    { label: "Script", content: scriptContent, active: false },
    { label: "Log", content: logContent, active: false },
    { label: "Info", content: infoContent, active: false },
  ];

  let tabsContent = await createTabHTML(objects, "xsltDebugTabs");

  // Store data globally for button access
  window.currentXSLTDebugData = data;

  return tabsContent;
}

/**
 * Formats log content from run step properties into an HTML table.
 * @function formatXSLTLogContent
 * @param {Array} inputList - Array of log entries with Name and Value properties
 * @returns {string} HTML table string containing formatted log content
 */
function formatXSLTLogContent(inputList) {
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

/**
 * Formats run step information into an HTML table showing execution details.
 * Calculates and displays start/end times and duration information.
 * @function formatXSLTInfoContent
 * @param {Object} inputList - Run step data containing execution information
 * @returns {string} HTML table string containing formatted execution information
 */
function formatXSLTInfoContent(inputList) {
  const valueList = [];

  if (!inputList?.StepStart) {
    return "<div class='ui message'>No execution info available for this step.</div>";
  }

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

/**
 * Resolves the full XSLT resource fetch URL from scriptInfo.
 * Uses the CPI resource API endpoint for XSLT mapping files.
 * API: /api/1.0/iflows/{artifactId}/resource/{filename}?resourceLocation=mapping&resourcePersistenceType=&artifactType=
 * @function resolveXSLTScriptUrl
 * @param {Object} scriptInfo - Script metadata with tenant, artifactId, filename
 * @returns {string|null} Full URL to fetch the XSLT script, or null if unavailable
 */
function resolveXSLTScriptUrl(scriptInfo) {
  if (!scriptInfo?.filename) return null;
  return `https://${scriptInfo.tenant}/api/1.0/iflows/${scriptInfo.artifactId}/resource/${encodeURIComponent(scriptInfo.filename)}?resourceLocation=mapping&resourcePersistenceType=&artifactType=`;
}

/**
 * Gathers and lazy-fetches all transfer data (script, payload, headers, properties)
 * based on the transfer options selected by the user.
 * @async
 * @function resolveXSLTTransferData
 * @param {Object} debugData - Complete debug data object
 * @param {Object} transferOptions - Which data types to transfer
 * @returns {Promise<{xsltScript: string, payload: string, headers: Object, properties: Object}>}
 */
async function resolveXSLTTransferData(debugData, transferOptions) {
  let xsltScript = "";
  if (transferOptions.script) {
    xsltScript = debugData.xsltScript || "";
    if (!xsltScript) {
      const scriptUrl = resolveXSLTScriptUrl(debugData.scriptInfo);
      if (scriptUrl) {
        try {
          const scriptResponse = await fetch(scriptUrl);
          if (scriptResponse.ok) {
            const scriptData = await scriptResponse.json();
            xsltScript = scriptData.content || "";
          }
        } catch (e) {
          log.error("Error fetching XSLT script for IDE:", e);
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
        log.error("Error fetching payload for XSLT IDE:", e);
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
        log.error("Error fetching headers for XSLT IDE:", e);
      }
    }
  }

  const properties = transferOptions.properties ? debugData.properties || {} : {};

  return { xsltScript, payload, headers, properties };
}

/**
 * Sends XSLT debug data to an external XSLT IDE.
 * The target URL is read from settings: if ideSelection is "custom" the user-supplied
 * customIdeUrl is used, otherwise ideSelection itself is the URL.
 * Data is encoded using pako.deflateRaw compression + URL-safe base64 and appended
 * as a #share/ hash fragment so the IDE can decode it on load.
 * @async
 * @function sendToXSLTIDE
 * @param {Object} settings - Plugin settings
 * @param {Object} debugData - Complete debug data object
 * @param {Object} transferOptions - Options for which data types to transfer
 * @returns {Promise<void>} Resolves when the IDE tab has been opened
 */
async function sendToXSLTIDE(settings, debugData, transferOptions = { body: true, properties: true, headers: true, script: true }) {
  const ideSelection = settings["xsltDebugX---ideSelection"] || "https://xsltdebugx.pages.dev/";
  const customUrl = settings["xsltDebugX---customIdeUrl"] || "";
  const ideUrl = ideSelection === "custom" ? customUrl.trim() || "https://xsltdebugx.pages.dev/" : ideSelection;

  if (typeof pako === "undefined") {
    showToast("Compression library not loaded. Please reload the page.", "XSLT Debugger", "Error");
    return;
  }

  const { xsltScript, payload, headers, properties } = await resolveXSLTTransferData(debugData, transferOptions);

  const sharePayload = {
    xml:        payload,
    xslt:       xsltScript,
    headers:    Object.keys(headers).map(name    => ({ name, value: headers[name] })),
    properties: Object.keys(properties).map(name => ({ name, value: properties[name] })),
  };

  // Compress with pako.deflateRaw + URL-safe base64 (matches xsltdebugx.pages.dev share format)
  const bytes      = new TextEncoder().encode(JSON.stringify(sharePayload));
  const compressed = pako.deflateRaw(bytes, { level: 9 });
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < compressed.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, compressed.subarray(i, i + CHUNK));
  }
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const baseUrl = ideUrl.split('#')[0];
  window.open(baseUrl + '#share/' + encoded, "_blank");
}

pluginList.push(plugin);
