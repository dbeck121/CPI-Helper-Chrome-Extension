// Transport of the open artifact from its editor. The toolbar button opens a dialog like the Transport dialog of the
// package view and sends the same requests as the web ui of SAP (recorded on a tenant with Transport Management Service
// and with MTAR Download). For CTS+, and every answer the dialog does not expect before sending, it offers the fallback
// "Use package view as fallback": the package opens in a new tab, the artifact gets selected and Actions > Transport is
// pressed there. The request for that tab travels in its name, so other tabs and a later reload of the package ignore it.
//
// Long description:
// Transport the artifact you are working on without going back to its package. Adds a Transport button to the CPI Helper
// toolbar of supported integration artifacts (the editors of integration flows, REST, SOAP and OData APIs and MCP
// servers, where the toolbar has its plugin section). It opens a Transport dialog in the editor (comment, transport owner,
// artifact and version) and sends the same request as Actions > Transport in the package view. After a successful
// transport the dialog closes by itself after 30 seconds.
// Transport modes (set by a tenant administrator in Settings > Integrations > Transport):
// - Transport Management Service: high confidence, tested with real transports. The dialog shows the TR ID.
// - MTAR Download: high confidence, tested. Downloads the .mtar file, which you upload to the target system yourself.
// - CTS+ Direct: medium confidence. Not sent by this dialog (no CTS+ system to test with). The dialog points to the
//   fallback, which runs the original transport of SAP: the package opens in a new tab, the artifact gets selected and
//   the Transport dialog of SAP opens for it. The fallback itself is tested, only not on a CTS+ tenant.
// - None: expected on QA and production tenants, the dialog says that transports are switched off there.
// Uses internal APIs of the SAP web UI that SAP may change without notice. If the dialog reports a problem after sending,
// check in your transport system before trying again.
(() => {
  const WINDOW_NAME_PREFIX = "cpiHelperArtifactTransport:";
  // loading the package view in the new tab takes a while, after this the request is dropped
  const REQUEST_MAX_AGE = 90000;

  // the modes the dialog sends itself, both were checked against a tenant. CTS+ uses the dialog of SAP
  const TMS_MODE = "SLS_D2CTS_CLOUD";
  const MTAR_MODE = "SLS";
  const CTS_MODE = "SLS_D2CTS";
  const MODE_NAMES = { SLS_D2CTS_CLOUD: "Transport Management Service", SLS_D2CTS: "CTS+ Direct", SLS: "MTAR Download", NONE: "None" };
  // artifact type of the workspace api -> type text in the transport request, the same as the dialog of SAP sends
  const DISPLAY_TYPES = {
    IFlow: "Integration Flow",
    FSNMapping: "FSN Mapping",
    ValueMapping: "Value Mapping",
    "OData Service": "OData API",
    RESTAPIProvider: "REST API",
    SOAPAPIProvider: "SOAP API",
    IntegrationAdapter: "Integration Adapter",
    MessageMapping: "Message Mapping",
    ScriptCollection: "Script Collection",
    DataType: "Data Type",
    MessageType: "Message Type",
    API: "API",
    FaultMessageType: "Fault Message Type",
    ServiceInterface: "Service Interface",
    Connector: "Connector",
    ConnectorInstance: "Connector Instance",
    MCPSERVER: "MCP Server",
  };
  // SAP needed 24 seconds to create the request and asks for the status every 3 seconds afterwards
  const SEND_TIMEOUT = 300000;
  const STATUS_INTERVAL = 3000;
  const STATUS_MAX_CHECKS = 40;
  const AUTO_CLOSE_SECONDS = 30;

  // tooltip of the question mark next to the fallback link
  const FALLBACK_HELP = "Runs the original transport of SAP, for CTS+ or when this dialog reports a problem: the package opens in a new tab, this artifact gets selected there and the Transport dialog of SAP opens for it.";

  // styles of the dialog live here, so the plugin changes no shared stylesheet of CPI Helper
  const DIALOG_STYLE = `
    .cpiHelper_artifactTransport .ui.form input:disabled {
      color: var(--cpih-text-muted);
      background: var(--cpih-bg-subtle);
      border-color: var(--cpih-border);
      cursor: not-allowed;
    }
    .cpiHelper_artifactTransport_loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 1.5rem 0;
      color: var(--cpih-text-muted);
    }
    .cpiHelper_artifactTransport_spinner {
      width: 2rem;
      height: 2rem;
      border: 0.2rem solid var(--cpih-border);
      border-top-color: var(--cpih-brand);
      border-radius: 50%;
      animation: cpih-icon-spin 0.7s linear infinite;
    }
    /* the fallback to the dialog of SAP is a plain link with a help mark on the left, Cancel and Transport stay right */
    .cpiHelper_artifactTransport.ui.modal > .actions > .cpiHelper_artifactTransport_fallback {
      display: inline-flex;
      /* baseline: the question mark sits on the line of the link text, centering the boxes left it 2px too low */
      align-items: baseline;
      gap: 0.25rem;
      margin-right: auto;
    }
    .cpiHelper_artifactTransport.ui.modal > .actions > .cpiHelper_artifactTransport_fallback[hidden] {
      display: none;
    }
    .cpiHelper_artifactTransport .cpiHelper_artifactTransport_packageLink.ui.tertiary.button {
      padding-left: 0;
      padding-right: 0;
      font-weight: normal;
      text-decoration: none;
    }
    .cpiHelper_artifactTransport .cpiHelper_artifactTransport_packageLink.ui.tertiary.button:hover {
      background: transparent;
      text-decoration: underline;
    }
    .cpiHelper_artifactTransport .cpiHelper_artifactTransport_help {
      color: var(--cpih-text-muted);
      cursor: help;
    }`;

  // request of this tab for the dialog of SAP, taken from the tab name on the first heartbeat
  let pendingRequest = null;
  // artifacts with a transport on its way, so a second click does not send it twice
  const runningTransports = new Set();

  // ----------------------
  // own dialog
  // ----------------------

  function apiUrl(path) {
    return "/" + cpiData.urlExtension + "api/1.0/" + path;
  }

  async function getJson(path) {
    const response = await makeCallPromiseV2("GET", apiUrl(path), false, "application/json", null, null, null, false);
    if (!response.successful) throw new Error(`reading ${path.split("?")[0]} failed (HTTP ${response.status || "no answer"})`);
    return JSON.parse(response.responseText);
  }

  // mode of the tenant, the logged in user and package and artifact as the workspace api knows them (ids, names, version)
  async function loadTransportContext(pluginHelper) {
    const [settings, users, workspaces] = await Promise.all([getJson("transportsettings/TransportSettings"), getJson("user").catch(() => null), getJson("workspace/")]);
    const context = { mode: settings?.transportMode, userId: users?.[0]?.Name || null };
    context.workspace = workspaces.find((entry) => entry.technicalName === pluginHelper.currentPackageId) || null;
    if (context.workspace) {
      const artifacts = await getJson(`workspace/${context.workspace.id}/artifacts/`);
      context.artifact = artifacts.find((entry) => entry.tooltip === pluginHelper.currentArtifactId) || null;
    }
    return context;
  }

  // own request instead of makeCallPromise: its timeout of 60 seconds is too short for a transport, and a failing token
  // fetch inside it never settles. answers { status, text }, status 0 when nothing came back
  async function postJson(path, payload, timeout = 60000) {
    const token = await getCsrfToken();
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", absolutePath(apiUrl(path)));
      xhr.withCredentials = true;
      xhr.timeout = timeout;
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("X-CSRF-Token", token);
      xhr.setRequestHeader("X-CPI-Helper-Client", "extension");
      xhr.setRequestHeader("X-CPI-Helper-Version", chrome.runtime.getManifest().version);
      xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
      xhr.onerror = () => resolve({ status: 0, text: "" });
      xhr.ontimeout = () => resolve({ status: 0, text: "" });
      xhr.send(JSON.stringify(payload));
    });
  }

  async function transportAllowed(artifactRegId) {
    const answer = await postJson("workspace/artifacts/accesspolicy", { artifactType: "Agnostic", regIds: [artifactRegId], uniqueIds: [] });
    if (answer.status < 200 || answer.status >= 300) throw new Error(`the permission check failed (HTTP ${answer.status || "no answer"})`);
    const access = JSON.parse(answer.text);
    return access.status === "ALLOWED" && !(access.deniedArtifacts || []).length;
  }

  // the transport is prepared in the background: ask for the status until it is done
  async function waitForTransport(created) {
    const query = new URLSearchParams({ fetchStatus: "true", rootURL: created.rootURL, mode: created.mode });
    for (let check = 0; check < STATUS_MAX_CHECKS; check++) {
      const { status } = await getJson(`transportcontents/${encodeURIComponent(created.processId)}?${query}`);
      if (status === "Success") return;
      if (/fail|error/i.test(status || "")) throw new Error(`the transport ended with the status ${status}`);
      await new Promise((resolve) => setTimeout(resolve, STATUS_INTERVAL));
    }
    throw new Error("the transport was not finished after two minutes");
  }

  // Transport Management Service: the text SAP shows for the request, e.g. "TestHabil - my comment, TR ID: 91032"
  async function fetchTransportRequest(created) {
    const query = new URLSearchParams({ fetchResult: "true", rootURL: created.rootURL, mode: created.mode });
    return (await getJson(`transportcontents/${encodeURIComponent(created.processId)}?${query}`)).transportRequestId;
  }

  // MTAR Download: the server answers with the file as attachment ("<package>_<timestamp>.mtar"). SAP opens it in a new
  // tab, which the browser may block after the wait, a link in this tab downloads it without leaving the page
  function mtarUrl(created, packageName) {
    const now = new Date();
    const timestamp = [now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()].map((part) => String(part).padStart(2, "0")).join("");
    const query = new URLSearchParams({ fetchResult: "true", rootURL: created.rootURL, timestamp, packageName, version: "", mode: created.mode });
    return absolutePath(apiUrl(`transportcontents/${encodeURIComponent(created.processId)}?${query}`));
  }

  function downloadFromUrl(url) {
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    body().appendChild(link);
    link.click();
    link.remove();
  }

  function addDialogStyle() {
    if (document.getElementById("cpiHelper_artifactTransport_style")) return;
    const style = document.createElement("style");
    style.id = "cpiHelper_artifactTransport_style";
    style.textContent = DIALOG_STYLE;
    document.head.appendChild(style);
  }

  function createDialog() {
    addDialogStyle();
    const modal = document.createElement("div");
    modal.className = "cpiHelper ui small modal cpiHelper_artifactTransport";
    modal.innerHTML = `
      <i class="close icon"></i>
      <div class="header">Transport</div>
      <div class="content">
        <div class="cpiHelper_artifactTransport_loading" data-part="loading">
          <span class="cpiHelper_artifactTransport_spinner"></span>
          <span>Reading the transport settings...</span>
        </div>
        <div data-part="form" hidden>
          <div class="ui form">
            <div class="field">
              <label for="cpiHelper_artifactTransport_mode">Mode</label>
              <input id="cpiHelper_artifactTransport_mode" type="text" disabled>
            </div>
            <div class="field">
              <label for="cpiHelper_artifactTransport_comment">Comment *</label>
              <textarea id="cpiHelper_artifactTransport_comment" rows="4" maxlength="255"></textarea>
            </div>
            <div class="field" data-part="owner">
              <div class="ui checkbox">
                <input id="cpiHelper_artifactTransport_owner" type="checkbox">
                <label for="cpiHelper_artifactTransport_owner">Propagate logged-in user as transport owner</label>
              </div>
            </div>
            <div class="field" data-part="ownerId" hidden>
              <label for="cpiHelper_artifactTransport_ownerId">Logged-in User ID</label>
              <input id="cpiHelper_artifactTransport_ownerId" type="text" disabled>
            </div>
          </div>
          <p data-part="packageInfo"></p>
          <table class="ui very compact table">
            <thead><tr><th>Name</th><th>Type</th><th>Version</th></tr></thead>
            <tbody><tr><td data-part="name"></td><td data-part="type"></td><td data-part="version"></td></tr></tbody>
          </table>
        </div>
        <div class="ui info message" data-part="status" hidden></div>
      </div>
      <div class="actions">
        <span class="cpiHelper_artifactTransport_fallback" data-part="fallback">
          <button type="button" class="ui tertiary button cpiHelper_artifactTransport_packageLink" data-action="package">Use package view as fallback</button>
          <i class="question circle icon cpiHelper_artifactTransport_help" tabindex="0" role="img" aria-label="${FALLBACK_HELP}" title="${FALLBACK_HELP}"></i>
        </span>
        <button type="button" class="ui deny button" data-action="cancel">Cancel</button>
        <button type="button" class="ui primary button" data-action="transport" disabled>Transport</button>
      </div>`;

    const part = (name) => modal.querySelector(`[data-part="${name}"]`);
    const dialog = {
      modal,
      form: part("form"),
      mode: modal.querySelector("#cpiHelper_artifactTransport_mode"),
      comment: modal.querySelector("#cpiHelper_artifactTransport_comment"),
      owner: modal.querySelector("#cpiHelper_artifactTransport_owner"),
      ownerField: part("owner"),
      ownerIdField: part("ownerId"),
      ownerId: modal.querySelector("#cpiHelper_artifactTransport_ownerId"),
      packageInfo: part("packageInfo"),
      name: part("name"),
      type: part("type"),
      version: part("version"),
      status: part("status"),
      loading: part("loading"),
      fallback: part("fallback"),
      packageButton: modal.querySelector('[data-action="package"]'),
      cancelButton: modal.querySelector('[data-action="cancel"]'),
      transportButton: modal.querySelector('[data-action="transport"]'),
      isOpen: () => cpihModal.isShown(modal),
      // every status ends the loading state of the opening dialog
      setStatus(type, text) {
        this.loading.hidden = true;
        this.status.className = `ui ${type} message`;
        this.status.textContent = text;
        this.status.hidden = !text;
      },
    };

    dialog.comment.addEventListener("input", () => {
      dialog.transportButton.disabled = !dialog.comment.value.trim();
    });
    dialog.owner.addEventListener("change", () => {
      dialog.ownerIdField.hidden = !dialog.owner.checked;
    });

    cpihRoot().appendChild(modal);
    cpihModal.show(modal, { onHidden: () => modal.remove() });
    return dialog;
  }

  function fillDialog(dialog, context) {
    const { workspace, artifact } = context;
    dialog.mode.value = MODE_NAMES[context.mode];
    dialog.ownerId.value = context.userId || "";
    // like in the dialog of SAP, only Transport Management Service knows a transport owner
    dialog.ownerField.hidden = !context.userId || context.mode !== TMS_MODE;
    dialog.packageInfo.textContent = `A package named "${workspace.title}" gets created with this artifact in the target tenant. If the package exists there, it gets updated with this artifact.`;
    dialog.name.textContent = artifact.name;
    dialog.type.textContent = DISPLAY_TYPES[artifact.type];
    dialog.version.textContent = artifact.semanticVersion;
    dialog.form.hidden = false;
    dialog.setStatus("info", "");
    dialog.comment.focus();
  }

  // downloadUrl: a link to get the MTAR file again, in case the browser did not save it
  function finishDialog(dialog, type, message, downloadUrl = null) {
    const link = downloadUrl ? document.createElement("a") : null;
    if (link) {
      link.href = downloadUrl;
      link.download = "";
      link.textContent = "Download again";
    }
    if (!dialog.isOpen()) {
      const toast = document.createElement("div");
      toast.append(message, ...(link ? [" ", link] : []));
      cpihToast({ message: toast, title: "Transport", type: type === "positive" ? "success" : "error", displayTime: 0, closeIcon: true });
      return;
    }
    dialog.setStatus(type, message);
    if (link) dialog.status.append(" ", link);
    dialog.transportButton.classList.remove("loading");
    dialog.transportButton.hidden = true;
    dialog.packageButton.disabled = false;
    dialog.cancelButton.textContent = "Close";
    if (type === "positive") closeAfterSuccess(dialog);
  }

  // after a successful transport the own dialog closes by itself, the dialog of SAP is never touched
  function closeAfterSuccess(dialog) {
    const countdown = document.createElement("div");
    dialog.status.append(countdown);
    let seconds = AUTO_CLOSE_SECONDS;
    const tick = () => {
      if (!dialog.isOpen()) {
        clearInterval(timer);
      } else if (seconds <= 0) {
        clearInterval(timer);
        cpihModal.hide(dialog.modal);
      } else {
        countdown.textContent = `This dialog closes in ${seconds} seconds.`;
        seconds--;
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
  }

  async function transport(dialog, context) {
    const comment = dialog.comment.value.trim();
    const key = `${cpiData.tenant}/${context.artifact.id}`;
    if (!comment) return;
    if (runningTransports.has(key)) {
      dialog.setStatus("warning", "A transport of this artifact is still being created, wait for its result.");
      return;
    }
    runningTransports.add(key);

    dialog.transportButton.disabled = true;
    dialog.transportButton.classList.add("loading");
    dialog.packageButton.disabled = true;
    dialog.comment.readOnly = true;
    dialog.owner.disabled = true;
    const mtar = context.mode === MTAR_MODE;
    dialog.setStatus("info", `SAP creates the ${mtar ? "MTAR file" : "transport request"}, this takes about half a minute. Closing this dialog does not stop it.`);

    // the same request the dialog of SAP sends for selected artifacts of a package
    const payload = {
      id: context.workspace.id,
      displayName: context.workspace.title,
      technicalName: context.workspace.technicalName,
      version: "",
      type: "ContentPackage",
      comments: comment,
      artifacts: [{ artifactId: context.artifact.id, artifactName: context.artifact.name, artifactType: DISPLAY_TYPES[context.artifact.type], artifactVersion: context.artifact.semanticVersion }],
    };
    if (!mtar && dialog.owner.checked && context.userId) payload.transportOwnerId = context.userId;

    try {
      const answer = await postJson("transportartifacts", payload, SEND_TIMEOUT);
      if (answer.status < 200 || answer.status >= 300) throw new Error(answer.status ? `SAP answered with HTTP ${answer.status}` : "SAP did not answer");
      let created = null;
      try {
        created = JSON.parse(answer.text);
      } catch (error) {
        // handled below
      }
      created = created?.processId ? created : created?.data;
      if (!created?.processId) throw new Error("SAP answered without the id of the transport process");
      await waitForTransport(created);
      if (mtar) {
        const url = mtarUrl(created, context.workspace.title);
        downloadFromUrl(url);
        finishDialog(dialog, "positive", "The MTAR file was created and downloaded. Import it in the target tenant or in your transport system.", url);
      } else {
        const requestId = await fetchTransportRequest(created);
        finishDialog(dialog, "positive", requestId ? `Transport request ${requestId} was created in Transport Management Service.` : "The transport request was created in Transport Management Service.");
      }
    } catch (error) {
      log.error("artifactTransport: transport failed", error);
      const check = mtar ? "Try again or use the package view as fallback." : "Check in Transport Management Service whether a transport request was created before you try again.";
      finishDialog(dialog, "negative", `The transport could not be confirmed: ${error.message}. ${check}`);
    } finally {
      runningTransports.delete(key);
    }
  }

  async function openTransportDialog(pluginHelper) {
    if (!pluginHelper.currentArtifactId || !packageArtifactsUrl()) {
      showToast("Open the artifact from its package to transport it from here.", "Transport", "warning");
      return;
    }
    const dialog = createDialog();
    dialog.packageButton.addEventListener("click", () => {
      cpihModal.hide(dialog.modal);
      openInPackageView(pluginHelper);
    });

    let context;
    try {
      context = await loadTransportContext(pluginHelper);
    } catch (error) {
      log.warn("artifactTransport: transport settings not readable, using the dialog of SAP", error);
    }

    // everything this dialog does not know goes to the dialog of SAP in the package. the new tab opens on a click of
    // the user, a tab opened after these calls could be blocked by the browser
    if (context && (!context.mode || context.mode === "NONE")) {
      dialog.transportButton.hidden = true;
      dialog.fallback.hidden = true;
      // QA and production tenants usually only receive transports, so this is a note and not a warning
      dialog.setStatus(
        "info",
        "Transports are switched off for this tenant. That is expected on QA and production tenants, which receive transports but do not send them. On a development tenant, a tenant administrator switches them on in Settings > Integrations > Transport."
      );
      return;
    }
    // CTS+ is planned to go through the fallback (not testable without a CTS+ system), so it is a note. a mode SAP adds
    // later, unreadable settings or an artifact the workspace api does not list are unexpected and warn
    const fallbackHint = "Use the package view as fallback to transport it with the original dialog of SAP.";
    let note = null;
    let problem = null;
    if (!context) problem = "The transport settings could not be read.";
    else if (context.mode === CTS_MODE) note = "This tenant transports with CTS+ Direct, which this dialog does not send itself because it could not be tested yet.";
    else if (context.mode !== TMS_MODE && context.mode !== MTAR_MODE) problem = `This tenant transports with ${MODE_NAMES[context.mode] || context.mode}, which this dialog does not know.`;
    else if (!context.artifact || !DISPLAY_TYPES[context.artifact.type]) problem = "The artifact was not found in its package.";
    if (note || problem) {
      dialog.transportButton.hidden = true;
      dialog.setStatus(note ? "info" : "warning", `${note || problem} ${fallbackHint}`);
      return;
    }

    try {
      if (!(await transportAllowed(context.artifact.id))) {
        dialog.transportButton.hidden = true;
        dialog.setStatus("negative", "You are not allowed to transport this artifact.");
        return;
      }
    } catch (error) {
      log.warn("artifactTransport: permission check failed", error);
      dialog.transportButton.hidden = true;
      dialog.setStatus("negative", `The permission to transport could not be checked: ${error.message}.`);
      return;
    }

    fillDialog(dialog, context);
    dialog.transportButton.addEventListener("click", () => transport(dialog, context));
  }

  // ----------------------
  // dialog of SAP in the package view (new tab)
  // ----------------------

  function packageArtifactsUrl() {
    const match = window.location.href.match(/^(.*\/contentpackage\/[^/?#]+)/);
    return match ? match[1] + "?section=ARTIFACTS" : null;
  }

  function openInPackageView(pluginHelper) {
    const url = packageArtifactsUrl();
    if (!pluginHelper.currentArtifactId || !url) {
      showToast("Open the artifact from its package to transport it from here.", "Transport", "warning");
      return;
    }
    const request = { artifactId: pluginHelper.currentArtifactId, packageId: pluginHelper.currentPackageId, requestedAt: Date.now() };
    if (!window.open(url, WINDOW_NAME_PREFIX + JSON.stringify(request))) {
      showToast("The browser blocked the new tab. Allow pop-ups for this page and try again.", "Transport", "warning");
    }
  }

  // read once and cleared right away, so a reload of the tab does not open the dialog again
  function takeRequest() {
    if (!window.name.startsWith(WINDOW_NAME_PREFIX)) return null;
    const value = window.name.slice(WINDOW_NAME_PREFIX.length);
    window.name = "";
    try {
      const request = JSON.parse(value);
      return request?.artifactId ? request : null;
    } catch (error) {
      log.warn("artifactTransport: request in the tab name not readable", error);
      return null;
    }
  }

  function finishRequest(message, type) {
    pendingRequest = null;
    if (message) showToast(message, "Transport", type);
  }

  function bridgeReady() {
    if (document.documentElement.getAttribute("data-cpih-artifact-transport") === "ready") return true;
    if (!document.getElementById("cpiHelper_artifactTransport_bridge")) {
      const script = document.createElement("script");
      script.id = "cpiHelper_artifactTransport_bridge";
      script.src = chrome.runtime.getURL("plugins/artifactTransport-inject.js");
      document.head.appendChild(script);
    }
    return false;
  }

  // the page world answers synchronously while the open event is dispatched. loading and more: try again on the next heartbeat
  document.addEventListener("cpiHelper_artifactTransport_result", (event) => {
    if (!pendingRequest) return;
    switch (event.detail) {
      case "opened":
        finishRequest();
        break;
      case "not-found":
        finishRequest(`${pendingRequest.artifactId} is not in the artifact list of this package.`, "warning");
        break;
      case "no-transport":
        finishRequest("The Actions menu of this package has no Transport entry. Transports are switched on in the settings of Cloud Integration.", "warning");
        break;
      case "error":
        finishRequest("The Transport dialog could not be opened, see the browser console for details.", "error");
        break;
    }
  });

  const plugin = {
    metadataVersion: "1.0.0",
    id: "artifactTransport",
    name: "Transport Artifact",
    version: "1.2.0",
    author: "Habil Altin",
    email: "habil.altin@fressnapf.com",
    website: "https://www.linkedin.com/in/habilaltin/",
    description: `Transport the open artifact <b>without going back to its package</b>: a <b>Transport</b> button in the toolbar of supported integration artifacts opens the Transport dialog in the editor. It closes by itself after a successful transport.<br><br>
      <b>Transport Management Service</b> and <b>MTAR Download</b>: tested. <b>CTS+</b>: uses the package view as fallback. Uses internal SAP APIs.`,
    settings: {},
    toolbarButton: {
      title: "Transport",
      icon: { text: "xe197", type: "icon" },
      onClick: (pluginHelper) => openTransportDialog(pluginHelper),
    },
    heartbeat: async (pluginHelper) => {
      if (!pendingRequest) {
        pendingRequest = takeRequest();
        if (!pendingRequest) return;
      }
      if (Date.now() - pendingRequest.requestedAt > REQUEST_MAX_AGE) {
        finishRequest("The package took too long to load. Select the artifact there and choose Actions > Transport.", "warning");
        return;
      }
      // wait until the package view of the requested package is shown
      if (pluginHelper.currentArtifactType !== "Package" || (pendingRequest.packageId && pluginHelper.currentPackageId !== pendingRequest.packageId)) return;
      if (!bridgeReady()) return;
      document.dispatchEvent(new CustomEvent("cpiHelper_artifactTransport_open", { detail: pendingRequest.artifactId }));
    },
  };

  pluginList.push(plugin);
})();
