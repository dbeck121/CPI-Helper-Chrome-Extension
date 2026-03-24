if (!window.groovyDebugSendToIDE) {
  /**
   * Global function for sending Groovy debug data to external IDE.
   * Called from the popup button when user wants to debug externally.
   * @async
   * @function groovyDebugSendToIDE
   * @global
   * @returns {Promise<void>} Resolves when debug data is sent successfully
   */
  window.groovyDebugSendToIDE = async function () {
    const settings = window.groovyDebuggerData?.settings || {};
    const ideSelection = settings["groovyDebugger---ideSelection"] || "https://groovyide.com/cpi/share/v1/";
    const customUrl = settings["groovyDebugger---customIdeUrl"] || "";
    const ideUrl = ideSelection === "custom" ? customUrl.trim() || "https://groovyide.com/cpi/share/v1/" : ideSelection === "contiva" ? "https://ide.contiva.com/cpi/script/debug" : ideSelection;
    const domain = new URL(ideUrl).hostname;

    // Load last-used transfer preferences (defaults: body+script on, properties+headers off)
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
        <p><strong>Destination:</strong> ${domain}</p>
        <p>Select which data you want to transfer to the external Groovy WebIDE:</p>
        <div class="ui form">
          <div class="grouped fields">
            <div class="field">
              <div class="ui checkbox ${prefs.body ? "checked" : ""}" id="transfer-body">
                <input type="checkbox" name="transfer-body" ${prefs.body ? "checked" : ""}>
                <label>Message Body <em>(may contain sensitive data)</em></label>
              </div>
            </div>
            <div class="field">
              <div class="ui checkbox ${prefs.script ? "checked" : ""}" id="transfer-script">
                <input type="checkbox" name="transfer-script" ${prefs.script ? "checked" : ""}>
                <label>Groovy Script <em>(source code)</em></label>
              </div>
            </div>
            <div class="field">
              <div class="ui checkbox ${prefs.properties ? "checked" : ""}" id="transfer-properties">
                <input type="checkbox" name="transfer-properties" ${prefs.properties ? "checked" : ""}>
                <label>Properties <em>(may contain configuration data)</em></label>
              </div>
            </div>
            <div class="field">
              <div class="ui checkbox ${prefs.headers ? "checked" : ""}" id="transfer-headers">
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

        $("#cpiHelper_semanticui_modal .ui.checkbox input").on("change", function () {
          $(this).closest(".ui.checkbox").toggleClass("checked", $(this).prop("checked"));
          updateContinueButton();
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

          $("#cpiHelper_semanticui_modal").modal("hide");
          const debugData = window.currentGroovyDebugData;
          try {
            if (ideSelection === "contiva") {
              await sendToContivaIDE(settings, debugData, transferOptions);
            } else {
              await sendToExternalIDE(settings, debugData, transferOptions);
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
        { value: "https://groovyide.com/cpi/share/v1/", label: "GroovyIDE.com", default: true },
        { value: "contiva", label: "Contiva IDE (ide.contiva.com)" },
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
        return; // Deselected, just clear and exit
      }

      // Get artifactId directly via API call
      const artifactId = await getArtifactIdDirectly();
      log.log("Groovy Debugger: artifactId=" + artifactId);

      if (!artifactId) {
        showToast("Could not fetch iFlow structure - make sure you're on an integration flow page", "Groovy Debugger", "Error");
        return;
      }

      showWaitingPopup("Fetching iFlow data, trace information and highlighting Groovy steps with data...", "ui blue");

      try {
        const iFlowUrl = "https://" + pluginHelper.tenant + "/api/1.0/iflows/" + artifactId;

        // Fetch the iFlow JSON structure
        const response = await fetch(iFlowUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const iFlowData = await response.json();

        // Extract groovy script elements
        const groovyElements = extractGroovyElements(iFlowData);

        if (groovyElements.length === 0) {
          $("#cpiHelper_waiting_model").modal("hide");
          showToast("No Groovy Script steps found in this integration flow", "Groovy Debugger", "Warning");
          return;
        }

        log.log("Groovy Debugger: Found " + groovyElements.length + " groovy script elements");

        // Reset any existing highlighting
        resetGroovyHighlighting();

        // Get trace elements to identify which groovy steps have been executed
        await createInlineTraceElements(runInfo.messageGuid, false);
        if (!inlineTraceElements?.length) {
          $("#cpiHelper_waiting_model").modal("hide");
          showToast("No trace data found for this message", "Groovy Debugger", "Warning");
          return;
        }

        // Find groovy elements that have corresponding trace data
        const groovyElementsWithTrace = groovyElements.filter((element) => {
          const matchingTraceElements = inlineTraceElements.filter((traceElement) => {
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

        // Highlight only groovy script elements that have trace data
        applyGroovyHighlighting(groovyElementsWithTrace);

        // Store data for click handling
        window.groovyDebuggerData = {
          settings: settings,
          runInfo: runInfo,
          groovyElements: groovyElementsWithTrace,
          iFlowData: iFlowData,
          iFlowUrl: iFlowUrl,
          artifactId: artifactId,
          inlineTraceElements: inlineTraceElements,
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

/**
 * Resets all Groovy highlighting and removes click handlers from BPMN shape elements.
 * Clears the fill color and cursor styles from all elements.
 * @function resetGroovyHighlighting
 */
function resetGroovyHighlighting() {
  document.querySelectorAll("g[id^='BPMNShape_'] rect.activity").forEach((rect) => {
    rect.style.fill = ""; // Reset fill for all elements
  });
  // Remove click handlers and cursor style from all BPMN shape elements
  document.querySelectorAll("g[id^='BPMNShape_']").forEach((element) => {
    element.style.cursor = "";
    element.onclick = null;
  });
}

/**
 * Retrieves the artifact ID directly via API call for the current integration flow.
 * Handles both Neo and Cloud Foundry platforms with different API approaches.
 * @async
 * @function getArtifactIdDirectly
 * @returns {Promise<string>} The artifact ID of the integration flow
 * @throws {Error} If the integration flow is not found or API call fails
 */
async function getArtifactIdDirectly() {
  try {
    // Both Neo and CF share the same list-fetch — only the return value differs
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

    // CF platform — artifact id from list is sufficient
    return artifact.id;
  } catch (error) {
    log.error("Error getting artifactId directly:", error);
    throw error;
  }
}

/**
 * Extracts Groovy script elements from the integration flow JSON data.
 * Filters elements to find only those with displayName "Groovy Script".
 * @function extractGroovyElements
 * @param {Object} iFlowData - The integration flow JSON structure
 * @param {Object} iFlowData.propertyViewModel - Property view model containing flow elements
 * @param {Array} iFlowData.propertyViewModel.listOfDefaultFlowElementModel - Array of flow elements
 * @returns {Array} Array of Groovy script elements with id, displayName, scriptFunction, and script properties
 */
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

/**
 * Applies green highlighting to found Groovy elements on the BPMN diagram.
 * Sets fill color to green (#13af00) for visual indication of debuggable steps.
 * @function applyGroovyHighlighting
 * @param {Array} groovyElements - Array of Groovy script elements to highlight
 * @param {Object} groovyElements[].id - Unique identifier of the element
 */
function applyGroovyHighlighting(groovyElements) {
  groovyElements.forEach((element) => {
    const selector = `g#BPMNShape_${element.id}`;
    const targetElement = document.querySelector(selector);

    if (targetElement) {
      // Find the rect inside the g element and apply fill color
      const rectElement = targetElement.querySelector("rect.activity");
      if (rectElement) {
        rectElement.style.fill = "#13af00"; // Apply green fill for groovy steps
      }
    }
  });
}

/**
 * Sets up click handlers for highlighted Groovy elements.
 * When clicked, displays debug popup with trace data for the selected Groovy step.
 * @function setupGroovyClickHandlers
 * @param {Object} settings - Plugin settings
 * @param {Object} runInfo - Runtime information for the message
 * @param {Array} groovyElements - Array of Groovy script elements
 * @param {Object} iFlowData - Integration flow JSON data
 * @param {string} artifactId - Artifact identifier
 * @param {string} tenant - Tenant name
 */
function setupGroovyClickHandlers(settings, runInfo, groovyElements, iFlowData, artifactId, tenant) {
  groovyElements.forEach((element) => {
    const selector = `g#BPMNShape_${element.id}`;
    const targetElement = document.querySelector(selector);

    if (targetElement) {
      targetElement.style.cursor = "pointer";
      targetElement.onclick = async (event) => {
        event.stopPropagation();
        event.preventDefault();

        try {
          // Try to get trace data for this element if available
          let debugData = await tryGetTraceDataForElement(runInfo, element, window.groovyDebuggerData.inlineTraceElements);

          if (!debugData) {
            // Create basic debug data if no trace available
            debugData = {
              messageGuid: runInfo.messageGuid,
              stepId: element.id,
              scriptName: element.displayName,
              groovyScript: "// Script content not available",
              scriptFunction: element.scriptFunction || "processData",
              timestamp: new Date().toISOString(),
            };
          } else {
            // Set initial placeholder for script content (will be lazy loaded)
            debugData.groovyScript = "// Script content not available";
          }

          // Store script fetching info for lazy loading
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
              debugBtn.on("click", () => window.groovyDebugSendToIDE());
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

/**
 * Attempts to get trace data for a specific element using pre-fetched trace elements.
 * Matches trace elements by StepId or ModelStepId to find corresponding execution data.
 * @async
 * @function tryGetTraceDataForElement
 * @param {Object} runInfo - Runtime information for the message
 * @param {Object} element - Groovy element to find trace data for
 * @param {string} element.id - Unique identifier of the element
 * @param {Array} inlineTraceElements - Array of pre-fetched trace elements
 * @returns {Promise<Object|null>} Debug data object if found, null otherwise
 */
async function tryGetTraceDataForElement(runInfo, element, inlineTraceElements) {
  try {
    // Use the pre-fetched trace elements instead of fetching again
    if (!inlineTraceElements?.length) {
      return null; // No trace data available
    }

    // Find trace elements that match this groovy element by ID
    const matchingTraceElements = inlineTraceElements.filter((traceElement) => {
      const traceId = traceElement.StepId || traceElement.ModelStepId;
      return traceId === element.id;
    });

    if (matchingTraceElements.length === 0) {
      return null; // Step wasn't executed in this trace
    }

    // Get debug data for the first matching trace element
    return await fetchGroovyDebugData(runInfo, matchingTraceElements[0], element.scriptFunction);
  } catch (error) {
    log.error("Error getting trace data for element:", error);
    return null;
  }
}

/**
 * Fetches debug data for a specific Groovy step from the CPI API.
 * Retrieves trace messages, properties, and run step information.
 * @async
 * @function fetchGroovyDebugData
 * @param {Object} runInfo - Runtime information containing message GUID
 * @param {Object} groovyStep - Trace element data for the Groovy step
 * @param {string} groovyStep.RunId - Run identifier
 * @param {number} groovyStep.ChildCount - Child count
 * @param {string} groovyStep.StepId - Step identifier
 * @param {string} scriptFunction - The actual Groovy function name from the iFlow element
 * @returns {Promise<Object|null>} Complete debug data object or null if failed
 */
async function fetchGroovyDebugData(runInfo, groovyStep, scriptFunction) {
  try {
    var messageGuid = runInfo.messageGuid;
    var runId = groovyStep.RunId;
    var childCount = groovyStep.ChildCount;

    // Get trace messages for this step
    var traceData = JSON.parse(
      await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogRunSteps(RunId='" + runId + "',ChildCount=" + childCount + ")/TraceMessages?$format=json", true)
    ).d.results;

    var traceInfo = traceData.find((trace) => trace.TraceId);

    if (!traceInfo) {
      return null;
    }

    var traceId = traceInfo.TraceId;

    // Payload will be fetched lazily when Body tab is activated

    // Get properties
    var properties = {};
    try {
      var propsData = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + traceId + ")/ExchangeProperties?$format=json", true)).d.results;
      propsData.forEach((prop) => {
        properties[prop.Name] = prop.Value;
      });
    } catch (e) {
      log.log("No properties for this step");
    }

    // Headers will be fetched lazily when Headers tab is activated

    // Get run step data with properties for Log and Info tabs
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

/**
 * Creates the HTML content for the Groovy debug popup with multiple tabs.
 * Uses lazy loading for performance - content is fetched only when tabs are activated.
 * @async
 * @function createGroovyDebugContent
 * @param {Object} data - Debug data object containing trace information
 * @param {string} data.traceId - The trace message ID
 * @param {Object} data.properties - Exchange properties
 * @param {Object} data.runStepData - Run step execution data
 * @param {Object} data.scriptInfo - Script metadata for lazy loading
 * @returns {Promise<string>} HTML content for the debug popup tabs
 */
async function createGroovyDebugContent(data) {
  // Lazy load body content when Body tab is activated
  let bodyContent = async () => {
    try {
      let payload = await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + data.traceId + ")/$value", true);
      return formatTrace(payload || "No payload", "groovyDebugBody", null, "payload.txt");
    } catch (error) {
      log.error("Error fetching body content:", error);
      return "<div>No body data available</div>";
    }
  };

  // Lazy load headers content when Headers tab is activated
  let headersContent = async () => {
    try {
      let headersData = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + data.traceId + ")/Properties?$format=json", true)).d.results;
      let headers = {};
      headersData.forEach((header) => {
        headers[header.Name] = header.Value;
      });
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

  // Lazy load script content when Script tab is activated
  let scriptContent = async () => {
    try {
      const scriptUrl = resolveScriptUrl(data.scriptInfo);
      let groovyScriptContent = "// Script content not available";
      if (scriptUrl) {
        const scriptResponse = await fetch(scriptUrl);
        const scriptData = await scriptResponse.json();
        groovyScriptContent = scriptData.content || "// Script content not available";
      }
      return formatTrace(groovyScriptContent, "groovyDebugScript", null, "script.groovy");
    } catch (error) {
      log.error("Error fetching script content:", error);
      return formatTrace("// Error loading script content", "groovyDebugScript", null, "script.groovy");
    }
  };

  // Get Log content from stored run step data
  let logContent = formatLogContent(data.runStepData?.RunStepProperties?.results || []);

  // Get Info content from stored run step data
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

  // Store data globally for button access
  window.currentGroovyDebugData = data;

  return tabsContent;
}

/**
 * Formats log content from run step properties into an HTML table.
 * Sorts the log entries alphabetically by name.
 * @function formatLogContent
 * @param {Array} inputList - Array of log entries with Name and Value properties
 * @returns {string} HTML table string containing formatted log content
 */
function formatLogContent(inputList) {
  inputList = inputList.sort(function (a, b) {
    return a.Name.toLowerCase() > b.Name.toLowerCase() ? 1 : -1;
  });
  let result = `<table class='ui basic striped selectable compact table'>
  <thead><tr class="blue"><th>Name</th><th>Value</th></tr></thead>
  <tbody>`;
  inputList.forEach((item) => {
    result += "<tr><td>" + item.Name + '</td><td style="word-break: break-all;">' + item.Value + "</td></tr>";
  });
  result += "</tbody></table>";
  return result;
}

/**
 * Formats run step information into an HTML table showing execution details.
 * Calculates and displays start/end times and duration information.
 * @function formatInfoContent
 * @param {Object} inputList - Run step data containing execution information
 * @param {string} inputList.StepStart - Start time in Microsoft JSON date format
 * @param {string} [inputList.StepStop] - End time in Microsoft JSON date format (optional)
 * @param {string} inputList.BranchId - Branch identifier
 * @param {string} inputList.RunId - Run identifier
 * @param {string} inputList.StepId - Step identifier
 * @param {string} inputList.ModelStepId - Model step identifier
 * @param {number} inputList.ChildCount - Child count
 * @returns {string} HTML table string containing formatted execution information
 */
function formatInfoContent(inputList) {
  const valueList = [];

  if (!inputList?.StepStart) {
    return "<div class='ui message'>No execution info available for this step.</div>";
  }

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

  let result = `<table class='ui basic striped selectable compact table'><thead><tr class="blue"><th>Name</th><th>Value</th></tr></thead>
  <tbody>`;
  valueList.forEach((item) => {
    result += "<tr><td>" + item.Name + '</td><td style="word-break: break-all;">' + item.Value + "</td></tr>";
  });
  result += "</tbody></table>";
  return result;
}

/**
 * Resolves the full script fetch URL from scriptInfo, handling v2 path variants.
 * @function resolveScriptUrl
 * @param {Object} scriptInfo - Script metadata
 * @returns {string|null} Full URL to fetch the script, or null if unavailable
 */
function resolveScriptUrl(scriptInfo) {
  if (!scriptInfo?.scriptPath) return null;
  let scriptPath = scriptInfo.scriptPath;
  const isV2Path = scriptPath.includes("/v2/");
  const versionParam = isV2Path ? "?scriptVersion=v2" : "";
  scriptPath = isV2Path ? scriptPath.replace("/script/v2/", "/") : scriptPath.replace(/^\/script\//, "/");
  return `https://${scriptInfo.tenant}/api/1.0/iflows/${scriptInfo.artifactId}/script/${scriptPath}${versionParam}`;
}

/**
 * Gathers and lazy-fetches all transfer data (script, payload, headers, properties)
 * based on the transfer options selected by the user.
 * @async
 * @function resolveTransferData
 * @param {Object} debugData - Complete debug data object
 * @param {Object} transferOptions - Which data types to transfer
 * @returns {Promise<{groovyScript: string, payload: string, headers: Object, properties: Object}>}
 */
async function resolveTransferData(debugData, transferOptions) {
  let groovyScript = "";
  if (transferOptions.script) {
    groovyScript = debugData.groovyScript || "";
    if (groovyScript === "// Script content not available") {
      const scriptUrl = resolveScriptUrl(debugData.scriptInfo);
      if (scriptUrl) {
        try {
          const scriptResponse = await fetch(scriptUrl);
          const scriptData = await scriptResponse.json();
          groovyScript = scriptData.content || "";
        } catch (e) {
          log.error("Error fetching script for IDE:", e);
          groovyScript = "";
        }
      }
    }
  }

  let payload = "";
  if (transferOptions.body) {
    payload = debugData.payload || "";
    if (!payload && debugData.traceId) {
      try {
        payload = await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/TraceMessages(" + debugData.traceId + ")/$value", true);
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

/**
 * Sends debug data to an external Groovy IDE for debugging.
 * Compresses and encodes the data before opening in a new tab/window.
 * @async
 * @function sendToExternalIDE
 * @param {Object} settings - Plugin settings
 * @param {Object} debugData - Complete debug data object
 * @param {Object} transferOptions - Options for which data types to transfer
 * @param {boolean} transferOptions.body - Whether to transfer message body
 * @param {boolean} transferOptions.properties - Whether to transfer properties
 * @param {boolean} transferOptions.headers - Whether to transfer headers
 * @param {boolean} transferOptions.script - Whether to transfer script
 * @returns {Promise<void>} Resolves when IDE is opened
 */
async function sendToExternalIDE(settings, debugData, transferOptions = { body: true, properties: true, headers: true, script: true }) {
  const ideSelection = settings["groovyDebugger---ideSelection"] || "https://groovyide.com/cpi/share/v1/";
  const customUrl = settings["groovyDebugger---customIdeUrl"] || "";
  const ideUrl = ideSelection === "custom" ? customUrl.trim() || "https://groovyide.com/cpi/share/v1/" : ideSelection;

  const { groovyScript, payload, headers, properties } = await resolveTransferData(debugData, transferOptions);

  const dataObject = {
    input: { body: payload, headers: headers, properties: properties },
    script: { code: groovyScript, function: debugData.scriptFunction || "processData" },
  };

  let encoded = await compressToBase64(JSON.stringify(dataObject));
  encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  window.open(ideUrl + encoded, "_blank");
}

/**
 * Converts CPI Helper debug data to Contiva format and opens in Contiva IDE.
 * Contiva encoding: JSON → ZIP (JSZip) → Gzip (pako) → standard Base64 → URL-encode.
 * URL: https://ide.contiva.com/cpi/script/debug?data={encoded}
 * @async
 * @function sendToContivaIDE
 * @param {Object} settings - Plugin settings
 * @param {Object} debugData - Complete debug data object
 * @param {Object} transferOptions - Which data types to transfer
 */
async function sendToContivaIDE(settings, debugData, transferOptions = { body: true, properties: true, headers: true, script: true }) {
  const contivaUrl = "https://ide.contiva.com/cpi/script/debug";

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

/**
 * Encodes Contiva format data for the Contiva IDE URL.
 * Pipeline: JSON → ZIP (JSZip, epoch date) → Gzip (pako, mtime=0)
 *           → standard Base64 (with padding) → URL-encode (encodeURIComponent).
 * @async
 * @function compressToContivaBase64
 * @param {Object} contivaData - Contiva format object to encode
 * @returns {Promise<string>} URL-encoded standard Base64 string
 */
async function compressToContivaBase64(contivaData) {
  const jsonString = JSON.stringify(contivaData);

  // Use epoch date (new Date(0)) for deterministic ZIP output
  const zip = new JSZip();
  zip.file("data.json", jsonString, { date: new Date(0) });
  const zipBytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  // mtime: 0 keeps the gzip header deterministic
  const gzipped = pako.gzip(zipBytes, { level: 9, mtime: 0 });

  // Standard Base64 — NOT URL-safe (keep + and /)
  let binary = "";
  for (let i = 0; i < gzipped.length; i++) {
    binary += String.fromCharCode(gzipped[i]);
  }
  let base64 = btoa(binary);

  const paddingNeeded = (4 - (base64.length % 4)) % 4;
  base64 += "=".repeat(paddingNeeded);

  return encodeURIComponent(base64);
}

/**
 * Compresses a data string using pako deflateRaw and encodes to Base64URL.
 * Used for compressing debug data before sending to external IDE.
 * @function compressToBase64
 * @param {string} dataString - JSON string to compress and encode
 * @returns {string} Compressed and Base64URL encoded string
 */
function compressToBase64(dataString) {
  const dataBytes = new TextEncoder().encode(dataString);

  // Raw Deflate stream — no Zlib/Gzip headers
  const compressedBytes = pako.deflateRaw(dataBytes, { level: 9 });

  return uint8ArrayToBase64Url(compressedBytes);
}

/**
 * Converts a Uint8Array to a Base64URL encoded string.
 * Used for URL-safe encoding of binary data.
 * @function uint8ArrayToBase64Url
 * @param {Uint8Array} bytes - Binary data to encode
 * @returns {string} Base64URL encoded string
 */
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
