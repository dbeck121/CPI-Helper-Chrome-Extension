// Runs in the page context, injected by messageMonitorQueueTools.js - UI5 controls are only reachable from here.
// Message monitor (/shell/monitoring/Messages/...):
// - the full screen and close buttons of the message detail get a data attribute (found by their UI5 icon, tooltips
//   differ between UI5 versions and languages), the close button also the guid of the shown message
// Manage Message Queues (/shell/monitoring/MessageQueues/...):
// - the queue table is sorted by its "Entries" column, descending (the page sorts by Name itself); re-applied when the
//   sort is lost, a different sort chosen afterwards stays
// - every hidden column of the message list is shown, once per table: columns hidden again by the user stay hidden
// - requests of the message monitor select a queue and a message and can start Move / Delete of the message list
// The content script refreshes data-cpih-monitor-queue-tools on <html> with every heartbeat; without it nothing runs,
// so deactivating the plugin stops this script within seconds. Settings arrive the same way (data attributes).
(() => {
  const MESSAGES_PATH = "/shell/monitoring/Messages/";
  const MESSAGE_QUEUES_PATH = "/shell/monitoring/MessageQueues";
  const ACTIVE_TIMEOUT_MS = 10000;
  const LOG_PREFIX = "[CPI Helper - Message Monitor & Queue Tools]";

  function isActive() {
    const lastHeartbeat = Number(document.documentElement.dataset.cpihMonitorQueueTools || 0);
    return Date.now() - lastHeartbeat < ACTIVE_TIMEOUT_MS;
  }

  function featureOn(name) {
    return document.documentElement.dataset[name] !== "0";
  }

  function allElements() {
    const Element = window.sap?.ui?.require?.("sap/ui/core/Element") || window.sap?.ui?.core?.Element;
    if (Element?.registry?.all) return Object.values(Element.registry.all());
    // very old UI5 versions
    const core = window.sap?.ui?.getCore?.();
    return core?.mElements ? Object.values(core.mElements) : [];
  }

  // ===========================================================================
  // message monitor: header buttons of the message detail
  // ===========================================================================

  const BUTTON_ROLES = {
    "sap-icon://full-screen": "fullscreen",
    "sap-icon://exit-full-screen": "fullscreen",
    "sap-icon://decline": "close",
    "sap-icon://sys-cancel": "close",
  };
  // message processing log ids, e.g. AGq7XOGwGvGwm12g5UsYAvX9IkLH
  const GUID = /^[A-Za-z0-9_-]{28}$/;
  const GUID_KEY = /^(message_?guid|message_?id|mpl_?id|guid)$/i;

  function bindingContexts(control) {
    const contexts = [control.getBindingContext?.()];
    const named = { ...(control.oPropagatedProperties?.oBindingContexts || {}), ...(control.oBindingContexts || {}) };
    Object.keys(named).forEach((name) => contexts.push(control.getBindingContext?.(name)));
    return contexts.filter(Boolean);
  }

  // the message shown in the detail: the first binding context above the close button that carries a message guid
  function messageGuidOf(control) {
    for (let c = control, depth = 0; c && depth < 40; c = c.getParent?.(), depth++) {
      for (const context of bindingContexts(c)) {
        const object = context.getObject?.();
        if (!object || typeof object !== "object") continue;
        for (const [key, value] of Object.entries(object)) {
          if (GUID_KEY.test(key) && typeof value === "string" && GUID.test(value)) return value;
        }
      }
    }
    return null;
  }

  // in narrow windows the header toolbar moves full screen and close into its "..." menu, they are not rendered then;
  // the visible "..." button of that toolbar takes the place of the close button as anchor
  // the toolbar is either a parent of the button or, in the title of an object / dynamic page (the message detail),
  // the title's internal "_actionsToolbar"
  function overflowButtonOf(control) {
    for (let parent = control.getParent?.(), depth = 0; parent && depth < 6; parent = parent.getParent?.(), depth++) {
      const toolbar = parent.isA?.("sap.m.OverflowToolbar") ? parent : parent.getAggregation?.("_actionsToolbar");
      if (toolbar?.isA?.("sap.m.OverflowToolbar")) {
        const overflow = toolbar._getOverflowButton?.() || toolbar.getAggregation?.("_overflowButton");
        return overflow?.getDomRef?.() ? overflow : null;
      }
    }
    return null;
  }

  function mark(dom, role, guid) {
    if (dom.dataset.cpihMmtButton !== role) dom.dataset.cpihMmtButton = role;
    if (guid !== undefined && dom.dataset.cpihMmtGuid !== guid) dom.dataset.cpihMmtGuid = guid;
  }

  function markHeaderButtons() {
    for (const control of allElements()) {
      if (!control.isA?.("sap.m.Button")) continue;
      const role = BUTTON_ROLES[control.getIcon?.()];
      if (!role) continue;
      const dom = control.getDomRef?.();
      if (dom) {
        mark(dom, role, role === "close" ? messageGuidOf(control) || "" : undefined);
        continue;
      }
      // only the close button in the title of the detail page, other close buttons (popovers, message strips) stay
      if (role !== "close" || !isPageTitleAction(control)) continue;
      const overflow = overflowButtonOf(control);
      // without a guid the content script reads the message id from the detail itself
      if (overflow) mark(overflow.getDomRef(), "close", messageGuidOf(control) || "");
    }
  }

  function isPageTitleAction(control) {
    const parent = control.getParent?.();
    return !!parent?.isA?.(["sap.uxap.ObjectPageDynamicHeaderTitle", "sap.uxap.ObjectPageHeader", "sap.f.DynamicPageTitle"]);
  }

  // ===========================================================================
  // Manage Message Queues
  // ===========================================================================

  // header of the entries column, UI5 translates it
  const ENTRIES_HEADER = /^(entries|einträge|entrées|entradas|voci|voces|записи)$/i;

  const sortedBindings = new WeakSet();
  const expandedTables = new WeakSet();

  function tableKind(control) {
    if (control.isA?.("sap.ui.mdc.Table")) return "mdc";
    if (control.isA?.("sap.ui.table.Table")) return "grid";
    if (control.isA?.("sap.m.Table")) return "responsive";
    return null;
  }

  // rendered and not part of a dialog (e.g. the column settings dialog has its own table). Visibility is not required:
  // in narrow windows the flexible column layout hides the queue list while the message list is shown, and
  // background tabs report nothing as visible.
  function isRelevant(control) {
    const dom = control.getDomRef?.();
    if (!dom || !dom.isConnected) return false;
    return !dom.closest(".sapMDialog, .sapMPopover, .sapMResponsivePopover");
  }

  function headerText(kind, column) {
    try {
      if (kind === "mdc") return String(column.getHeader?.() || "").trim();
      if (kind === "grid") {
        const label = column.getLabel?.() || column.getMultiLabels?.()[0];
        return String((typeof label === "string" ? label : label?.getText?.()) || "").trim();
      }
      return String(column.getHeader?.()?.getText?.() || "").trim();
    } catch (e) {
      return "";
    }
  }

  function findEntriesColumn(kind, table) {
    const columns = table.getColumns?.() || [];
    const index = columns.findIndex((column) => ENTRIES_HEADER.test(headerText(kind, column)));
    return index === -1 ? null : { index, column: columns[index] };
  }

  // numbers may arrive as strings, compare them as numbers (only used for client side models)
  function compareNumbers(a, b) {
    const na = Number(a);
    const nb = Number(b);
    if (isNaN(na) || isNaN(nb)) return String(a).localeCompare(String(b));
    return na - nb;
  }

  // context of a rendered row. The tables of the page are bound to the named model "FromOData",
  // their rows only have a context for that name.
  function rowContext(table, item) {
    const model = table.getBindingInfo("items")?.model;
    return item.getBindingContext(model) || item.getBindingContext();
  }

  // diagnostics are logged once, the loop runs every second
  const loggedNotes = new Set();
  function logOnce(key, ...args) {
    if (loggedNotes.has(key)) return;
    loggedNotes.add(key);
    console.log(LOG_PREFIX, ...args);
  }

  // diagnosis: are the rendered rows really descending? logs the first values once if not
  function checkSortOrder(table, path) {
    const values = table
      .getItems()
      .slice(0, 8)
      .map((item) => rowContext(table, item)?.getProperty?.(path));
    const numbers = values.map(Number);
    const descending = numbers.every((n, i) => i === 0 || isNaN(n) || isNaN(numbers[i - 1]) || numbers[i - 1] >= n);
    if (!descending) logOnce("order" + values.join(), "rows are not descending although sorted, first values:", JSON.stringify(values));
  }

  // binding path of the property a cell template shows, e.g. "NumbOfMsgs"
  function templatePath(cell) {
    if (!cell) return null;
    for (const property of ["text", "number", "value", "title"]) {
      const info = cell.getBindingInfo?.(property);
      const path = info?.parts?.[0]?.path || info?.path;
      if (path) return path;
    }
    return null;
  }

  // checked on every run, the page may reload or re-sort the list: no sorter or the page's own one -> ours is applied,
  // a different sorter set after ours -> chosen elsewhere, it stays
  function sortQueues(kind, table, entries) {
    if (kind === "responsive") {
      const binding = table.getBinding("items");
      if (!binding) return;
      const template = table.getBindingInfo("items")?.template;
      const path = templatePath(template?.getCells?.()[entries.index]);
      if (!path) return logOnce("nopath", "no binding path found for the entries column", table.getId());

      const sorters = binding.aSorters || [];
      if (sorters.length === 1 && sorters[0].sPath === path && sorters[0].bDescending) {
        checkSortOrder(table, path);
        return;
      }
      const describe = sorters.map((s) => s.sPath + (s.bDescending ? " desc" : " asc")).join(", ");
      if (sorters.length && sortedBindings.has(binding)) {
        logOnce("other" + describe, "a different sort is active, it is kept:", describe);
        return;
      }
      const Sorter = sap.ui.require("sap/ui/model/Sorter");
      binding.sort(new Sorter(path, true, false, compareNumbers));
      console.log(LOG_PREFIX, sortedBindings.has(binding) ? "sort was lost, queues sorted again by" : "queues sorted by", path, "descending");
      sortedBindings.add(binding);
      return;
    }

    if (kind === "grid") {
      const binding = table.getBinding("rows");
      if (!binding || sortedBindings.has(binding)) return;
      if (!entries.column.getSortProperty?.()) {
        const path = templatePath(entries.column.getTemplate?.());
        if (!path) return logOnce("nogridpath", "no sort property for the entries column", table.getId());
        entries.column.setSortProperty(path);
      }
      table.sort(entries.column, "Descending");
      sortedBindings.add(binding);
      console.log(LOG_PREFIX, "queues sorted by", entries.column.getSortProperty(), "descending");
      return;
    }

    if (kind === "mdc") {
      if (sortedBindings.has(table)) return;
      sortedBindings.add(table);
      const name = entries.column.getPropertyKey?.() || entries.column.getDataProperty?.();
      if (!name) return logOnce("nomdcpath", "no property for the entries column", table.getId());
      sap.ui.require(["sap/ui/mdc/p13n/StateUtil"], (StateUtil) => {
        StateUtil.applyExternalState(table, { sorters: [{ name, descending: true }] })
          .then(() => console.log(LOG_PREFIX, "queues sorted by", name, "descending"))
          .catch((e) => console.warn(LOG_PREFIX, "sorting failed", e));
      });
    }
  }

  function showAllColumns(kind, table) {
    if (expandedTables.has(table)) return;
    expandedTables.add(table);

    if (kind === "mdc") {
      sap.ui.require(["sap/ui/mdc/p13n/StateUtil"], (StateUtil) => {
        table
          .initialized()
          .then(() => {
            const shown = new Set(table.getColumns().map((c) => c.getPropertyKey?.() || c.getDataProperty?.()));
            const missing = table
              .getPropertyHelper()
              .getProperties()
              .filter((p) => p.visible !== false && !shown.has(p.key || p.name))
              .map((p) => ({ name: p.key || p.name }));
            if (missing.length === 0) return;
            return StateUtil.applyExternalState(table, { items: missing }).then(() =>
              console.log(LOG_PREFIX, "columns shown:", missing.map((m) => m.name).join(", "))
            );
          })
          .catch((e) => console.warn(LOG_PREFIX, "showing columns failed", e));
      });
      return;
    }

    const shown = [];
    for (const column of table.getColumns()) {
      if (column.getVisible && !column.getVisible()) {
        column.setVisible(true);
        shown.push(headerText(kind, column) || column.getId());
      }
    }
    if (shown.length) console.log(LOG_PREFIX, "columns shown:", shown.join(", "));
  }

  // ---------------------------------------------------------------------------
  // requests of the message monitor, stored in localStorage: { queueName, mplId, action, token, at } - the queue is
  // selected, then the message with that MPL id. For action "move" / "delete" that button of the message list is
  // pressed afterwards, SAP's own dialogs (target queue, confirmation) take over from there.
  // ---------------------------------------------------------------------------

  const QUEUE_SELECT_KEY = "cpihMessageQueueSelect";
  // set by the monitor in the tab that navigates here; requests with a token belong to that tab only
  const QUEUE_REQUEST_TOKEN_KEY = "cpihMessageQueueRequestToken";
  // generous: this script is only injected by the 3 s heartbeat after the (slow) page load
  const QUEUE_SELECT_MAX_AGE_MS = 120000;
  // button texts of the message list, UI5 translates them
  const ACTION_LABELS = {
    move: /^(move|verschieben|déplacer|mover|sposta)$/i,
    delete: /^(delete|löschen|supprimer|eliminar|elimina)$/i,
  };

  let queueTableDom = null;

  function readRequest() {
    try {
      const request = JSON.parse(localStorage.getItem(QUEUE_SELECT_KEY) || "null");
      if (!request) return null;
      if (!request.queueName || Date.now() - request.at >= QUEUE_SELECT_MAX_AGE_MS) {
        localStorage.removeItem(QUEUE_SELECT_KEY);
        return null;
      }
      // move / delete must only run in the tab where they were requested, never in another open tab
      if ((request.action && !request.token) || (request.token && request.token !== sessionStorage.getItem(QUEUE_REQUEST_TOKEN_KEY))) {
        logOnce(request.at + "othertab", "a request of the message monitor belongs to another tab, it is ignored here");
        return null;
      }
      return request;
    } catch (e) {}
    return null;
  }

  function writeRequest(request) {
    try {
      localStorage.setItem(QUEUE_SELECT_KEY, JSON.stringify(request));
    } catch (e) {}
  }

  function clearRequest() {
    try {
      localStorage.removeItem(QUEUE_SELECT_KEY);
    } catch (e) {}
  }

  function queueNameOf(context) {
    const object = context?.getObject?.();
    return object?.Name ?? object?.queueName ?? object?.QueueName;
  }

  function mplIdOf(context) {
    const object = context?.getObject?.();
    return object?.Mplid ?? object?.MplId ?? object?.mplId;
  }

  // growing tables render only the first rows. If the wanted row is in the data but not rendered, the rest is
  // loaded like with the "More" button of the table, in one page. Returns false when the row is not in the data at all.
  function renderAllRowsIfNeeded(table, matches) {
    const binding = table.getBinding("items");
    if (!binding) return false;
    const model = binding.getModel?.();
    let rows;
    if (Array.isArray(binding.aKeys)) {
      // OData v2 list binding: the loaded entities are listed by their keys
      rows = binding.aKeys.map((key) => model?.getObject?.("/" + key)).filter(Boolean);
    } else {
      const data = model?.getProperty?.(binding.getPath(), binding.getContext?.());
      rows = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data) : [];
    }
    const inData = rows.some((row) => matches({ getObject: () => row }));
    if (inData && table.getGrowing?.()) {
      const length = binding.getLength?.() || rows.length;
      if (table.getGrowingThreshold() < length) table.setGrowingThreshold(length);
      // the growing delegate of sap.m.ListBase loads the next page, what the "More" button does
      if (table._oGrowingDelegate?.requestNewPage) {
        table._oGrowingDelegate.requestNewPage();
      } else {
        binding.checkUpdate?.(true);
      }
    }
    return inData;
  }

  // selects the row like a click of the user, so the page loads the messages of the queue
  function selectRequestedQueue(kind, table) {
    queueTableDom = table.getDomRef();
    const request = readRequest();
    if (!request || request.queueSelected) return;
    const queueName = request.queueName;
    logOnce(request.at + "request", "request from the message monitor:", JSON.stringify(request), "- queue table:", kind);

    if (kind === "responsive") {
      const items = table.getItems();
      const isQueue = (context) => queueNameOf(context) === queueName;
      const item = items.find((i) => isQueue(rowContext(table, i)));
      if (!item) {
        if (renderAllRowsIfNeeded(table, isQueue)) {
          logOnce(request.at + "growing", "queue", queueName, "is further down, all rows are loaded");
        } else if (items.length) {
          const sample = rowContext(table, items[0])?.getObject?.() || {};
          logOnce(request.at + "notfound", "queue", queueName, "not among the queues; fields of a row:", Object.keys(sample).join(", "));
        }
        return;
      }
      if (table.getMode?.() !== "None") {
        table.setSelectedItem(item, true);
        table.fireSelectionChange({ listItem: item, listItems: [item], selected: true });
      }
      table.fireItemPress({ listItem: item, srcControl: item });
      item.getDomRef()?.scrollIntoView({ block: "center" });
    } else if (kind === "grid") {
      const binding = table.getBinding("rows");
      const contexts = binding?.getContexts(0, binding.getLength()) || [];
      const index = contexts.findIndex((c) => queueNameOf(c) === queueName);
      if (index === -1) return;
      table.setFirstVisibleRow(Math.max(0, index - 2));
      table.setSelectedIndex(index);
      table.fireRowSelectionChange({ rowIndex: index, rowContext: contexts[index], rowIndices: [index] });
    } else {
      return;
    }

    if (request.mplId) {
      writeRequest({ ...request, queueSelected: true });
    } else {
      clearRequest();
    }
    console.log(LOG_PREFIX, "queue selected:", queueName);
  }

  // the button of the message list: searched from the message table upwards, but never in a container that also
  // holds the queue table (its buttons act on whole queues). Only a single match counts.
  function findMessageListButton(table, label) {
    const buttons = allElements().filter((c) => c.isA?.("sap.m.Button") && c.getDomRef?.());
    let container = table.getDomRef();
    for (let depth = 0; container && depth < 8; depth++, container = container.parentElement) {
      if (queueTableDom && container.contains(queueTableDom)) break;
      const matches = buttons.filter((b) => {
        const texts = [b.getText?.(), b.getTooltip_AsString?.()].filter(Boolean).map((t) => t.trim());
        return container.contains(b.getDomRef()) && texts.some((t) => label.test(t));
      });
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) return null;
    }
    return null;
  }

  // second step of move / delete: only with exactly the requested message selected
  function pressRequestedAction(table, request) {
    const selected = table.getSelectedItems?.() || [];
    if (selected.length !== 1 || mplIdOf(rowContext(table, selected[0])) !== request.mplId) {
      console.warn(LOG_PREFIX, request.action, "cancelled: the selection is not exactly message", request.mplId);
      clearRequest();
      return;
    }
    const button = findMessageListButton(table, ACTION_LABELS[request.action]);
    if (!button) {
      console.warn(LOG_PREFIX, request.action, "button of the message list not found - the message is selected, please use it yourself");
      clearRequest();
      return;
    }
    if (!button.getEnabled()) {
      // the page enables its buttons after the selection
      if (Date.now() - request.selectedAt > 10000) {
        console.warn(LOG_PREFIX, request.action, "button stays disabled - nothing was done");
        clearRequest();
      }
      return;
    }
    clearRequest();
    button.firePress();
    console.log(LOG_PREFIX, request.action, "started for message", request.mplId, "in queue", request.queueName);
  }

  // selects the requested message in the message list of the selected queue
  function selectRequestedMessage(kind, table) {
    const request = readRequest();
    if (!request?.queueSelected || !request.mplId || kind !== "responsive") return;
    if (request.messageSelected) {
      pressRequestedAction(table, request);
      return;
    }

    const items = table.getItems();
    const isMessage = (context) => mplIdOf(context) === request.mplId;
    const item = items.find((i) => isMessage(rowContext(table, i)));
    if (!item) {
      if (renderAllRowsIfNeeded(table, isMessage)) {
        logOnce(request.at + "msggrowing", "message", request.mplId, "is further down, all rows are loaded");
      } else if (items.length) {
        const sample = rowContext(table, items[0])?.getObject?.() || {};
        logOnce(request.at + "msgnotfound", "message", request.mplId, "not among", items.length, "rows; fields of a row:", Object.keys(sample).join(", "));
      }
      return;
    }
    const queueOfItem = queueNameOf(rowContext(table, item));
    if (queueOfItem && queueOfItem !== request.queueName) return;

    if (table.getMode?.() !== "None") {
      table.removeSelections?.(true);
      table.setSelectedItem(item, true);
      table.fireSelectionChange({ listItem: item, listItems: [item], selected: true });
    }
    item.getDomRef()?.scrollIntoView({ block: "center" });
    console.log(LOG_PREFIX, "message selected:", request.mplId);
    if (ACTION_LABELS[request.action]) {
      writeRequest({ ...request, messageSelected: true, selectedAt: Date.now() });
    } else {
      clearRequest();
    }
  }

  // once per page load: what the message monitor left in the storage, to tell "nothing sent" from "expired"
  let storageLogged = false;
  function logStoredRequest() {
    if (storageLogged) return;
    storageLogged = true;
    try {
      const raw = localStorage.getItem(QUEUE_SELECT_KEY);
      if (!raw) return;
      const request = JSON.parse(raw);
      const age = request?.at ? Math.round((Date.now() - request.at) / 1000) + " s old" : "";
      console.log(LOG_PREFIX, "on load - stored request:", raw, age, "- token of this tab:", sessionStorage.getItem(QUEUE_REQUEST_TOKEN_KEY) || "none");
    } catch (e) {}
  }

  function handleMessageQueues() {
    logStoredRequest();
    for (const control of allElements()) {
      const kind = tableKind(control);
      if (!kind || !isRelevant(control)) continue;
      try {
        const entries = findEntriesColumn(kind, control);
        if (entries) {
          if (featureOn("cpihMmqtSort")) sortQueues(kind, control, entries);
          selectRequestedQueue(kind, control);
        } else {
          if (featureOn("cpihMmqtColumns")) showAllColumns(kind, control);
          selectRequestedMessage(kind, control);
        }
      } catch (e) {
        console.warn(LOG_PREFIX, "error on table", control.getId?.(), e);
      }
    }
  }

  // ===========================================================================

  // the header buttons need a quick reaction (the monitor re-renders its header), the queue page does not
  let tick = 0;
  function run() {
    if (!isActive() || !window.sap?.ui) return;
    tick++;
    if (location.pathname.includes(MESSAGES_PATH)) {
      markHeaderButtons();
    } else if (location.pathname.includes(MESSAGE_QUEUES_PATH) && tick % 2 === 0) {
      handleMessageQueues();
    }
  }

  setInterval(run, 500);
  run();
})();
