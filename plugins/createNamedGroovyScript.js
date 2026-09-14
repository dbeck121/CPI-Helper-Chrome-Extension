(() => {
    const DEFAULT_GROOVY_TEMPLATE = `package script

  import com.sap.gateway.ip.core.customdev.util.Message

  def Message processData(Message message) {
      return message
  }
  `;

    function getIntegrationFlowId(pluginHelper) {
      if (pluginHelper.currentArtifactType && pluginHelper.currentArtifactType !== "IFlow") {
        return null;
      }

      return pluginHelper.currentIflowId || pluginHelper.currentArtifactId || pluginHelper.integrationFlowId || null;
    }

    function normalizeFileName(value) {
      const name = value.trim();
      if (!name) {
        throw new Error("Enter a file name.");
      }

      const nameWithExtension = name.toLowerCase().endsWith(".groovy") ? name : `${name}.groovy`;
      const baseName = nameWithExtension.slice(0, -".groovy".length);

      if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(baseName) || baseName.includes("..")) {
        throw new Error("Use a Groovy file name starting with a letter or underscore. Only letters, numbers, dot, dash and underscore are allowed.");
      }

      return nameWithExtension;
    }

    function getWorkspaceApiRoot(pluginHelper) {
      const urlExtension = pluginHelper?.urlExtension || "";
      return `/${urlExtension}api/1.0/workspace`;
    }

    function encodePathSegment(value) {
      return encodeURIComponent(value);
    }

    function getPackageId(pluginHelper) {
      return pluginHelper.currentPackageId || null;
    }

    function getErrorMessage(response, fallback) {
      if (!response) {
        return fallback;
      }

      try {
        const body = JSON.parse(response.responseText);
        return body?.error?.message?.value || body?.error?.message || response.statusText || fallback;
      } catch (error) {
        return response.statusText || response.responseText || fallback;
      }
    }

    function setStatus(status, message, type = "") {
      status.className = `ui ${type} message`;
      status.textContent = message;
      status.hidden = false;
    }

    function throwRequestError(response, fallback, requestUrl) {
      const message = getErrorMessage(response, fallback);
      const status = response?.status ? ` HTTP ${response.status}.` : "";
      throw new Error(`${message}${status} Request: ${requestUrl}`);
    }

    function parseJsonResponse(response, fallback, requestUrl) {
      try {
        return JSON.parse(response.responseText);
      } catch (error) {
        throw new Error(`${fallback} Request: ${requestUrl}`);
      }
    }

    async function resolveWorkspaceContext(pluginHelper, integrationFlowId) {
      const packageId = getPackageId(pluginHelper);
      if (!packageId) {
        throw new Error("Open the integration flow from its integration package before creating a file.");
      }

      const workspaceRoot = getWorkspaceApiRoot(pluginHelper);
      const workspacesResponse = await makeCallPromiseV2("GET", `${workspaceRoot}/`, false, "application/json", null, false, null, false);
      if (!workspacesResponse.successful) {
        throwRequestError(workspacesResponse, "Could not read the integration packages.", `${workspaceRoot}/`);
      }

      const workspaces = parseJsonResponse(workspacesResponse, "SAP returned an unreadable integration package list.", `${workspaceRoot}/`);
      const workspace = Array.isArray(workspaces) ? workspaces.find((item) => item.technicalName === packageId) : null;
      if (!workspace?.id) {
        throw new Error(`The integration package '${packageId}' was not found in the current workspace.`);
      }

      const artifactsUrl = `${workspaceRoot}/${encodePathSegment(workspace.id)}/artifacts/`;
      const artifactsResponse = await makeCallPromiseV2("GET", artifactsUrl, false, "application/json", null, false, null, false);
      if (!artifactsResponse.successful) {
        throwRequestError(artifactsResponse, "Could not read the integration package artifacts.", artifactsUrl);
      }

      const artifacts = parseJsonResponse(artifactsResponse, "SAP returned an unreadable artifact list.", artifactsUrl);
      const artifact = Array.isArray(artifacts) ? artifacts.find((item) => item.tooltip === integrationFlowId) : null;
      const entityId = artifact?.entityID || artifact?.id;
      if (!entityId) {
        throw new Error(`The integration flow '${integrationFlowId}' was not found in package '${packageId}'.`);
      }

      const entityBaseUrl = `${artifactsUrl}${encodePathSegment(entityId)}/entities/${encodePathSegment(entityId)}`;
      return { entityBaseUrl };
    }

    async function ensureScriptDoesNotExist(entityBaseUrl, integrationFlowId, fileName) {
      const scriptsUrl = `${entityBaseUrl}/iflows/${encodePathSegment(integrationFlowId)}/script/?extension=.groovy`;
      const response = await makeCallPromiseV2("GET", scriptsUrl, false, "application/json", null, false, null, false);
      if (!response.successful) {
        throwRequestError(response, "Could not read the existing Groovy files.", scriptsUrl);
      }

      const scripts = parseJsonResponse(response, "SAP returned an unreadable Groovy file list.", scriptsUrl);
      if (!Array.isArray(scripts)) {
        throw new Error(`SAP returned an unexpected Groovy file list. Request: ${scriptsUrl}`);
      }

      const requestedBaseName = fileName.slice(0, -".groovy".length).toLowerCase();
      const alreadyExists = scripts.some((script) => String(script.fileName || "").toLowerCase() === requestedBaseName);
      if (alreadyExists) {
        throw new Error(`The file '${fileName}' already exists in this iFlow.`);
      }
    }

    async function createGroovyResource(pluginHelper, integrationFlowId, fileName) {
      const { entityBaseUrl } = await resolveWorkspaceContext(pluginHelper, integrationFlowId);
      await ensureScriptDoesNotExist(entityBaseUrl, integrationFlowId, fileName);

      const scriptUrl = `${entityBaseUrl}/iflows/${encodePathSegment(integrationFlowId)}/script/${encodePathSegment(fileName)}`;
      const createResponse = await makeCallPromiseV2("PUT", scriptUrl, false, "application/json", JSON.stringify({ content: DEFAULT_GROOVY_TEMPLATE }), true, "application/json", true);
      if (!createResponse.successful) {
        throwRequestError(createResponse, "SAP did not create the Groovy file.", scriptUrl);
      }

      const draftUrl = `${entityBaseUrl}/drafts?type=script`;
      const draftPayload = {
        draftModel: DEFAULT_GROOVY_TEMPLATE,
        resourceName: fileName,
        resourceType: "script",
      };
      const draftResponse = await makeCallPromiseV2("POST", draftUrl, false, "application/json", JSON.stringify(draftPayload), true, "application/json", true);
      if (!draftResponse.successful) {
        throwRequestError(draftResponse, "The Groovy file was created, but SAP could not save its draft.", draftUrl);
      }
    }

    function createDialog(pluginHelper) {
      const integrationFlowId = getIntegrationFlowId(pluginHelper);
      const content = document.createElement("div");
      content.className = "ui form";

      const introduction = document.createElement("p");
      introduction.textContent = integrationFlowId
        ? `Create a Groovy resource in iFlow '${integrationFlowId}'. The .groovy extension is added automatically.`
        : "Open an integration flow before creating a Groovy resource.";

      const field = document.createElement("div");
      field.className = "field";

      const label = document.createElement("label");
      label.htmlFor = "cpiHelper_createNamedGroovyScript_name";
      label.textContent = "File name";

      const input = document.createElement("input");
      input.id = "cpiHelper_createNamedGroovyScript_name";
      input.type = "text";
      input.autocomplete = "off";
      input.placeholder = "GS_SetLoggingContext.groovy";
      input.disabled = !integrationFlowId;

      const help = document.createElement("div");
      help.className = "ui pointing basic label";
      help.textContent = "The new file contains a minimal processData(Message message) template.";

      const status = document.createElement("div");
      status.hidden = true;

      const actions = document.createElement("div");
      actions.className = "field";

      const createButton = document.createElement("button");
      createButton.type = "button";
      createButton.className = "ui primary button";
      createButton.textContent = "Create File";
      createButton.disabled = !integrationFlowId;

      const submit = async () => {
        try {
          const fileName = normalizeFileName(input.value);
          createButton.disabled = true;
          input.disabled = true;
          setStatus(status, `Creating '${fileName}' ...`, "info");

          await createGroovyResource(pluginHelper, integrationFlowId, fileName);
          setStatus(status, `Created '${fileName}'. Refresh the iFlow resources to display the new file.`, "positive");
          showToast(`Created ${fileName}`, "Groovy resource", "success");
        } catch (error) {
          setStatus(status, error.message || "Could not create the Groovy resource.", "negative");
          createButton.disabled = false;
          input.disabled = false;
          input.focus();
        }
      };

      createButton.addEventListener("click", submit);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      });

      field.append(label, input, help);
      actions.appendChild(createButton);
      content.append(introduction, field, actions, status);

      pluginHelper.functions.popup(content, "Create Groovy File", {
        fullscreen: false,
        large: false,
        closeText: "Cancel",
      });

      window.setTimeout(() => input.focus(), 100);
    }

    const plugin = {
      metadataVersion: "1.0.0",
      id: "createNamedGroovyScript",
      name: "Create named Groovy script",
      version: "0.1.0",
      author: "Björn Konzmann",
      website: "https://github.com/dbeck121/CPI-Helper-Chrome-Extension",
      email: "",
      settings: {},
      description: "Adds a Create File button to the message sidebar. It creates a named Groovy resource in the current integration flow.",
      messageSidebarContent: {
        static: true,
        onRender: (pluginHelper) => {
          const wrapper = document.createElement("div");
          const button = document.createElement("button");
          button.type = "button";
          button.className = "ui primary mini button";
          button.textContent = "Create File";
          button.title = "Create a named Groovy file in the current integration flow";
          button.addEventListener("click", () => createDialog(pluginHelper));
          wrapper.appendChild(button);
          return wrapper;
        },
      },
    };

    pluginList.push(plugin);
  })();
