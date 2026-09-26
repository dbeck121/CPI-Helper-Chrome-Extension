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
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3.5"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3.5"/><path d="M20 20v-4h-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
};

// accesskey needs a modifier that depends on the platform: Control+Option on macOS, Alt elsewhere
function floatingToolbarShortcutLabel(key) {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  return /mac/i.test(platform) ? `⌃⌥${key}` : `Alt+${key}`;
}

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
    toggle.dataset.cpiHint = expanded ? "Show icons only" : "Show labels";
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

// own tooltip instead of the title attribute: the browser shows that late and unstyled. the attribute is
// data-cpi-hint and not data-tooltip, Fomantic's CSS would show a second tooltip for data-tooltip
// in the compact variant always; in the wide one only for a label that was cut, with the full name
function showFloatingToolbarTooltip(toolbar, target) {
  const tooltip = toolbar.querySelector(".cpiHelper_floatingToolbar_tooltip");
  const popoverOpen = [...toolbar.querySelectorAll(".cpiHelper_floatingToolbar_menu, .cpiHelper_floatingToolbar_panel")].some((popover) => !popover.hidden);
  const expanded = toolbar.classList.contains("cpiHelper_floatingToolbar_expanded");
  const label = target.querySelector(".cpiHelper_floatingToolbar_label");
  const cut = label && label.scrollWidth > label.clientWidth;
  if (!tooltip || popoverOpen || !target.dataset.cpiHint || (expanded && !cut)) {
    hideFloatingToolbarTooltip(toolbar);
    return;
  }

  tooltip.replaceChildren(target.dataset.cpiHint);
  if (target.accessKey && !expanded) {
    const kbd = document.createElement("kbd");
    kbd.textContent = floatingToolbarShortcutLabel(target.accessKey);
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

// a hint waits a bit, so moving across the bar does not flash one after the other. once one is shown the
// neighbours follow without delay, until the mouse has been away from the bar for a moment
const FLOATING_TOOLBAR_TOOLTIP_DELAY = 500;
const FLOATING_TOOLBAR_TOOLTIP_WARM = 600;

function bindFloatingToolbarTooltip(toolbar) {
  let warmUntil = 0;
  const targetOf = (event) => event.target.closest?.("[data-cpi-hint]");
  const schedule = (target) => {
    clearTimeout(toolbar._cpiHelperTooltipTimer);
    const delay = Date.now() < warmUntil ? 0 : FLOATING_TOOLBAR_TOOLTIP_DELAY;
    toolbar._cpiHelperTooltipTimer = setTimeout(() => showFloatingToolbarTooltip(toolbar, target), delay);
  };
  toolbar.addEventListener("pointerover", (event) => {
    const target = targetOf(event);
    if (target && !toolbar.classList.contains("cpiHelper_floatingToolbar_dragging")) schedule(target);
  });
  toolbar.addEventListener("pointerout", (event) => {
    const target = targetOf(event);
    if (!target || target.contains(event.relatedTarget)) return;
    const tooltip = toolbar.querySelector(".cpiHelper_floatingToolbar_tooltip");
    if (tooltip && !tooltip.hidden) warmUntil = Date.now() + FLOATING_TOOLBAR_TOOLTIP_WARM;
    hideFloatingToolbarTooltip(toolbar);
  });
  // keyboard users get the hint on focus, without delay
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

  // the grip is the header of the bar: dots to drag it and, in the wide variant, the name
  const grip = document.createElement("div");
  grip.className = "cpiHelper_floatingToolbar_grip";
  grip.dataset.cpiHint = "CPI Helper";
  const dots = document.createElement("span");
  dots.className = "cpiHelper_floatingToolbar_dots";
  const name = document.createElement("span");
  name.className = "cpiHelper_floatingToolbar_title";
  name.textContent = "CPI Helper";
  grip.append(dots, name);
  grip.tabIndex = 0;
  grip.setAttribute("role", "separator");
  grip.setAttribute("aria-label", "Move CPI Helper toolbar");
  toolbar.appendChild(grip);

  const menu = document.createElement("div");
  menu.className = "cpiHelper_floatingToolbar_menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  toolbar.appendChild(menu);

  // holds whatever a plugin renders, so it is a panel and not a menu
  const panel = document.createElement("div");
  panel.className = "cpiHelper_floatingToolbar_panel";
  panel.setAttribute("role", "dialog");
  panel.hidden = true;
  toolbar.appendChild(panel);

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
function createFloatingToolbarButton({ id, icon, iconNode, title, accessKey }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cpiHelper_floatingToolbar_button";
  if (id) button.id = id;
  button.setAttribute("aria-label", title);
  button.dataset.cpiHint = title;
  if (accessKey) button.accessKey = accessKey;
  const iconSpan = document.createElement("span");
  iconSpan.className = "cpiHelper_floatingToolbar_buttonIcon";
  if (iconNode) {
    iconSpan.appendChild(iconNode);
  } else {
    iconSpan.innerHTML = floatingToolbarIcon(icon);
  }
  const label = document.createElement("span");
  label.className = "cpiHelper_floatingToolbar_label";
  label.textContent = title;
  button.append(iconSpan, label);
  return button;
}

function appendFloatingToolbarItem(toolbar, item) {
  toolbar.insertBefore(item, toolbar.querySelector(".cpiHelper_floatingToolbar_menu"));
  return item;
}

// a line between two groups of buttons, with the name of the group in the wide variant
function addFloatingToolbarSeparator(toolbar, label) {
  const separator = document.createElement("div");
  separator.className = "cpiHelper_floatingToolbar_separator";
  separator.setAttribute("role", "separator");
  if (label) {
    const name = document.createElement("span");
    name.textContent = label;
    separator.appendChild(name);
  }
  return appendFloatingToolbarItem(toolbar, separator);
}

function addFloatingToolbarButton(toolbar, { id, icon, iconNode, title, accessKey, onClick }) {
  const button = createFloatingToolbarButton({ id, icon, iconNode, title, accessKey });
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    closeFloatingToolbarMenu(toolbar);
    await onClick(button);
  });
  return appendFloatingToolbarItem(toolbar, button);
}

// getItems runs on every open and returns [{ label, icon?, selected?, disabled?, onClick? }]
function addFloatingToolbarMenuButton(toolbar, { id, icon, title, getItems }) {
  const button = createFloatingToolbarButton({ id, icon, title });
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const menu = toolbar.querySelector(".cpiHelper_floatingToolbar_menu");
    const wasOpen = !menu.hidden && menu.dataset.owner === button.id;
    // also closes an open plugin panel
    closeFloatingToolbarMenu(toolbar);
    if (wasOpen) return;
    await openFloatingToolbarMenu(toolbar, button, await getItems());
  });
  return appendFloatingToolbarItem(toolbar, button);
}

// opens a panel beside the bar with the node render() returns. clicks inside the panel keep it open
function addFloatingToolbarPanelButton(toolbar, { id, icon, iconNode, title, render }) {
  const button = createFloatingToolbarButton({ id, icon, iconNode, title });
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const panel = toolbar.querySelector(".cpiHelper_floatingToolbar_panel");
    const wasOpen = !panel.hidden && panel.dataset.owner === button.id;
    closeFloatingToolbarMenu(toolbar);
    if (wasOpen) return;

    const heading = document.createElement("div");
    heading.className = "cpiHelper_floatingToolbar_panelTitle";
    heading.textContent = title;
    const body = document.createElement("div");
    body.className = "cpiHelper_floatingToolbar_panelBody";
    try {
      const content = await render();
      if (content instanceof Node) {
        body.appendChild(content);
      } else {
        body.textContent = "Nothing to show here.";
      }
    } catch (error) {
      log.error(`toolbar panel ${title} failed`, error);
      body.textContent = "This could not be shown, see the browser console for details.";
    }
    panel.replaceChildren(heading, body);
    panel.setAttribute("aria-label", title);
    panel.dataset.owner = button.id;
    hideFloatingToolbarTooltip(toolbar);
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    positionFloatingToolbarPopover(toolbar, panel, button);
  });
  return appendFloatingToolbarItem(toolbar, button);
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
  toolbar.querySelectorAll("[aria-haspopup]").forEach((b) => b.setAttribute("aria-expanded", String(b === button)));

  positionFloatingToolbarPopover(toolbar, menu, button);
  menu.querySelector(".cpiHelper_floatingToolbar_menuItem:not(:disabled)")?.focus();
}

// closes the menu and the plugin panel
function closeFloatingToolbarMenu(toolbar) {
  let closed = false;
  for (const popover of toolbar?.querySelectorAll(".cpiHelper_floatingToolbar_menu, .cpiHelper_floatingToolbar_panel") || []) {
    if (!popover.hidden) {
      popover.hidden = true;
      closed = true;
    }
  }
  if (closed) toolbar.querySelectorAll("[aria-haspopup]").forEach((b) => b.setAttribute("aria-expanded", "false"));
}

// menu and panel open beside the bar, towards the middle of the screen, aligned with their button
function positionFloatingToolbarPopover(toolbar, popover, button) {
  const toolbarRect = toolbar.getBoundingClientRect();
  const openLeft = toolbarRect.left + toolbarRect.width / 2 > window.innerWidth / 2;
  popover.classList.toggle("cpiHelper_floatingToolbar_popover_left", openLeft);
  popover.style.top = button.offsetTop + "px";
  // keep it inside the viewport vertically
  const overflow = toolbarRect.top + button.offsetTop + popover.offsetHeight - window.innerHeight + 8;
  if (overflow > 0) popover.style.top = Math.max(button.offsetTop - overflow, -toolbarRect.top + 8) + "px";
}

function setFloatingToolbarButtonActive(id, active) {
  const button = document.getElementById(id);
  if (!button) return;
  button.classList.toggle("cpiHelper_floatingToolbar_button_active", !!active);
  button.setAttribute("aria-pressed", String(!!active));
}
