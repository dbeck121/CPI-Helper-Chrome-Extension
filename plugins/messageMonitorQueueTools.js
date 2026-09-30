/**
 * SAP CPI Helper Plugin - Message Monitor & Queue Tools
 * Message monitor (/shell/monitoring/Messages/...), in the message detail:
 * - header icons: open the iFlow in the started artifacts monitor, start its trace
 *   (without an open message detail a small floating bar is shown instead)
 * - for messages in a JMS queue a line with the queue (opens Manage Message Queues with queue and message selected),
 *   restart (retry), move to another queue and delete
 * Manage Message Queues (/shell/monitoring/MessageQueues/...):
 * - queues sorted by entries descending, all columns of the message list shown
 * - queue and message selected and Move / Delete started when requested from the message monitor
 * UI5 controls are only reachable from the page context, that part is messageMonitorQueueTools-inject.js.
 */
// Wrapped in an IIFE: content scripts share one global scope, so helper names must not leak.
(() => {
  const HEADER_ICONS_ID = "cpiHelper_mmt_headerIcons";
  const PLUGIN_ID = "messageMonitorQueueTools";
  const INJECT_SCRIPT_ID = "cpiHelper_messageMonitorQueueToolsScript";
  const QUEUE_LINE_ID = "cpiHelper_mmt_queueLine";
  const MESSAGE_QUEUES_PATH = "/shell/monitoring/MessageQueues";
  // read by messageMonitorQueueTools-inject.js, which selects the queue on Manage Message Queues
  const QUEUE_SELECT_KEY = "cpihMessageQueueSelect";
  const QUEUE_REQUEST_TOKEN_KEY = "cpihMessageQueueRequestToken";
  const BAR_ID = "cpiHelper_messageMonitorQueueToolsBar";
  const MESSAGES_PATH = "/shell/monitoring/Messages/";
  // UI5 re-renders the detail header when another message is selected, the 3 second heartbeat
  // alone would leave the icons missing for too long, so a short local loop keeps them in place
  const PLACE_INTERVAL_MS = 500;
  const HEARTBEAT_TIMEOUT_MS = 10000;

  // tooltips/icon names of the detail header buttons, several languages because UI5 translates them
  // only a fallback: messageMonitorQueueTools-inject.js marks the buttons by their UI5 icon
  const FULLSCREEN_LABEL = /full.?screen|vollbild|plein [ée]cran|pantalla completa|schermo intero/i;
  const CLOSE_LABEL = /^(close|decline|schlie(ss|ß)en|fermer|cerrar|chiudi)$/i;

  let pluginHelperRef = null;
  let settingsRef = {};
  let lastHeartbeat = 0;
  let placeInterval = null;
  let componentsCache = null;

  // the features can be switched off one by one; unset checkboxes mean "on", so the defaults need no storage
  function featureOff(key) {
    return settingsRef[PLUGIN_ID + "---" + key] === true;
  }

  var plugin = {
    metadataVersion: "1.0.0",
    id: PLUGIN_ID,
    name: "Message Monitor & Queue Tools",
    version: "2.1.0",
    author: "David Sternberger",
    website: "https://github.com/dbeck121/CPI-Helper-Chrome-Extension",
    email: "office@sternberger.at",
    description:
      "Message monitor: open the iFlow of a message in the started artifacts, start its trace, and for messages in a JMS queue show the queue with restart, move and delete. Manage Message Queues: queues sorted by entries, all columns of the message list shown.",
    settings: {
      text1: { text: "All features are on, tick a box to switch one off.", type: "label" },
      hideHeaderIcons: { text: "Message monitor: no Started Artifacts / Trace icons", type: "checkbox", scope: "browser" },
      hideQueueLine: { text: "Message monitor: no JMS queue line (restart, move, delete)", type: "checkbox", scope: "browser" },
      noQueueSort: { text: "Manage Message Queues: do not sort by entries", type: "checkbox", scope: "browser" },
      noAllColumns: { text: "Manage Message Queues: do not show all columns of the message list", type: "checkbox", scope: "browser" },
    },
    heartbeat: async (pluginHelper, settings) => {
      pluginHelperRef = pluginHelper;
      settingsRef = settings || {};
      lastHeartbeat = Date.now();

      const onMessageQueues = document.location.pathname.includes(MESSAGE_QUEUES_PATH);
      const onMonitor = !!readMonitorFilter();
      if (!onMonitor) stopPlacing();
      if (!onMonitor && !onMessageQueues) return;

      // the page script only works while this is fresh, deactivating the plugin stops it within seconds;
      // the settings for the queue page travel the same way
      const root = document.documentElement.dataset;
      root.cpihMonitorQueueTools = String(Date.now());
      root.cpihMmqtSort = featureOff("noQueueSort") ? "0" : "1";
      root.cpihMmqtColumns = featureOff("noAllColumns") ? "0" : "1";
      injectPageScript();

      if (onMonitor) {
        placeIcons();
        if (!placeInterval) placeInterval = setInterval(placeLoop, PLACE_INTERVAL_MS);
      }
    },
  };

  pluginList.push(plugin);

  // stops by itself when the heartbeat does not come anymore, e.g. the plugin was deactivated
  function placeLoop() {
    if (Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT_MS || !readMonitorFilter()) {
      stopPlacing();
      return;
    }
    placeIcons();
  }

  // UI5 controls are only reachable from the page context
  function injectPageScript() {
    if (document.getElementById(INJECT_SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = INJECT_SCRIPT_ID;
    script.src = chrome.runtime.getURL("plugins/messageMonitorQueueTools-inject.js");
    document.head.appendChild(script);
  }

  function stopPlacing() {
    clearInterval(placeInterval);
    placeInterval = null;
    document.getElementById(HEADER_ICONS_ID)?.remove();
    document.getElementById(QUEUE_LINE_ID)?.remove();
    document.getElementById(BAR_ID)?.remove();
  }

  // ---------------------------------------------------------------------------
  // monitor filter and artifact id
  // ---------------------------------------------------------------------------

  // the monitor filter is a url encoded json object in the path segment after /Messages/
  function readMonitorFilter() {
    const idx = location.pathname.indexOf(MESSAGES_PATH);
    if (idx === -1) return null;
    const segment = location.pathname.substring(idx + MESSAGES_PATH.length).split("/")[0];
    try {
      return JSON.parse(decodeURIComponent(segment)) || {};
    } catch (e) {
      return {};
    }
  }

  function filteredArtifactIds() {
    const filter = readMonitorFilter() || {};
    if (!Array.isArray(filter.artifactIds)) return [];
    return filter.artifactIds.filter((id) => id && id !== "ALL");
  }

  // started artifacts monitor; "artifact" selects the iFlow, like the "Deployment status" jump target
  function artifactsMonitorUrl(iflowId) {
    const filter = { type: "ALL", status: "STARTED" };
    if (iflowId) filter.artifact = iflowId;
    return location.origin + "/shell/monitoring/Artifacts/" + cpihMonitorFilter(pluginHelperRef?.runtimeLocationId, filter);
  }

  // cpiData.urlExtension is only set when an iFlow is opened, so derive it from the host here
  function urlExtension() {
    return document.location.host.match(cpiTypeRegexp) ? "" : "itspaces/";
  }

  // deployed artifacts of the runtime, to map the display name in the header to the symbolic name
  async function deployedComponents() {
    const locationId = pluginHelperRef?.runtimeLocationId || "cloudintegration";
    if (componentsCache?.locationId === locationId) return componentsCache.list;
    const resp = await makeCallPromiseV2(
      "GET",
      "/" + urlExtension() + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListCommand?runtimeLocationId=" + encodeURIComponent(locationId),
      60000,
      null,
      null,
      null,
      null,
      false
    );
    if (!resp.successful) return [];
    const json = new XmlToJson().parse(resp.responseText)["com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListResponse"];
    const list = json?.artifactInformations;
    const components = Array.isArray(list) ? list : list ? [list] : [];
    componentsCache = { locationId, list: components };
    return components;
  }

  function tenantApiBase() {
    return "/" + urlExtension() + (pluginHelperRef?.runtimePathExtension || "") + "odata/api/v1/";
  }

  // the message processing log of a message; short cache, its status changes
  async function messageLog(guid) {
    const resp = await makeCallPromiseV2("GET", tenantApiBase() + "MessageProcessingLogs('" + encodeURIComponent(guid) + "')?$format=json", 10000, "application/json", null, null, null, false);
    if (!resp.successful) return null;
    try {
      return JSON.parse(resp.responseText).d || null;
    } catch (e) {
      return null;
    }
  }

  // the message processing log knows the symbolic name of its iFlow, that is the most reliable source
  async function iflowIdOfMessage(guid) {
    return (await messageLog(guid))?.IntegrationFlowName || null;
  }

  // the header shows the artifact name, which is not always the symbolic name the monitor and trace need
  async function resolveIflowId(headerTitle) {
    const filterIds = filteredArtifactIds();
    if (headerTitle && filterIds.includes(headerTitle)) return headerTitle;

    if (headerTitle) {
      try {
        const components = await deployedComponents();
        const match = components.find((c) => c.symbolicName === headerTitle) || components.find((c) => c.name === headerTitle);
        if (match) return match.symbolicName;
      } catch (e) {
        log.log("messageMonitorQueueTools: could not load deployed artifacts", e);
      }
    }

    if (filterIds.length === 1) return filterIds[0];
    return headerTitle || null;
  }

  // same call as setLogLevel() in contentScript.js, but awaitable so the button can show the result
  async function startTrace(iflowId) {
    const payload = { artifactSymbolicName: iflowId, mplLogLevel: "TRACE", nodeType: "IFLMAP" };
    if (pluginHelperRef?.runtimeLocationId) payload.runtimeLocationId = pluginHelperRef.runtimeLocationId;

    await makeCallPromise(
      "POST",
      "/" + urlExtension() + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentSetMplLogLevelCommand",
      false,
      null,
      JSON.stringify(payload),
      true,
      "application/json;charset=UTF-8"
    );
  }

  // ---------------------------------------------------------------------------
  // restart of messages in a JMS queue, via the tenant OData api the web UI uses (odata/api/v1). The queue entry is
  // found in Queues('<queue>')/Messages and retried with a MERGE of JmsMessages, like Manage Message Queues does.
  // $metadata also lists MessagingQueues / RetryMessagingMessages and a JmsMessages $filter, but tenants may not
  // serve them (404 / 501), so they are only tried first and skipped once they failed.
  // Needs the role templates DataStoresAndQueuesRead and QueuesRetry (NEO: ESBDataStore.read / ESBDataStore.retry).
  // ---------------------------------------------------------------------------

  function odataKey(value) {
    return "'" + encodeURIComponent(String(value).replace(/'/g, "''")) + "'";
  }

  function odataString(value) {
    return encodeURIComponent("'" + String(value).replace(/'/g, "''") + "'");
  }

  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  // GET on the tenant api, returns d.results or null; failures are logged with status and response for diagnosis
  async function odataResults(path, cache = false) {
    const resp = await makeCallPromiseV2("GET", tenantApiBase() + path, cache, "application/json", null, null, null, false);
    const results = resp.successful ? parseJson(resp.responseText)?.d?.results : null;
    if (!Array.isArray(results)) {
      log.warn("messageMonitorQueueTools: GET", path, "failed:", resp.status, (resp.responseText || "").substring(0, 300));
      return null;
    }
    return results;
  }

  // each strategy returns the entry, null when the message is in no queue, or undefined when its api is not usable

  // 1. one call over all queues
  async function findViaJmsMessages(guid) {
    const results = await odataResults("JmsMessages?$filter=Mplid%20eq%20" + odataString(guid) + "&$format=json");
    if (!results) return undefined;
    // exact comparison, a server that ignores $filter would otherwise hand back any message
    const entry = results.find((message) => message.Mplid === guid);
    return entry?.Msgid && entry?.Name ? { queueName: entry.Name, jmsMessageId: entry.Msgid, failed: entry.Failed, raw: entry } : null;
  }

  // 2. newer api: every queue with entries is asked for the message
  async function findViaMessagingQueues(guid) {
    const queues = await odataResults("MessagingQueues?$format=json", 30000);
    if (!queues) return undefined;
    const hits = await Promise.all(
      queues
        .filter((queue) => Number(queue.numberOfMessages) > 0)
        .map(async (queue) => {
          const results = await odataResults("MessagingQueues(" + odataKey(queue.queueName) + ")/MessagingMessages?mplId=" + encodeURIComponent(guid) + "&$format=json");
          const entry = (results || []).find((message) => message.mplId === guid);
          return entry?.jmsMessageId ? { queueName: entry.queueName || queue.queueName, jmsMessageId: entry.jmsMessageId } : null;
        })
    );
    return hits.find(Boolean) || null;
  }

  // 3. older api of Manage Message Queues. It IGNORES $filter (a filter on a non-existent Mplid returns all
  // messages of the queue), so the messages are loaded and compared exactly here - never take results[0] blindly.
  async function findViaQueues(guid) {
    const queues = await odataResults("Queues?$format=json", 15000);
    if (!queues) return undefined;
    const hits = await Promise.all(
      queues
        .filter((queue) => Number(queue.NumbOfMsgs) > 0)
        .map(async (queue) => {
          const results = await odataResults("Queues(" + odataKey(queue.Name) + ")/Messages?$format=json", 15000);
          const entry = (results || []).find((message) => message.Mplid === guid);
          return entry?.Msgid ? { queueName: entry.Name || queue.Name, jmsMessageId: entry.Msgid, failed: entry.Failed, raw: entry } : null;
        })
    );
    return hits.find(Boolean) || null;
  }

  // strategies whose api failed are skipped until the page is reloaded
  const unusableStrategies = new Set();

  // the queue entry of a message, found by its message processing log id
  async function findQueuedMessage(guid) {
    for (const strategy of [findViaJmsMessages, findViaMessagingQueues, findViaQueues]) {
      if (unusableStrategies.has(strategy)) continue;
      const entry = await strategy(guid);
      if (entry === undefined) {
        // e.g. JmsMessages $filter is not implemented and MessagingQueues is not served on every tenant
        unusableStrategies.add(strategy);
        continue;
      }
      log.info("messageMonitorQueueTools:", strategy.name, "->", entry ? "queue " + entry.queueName : "in no queue", guid);
      return entry;
    }
    log.warn("messageMonitorQueueTools: no JMS api usable, see the warnings above");
    return null;
  }

  // the Retry of Manage Message Queues is a MERGE of the queue entry with its own data (recorded from the UI,
  // it sends it in a $batch); the entry comes from Queues('<queue>')/Messages, the lookup that works on every tenant
  async function retryQueuedMessage(entry) {
    if (!entry.raw) throw new Error("the queue entry of the message is not known");
    const key =
      "JmsMessages(Msgid=" + odataKey(entry.jmsMessageId) + ",Name=" + odataKey(entry.queueName) + ",Failed=" + (entry.failed === true || entry.failed === "true") + ")";
    const token = await getCsrfToken();
    // a MERGE as http method is answered with 400 by the gateway (the UI sends it inside a $batch);
    // POST with the standard OData override header is accepted (204) - tested on a Cloud Foundry tenant
    const resp = await fetch(tenantApiBase() + key, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": token, "X-HTTP-Method": "MERGE" },
      body: JSON.stringify(entry.raw),
    });
    if (!resp.ok) {
      const text = await resp.text();
      log.warn("messageMonitorQueueTools: retry (MERGE", key + ") failed:", resp.status, text.substring(0, 300));
      throw new Error(parseJson(text)?.error?.message?.value || "HTTP " + resp.status);
    }
  }

  // restart state of the message shown in the detail, looked up once per message:
  // hidden | queued (entry known, can be retried) | notQueued (status Retry, but in no queue) | retried
  let restart = { guid: null, state: "hidden" };
  let lastGuidScan = 0;
  let scannedGuid = null;

  // the page script puts the guid on the close button; otherwise the detail is searched, at most every 2 seconds
  function currentMessageGuid(closeBtn) {
    if (closeBtn.dataset.cpihMmtGuid) return closeBtn.dataset.cpihMmtGuid;
    if (Date.now() - lastGuidScan > 2000) {
      lastGuidScan = Date.now();
      scannedGuid = findMessageGuidInDetail(closeBtn);
    }
    return scannedGuid;
  }

  function updateRestartState(guid) {
    if (restart.guid === guid) return;
    const current = { guid, state: "hidden" };
    restart = current;
    applyRestartState();
    if (!guid) return;
    lookupRestart(guid).then((result) => {
      if (restart !== current) return;
      Object.assign(current, result);
      applyRestartState();
    });
  }

  async function lookupRestart(guid) {
    try {
      const [mpl, entry] = await Promise.all([messageLog(guid), findQueuedMessage(guid)]);
      if (entry) return { state: "queued", entry, status: mpl?.Status };
      if (mpl?.Status === "RETRY") return { state: "notQueued", status: mpl.Status };
    } catch (e) {
      log.warn("messageMonitorQueueTools: restart lookup failed", e);
    }
    return { state: "hidden" };
  }

  function applyRestartState() {
    const queueLine = document.getElementById(QUEUE_LINE_ID);
    if (queueLine) {
      const queueName = restart.entry?.queueName;
      const queueLink = queueLine.querySelector(".cpiHelper_mmt_queue");
      queueLine.classList.toggle("cpiHelper_mmt_hidden", !queueName);
      queueLink.textContent = queueName || "";
      queueLink.title = queueName ? "Open Manage Message Queues with queue " + queueName + " selected" : "";
    }

    // move and delete need the queue entry, like the restart
    document.querySelectorAll("#" + QUEUE_LINE_ID + " .cpiHelper_mmt_queueAction").forEach((action) => {
      action.disabled = !restart.entry;
    });

    const button = document.querySelector("#" + QUEUE_LINE_ID + " .cpiHelper_mmt_restart");
    if (!button) return;
    button.classList.toggle("cpiHelper_mmt_hidden", restart.state === "hidden");
    button.classList.toggle("cpiHelper_mmt_active", restart.state === "retried");
    button.disabled = restart.state !== "queued";
    button.innerHTML = floatingToolbarIcon(restart.state === "retried" ? "check" : "refresh");
    const titles = {
      queued: "Restart: retry the message in queue " + restart.entry?.queueName,
      notQueued: "Status Retry, but the message is in no JMS queue, it cannot be restarted from here",
      retried: "Retry triggered in queue " + restart.entry?.queueName,
    };
    button.title = titles[restart.state] || "";
    button.setAttribute("aria-label", button.title);
  }

  // own line under the header with the queue the message waits in. The link opens Manage Message Queues; the queue
  // is selected there by messageMonitorQueueTools-inject.js, which picks the request up from localStorage (also in a new tab)
  function createQueueLine() {
    const line = document.createElement("div");
    line.id = QUEUE_LINE_ID;
    line.className = "cpiHelper_mmt_hidden";

    const label = document.createElement("span");
    label.className = "cpiHelper_mmt_queueLabel";
    label.textContent = "JMS Queue:";

    const link = document.createElement("a");
    link.className = "cpiHelper_mmt_queue";
    link.href = messageQueuesUrl();
    link.addEventListener("click", (event) => {
      // ctrl / cmd / shift click opens a new tab or window, which does not have this tab's token
      storeQueueRequest(undefined, !(event.ctrlKey || event.metaKey || event.shiftKey));
      try {
        statistic("messageMonitorQueueTools_queue");
      } catch (e) {}
    });
    // middle click opens a new tab without a click event
    link.addEventListener("auxclick", () => storeQueueRequest(undefined, false));

    line.append(
      label,
      link,
      createRestartButton(),
      createQueueActionButton("move", "Move to another queue: opens Manage Message Queues with this message selected and starts Move there"),
      createQueueActionButton("delete", "Delete from the queue (stops the retries): opens Manage Message Queues with this message selected and starts Delete there")
    );
    return shieldFromUi5(line);
  }

  // UI5 handles the events of the detail header itself (e.g. it re-renders the header on a press), which can replace
  // our buttons between mousedown and mouseup, so the click never happens. Events inside our elements stay with us.
  function shieldFromUi5(element) {
    ["mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend", "click", "keydown", "keyup"].forEach((type) =>
      element.addEventListener(type, (event) => event.stopPropagation())
    );
    return element;
  }

  function messageQueuesUrl() {
    return location.origin + "/shell/monitoring/MessageQueues/" + encodeURIComponent(JSON.stringify({ type: "ALL" }));
  }

  // picked up by messageMonitorQueueTools-inject.js on Manage Message Queues: it selects the queue and this message and,
  // for move / delete, presses that button of the message list, so SAP's own dialogs take over from there.
  // sameTab ties the request to this tab (token in sessionStorage), so another open Manage Message Queues tab does
  // not take it; only a plain selection opened in a new tab (middle click) is left open to any tab.
  function storeQueueRequest(action, sameTab = true) {
    const queueName = restart.entry?.queueName;
    if (!queueName) return false;
    try {
      let token = null;
      if (sameTab) {
        token = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem(QUEUE_REQUEST_TOKEN_KEY, token);
      }
      const request = { queueName, mplId: restart.guid, action, token, at: Date.now() };
      localStorage.setItem(QUEUE_SELECT_KEY, JSON.stringify(request));
      log.log("messageMonitorQueueTools: request for Manage Message Queues stored:", JSON.stringify(request));
      return true;
    } catch (e) {
      log.warn("messageMonitorQueueTools: could not store the queue request", e);
      return false;
    }
  }

  const QUEUE_ACTION_ICONS = {
    move: '<path d="M3 12h11"/><path d="M10 8l4 4-4 4"/><rect x="16" y="4" width="5" height="16" rx="1"/>',
    delete: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  };

  function createQueueActionButton(action, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cpiHelper_mmt_icon cpiHelper_mmt_queueAction";
    button.title = title;
    button.setAttribute("aria-label", title);
    button.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${QUEUE_ACTION_ICONS[action]}</svg>`;
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = restart;
      log.log("messageMonitorQueueTools:", action, "clicked, queue entry:", current.entry ? current.entry.queueName : "none");
      if (!current.entry) return;
      if (action === "delete") {
        const approved = await cpihConfirm({
          title: "Delete message from queue?",
          content:
            "Manage Message Queues opens with message " + current.guid + " in queue " + current.entry.queueName + " selected and its Delete is started. The message is removed from the queue and not retried anymore.",
          approveText: "Continue",
          denyText: "Cancel",
        });
        if (!approved || restart !== current) return;
      }
      if (storeQueueRequest(action)) {
        // statistic needs the extension context, which is gone in tabs opened before a reload of the extension
        try {
          statistic("messageMonitorQueueTools_" + action);
        } catch (e) {}
        location.href = messageQueuesUrl();
      }
    });
    return button;
  }

  // the line goes right above the tab bar of the detail (Status, Error Details, ...)
  function findDetailTabBar(closeBtn) {
    const closeRect = closeBtn.getBoundingClientRect();
    let container = closeBtn.parentElement;
    for (let depth = 0; container && depth < 15; depth++, container = container.parentElement) {
      for (const tablist of container.querySelectorAll('[role="tablist"]')) {
        const rect = tablist.getBoundingClientRect();
        if (rect.width > 0 && rect.top > closeRect.top && rect.right > closeRect.left - 400) {
          return tablist.closest(".sapMITH, .sapUxAPAnchorBar") || tablist;
        }
      }
    }
    return null;
  }

  function placeQueueLine(closeBtn) {
    const anchor = closeBtn ? findDetailTabBar(closeBtn) : null;
    const existing = document.getElementById(QUEUE_LINE_ID);
    if (!anchor) {
      existing?.remove();
      return;
    }
    if (existing && existing.nextElementSibling === anchor) return;
    existing?.remove();
    anchor.insertAdjacentElement("beforebegin", createQueueLine());
    applyRestartState();
  }

  function createRestartButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cpiHelper_mmt_icon cpiHelper_mmt_restart cpiHelper_mmt_hidden";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = restart;
      if (current.state !== "queued") return;
      const approved = await cpihConfirm({
        title: "Restart message?",
        content: "Retry message " + current.guid + " in queue " + current.entry.queueName + " now?",
        approveText: "Retry",
        denyText: "Cancel",
      });
      if (!approved || restart !== current) return;
      button.disabled = true;
      try {
        await retryQueuedMessage(current.entry);
        current.state = "retried";
        showToast("Retry triggered in queue " + current.entry.queueName);
        statistic("messageMonitorQueueTools_restart");
      } catch (e) {
        showToast("Error restarting the message", e.message, "error");
        log.warn("messageMonitorQueueTools: error restarting message", e);
      } finally {
        if (restart === current) applyRestartState();
      }
    });
    return button;
  }

  // ---------------------------------------------------------------------------
  // finding the message detail header
  // ---------------------------------------------------------------------------

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // tooltip, aria label or the (translated) name of the icon inside the button
  function buttonLabels(btn) {
    const parts = [btn.getAttribute("title"), btn.getAttribute("aria-label")];
    const icon = btn.querySelector(".sapUiIcon");
    if (icon) parts.push(icon.getAttribute("title"), icon.getAttribute("aria-label"));
    (btn.getAttribute("aria-labelledby") || "").split(/\s+/).forEach((id) => {
      if (id) parts.push(document.getElementById(id)?.textContent);
    });
    return parts.filter(Boolean).map((p) => p.trim());
  }

  // the detail is the right column, dialogs and the left column are ignored
  function isDetailButton(btn) {
    return !btn.closest("#" + HEADER_ICONS_ID) && isVisible(btn) && btn.getBoundingClientRect().left >= window.innerWidth * 0.4 && !btn.closest(".sapMDialog, .sapMPopover");
  }

  function findHeaderButtons() {
    // marked by messageMonitorQueueTools-inject.js
    let fullscreen = [...document.querySelectorAll('[data-cpih-mmt-button="fullscreen"]')].find(isDetailButton) || null;
    let close = [...document.querySelectorAll('[data-cpih-mmt-button="close"]')].find(isDetailButton) || null;

    if (!close) {
      for (const btn of document.querySelectorAll("button")) {
        if (!isDetailButton(btn)) continue;
        const labels = buttonLabels(btn);
        if (!fullscreen && labels.some((l) => FULLSCREEN_LABEL.test(l))) fullscreen = btn;
        if (!close && labels.some((l) => CLOSE_LABEL.test(l))) close = btn;
      }
    }
    if (!close) return null;
    // both buttons of the header sit on one line
    if (fullscreen && Math.abs(fullscreen.getBoundingClientRect().top - close.getBoundingClientRect().top) > 20) fullscreen = null;
    return { fullscreen, close };
  }

  // "Message ID" is the first message guid in the detail column. The smallest ancestor of the close button that
  // contains a guid is that column; the message list next to it is only reached further up.
  function findMessageGuidInDetail(closeBtn) {
    const guidPattern = /^[A-Za-z0-9_-]{28}$/;
    let container = closeBtn.parentElement;
    for (let depth = 0; container && depth < 25; depth++, container = container.parentElement) {
      for (const el of container.querySelectorAll("span, div, a, bdi")) {
        if (el.children.length) continue;
        const text = (el.textContent || "").trim();
        if (guidPattern.test(text)) return text;
      }
    }
    return null;
  }

  // the artifact name is the biggest text left of the close button on the same line
  function findHeaderTitle(closeBtn) {
    const closeRect = closeBtn.getBoundingClientRect();
    const onHeaderLine = (el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.right <= closeRect.left && Math.abs(rect.top + rect.height / 2 - (closeRect.top + closeRect.height / 2)) < 30;
    };

    let container = closeBtn.parentElement;
    for (let depth = 0; container && depth < 12; depth++, container = container.parentElement) {
      for (const heading of container.querySelectorAll('[role="heading"], h1, h2, h3, h4, .sapMTitle')) {
        const text = (heading.textContent || "").trim();
        if (text && onHeaderLine(heading)) return text;
      }

      let best = null;
      let bestSize = 0;
      for (const el of container.querySelectorAll("span, div, a, bdi")) {
        if (el.children.length || el.closest("#" + HEADER_ICONS_ID)) continue;
        const text = (el.textContent || "").trim();
        if (!text || !onHeaderLine(el)) continue;
        const size = parseFloat(getComputedStyle(el).fontSize) || 0;
        if (size > bestSize) {
          best = text;
          bestSize = size;
        }
      }
      if (best) return best;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // ui
  // ---------------------------------------------------------------------------

  function placeIcons() {
    injectStyles();
    const buttons = findHeaderButtons();
    const showIcons = !featureOff("hideHeaderIcons");
    const showQueueLine = !featureOff("hideQueueLine");

    if (!buttons) {
      document.getElementById(HEADER_ICONS_ID)?.remove();
      placeQueueLine(null);
      updateRestartState(null);
      if (!showIcons) document.getElementById(BAR_ID)?.remove();
      else if (!document.getElementById(BAR_ID)) body().appendChild(createFallbackBar());
      return;
    }

    document.getElementById(BAR_ID)?.remove();
    // the queue lookup only runs with the queue line, it loads the queues of the tenant
    updateRestartState(showQueueLine ? currentMessageGuid(buttons.close) : null);
    placeQueueLine(showQueueLine ? buttons.close : null);
    if (!showIcons) {
      document.getElementById(HEADER_ICONS_ID)?.remove();
      return;
    }
    const anchor = buttons.fullscreen || buttons.close;
    const existing = document.getElementById(HEADER_ICONS_ID);
    if (existing && existing.nextElementSibling === anchor) return;
    existing?.remove();

    // resolved on click, the header may show another message by then
    const currentIflowId = async () => {
      const current = findHeaderButtons();
      if (!current) return resolveIflowId(null);
      const guid = current.close.dataset.cpihMmtGuid || findMessageGuidInDetail(current.close);
      if (guid) {
        const iflowId = await iflowIdOfMessage(guid);
        log.log("messageMonitorQueueTools: message", guid, "belongs to", iflowId);
        if (iflowId) return iflowId;
      }
      return resolveIflowId(findHeaderTitle(current.close));
    };

    const icons = shieldFromUi5(document.createElement("span"));
    icons.id = HEADER_ICONS_ID;
    icons.append(createArtifactsLink(currentIflowId), createTraceButton(currentIflowId));
    anchor.insertAdjacentElement("beforebegin", icons);
    applyRestartState();
  }

  // a real link, so ctrl/middle click opens a new tab; the href gets the resolved iFlow before the click is handled
  function createArtifactsLink(getIflowId) {
    const link = document.createElement("a");
    link.className = "cpiHelper_mmt_icon";
    link.href = artifactsMonitorUrl(null);
    link.title = "Show in Started Artifacts";
    link.setAttribute("aria-label", "Show in Started Artifacts");
    link.innerHTML = floatingToolbarIcon("runtime");

    const updateHref = async () => {
      link.href = artifactsMonitorUrl(await getIflowId());
    };
    // hover/focus resolve it early so a middle click already has the right href
    link.addEventListener("mouseenter", updateHref);
    link.addEventListener("focus", updateHref);
    link.addEventListener("click", async (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      statistic("messageMonitorQueueTools_artifacts");
      await updateHref();
      location.href = link.href;
    });
    return link;
  }

  function createTraceButton(getIflowId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cpiHelper_mmt_icon";
    button.title = "Start Trace";
    button.setAttribute("aria-label", "Start Trace");
    button.innerHTML = floatingToolbarIcon("trace");
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      let iflowId = null;
      try {
        iflowId = await getIflowId();
        if (!iflowId) throw new Error("no iFlow found");
        await startTrace(iflowId);
        button.classList.add("cpiHelper_mmt_active");
        button.innerHTML = floatingToolbarIcon("check");
        button.title = "Trace active: " + iflowId;
        showToast("Trace is activated for " + iflowId);
        statistic("messageMonitorQueueTools_start");
      } catch (e) {
        showToast("Error activating trace" + (iflowId ? " for " + iflowId : ""), "", "error");
        log.log("messageMonitorQueueTools: error activating trace", e);
      } finally {
        button.disabled = false;
      }
    });
    return button;
  }

  // shown when no message detail is open; uses the iFlow of the monitor filter if there is exactly one
  function createFallbackBar() {
    const bar = document.createElement("div");
    bar.id = BAR_ID;
    const ids = filteredArtifactIds();
    const filterIflowId = async () => (ids.length === 1 ? ids[0] : null);
    bar.appendChild(createArtifactsLink(filterIflowId));
    if (ids.length === 1) {
      const button = createTraceButton(filterIflowId);
      button.title = "Start Trace: " + ids[0];
      bar.appendChild(button);
    }
    return bar;
  }

  function injectStyles() {
    if (document.getElementById("cpiHelper_mmt_styles")) return;
    const style = document.createElement("style");
    style.id = "cpiHelper_mmt_styles";
    style.textContent = `
      #${HEADER_ICONS_ID} {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        margin-right: 2px;
        vertical-align: middle;
      }
      #${BAR_ID} {
        position: fixed;
        left: 16px;
        bottom: 16px;
        z-index: 10000;
        display: flex;
        gap: 2px;
        padding: 4px;
        background: #ffffff;
        border: 1px solid #d9d9d9;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
      .cpiHelper_mmt_icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        padding: 0;
        color: #0064d9;
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        text-decoration: none;
      }
      .cpiHelper_mmt_icon:hover {
        background: rgba(0, 100, 217, 0.08);
      }
      .cpiHelper_mmt_icon:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .cpiHelper_mmt_hidden {
        display: none !important;
      }
      #${QUEUE_LINE_ID} .cpiHelper_mmt_icon {
        width: 28px;
        height: 28px;
      }
      #${QUEUE_LINE_ID} .cpiHelper_mmt_restart {
        margin-left: 6px;
      }
      #${QUEUE_LINE_ID} {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 2rem 8px;
        font-family: "72", "72full", Arial, sans-serif;
        font-size: 14px;
      }
      .cpiHelper_mmt_queueLabel {
        color: #556b82;
      }
      .cpiHelper_mmt_queue {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #0064d9;
        text-decoration: none;
      }
      .cpiHelper_mmt_queue:hover {
        text-decoration: underline;
      }
      .cpiHelper_mmt_icon.cpiHelper_mmt_active {
        color: #107e3e;
      }
    `;
    document.head.appendChild(style);
  }
})();
