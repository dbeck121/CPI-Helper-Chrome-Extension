// Wrapped in an IIFE: content scripts share one global scope, so helper names must not leak.
(() => {
  const plugin = {
    metadataVersion: "1.0.0",
    id: "xmlToXsd",
    name: "XML to XSD",
    version: "1.0.0",
    author: "Jorge Sá",
    website: "https://www.linkedin.com/in/jorgersa/",
    email: "jorgesa.developer@gmail.com",
    description:
      "Generates an XSD from a sample XML, for the source and target schema of a message mapping. Paste or load the XML, choose the schema design and copy or download the XSD, or add it as a schema resource to the iFlow you have open. Repeated elements become unbounded, everything is optional by default, value types are inferred from the sample. The XSD is generated in your browser, adding it to an iFlow only talks to your own tenant.",
    settings: {},
    toolbarButton: {
      title: "XML to XSD",
      icon: { text: "XSD", type: "text" },
      onClick: (pluginHelper) => openXmlToXsd(pluginHelper),
    },
  };

  const MARKUP = `
    <div class="ui form cpihXsd">
      <div class="fields">
        <div class="field">
          <label>Schema design</label>
          <select class="ui dropdown cpihXsd_design">
            <option value="russian-doll">Russian doll: nested, one global element</option>
            <option value="venetian-blind">Venetian blind: named complex types</option>
          </select>
        </div>
        <div class="field">
          <label>Value types</label>
          <div class="ui checkbox"><input type="checkbox" class="cpihXsd_infer" id="cpihXsd_infer" checked /><label for="cpihXsd_infer">Infer from the values (int, decimal, date, ...), otherwise everything is xs:string</label></div>
        </div>
      </div>
      <div class="field">
        <div class="ui checkbox"><input type="checkbox" class="cpihXsd_optional" id="cpihXsd_optional" checked /><label for="cpihXsd_optional">All optional: minOccurs="0" on every element, no required attributes (one sample cannot show what is mandatory)</label></div>
      </div>
      <div class="cpihXsd_messages"></div>
      <div class="fields">
        <div class="field">
          <label>XML</label>
          <textarea class="cpihXsd_xml" spellcheck="false" placeholder="Paste a sample XML here"></textarea>
        </div>
        <div class="field">
          <label>XSD</label>
          <textarea class="cpihXsd_xsd" spellcheck="false" readonly></textarea>
        </div>
      </div>
      <div class="field cpihXsd_nameField">
        <label>File name</label>
        <input type="text" class="cpihXsd_name" value="schema.xsd" autocomplete="off" spellcheck="false" />
      </div>
      <div class="cpihXsd_status" hidden></div>
      <div>
        <button type="button" class="ui button cpihXsd_load">Load XML file</button>
        <button type="button" class="ui button cpihXsd_copy" disabled>Copy XSD</button>
        <button type="button" class="ui button cpihXsd_download" disabled>Download XSD</button>
        <button type="button" class="ui primary button cpihXsd_upload" disabled>Add to iFlow</button>
        <input type="file" class="cpihXsd_file" accept=".xml,text/xml,application/xml" hidden />
      </div>
    </div>`;

  // the schema upload of the iFlow editor: POST of a multipart form, the file lands in src/main/resources/xsd
  const RESOURCE_LIST_QUERY = "attributeKey=default&fileExtensions=xsd,zip&readLocations=xsd&helpServiceName=resourceLookupService";
  const RESOURCE_UPLOAD_QUERY = "attributeKey=default&writeLocation=xsd&fileExtensions=xsd,zip&helpServiceName=resourceLookupService&resourceType=xsd";

  function getIntegrationFlowId(pluginHelper) {
    if (pluginHelper.currentArtifactType && pluginHelper.currentArtifactType !== "IFlow") return null;
    return pluginHelper.currentIflowId || pluginHelper.currentArtifactId || null;
  }

  function normalizeFileName(value) {
    const name = value.trim();
    if (!name) throw new Error("Enter a file name.");
    const withExtension = name.toLowerCase().endsWith(".xsd") ? name : `${name}.xsd`;
    const baseName = withExtension.slice(0, -".xsd".length);
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(baseName) || baseName.includes("..")) {
      throw new Error("Use a file name that starts with a letter or underscore. Only letters, numbers, dot, dash and underscore are allowed.");
    }
    return withExtension;
  }

  function describeFailure(response, fallback) {
    let detail = response?.statusText || "";
    try {
      const body = JSON.parse(response.responseText);
      detail = body?.errorMessage || body?.error?.message?.value || body?.error?.message || detail;
    } catch (error) {
      // not JSON, the status text has to do
    }
    return `${fallback}${detail ? " " + detail : ""}${response?.status ? ` (HTTP ${response.status})` : ""}`;
  }

  async function getJson(url, fallback) {
    const response = await makeCallPromiseV2("GET", url, false, "application/json", null, false, null, false);
    if (!response.successful) throw new Error(describeFailure(response, fallback));
    try {
      return JSON.parse(response.responseText);
    } catch (error) {
      throw new Error(`${fallback} SAP returned an unreadable answer.`);
    }
  }

  // same lookup as plugins/createNamedGroovyScript.js: package -> artifact list -> entity id of the iFlow
  async function resolveEntityId(pluginHelper, integrationFlowId) {
    const packageId = pluginHelper.currentPackageId;
    if (!packageId) throw new Error("Open the integration flow from its integration package first.");
    const root = `/${pluginHelper.urlExtension || ""}api/1.0/workspace`;
    const workspaces = await getJson(`${root}/`, "Could not read the integration packages.");
    const workspace = Array.isArray(workspaces) ? workspaces.find((item) => item.technicalName === packageId) : null;
    if (!workspace?.id) throw new Error(`The integration package '${packageId}' was not found in the current workspace.`);
    const artifactsUrl = `${root}/${encodeURIComponent(workspace.id)}/artifacts/`;
    const artifacts = await getJson(artifactsUrl, "Could not read the artifacts of the package.");
    const artifact = Array.isArray(artifacts) ? artifacts.find((item) => item.tooltip === integrationFlowId) : null;
    const entityId = artifact?.entityID || artifact?.id;
    if (!entityId) throw new Error(`The integration flow '${integrationFlowId}' was not found in package '${packageId}'.`);
    return entityId;
  }

  // resolves with the reference a mapping step uses, e.g. /xsd/Order.xsd
  async function uploadXsd(pluginHelper, integrationFlowId, fileName, xsd) {
    const entityId = await resolveEntityId(pluginHelper, integrationFlowId);
    const resourceUrl = `/${pluginHelper.urlExtension || ""}api/1.0/iflow/${encodeURIComponent(entityId)}/component/defaultResource/resource`;

    const existing = await getJson(`${resourceUrl}?${RESOURCE_LIST_QUERY}`, "Could not read the schemas of the iFlow.");
    const reference = `/xsd/${fileName}`;
    if (Array.isArray(existing) && existing.some((resource) => String(resource.persistenceValue || "").toLowerCase() === reference.toLowerCase())) {
      throw new Error(`The schema '${fileName}' already exists in this iFlow. Choose another file name.`);
    }

    const form = new FormData();
    form.append("__uploader2[]", new File([xsd], fileName, { type: "text/xml" }));
    form.append("_charset_", "UTF-8");
    form.append("__uploader2-data", JSON.stringify({ additionalData: [{ fileName, contentType: "application/x.generic.xsd", sourceResourceType: "xsd" }] }));
    // no content type: the browser adds the multipart boundary
    const response = await makeCallPromiseV2("POST", `${resourceUrl}?${RESOURCE_UPLOAD_QUERY}`, false, "application/json", form, true, null, false);
    if (!response.successful) throw new Error(describeFailure(response, "SAP did not accept the schema. Is the iFlow in edit mode?"));

    let result;
    try {
      result = JSON.parse(response.responseText)?.responsesValue?.[0];
    } catch (error) {
      // handled below
    }
    if (result?.errorCode) throw new Error(result.errorMessage || `SAP refused the schema (${result.errorCode}).`);
    if (!result?.persistenceValue) throw new Error("SAP answered without a reference to the new schema, check the Resources tab of the iFlow.");
    return result.persistenceValue;
  }

  function openXmlToXsd(pluginHelper) {
    const root = document.createElement("div");
    root.innerHTML = MARKUP;
    const $ = (selector) => root.querySelector(selector);
    const xmlField = $(".cpihXsd_xml");
    const xsdField = $(".cpihXsd_xsd");
    const messages = $(".cpihXsd_messages");
    const copyButton = $(".cpihXsd_copy");
    const downloadButton = $(".cpihXsd_download");
    const uploadButton = $(".cpihXsd_upload");
    const nameField = $(".cpihXsd_name");
    const status = $(".cpihXsd_status");
    const integrationFlowId = getIntegrationFlowId(pluginHelper);
    let nameEdited = false;

    nameField.parentElement.style.maxWidth = "28rem";
    uploadButton.title = integrationFlowId ? `Add the schema as a resource of '${integrationFlowId}'` : "Open an integration flow to add the schema to it";

    const setStatus = (type, text) => {
      status.className = `cpihXsd_status ui ${type} message`;
      status.textContent = text;
      status.hidden = false;
    };

    for (const field of [xmlField, xsdField]) {
      field.style.cssText = "height: 55vh; font-family: Consolas, 'Courier New', monospace; font-size: 0.8125rem; white-space: pre; resize: none;";
    }

    const showMessage = (type, lines) => {
      messages.replaceChildren(
        ...lines.map((line) => {
          const message = document.createElement("div");
          message.className = `ui ${type} message`;
          message.textContent = line;
          return message;
        })
      );
    };

    const generate = () => {
      messages.replaceChildren();
      const setResult = (xsd) => {
        xsdField.value = xsd;
        copyButton.disabled = downloadButton.disabled = !xsd;
        uploadButton.disabled = !xsd || !integrationFlowId;
      };
      if (!xmlField.value.trim()) return setResult("");
      try {
        const result = cpihXmlToXsd(xmlField.value, { design: $(".cpihXsd_design").value, inferTypes: $(".cpihXsd_infer").checked, allOptional: $(".cpihXsd_optional").checked });
        setResult(result.xsd);
        if (!nameEdited) nameField.value = `${result.rootName}.xsd`;
        if (result.warnings.length) showMessage("warning", result.warnings);
      } catch (error) {
        setResult("");
        showMessage("negative", [error.message]);
      }
    };

    let timer;
    xmlField.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(generate, 250);
    });
    $(".cpihXsd_design").addEventListener("change", generate);
    $(".cpihXsd_infer").addEventListener("change", generate);
    $(".cpihXsd_optional").addEventListener("change", generate);

    const fileInput = $(".cpihXsd_file");
    $(".cpihXsd_load").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      xmlField.value = await file.text();
      generate();
    });

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(xsdField.value);
        showToast("XSD copied to the clipboard", "XML to XSD", "success");
      } catch (error) {
        xsdField.select();
        showToast("Could not access the clipboard, the XSD is selected, press Ctrl+C", "XML to XSD", "warning");
      }
    });

    nameField.addEventListener("input", () => {
      nameEdited = true;
    });

    downloadButton.addEventListener("click", () => {
      let name;
      try {
        name = normalizeFileName(nameField.value);
      } catch (error) {
        return setStatus("negative", error.message);
      }
      const url = URL.createObjectURL(new Blob([xsdField.value], { type: "application/xml" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    });

    uploadButton.addEventListener("click", async () => {
      try {
        const name = normalizeFileName(nameField.value);
        uploadButton.disabled = true;
        setStatus("info", `Adding '${name}' to the iFlow '${integrationFlowId}' ...`);
        const reference = await uploadXsd(pluginHelper, integrationFlowId, name, xsdField.value);
        setStatus("positive", `Added to '${integrationFlowId}' as ${reference}. Pick it in the schema picker of a mapping step. If it is not listed yet, reopen the picker or reload the editor.`);
        showToast(`Added ${name} to the iFlow`, "XML to XSD", "success");
      } catch (error) {
        setStatus("negative", error.message || "Could not add the schema to the iFlow.");
      } finally {
        uploadButton.disabled = !xsdField.value || !integrationFlowId;
      }
    });

    pluginHelper.functions.popup(root, "XML to XSD", { large: true, fullscreen: false });
  }

  pluginList.push(plugin);
})();
