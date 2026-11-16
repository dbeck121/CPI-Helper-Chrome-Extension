// Native tabs provide the live SAP views; this plugin supplies the pin shelf.
(() => {
  // Resolve the tab role before the core can paint its toolbar. Keeping this
  // guard separate from the shelf also covers SAP reloads and new pin tabs.
  const roleGuard = document.createElement("style");
  roleGuard.textContent = `
    html.kate-role-pending #cpiHelper_floatingToolbar,
    html.kate-role-pending #__cpihelper,
    html.kate-pin-tab #cpiHelper_floatingToolbar,
    html.kate-pin-tab #__cpihelper,
    html.kate-role-pending #cpihelperglobal > :not(style):not(#kate-pin-shelf):not(#kate-pin-menu),
    html.kate-pin-tab #cpihelperglobal > :not(style):not(#kate-pin-shelf):not(#kate-pin-menu):not(.cpiHelper_toast_container),
    html.kate-role-pending body > [id^="cpiHelper"],
    html.kate-pin-tab body > [id^="cpiHelper"]:not(.cpiHelper_toast_container) { display:none !important; }
  `;
  document.documentElement.classList.add("kate-role-pending");
  body().append(roleGuard);
  let state = { role: "owner", pins: [] };
  // Run before the core's document-level shortcut, without changing its API.
  window.addEventListener("keydown", event => {
    if (state.role !== "pin" || !extensionAlive()) return;
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key?.toLowerCase() !== "k") return;
    if (event.target?.closest?.(".ace_editor")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  let requestQueue = Promise.resolve(), refreshPending = false;
  let requestGeneration = 0;
  function resetRequests() {
    requestGeneration++;
    requestQueue = Promise.resolve();
    refreshPending = false;
  }
  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    // A request that initiated navigation may still be pending when Chrome
    // freezes this document. Never resume its old queue after a BFCache restore.
    resetRequests();
    request();
  });
  let shelfCollapsed = false;
  let contextMenu, contextOrigin, pinDragging = false;
  let cancelPinDrag = () => {};
  const positionKey = `kate-pin-position---${location.host}`;
  let position = { x: 1, y: 1 }, sizeObserver;
  let stopDrag = () => {};
  let shelf, edge, edgeToggle, edgePin, edgeCount, style, rendered = "";
  function validPosition(value) {
    return value && Number.isFinite(value.x) && Number.isFinite(value.y);
  }
  function placeShelf() {
    if (!shelf || shelf.hidden) return;
    const rect = shelf.getBoundingClientRect();
    shelf.style.left = `${8 + Math.max(0, innerWidth - rect.width - 16) * Math.min(1, Math.max(0, position.x))}px`;
    shelf.style.top = `${8 + Math.max(0, innerHeight - rect.height - 16) * Math.min(1, Math.max(0, position.y))}px`;
    shelf.style.right = shelf.style.bottom = "auto";
  }
  function moveShelf(left, top) {
    const rect = shelf.getBoundingClientRect();
    position = {
      x: Math.min(1, Math.max(0, (left - 8) / Math.max(1, innerWidth - rect.width - 16))),
      y: Math.min(1, Math.max(0, (top - 8) / Math.max(1, innerHeight - rect.height - 16))),
    };
    placeShelf();
  }
  function savePosition() {
    chrome.storage.local.set({ [positionKey]: position }).catch((error) => log.error("KaTe: could not save pin position", error));
  }
  function enableDragging(header) {
    header.tabIndex = 0;
    header.title = "Drag to move pins; arrow keys to adjust";
    header.setAttribute("aria-label", "Move pin list");
    header.addEventListener("keydown", (event) => {
      if (event.target !== header || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const rect = shelf.getBoundingClientRect();
      moveShelf(rect.left + (event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0), rect.top + (event.key === "ArrowDown" ? 10 : event.key === "ArrowUp" ? -10 : 0));
      savePosition();
    });
    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button")) return;
      event.preventDefault();
      stopDrag();
      const rect = shelf.getBoundingClientRect();
      const offsetX = event.clientX - rect.left, offsetY = event.clientY - rect.top;
      header.setPointerCapture(event.pointerId);
      header.classList.add("kate-pin-dragging");
      const move = (e) => moveShelf(e.clientX - offsetX, e.clientY - offsetY);
      const finish = () => { stopDrag(); savePosition(); };
      stopDrag = () => {
        header.removeEventListener("pointermove", move);
        header.removeEventListener("pointerup", finish);
        header.removeEventListener("pointercancel", finish);
        header.removeEventListener("lostpointercapture", finish);
        header.classList.remove("kate-pin-dragging");
        if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
      };
      header.addEventListener("pointermove", move);
      header.addEventListener("pointerup", finish);
      header.addEventListener("pointercancel", finish);
      header.addEventListener("lostpointercapture", finish);
    });
  }
  function closePinMenu(restoreFocus = false) {
    contextMenu?.remove(); contextMenu = null;
    if (restoreFocus && contextOrigin?.isConnected) contextOrigin.focus();
    contextOrigin = null;
  }
  function onOutsideMenu(event) {
    if (contextMenu && !contextMenu.contains(event.target)) closePinMenu();
  }
  function onMenuKey(event) {
    if (!contextMenu) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closePinMenu(true); }
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const items = [...contextMenu.querySelectorAll("button")];
      const current = items.indexOf(document.activeElement);
      const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[index].focus();
    } else if (event.key === "Tab") closePinMenu();
  }
  function openPinMenu(pin, origin, x, y) {
    closePinMenu(); contextOrigin = origin;
    contextMenu = document.createElement("div");
    contextMenu.id = "kate-pin-menu";
    contextMenu.setAttribute("role", "menu");
    contextMenu.setAttribute("aria-label", pin.title);
    const rename = button("Rename", "Rename", () => {
      closePinMenu(true);
      const name = window.prompt("Pin name", pin.title);
      if (name !== null) request("rename", pin.url, name);
    });
    const remove = button("Remove pin", "Remove pin", () => { closePinMenu(); request("remove", pin.url); });
    rename.setAttribute("role", "menuitem"); remove.setAttribute("role", "menuitem");
    contextMenu.append(rename, remove);
    body().append(contextMenu);
    const rect = contextMenu.getBoundingClientRect();
    contextMenu.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`;
    contextMenu.style.top = `${Math.max(8, Math.min(y, innerHeight - rect.height - 8))}px`;
    rename.focus();
  }
  function enablePinActions(select, pin, trash) {
    let dragged = false;
    select.title = `${pin.title} · Right-click for actions`;
    select.setAttribute("aria-haspopup", "menu");
    select.addEventListener("contextmenu", (event) => {
      event.preventDefault(); event.stopPropagation();
      openPinMenu(pin, select, event.clientX, event.clientY);
    });
    select.addEventListener("keydown", (event) => {
      dragged = false;
      if (event.key === "ContextMenu" || event.shiftKey && event.key === "F10") {
        event.preventDefault(); event.stopPropagation();
        const rect = select.getBoundingClientRect();
        openPinMenu(pin, select, rect.left, rect.bottom);
      }
    });
    // A drag must never also activate a pin, even when the drop is cancelled.
    select.addEventListener("click", (event) => {
      if (dragged) { event.preventDefault(); event.stopImmediatePropagation(); dragged = false; }
    }, true);
    select.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      cancelPinDrag(); closePinMenu();
      dragged = false; pinDragging = true;
      const startX = event.clientX, startY = event.clientY;
      select.setPointerCapture(event.pointerId);
      const overTrash = (e) => {
        const rect = trash.getBoundingClientRect();
        return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      };
      const move = (e) => {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < 6 && !dragged) return;
        e.preventDefault(); dragged = true;
        select.classList.add("kate-pin-dragging");
        trash.classList.add("kate-pin-trash-ready");
        trash.classList.toggle("kate-pin-trash-over", overTrash(e));
      };
      const finish = (e) => {
        const remove = dragged && e.type === "pointerup" && overTrash(e);
        cancelPinDrag();
        if (remove) request("remove", pin.url);
        // Defer a pending state render until the click following pointerup has finished.
        setTimeout(render, 0);
      };
      cancelPinDrag = () => {
        select.removeEventListener("pointermove", move);
        select.removeEventListener("pointerup", finish);
        select.removeEventListener("pointercancel", finish);
        select.removeEventListener("lostpointercapture", finish);
        select.classList.remove("kate-pin-dragging");
        trash.classList.remove("kate-pin-trash-ready", "kate-pin-trash-over");
        pinDragging = false;
        if (select.hasPointerCapture(event.pointerId)) select.releasePointerCapture(event.pointerId);
      };
      select.addEventListener("pointermove", move);
      select.addEventListener("pointerup", finish);
      select.addEventListener("pointercancel", finish);
      select.addEventListener("lostpointercapture", finish);
    });
  }
  function trashIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24"); icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor"); icon.setAttribute("stroke-width", "1.7");
    icon.setAttribute("stroke-linecap", "round"); icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7");
    icon.append(path); return icon;
  }
  function setRootClass(name, enabled) {
    const classes = document.documentElement.classList;
    if (classes.contains(name) !== enabled) classes.toggle(name, enabled);
  }
  function cleanup() {
    cancelPinDrag(); closePinMenu();
    document.removeEventListener("pointerdown", onOutsideMenu, true);
    document.removeEventListener("keydown", onMenuKey, true);
    stopDrag();
    sizeObserver?.disconnect();
    window.removeEventListener("resize", placeShelf);
    shelf?.remove(); edge?.remove(); style?.remove();
    shelf = edge = edgeToggle = edgePin = edgeCount = style = null;
    rendered = "";
    setRootClass("kate-pin-tab", false);
    setRootClass("kate-role-pending", false);
    delete document.documentElement.dataset.cpihUi;
  }
  function button(text, title, action) {
    const node = document.createElement("button");
    node.type = "button"; node.textContent = text; node.title = title;
    node.setAttribute("aria-label", title);
    node.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      action();
    });
    return node;
  }
  function request(action = "state", pinId, name) {
    const generation = requestGeneration;
    // Capture the SPA route when clicked, not when the queued request runs.
    const url = location.href;
    const title = (typeof cpiData !== "undefined" ? cpiData?.currentArtifactId : "") || [...document.querySelectorAll("h1,h2,[role=heading]")].map((node) => node.textContent.trim()).find((text) => text && text !== "Integration Suite" && text !== "CPI Helper") || document.title;
    if (action === "state" && refreshPending) return requestQueue;
    if (action === "state") refreshPending = true;
    const task = requestQueue.then(async () => {
      if (generation !== requestGeneration) return;
      try {
        const result = await chrome.runtime.sendMessage({ type: "kate:workspace", action, pinId, title, url, name });
        if (generation !== requestGeneration) return;
        if (!result?.ok) throw new Error(result?.error || "Pin workspace unavailable.");
        state = result;
        render();
      } catch (error) {
        if (generation !== requestGeneration) return;
        // Never leave the left toolbar hidden if the worker is unavailable.
        if (document.documentElement) setRootClass("kate-role-pending", false);
        if (action !== "state") showToast(error.message, "KaTe", "error");
      } finally {
        if (action === "state" && generation === requestGeneration) refreshPending = false;
      }
    });
    requestQueue = task.catch(() => {});
    return task;
  }
  // Keep the native split intact. History traversal can restore the complete
  // SAP document from BFCache; Chrome reloads it if that cache has been evicted.
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || sender.tab) return;
    if (message?.type === "kate:refresh-state") {
      respond({ ok: true });
      request();
      return;
    }
    if (message?.type !== "kate:navigate-pin") return;
    try {
      const target = new URL(message.url);
      if (target.origin !== location.origin) throw new Error("Pin belongs to another tenant.");
      if (typeof cpihEditorInEditMode !== "function") {
        respond({ ok: false, error: "Wait for the pinned SAP page to finish loading." }); return;
      }
      if (cpihEditorInEditMode()) {
        respond({ ok: false, error: "Save or cancel your changes in the pinned view first." }); return;
      }
      if (message.useHistory && typeof navigation !== "undefined" && typeof navigation.traverseTo === "function") {
        // Resolve from the live history, never persisted keys: forward entries
        // may disappear after a new pin or ordinary SAP navigation is opened.
        const entries = navigation.entries();
        const currentIndex = navigation.currentEntry?.index ?? 0;
        const entry = entries.filter(entry => entry.url === target.href)
          .sort((a, b) => Math.abs(a.index - currentIndex) - Math.abs(b.index - currentIndex))[0];
        if (entry) {
          const transition = navigation.traverseTo(entry.key);
          // Reply before the document is frozen and the message port closes.
          respond({ ok: true, history: true });
          transition.finished.catch(error => {
            // Do not override an interrupted navigation with a forced reload.
            if (error.name !== "AbortError") showToast("The pin could not be opened. Select it again.", "KaTe", "error");
          });
          return;
        }
      }
      if (typeof cpihNavigate !== "function" || typeof cpihShellArea !== "function") {
        respond({ reload: true }); return;
      }
      if (cpihShellArea(target.pathname) !== cpihShellArea(location.pathname)) {
        respond({ reload: true }); return;
      }
      respond({ ok: cpihNavigate(target.href) });
    } catch (error) {
      respond({ ok: false, error: error.message });
    }
  });
  function updatePinSelection() {
    if (!shelf) return;
    shelf.querySelectorAll("nav button").forEach((node, index) => {
      const pressed = String(state.active === state.pins[index]?.url);
      if (node.getAttribute("aria-pressed") !== pressed) node.setAttribute("aria-pressed", pressed);
    });
  }
  function render() {
    if (state.role === "inactive") { cleanup(); return; }
    if (pinDragging) return;
    const pinTab = state.role === "pin";
    setRootClass("kate-pin-tab", pinTab);
    if (pinTab && document.documentElement.dataset.cpihUi !== "hidden") {
      document.documentElement.dataset.cpihUi = "hidden";
      if (typeof cpihModal !== "undefined") cpihModal.hideAll();
      if (typeof closeCommandPalette === "function") closeCommandPalette();
    } else if (!pinTab && document.documentElement.dataset.cpihUi === "hidden") delete document.documentElement.dataset.cpihUi;
    setRootClass("kate-role-pending", false);
    if (!style) {
      style = document.createElement("style");
      style.textContent = `
        html.kate-pin-tab #cpiHelper_floatingToolbar, html.kate-pin-tab #__cpihelper { display:none !important; }
        #kate-pin-shelf { position:fixed; bottom:8px; right:8px; display:grid; grid-template-columns:auto minmax(0,1fr) auto auto; align-items:center; gap:6px; width:fit-content; max-width:calc(100% - 16px); box-sizing:border-box; z-index:900; padding:4px; background:#fff; color:#172b4d; border:1px solid #b8cce0; border-radius:6px; box-shadow:0 3px 16px #0003; font:12px Arial,sans-serif; }
        #kate-pin-shelf[hidden], #kate-pin-edge[hidden] { display:none !important; }
        #kate-pin-shelf header, #kate-pin-shelf nav { display:flex; flex-wrap:wrap; align-items:center; gap:4px; }
        #kate-pin-shelf header { flex-wrap:nowrap; white-space:nowrap; cursor:grab; touch-action:none; user-select:none; }
        #kate-pin-shelf header.kate-pin-dragging { cursor:grabbing; }
        #kate-pin-shelf .kate-pin-grip { display:inline-block; width:10px; height:16px; flex:none; margin-right:3px; color:#64748b; background:radial-gradient(circle,currentColor 1.4px,transparent 1.6px) 0 0/5px 5px; }
        #kate-pin-shelf header:focus-visible { outline:2px solid #0070f2; }
        #kate-pin-shelf.kate-pin-shelf-collapsed { grid-template-columns:auto auto; }
        #kate-pin-shelf .kate-pin-logo { width:16px; height:16px; object-fit:contain; }
        #kate-pin-shelf nav { min-width:0; }
        #kate-pin-shelf button, #kate-pin-edge button { cursor:pointer; padding:3px 6px; background:#fff; color:#174b91; border:1px solid #b8cce0; border-radius:4px; font:inherit; }
        #kate-pin-shelf button[aria-pressed=true] { background:#e8f1ff; border-color:#0070f2; }
        #kate-pin-shelf button:focus-visible, #kate-pin-edge button:focus-visible { outline:2px solid #0070f2; }
        #kate-pin-shelf nav>span { display:inline-flex; align-items:center; gap:2px; max-width:100%; }
        #kate-pin-shelf nav button { border-color:transparent; background:transparent; border-radius:4px; padding:5px 8px; font-weight:600; touch-action:none; user-select:none; }
        #kate-pin-shelf nav button:hover { background:#eff5fc; }
        #kate-pin-shelf nav button[aria-pressed=true] { background:#e8f1ff; color:#0645ad; border-color:transparent; box-shadow:inset 0 -2px #0070f2;  }
        #kate-pin-shelf nav button.kate-pin-dragging { opacity:.5; cursor:grabbing; }
        #kate-pin-trash { display:grid; place-items:center; width:30px; height:30px; color:#687c91; border-radius:5px; border:1px dashed transparent; transition:background .12s,color .12s; }
        #kate-pin-trash svg { width:17px; height:17px; pointer-events:none; }
        #kate-pin-trash.kate-pin-trash-ready { border-color:#a6b9cc; background:#f1f5fa; }
        #kate-pin-trash.kate-pin-trash-over { border-color:#d93645; background:#fff0f1; color:#c12132; }
        #kate-pin-menu { position:fixed; z-index:910; display:flex; flex-direction:column; min-width:150px; padding:4px; border:1px solid #c5d3e0; border-radius:7px; background:#fff; color:#172b4d; box-shadow:0 5px 18px #0003; font:12px Arial,sans-serif; }
        #kate-pin-menu button { text-align:left; padding:8px 10px; border:0; border-radius:4px; background:transparent; color:inherit; cursor:pointer; font:inherit; }
        #kate-pin-menu button:hover, #kate-pin-menu button:focus-visible { background:#e8f1ff; outline:none; }
        #cpihelperglobal.ch_dark #kate-pin-menu { background:#232e3b; color:#d5e8ff; }
        #cpihelperglobal.ch_dark #kate-pin-menu button:focus-visible, #cpihelperglobal.ch_dark #kate-pin-menu button:hover { background:#344963; }
        #kate-pin-shelf nav>span>button:first-child { min-width:0; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        #kate-pin-edge { position:fixed; right:0; top:50%; transform:translateY(-50%); z-index:900; display:flex; flex-direction:column; align-items:center; width:30px; padding:2px; background:#fff; border:1px solid #b8cce0; border-radius:6px 0 0 6px; box-shadow:0 2px 6px #0002; font:12px Arial,sans-serif; }
        #kate-pin-edge button { display:flex; justify-content:center; align-items:center; width:26px; height:28px; padding:2px; border:0; background:transparent; font-size:18px; }
        #kate-pin-edge button:disabled { opacity:.35; cursor:default; }
        #kate-pin-edge small { font-size:10px; color:#174b91; }
        #kate-pin-edge svg { width:17px; height:17px; }
        #cpihelperglobal.ch_dark #kate-pin-shelf, #cpihelperglobal.ch_dark #kate-pin-shelf button, #cpihelperglobal.ch_dark #kate-pin-edge, #cpihelperglobal.ch_dark #kate-pin-edge button { background:#232e3b; color:#d5e8ff; }
      `;
      shelf = document.createElement("aside"); shelf.id = "kate-pin-shelf";
      shelf.setAttribute("aria-label", "KaTe pinned views");
      shelf.style.visibility = "hidden";
      edge = document.createElement("div");
      edge.id = "kate-pin-edge";
      edge.setAttribute("role", "group");
      edge.setAttribute("aria-label", "KaTe pin controls");
      edgeToggle = button("", "Open split", () => request(state.open ? "collapse" : "expand"));
      edgePin = button("", "Pin current left SAP view", () => request("pin"));
      const pinIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      pinIcon.setAttribute("viewBox", "0 0 24 24");
      pinIcon.setAttribute("fill", "none");
      pinIcon.setAttribute("stroke", "currentColor");
      pinIcon.setAttribute("stroke-width", "1.7");
      pinIcon.setAttribute("aria-hidden", "true");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "m15 3 6 6-4 1-4 5-1 4-7-7 4-1 5-4Z M8 16l-5 5");
      pinIcon.append(path);
      edgePin.append(pinIcon);
      edgeCount = document.createElement("small");
      edge.append(edgeToggle, edgePin, edgeCount);
      body().append(style, shelf, edge);
      document.addEventListener("pointerdown", onOutsideMenu, true);
      document.addEventListener("keydown", onMenuKey, true);
      window.addEventListener("resize", placeShelf);
      sizeObserver = new ResizeObserver(placeShelf);
      sizeObserver.observe(shelf);
      const currentShelf = shelf;
      chrome.storage.local.get(positionKey).then((saved) => {
        if (validPosition(saved[positionKey])) position = saved[positionKey];
      }).catch((error) => log.error("KaTe: could not load pin position", error)).finally(() => {
        if (shelf !== currentShelf) return;
        placeShelf(); shelf.style.visibility = "";
      });
    }
    // Selection and runtime tab IDs must not rebuild or resize the pin shelf.
    const signature = JSON.stringify([state.role, state.open, state.maxPins, state.pins.map(({ url, title }) => ({ url, title })), shelfCollapsed]);
    if (signature === rendered) { updatePinSelection(); return; }
    rendered = signature;
    shelf.hidden = !pinTab;
    shelf.classList.toggle("kate-pin-shelf-collapsed", shelfCollapsed);
    edge.hidden = pinTab;
    edgeToggle.disabled = !state.pins.length;
    edgeToggle.textContent = state.open ? "»" : "«";
    edgeToggle.title = state.open ? "Close split" : "Open split";
    edgeToggle.setAttribute("aria-label", edgeToggle.title);
    edgeToggle.setAttribute("aria-expanded", String(!!state.open));
    edgeCount.textContent = `${state.pins.length}/${state.maxPins || 5}`;
    closePinMenu();
    stopDrag();
    shelf.replaceChildren();
    const header = document.createElement("header");
    enableDragging(header);
    const grip = document.createElement("span");
    grip.className = "kate-pin-grip";
    grip.setAttribute("aria-hidden", "true");
    const logo = document.createElement("img");
    logo.className = "kate-pin-logo";
    logo.src = chrome.runtime.getURL("images/plugin_logos/kate.png");
    logo.alt = "KaTe";
    const brand = document.createElement("strong"); brand.textContent = `${state.pins.length}/${state.maxPins || 5}`;
    brand.title = "Pinned SAP views";
    header.append(grip, logo, brand);
    const shelfToggle = button(shelfCollapsed ? "«" : "»", shelfCollapsed ? "Expand pin list" : "Minimize pin list", () => {
      shelfCollapsed = !shelfCollapsed;
      render();
    });
    shelfToggle.setAttribute("aria-expanded", String(!shelfCollapsed));
    const trash = document.createElement("div");
    trash.id = "kate-pin-trash";
    trash.title = "Drag a pin here to remove it";
    trash.setAttribute("role", "img");
    trash.setAttribute("aria-label", trash.title);
    trash.append(trashIcon());
    const tabs = document.createElement("nav"); tabs.setAttribute("aria-label", "Pinned SAP views");
    for (const pin of state.pins) {
      const item = document.createElement("span");
      const select = button(pin.title, pin.title, () => request("select", pin.url));
      select.setAttribute("aria-pressed", String(state.active === pin.url));
      enablePinActions(select, pin, trash);
      item.append(select);
      tabs.append(item);
    }
    shelf.append(header);
    if (!shelfCollapsed) shelf.append(tabs, trash);
    shelf.append(shelfToggle);
    placeShelf();
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes["kate---isActive"]) {
      if (changes["kate---isActive"].newValue !== true) {
        resetRequests();
        state = { role: "inactive", pins: [] };
        cleanup();
      }
      else request();
      return;
    }
    if (state.role === "inactive") return;
    if (area === "session" && changes["kate-workspaces"]) {
      const change = changes["kate-workspaces"];
      const tenantState = entries => JSON.stringify((entries || []).filter(entry => !entry.origin || entry.origin === location.origin));
      if (tenantState(change.oldValue) !== tenantState(change.newValue)) request();
    }
    if (area === "local" && changes[`kate-pins---${location.hostname}`]) request();
    if (area === "local" && validPosition(changes[positionKey]?.newValue)) {
      position = changes[positionKey].newValue;
      placeShelf();
    }
  });
  window.addEventListener("focus", () => request());
  request();
})();

var plugin = {
  metadataVersion: "1.0.0",
  id: "kate",
  name: "KaTe · Pins",
  version: "0.4.0",
  author: "KaTe GmbH",
  website: "https://kate-group.de/en/kate-group-home/",
  description:
    'Save up to 5 SAP views as pins. Open them beside your current view and switch between them without leaving your workspace.<br><br><strong>Requires:</strong> Google Chrome 155+ with Split View enabled.<br><small>KaTe GmbH · Stuttgart · Integration software.</small>',
  settings: {
    icon: {
      src: "images/plugin_logos/kate.png",
      type: "icon",
    },
  },
};

pluginList.push(plugin);
