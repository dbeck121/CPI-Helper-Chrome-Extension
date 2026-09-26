// Floating, draggable icon toolbar for the artifact actions (Trace, Messages, Info, ...).
// It is mounted on <body> instead of the UI5 header: UI5 re-renders and clips its own header,
// and the header does not exist on every artifact page. Plain DOM, no jQuery or Fomantic.

const FLOATING_TOOLBAR_ID = "cpiHelper_floatingToolbar";
const FLOATING_TOOLBAR_POSITION_KEY = "cpiHelper_floatingToolbarPosition";
const FLOATING_TOOLBAR_DEFAULT_POSITION = { right: 16, top: 140 };
// wide shows the labels next to the icons, compact only the icons. wide is the default
const FLOATING_TOOLBAR_EXPANDED_KEY = "cpiHelper_floatingToolbarExpanded";

// static inline svgs, stroke uses currentColor so the theme color applies
const FLOATING_TOOLBAR_ICONS = {
  trace: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  messages: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.01"/>',
  runtime: '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M8 7h.01M8 17h.01"/>',
  logs: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h4"/>',
  plugins: '<path d="M9 3v4M15 3v4"/><path d="M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>',
  check: '<path d="M5 12l4 4 10-10"/>',
  collapse: '<path d="M13 6l6 6-6 6"/><path d="M5 6l6 6-6 6"/>',
  expand: '<path d="M11 6l-6 6 6 6"/><path d="M19 6l-6 6 6 6"/>',
};

function floatingToolbarIcon(name) {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FLOATING_TOOLBAR_ICONS[name] || ""}</svg>`;
}

function getFloatingToolbar() {
  return document.getElementById(FLOATING_TOOLBAR_ID);
}

function removeFloatingToolbar() {
  const toolbar = getFloatingToolbar();
  if (toolbar) {
    toolbar._cpiHelperCleanup?.();
    toolbar.remove();
  }
}

// keeps the whole bar on screen, also after the window got smaller
function clampFloatingToolbar(toolbar, position) {
  const width = toolbar.offsetWidth || 44;
  const height = toolbar.offsetHeight || 200;
  return {
    right: Math.min(Math.max(position.right, 0), Math.max(window.innerWidth - width, 0)),
    top: Math.min(Math.max(position.top, 0), Math.max(window.innerHeight - height, 0)),
  };
}

function applyFloatingToolbarPosition(toolbar, position) {
  const clamped = clampFloatingToolbar(toolbar, position);
  toolbar.style.right = clamped.right + "px";
  toolbar.style.top = clamped.top + "px";
  return clamped;
}

async function loadFloatingToolbarState() {
  const state = { position: FLOATING_TOOLBAR_DEFAULT_POSITION, expanded: true };
  try {
    const result = await chrome.storage.local.get([FLOATING_TOOLBAR_POSITION_KEY, FLOATING_TOOLBAR_EXPANDED_KEY]);
    const stored = result[FLOATING_TOOLBAR_POSITION_KEY];
    if (stored && Number.isFinite(stored.right) && Number.isFinite(stored.top)) {
      state.position = stored;
    }
    if (typeof result[FLOATING_TOOLBAR_EXPANDED_KEY] === "boolean") {
      state.expanded = result[FLOATING_TOOLBAR_EXPANDED_KEY];
    }
  } catch (error) {
    log.debug("floating toolbar state not readable", error);
  }
  return state;
}

function setFloatingToolbarExpanded(toolbar, expanded, persist = true) {
  toolbar.classList.toggle("cpiHelper_floatingToolbar_expanded", expanded);
  const toggle = toolbar.querySelector(".cpiHelper_floatingToolbar_toggle");
  if (toggle) {
    const label = expanded ? "Collapse" : "Expand";
    toggle.querySelector(".cpiHelper_floatingToolbar_buttonIcon").innerHTML = floatingToolbarIcon(expanded ? "collapse" : "expand");
    toggle.querySelector(".cpiHelper_floatingToolbar_label").textContent = label;
    toggle.setAttribute("aria-label", expanded ? "Show icons only" : "Show labels");
    toggle.dataset.tooltip = expanded ? "Show icons only" : "Show labels";
    toggle.setAttribute("aria-expanded", String(expanded));
  }
  hideFloatingToolbarTooltip(toolbar);
  closeFloatingToolbarMenu(toolbar);
  // the bar is anchored on the right, so it grows to the left and may have to be pulled back on screen
  applyFloatingToolbarPosition(toolbar, { right: parseFloat(toolbar.style.right) || 0, top: parseFloat(toolbar.style.top) || 0 });
  if (persist && extensionAlive()) {
    chrome.storage.local.set({ [FLOATING_TOOLBAR_EXPANDED_KEY]: expanded });
  }
}

// own tooltip instead of the title attribute: the browser shows that late and unstyled.
// in the wide variant the label is already visible, then only the shortcut hint is left
function showFloatingToolbarTooltip(toolbar, target) {
  const tooltip = toolbar.querySelector(".cpiHelper_floatingToolbar_tooltip");
  const expanded = toolbar.classList.contains("cpiHelper_floatingToolbar_expanded");
  const menu = toolbar.querySelector(".cpiHelper_floatingToolbar_menu");
  const text = target.dataset.tooltip;
  const key = target.accessKey;
  if (!tooltip || !menu.hidden || (!text && !key) || (expanded && target.classList.contains("cpiHelper_floatingToolbar_button") && !key)) {
    hideFloatingToolbarTooltip(toolbar);
    return;
  }

  tooltip.replaceChildren();
  if (!expanded || !target.classList.contains("cpiHelper_floatingToolbar_button")) {
    tooltip.append(text);
  }
  if (key) {
    const kbd = document.createElement("kbd");
    kbd.textContent = key;
    tooltip.append(kbd);
  }

  tooltip.hidden = false;
  const toolbarRect = toolbar.getBoundingClientRect();
  const openLeft = toolbarRect.left + toolbarRect.width / 2 > window.innerWidth / 2;
  tooltip.classList.toggle("cpiHelper_floatingToolbar_tooltip_left", openLeft);
  tooltip.style.top = target.offsetTop + target.offsetHeight / 2 - tooltip.offsetHeight / 2 + "px";
}

function hideFloatingToolbarTooltip(toolbar) {
  const tooltip = toolbar?.querySelector(".cpiHelper_floatingToolbar_tooltip");
  if (tooltip) tooltip.hidden = true;
  clearTimeout(toolbar?._cpiHelperTooltipTimer);
}

function bindFloatingToolbarTooltip(toolbar) {
  const targetOf = (event) => event.target.closest?.("[data-tooltip]");
  const schedule = (target) => {
    clearTimeout(toolbar._cpiHelperTooltipTimer);
    toolbar._cpiHelperTooltipTimer = setTimeout(() => showFloatingToolbarTooltip(toolbar, target), 150);
  };
  toolbar.addEventListener("pointerover", (event) => {
    const target = targetOf(event);
    if (target && !toolbar.classList.contains("cpiHelper_floatingToolbar_dragging")) schedule(target);
  });
  toolbar.addEventListener("pointerout", (event) => {
    if (targetOf(event) && !targetOf(event).contains(event.relatedTarget)) hideFloatingToolbarTooltip(toolbar);
  });
  // keyboard users get the tooltip on focus, without delay
  toolbar.addEventListener("focusin", (event) => {
    const target = targetOf(event);
    if (target && target.matches(":focus-visible")) showFloatingToolbarTooltip(toolbar, target);
  });
  toolbar.addEventListener("focusout", () => hideFloatingToolbarTooltip(toolbar));
}

function saveFloatingToolbarPosition(position) {
  if (!extensionAlive()) return;
  chrome.storage.local.set({ [FLOATING_TOOLBAR_POSITION_KEY]: position });
}

// the bar is dragged by its grip only, so a click on an icon never turns into a drag
function makeFloatingToolbarDraggable(toolbar, grip) {
  let start = null;

  grip.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    grip.setPointerCapture(event.pointerId);
    start = { x: event.clientX, y: event.clientY, right: parseFloat(toolbar.style.right) || 0, top: parseFloat(toolbar.style.top) || 0 };
    toolbar.classList.add("cpiHelper_floatingToolbar_dragging");
    closeFloatingToolbarMenu(toolbar);
    hideFloatingToolbarTooltip(toolbar);
  });

  grip.addEventListener("pointermove", (event) => {
    if (!start) return;
    // right is measured from the right edge, so moving the mouse right makes it smaller
    applyFloatingToolbarPosition(toolbar, { right: start.right - (event.clientX - start.x), top: start.top + (event.clientY - start.y) });
  });

  const stop = (event) => {
    if (!start) return;
    start = null;
    grip.releasePointerCapture?.(event.pointerId);
    toolbar.classList.remove("cpiHelper_floatingToolbar_dragging");
    saveFloatingToolbarPosition({ right: parseFloat(toolbar.style.right) || 0, top: parseFloat(toolbar.style.top) || 0 });
  };
  grip.addEventListener("pointerup", stop);
  grip.addEventListener("pointercancel", stop);

  // arrow keys on the focused grip move the bar too
  grip.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 40 : 10;
    const moves = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [step, 0], ArrowRight: [-step, 0] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const position = applyFloatingToolbarPosition(toolbar, { right: (parseFloat(toolbar.style.right) || 0) + move[0], top: (parseFloat(toolbar.style.top) || 0) + move[1] });
    saveFloatingToolbarPosition(position);
  });
}

// creates the empty bar on <body>; buttons are added with addFloatingToolbarButton / addFloatingToolbarMenuButton
async function createFloatingToolbar(artifactId) {
  removeFloatingToolbar();

  const toolbar = document.createElement("div");
  toolbar.id = FLOATING_TOOLBAR_ID;
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-orientation", "vertical");
  toolbar.setAttribute("aria-label", "CPI Helper");
  toolbar.dataset.artifactId = artifactId || "";

  const grip = document.createElement("div");
  grip.className = "cpiHelper_floatingToolbar_grip";
  grip.dataset.tooltip = "Drag to move";
  grip.tabIndex = 0;
  grip.setAttribute("role", "separator");
  grip.setAttribute("aria-label", "Move CPI Helper toolbar");
  toolbar.appendChild(grip);

  const menu = document.createElement("div");
  menu.className = "cpiHelper_floatingToolbar_menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  toolbar.appendChild(menu);

  const tooltip = document.createElement("div");
  tooltip.className = "cpiHelper_floatingToolbar_tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  toolbar.appendChild(tooltip);

  // last element: switches between the wide (icon + label) and the compact (icon only) variant
  const toggle = createFloatingToolbarButton({ icon: "collapse", title: "Collapse" });
  toggle.classList.add("cpiHelper_floatingToolbar_toggle");
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setFloatingToolbarExpanded(toolbar, !toolbar.classList.contains("cpiHelper_floatingToolbar_expanded"));
  });
  toolbar.appendChild(toggle);

  // hidden until positioned, otherwise it flashes at the default spot first
  toolbar.style.visibility = "hidden";
  document.body.appendChild(toolbar);
  makeFloatingToolbarDraggable(toolbar, grip);
  bindFloatingToolbarTooltip(toolbar);

  const onDocumentClick = (event) => {
    if (!toolbar.contains(event.target)) closeFloatingToolbarMenu(toolbar);
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") closeFloatingToolbarMenu(toolbar);
  };
  const onResize = () => applyFloatingToolbarPosition(toolbar, { right: parseFloat(toolbar.style.right) || 0, top: parseFloat(toolbar.style.top) || 0 });
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onResize);
  toolbar._cpiHelperCleanup = () => {
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", onResize);
  };

  const state = await loadFloatingToolbarState();
  toolbar.style.right = state.position.right + "px";
  toolbar.style.top = state.position.top + "px";
  setFloatingToolbarExpanded(toolbar, state.expanded, false);
  toolbar.style.visibility = "";
  return toolbar;
}

// title is the visible label of the wide variant and the tooltip of the compact one
function createFloatingToolbarButton({ id, icon, title, accessKey }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cpiHelper_floatingToolbar_button";
  if (id) button.id = id;
  button.setAttribute("aria-label", title);
  button.dataset.tooltip = title;
  if (accessKey) button.accessKey = accessKey;
  const iconSpan = document.createElement("span");
  iconSpan.className = "cpiHelper_floatingToolbar_buttonIcon";
  iconSpan.innerHTML = floatingToolbarIcon(icon);
  const label = document.createElement("span");
  label.className = "cpiHelper_floatingToolbar_label";
  label.textContent = title;
  button.append(iconSpan, label);
  return button;
}

function addFloatingToolbarButton(toolbar, { id, icon, title, accessKey, onClick }) {
  const button = createFloatingToolbarButton({ id, icon, title, accessKey });
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    closeFloatingToolbarMenu(toolbar);
    await onClick(button);
  });
  toolbar.insertBefore(button, toolbar.querySelector(".cpiHelper_floatingToolbar_menu"));
  return button;
}

// getItems runs on every open and returns [{ label, icon?, selected?, disabled?, onClick? }]
function addFloatingToolbarMenuButton(toolbar, { id, icon, title, getItems }) {
  const button = createFloatingToolbarButton({ id, icon, title });
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const menu = toolbar.querySelector(".cpiHelper_floatingToolbar_menu");
    if (!menu.hidden && menu.dataset.owner === button.id) {
      closeFloatingToolbarMenu(toolbar);
      return;
    }
    await openFloatingToolbarMenu(toolbar, button, await getItems());
  });
  toolbar.insertBefore(button, toolbar.querySelector(".cpiHelper_floatingToolbar_menu"));
  return button;
}

async function openFloatingToolbarMenu(toolbar, button, items) {
  const menu = toolbar.querySelector(".cpiHelper_floatingToolbar_menu");
  menu.replaceChildren(
    ...items.map((item) => {
      const entry = document.createElement("button");
      entry.type = "button";
      entry.className = "cpiHelper_floatingToolbar_menuItem";
      entry.setAttribute("role", item.selected === undefined ? "menuitem" : "menuitemradio");
      if (item.selected !== undefined) entry.setAttribute("aria-checked", String(!!item.selected));
      entry.disabled = !!item.disabled;
      // the checkmark column keeps selectable entries aligned
      const iconName = item.selected ? "check" : item.icon;
      const iconSpan = document.createElement("span");
      iconSpan.className = "cpiHelper_floatingToolbar_menuIcon";
      iconSpan.innerHTML = iconName ? floatingToolbarIcon(iconName) : "";
      const label = document.createElement("span");
      label.textContent = item.label;
      entry.append(iconSpan, label);
      entry.addEventListener("click", async (event) => {
        event.stopPropagation();
        closeFloatingToolbarMenu(toolbar);
        await item.onClick?.();
      });
      return entry;
    })
  );

  hideFloatingToolbarTooltip(toolbar);
  menu.dataset.owner = button.id;
  menu.hidden = false;
  toolbar.querySelectorAll("[aria-expanded]").forEach((b) => b.setAttribute("aria-expanded", String(b === button)));

  // open towards the middle of the screen, so a bar at the right edge opens its menu to the left
  const toolbarRect = toolbar.getBoundingClientRect();
  const openLeft = toolbarRect.left + toolbarRect.width / 2 > window.innerWidth / 2;
  menu.classList.toggle("cpiHelper_floatingToolbar_menu_left", openLeft);
  menu.style.top = button.offsetTop + "px";
  // keep the menu inside the viewport vertically
  const overflow = toolbarRect.top + button.offsetTop + menu.offsetHeight - window.innerHeight + 8;
  if (overflow > 0) menu.style.top = Math.max(button.offsetTop - overflow, -toolbarRect.top + 8) + "px";
  menu.querySelector(".cpiHelper_floatingToolbar_menuItem:not(:disabled)")?.focus();
}

function closeFloatingToolbarMenu(toolbar) {
  const menu = toolbar?.querySelector(".cpiHelper_floatingToolbar_menu");
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  toolbar.querySelectorAll("[aria-expanded]").forEach((b) => b.setAttribute("aria-expanded", "false"));
}

function setFloatingToolbarButtonActive(id, active) {
  const button = document.getElementById(id);
  if (!button) return;
  button.classList.toggle("cpiHelper_floatingToolbar_button_active", !!active);
  button.setAttribute("aria-pressed", String(!!active));
}
