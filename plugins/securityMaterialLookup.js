// Opt-in plugin. Never use the common request helper here: it logs/caches response bodies.
var securityMaterialViewer = (() => {
  const id = "securityMaterialViewer";
  const buttonClass = "cpiHelper_securityMaterialViewer";
  let busy = false;
  let dialog = null;
  const isPage = () => /\/shell\/monitoring\/SecurityMaterials(?:\/|$)/.test(location.pathname);
  const active = async () => (await getPluginSettings(id))[id + "---isActive"] === true;

  async function request(base, path, method = "GET", body, token) {
    const headers = { Accept: "application/json" };
    if (token) headers["X-CSRF-Token"] = token;
    if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
    const response = await fetch(base + path, {
      method, headers, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000),
    });
    if (method === "DELETE" && response.status === 404) return null;
    if (!response.ok) throw new Error(`SAP request failed (HTTP ${response.status}). Check your session and design/simulation permissions.`);
    if (method === "DELETE" || response.status === 204) return null;
    return response.json();
  }

  // A new, minimal simulation-only flow, assembled locally; no deployed HTTP endpoint.
  function archive(flowName) {
    const zip = new JSZip();
    const properties = (values) => '<bpmn2:extensionElements>' + Object.entries(values).map(([key, value]) =>
      `<ifl:property><key>${key}</key><value>${value}</value></ifl:property>`).join("") + '</bpmn2:extensionElements>';
    const variant = (name, version) => `ctype::FlowstepVariant/cname::${name}/version::${version}`;
    zip.file("src/main/resources/scenarioflows/integrationflow/CredentialViewer.iflw", `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:ifl="http:///com.sap.ifl.model/Ifl.xsd" id="Definitions_1">
<bpmn2:collaboration id="Collaboration_1" name="Credential Viewer">
${properties({ componentVersion: "1.2", cmdVariantUri: "ctype::IFlowVariant/cname::IFlowConfiguration/version::1.2.4", log: "All events", httpSessionHandling: "None", ServerTrace: "false" })}
<bpmn2:participant id="Participant_Process_1" name="Integration Process" ifl:type="IntegrationProcess" processRef="Process_1"/></bpmn2:collaboration>
<bpmn2:process id="Process_1" name="Integration Process">
${properties({ componentVersion: "1.2", cmdVariantUri: variant("IntegrationProcess", "1.2.1"), transactionalHandling: "Not Required", transactionTimeout: "30" })}
<bpmn2:startEvent id="StartEvent_2" name="Start">${properties({ componentVersion: "1.0", cmdVariantUri: variant("MessageStartEvent", "1.0.0") })}<bpmn2:outgoing>SequenceFlow_5</bpmn2:outgoing><bpmn2:messageEventDefinition/></bpmn2:startEvent>
<bpmn2:callActivity id="CallActivity_4" name="Read credential">${properties({ componentVersion: "1.1", cmdVariantUri: variant("GroovyScript", "1.1.2"), activityType: "Script", subActivityType: "GroovyScript", script: "credential.groovy", scriptFunction: "", scriptBundleId: "" })}<bpmn2:incoming>SequenceFlow_5</bpmn2:incoming><bpmn2:outgoing>SequenceFlow_6</bpmn2:outgoing></bpmn2:callActivity>
<bpmn2:endEvent id="EndEvent_2" name="End">${properties({ componentVersion: "1.1", cmdVariantUri: variant("MessageEndEvent", "1.1.0") })}<bpmn2:incoming>SequenceFlow_6</bpmn2:incoming><bpmn2:messageEventDefinition/></bpmn2:endEvent>
<bpmn2:sequenceFlow id="SequenceFlow_5" sourceRef="StartEvent_2" targetRef="CallActivity_4"/><bpmn2:sequenceFlow id="SequenceFlow_6" sourceRef="CallActivity_4" targetRef="EndEvent_2"/></bpmn2:process>
<bpmndi:BPMNDiagram id="Diagram_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collaboration_1">
<bpmndi:BPMNShape id="Pool" bpmnElement="Participant_Process_1"><dc:Bounds x="100" y="60" width="600" height="200"/></bpmndi:BPMNShape>
<bpmndi:BPMNShape id="Start" bpmnElement="StartEvent_2"><dc:Bounds x="150" y="140" width="32" height="32"/></bpmndi:BPMNShape>
<bpmndi:BPMNShape id="Script" bpmnElement="CallActivity_4"><dc:Bounds x="300" y="125" width="100" height="60"/></bpmndi:BPMNShape>
<bpmndi:BPMNShape id="End" bpmnElement="EndEvent_2"><dc:Bounds x="550" y="140" width="32" height="32"/></bpmndi:BPMNShape>
<bpmndi:BPMNEdge id="In" bpmnElement="SequenceFlow_5"><di:waypoint x="182" y="156"/><di:waypoint x="300" y="156"/></bpmndi:BPMNEdge>
<bpmndi:BPMNEdge id="Out" bpmnElement="SequenceFlow_6"><di:waypoint x="400" y="156"/><di:waypoint x="550" y="156"/></bpmndi:BPMNEdge>
</bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn2:definitions>`);
    zip.file("src/main/resources/script/credential.groovy", `import com.sap.gateway.ip.core.customdev.util.Message
import com.sap.it.api.ITApiFactory
import com.sap.it.api.securestore.SecureStoreService
import groovy.json.JsonSlurper
import groovy.json.JsonOutput

def Message processData(Message message) {
    def input = new JsonSlurper().parse(message.getBody(java.io.Reader))
    def store = ITApiFactory.getService(SecureStoreService.class, null)
    def result = [:]
    try {
        def credential = store.getUserCredential(input.alias as String)
        credential.getCredentialProperties().each { key, value -> result[key] = value }
        result.user = credential.getUsername()
        def password = credential.getPassword()
        if (password != null) result.password = new String(password)
    } catch (Exception credentialError) {
        result.clear()
        try {
            def oauth = store.getAccesTokenForOauth2AuthorizationCodeCredential(input.alias as String)
            result.token = oauth.getAccessToken()
            result.user = oauth.getUser()
        } catch (Exception tokenError) {
            // Backend exception messages can contain credential data; return a safe explanation.
            result.error = "SAP could not read this security material. Check that it is deployed, that OAuth authorization is complete if required, and that the runtime supports this credential type."
        }
    }
    result.credentialName = input.alias
    message.setBody(JsonOutput.toJson(result))
    return message
}
`);
    zip.file("META-INF/MANIFEST.MF", `Manifest-Version: 1.0\r\nBundle-ManifestVersion: 2\r\nBundle-SymbolicName: ${flowName}; singleton:=true\r\nBundle-Name: ${flowName}\r\nBundle-Version: 1.0.0\r\nSAP-BundleType: IntegrationFlow\r\nSAP-RuntimeProfile: iflmap\r\nSAP-NodeType: IFLMAP\r\n\r\n`);
    zip.file(".project", `<?xml version="1.0" encoding="UTF-8"?><projectDescription><name>${flowName}</name><comment/><projects/><buildSpec/><natures><nature>com.sap.ifl.ide.nature</nature></natures></projectDescription>`);
    zip.file("src/main/resources/parameters.prop", "");
    zip.file("src/main/resources/parameters.propdef", '<?xml version="1.0" encoding="UTF-8"?><parameters/>');
    zip.file("metainfo.prop", "description=Temporary credential viewer simulation\n");
    return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  }

  async function retrieve(alias, progress = () => {}) {
    const base = "/" + cpiData.urlExtension;
    const name = "CPIHelperCredentialViewer" + crypto.randomUUID().replaceAll("-", "");
    const flow = name + "Flow";
    let created = false;
    let token;
    let result;
    let failure;
    try {
      progress("Preparing temporary simulation…");
      const csrf = await fetch(base + "api/1.0/user", { credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "X-CSRF-Token": "Fetch" }, signal: AbortSignal.timeout(30000) });
      token = csrf.headers.get("x-csrf-token");
      if (!csrf.ok || !token) throw new Error("Cannot obtain SAP CSRF token. Refresh your session and retry.");
      const blob = await archive(flow);
      created = true; // Also clean up if the create response is lost or malformed.
      const pkg = await request(base, "odata/1.0/workspace.svc/ContentEntities.ContentPackages", "POST", {
        Category: "Integration", SupportedPlatforms: "SAP HANA Cloud Integration", TechnicalName: name, DisplayName: name, ShortText: "Temporary CPI Helper credential simulation",
      }, token);
      if (!pkg?.d?.reg_id) throw new Error("SAP did not return the temporary package ID.");
      const form = new FormData();
      form.append("__xmlview4--iflowBrowse", blob, flow + ".zip");
      form.append("_charset_", "UTF-8");
      form.append("__xmlview4--iflowBrowse-data", JSON.stringify({ name: flow, id: flow, description: "Temporary credential simulation", type: "IFlow", additionalAttrs: { source: [], target: [], productProfile: ["iflmap"], nodeType: ["IFLMAP"] }, packageId: name, fileName: flow + ".zip" }));
      const uploaded = await request(base, `api/1.0/workspace/${encodeURIComponent(pkg.d.reg_id)}/iflows`, "POST", form, token);
      if (!uploaded?.id) throw new Error("SAP did not return the uploaded iFlow ID.");
      const path = `api/1.0/workspace/${encodeURIComponent(pkg.d.reg_id)}/artifacts/${encodeURIComponent(uploaded.id)}/entities/${encodeURIComponent(uploaded.id)}/iflows/${flow}`;
      const model = await request(base, path);
      progress("Reading credential in simulation…");
      const stamp = Date.now();
      const task = await request(base, path + `/simulations?id=${stamp}&isReadMode=true&webdav=SIMULATE`, "PUT", {
        startSeqID: "SequenceFlow_5", endSeqID: "SequenceFlow_6", process: "Process_1",
        inputPayload: { body: Array.from(new TextEncoder().encode(JSON.stringify({ alias }))) }, mockPayloads: {}, traceCache: {}, iflowModelTO: model,
      }, token);
      if (!task?.stepTestTaskId) throw new Error("SAP did not start the simulation.");
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        const state = await request(base, path + `/simulations/${encodeURIComponent(task.stepTestTaskId)}?id=${stamp}`);
        if (state.statusCode === "TEST_EXECUTION_FAILED") throw new Error("Credential simulation failed. Check that the security material is deployed and your user has simulation permissions.");
        if (Number(state.percentageComplete) === 100) {
          const bytes = state.traceData?.SequenceFlow_6?.tracePages?.[1]?.body;
          if (!Array.isArray(bytes)) throw new Error("SAP returned no credential result in the simulation trace.");
          result = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes)));
          if (!result || typeof result !== "object" || Array.isArray(result) || !["password", "token", "error"].some(key => typeof result[key] === "string")) throw new Error("SAP returned an unexpected credential result.");
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 750));
      }
      if (!result) throw new Error("Credential simulation timed out.");
    } catch (error) {
      // Do not expose raw backend exceptions: they can contain payloads.
      failure = error instanceof SyntaxError ? new Error("SAP returned an unreadable simulation result.") : error;
    } finally {
      if (created) {
        progress("Removing temporary package…");
        try {
          await request(base, `odata/1.0/workspace.svc/ContentEntities.ContentPackages('${name}')`, "DELETE", undefined, token);
        } catch (_) {
          // Never hide cleanup failures, including failures after a successful read.
          failure = new Error(`Temporary package cleanup failed. Delete ${name} from Design → Integrations and APIs. ${failure ? failure.message : ""}`);
        }
      }
    }
    if (failure) throw failure;
    return result;
  }

  function close() {
    if (!dialog) return;
    dialog.replaceChildren();
    dialog.close();
    dialog.remove();
    dialog = null;
  }

  function ensureStyles() {
    if (document.getElementById("cpiHelper_securityMaterialViewer_styles")) return;
    const style = document.createElement("style");
    style.id = "cpiHelper_securityMaterialViewer_styles";
    style.textContent = `
      .cpiHelper_securityMaterialViewer_dialog {
        box-sizing: border-box; width: 500px; max-width: calc(100vw - 32px);
        max-height: calc(100dvh - 32px); margin: auto; padding: 0; border: 0;
        border-radius: var(--sapElement_BorderCornerRadius, 12px);
        background: var(--sapGroup_ContentBackground, #fff); color: var(--sapTextColor, #131e29);
        box-shadow: 0 0 0 1px rgba(34,53,72,.48), 0 20px 80px rgba(34,53,72,.25);
        font: 14px var(--sapFontFamily, Arial, sans-serif); overflow: hidden;
      }
      .cpiHelper_securityMaterialViewer_dialog[open] { display: flex; flex-direction: column; }
      .cpiHelper_securityMaterialViewer_dialog::backdrop { background: rgba(0,0,0,.2); }
      .cpiHelper_securityMaterialViewer_dialog h2 {
        box-sizing: border-box; flex: none; min-height: 40px; margin: 0; padding: 9px 16px;
        font: 16px/20px var(--sapFontBoldFamily, var(--sapFontFamily, Arial, sans-serif));
        font-weight: 400; color: var(--sapGroup_TitleTextColor, #131e29);
        border-bottom: 1px solid var(--sapGroup_TitleBorderColor, #d9d9d9);
        overflow-wrap: anywhere;
      }
      .cpiHelper_securityMaterialViewer_content { padding: 16px; overflow: auto; min-height: 0; }
      .cpiHelper_securityMaterialViewer_content > p { margin: 0 0 16px; line-height: 1.4; }
      .cpiHelper_securityMaterialViewer_table { width: 100%; border-collapse: collapse; table-layout: fixed; font: inherit; }
      .cpiHelper_securityMaterialViewer_table th, .cpiHelper_securityMaterialViewer_table td {
        box-sizing: border-box; width: 50%; height: 32px; padding: 6px 8px; text-align: left;
        vertical-align: middle; line-height: 18px; overflow-wrap: anywhere;
        border-bottom: 1px solid var(--sapList_BorderColor, #e5e5e5);
      }
      .cpiHelper_securityMaterialViewer_table th { font-weight: 700; padding-top: 7px; padding-bottom: 7px; }
      .cpiHelper_securityMaterialViewer_table th:first-child, .cpiHelper_securityMaterialViewer_table td:first-child { padding-left: 16px; }
      .cpiHelper_securityMaterialViewer_table tbody tr:last-child td {
        border-bottom-color: var(--sapList_TableFooterBorder, #a8b3bd);
      }
      .cpiHelper_securityMaterialViewer_table tbody tr:focus {
        outline: 2px solid var(--sapContent_FocusColor, #005fcc); outline-offset: -3px;
      }
      .cpiHelper_securityMaterialViewer_footer {
        display: flex; justify-content: flex-end; align-items: center; flex: none;
        box-sizing: border-box; height: 40px; padding: 4px 16px;
        border-top: 1px solid var(--sapGroup_TitleBorderColor, #d9d9d9);
      }
      .cpiHelper_securityMaterialViewer_actionSlot { display: inline-block; vertical-align: top; }
    `;
    document.head.append(style);
  }

  // Reuse the tenant's SAP button and icon styles so these follow its theme and density.
  function sapButton(text, onClick, icon = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sapMBtnBase sapMBtn";
    button.setAttribute("aria-label", text);
    button.title = text;
    const inner = document.createElement("span");
    inner.className = "sapMBtnInner sapMBtnHoverable sapMFocusable sapMBtnTransparent " + (icon ? "sapMBtnIconFirst" : "sapMBtnText");
    const content = document.createElement("span");
    if (icon) {
      content.className = "sapUiIcon sapUiIconMirrorInRTL sapMBtnCustomIcon sapMBtnIcon sapMBtnIconLeft";
      content.style.fontFamily = "SAP-icons";
      content.dataset.sapUiIconContent = "\ue1d8";
      content.setAttribute("aria-hidden", "true");
    } else {
      content.className = "sapMBtnContent";
      content.textContent = text;
    }
    inner.append(content);
    button.append(inner);
    button.onclick = onClick;
    return button;
  }

  function openDialog(alias) {
    close();
    ensureStyles();
    dialog = document.createElement("dialog");
    dialog.className = "cpiHelper_securityMaterialViewer_dialog";
    dialog.setAttribute("aria-labelledby", "cpiHelper_securityMaterialViewer_title");
    const title = document.createElement("h2");
    title.id = "cpiHelper_securityMaterialViewer_title";
    title.textContent = alias ? "Credential details - " + alias : "Credential details";
    const content = document.createElement("div");
    content.className = "cpiHelper_securityMaterialViewer_content";
    const footer = document.createElement("footer");
    footer.className = "cpiHelper_securityMaterialViewer_footer";
    footer.append(sapButton("Close", close));
    dialog.append(title, content, footer);
    dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
    body().append(dialog);
    dialog.showModal();
    return content;
  }

  async function show(alias) {
    if (busy || !isPage() || !(await active()) || busy) return;
    busy = true;
    const content = openDialog(alias);
    const status = text => { content.textContent = text; };
    try {
      const details = await retrieve(alias, status);
      if (!content.isConnected || !isPage() || !(await active())) return;
      content.replaceChildren();
      const table = document.createElement("table");
      table.className = "cpiHelper_securityMaterialViewer_table";
      table.setAttribute("aria-label", "Credential properties");
      const header = table.createTHead().insertRow();
      for (const label of ["Property", "Value"]) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = label;
        header.append(th);
      }
      const tbody = table.createTBody();
      // Show the actual secret (or a retrieval error) first; token results have no password.
      const primary = ["password", "token", "error"].filter(key => Object.hasOwn(details, key));
      const properties = [...primary, ...Object.keys(details).filter(key => !primary.includes(key))];
      for (const key of properties) {
        const value = details[key];
        const row = tbody.insertRow();
        row.tabIndex = 0;
        row.insertCell().textContent = key;
        row.insertCell().textContent = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
      }
      content.append(table);
      tbody.rows[0]?.focus();

    } catch (error) {
      if (content.isConnected) status(error.message);
      else if (error.message.startsWith("Temporary package cleanup failed")) showToast(error.message, "Security Material Viewer", "error");
    } finally {
      busy = false;
    }
  }

  function decorate() {
    if (!isPage()) { cleanup(); return; }
    ensureStyles();
    for (const row of document.querySelectorAll("tr.sapMListTblRow")) {
      const cells = row.querySelectorAll("td.sapMListTblCell");
      if (cells.length < 3 || /^SSH[ _]+KNOWN[ _]+HOSTS$/i.test(cells[1].textContent.trim())) continue;
      if (row.querySelector("." + buttonClass)) continue;
      const button = sapButton("View credential", event => {
        event.stopPropagation();
        show(cells[0].textContent.trim());
      }, true);
      button.classList.add(buttonClass);
      const actions = cells[cells.length - 1].querySelector(".sapUiHLayout");
      if (actions) {
        const slot = document.createElement("div");
        slot.className = buttonClass + " cpiHelper_securityMaterialViewer_actionSlot sapUiHLayoutChildWrapper";
        slot.append(button);
        actions.prepend(slot);
      } else {
        cells[cells.length - 1].prepend(button);
      }
    }
  }

  function cleanup() {
    document.querySelectorAll("." + buttonClass).forEach(button => button.remove());
    close();
    document.getElementById("cpiHelper_securityMaterialViewer_styles")?.remove();
  }
  window.addEventListener("popstate", cleanup);
  window.addEventListener("hashchange", cleanup);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && Object.hasOwn(changes, id + "---isActive") && changes[id + "---isActive"].newValue !== true) cleanup();
  });
  return { retrieve, archive, show, decorate };
})();

pluginList.push({
  metadataVersion: "1.0.0", id: "securityMaterialViewer", name: "Security Material Viewer", version: "1.0.0",
  author: "CPI Helper", website: "", email: "",
  description: "View credential details, secure parameters, and OAuth authorization-code tokens on Manage Security Material. Uses a temporary iFlow simulation, then deletes its package. Requires design and simulation permissions. Credentials are displayed only on request and are not saved by CPI Helper.",
  settings: {},
  heartbeat: () => securityMaterialViewer.decorate(),
});