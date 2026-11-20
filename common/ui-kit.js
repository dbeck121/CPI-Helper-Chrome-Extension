// Small UI kit that replaces jQuery and the Fomantic UI javascript modules.
// Markup and class names stay the same as before (ui modal, ui tab, ui checkbox, ...), only the behaviour lives here.
// Everything is global on purpose: content scripts and plugins share one scope and are not modules.

// null safe query helpers. jQuery silently ignored empty selections, these keep that property for the common cases
function cpihQs(selector, root = document) {
  if (selector instanceof Element) return selector;
  return root?.querySelector(selector) ?? null;
}

function cpihQsa(selector, root = document) {
  if (selector instanceof Element) return [selector];
  if (Array.isArray(selector)) return selector.flatMap((item) => cpihQsa(item, root));
  if (selector instanceof NodeList || selector instanceof HTMLCollection) return [...selector];
  return root ? [...root.querySelectorAll(selector)] : [];
}

// dark mode of the CPI page, used where an element lives outside of #cpihelperglobal
function cpihIsDark() {
  return document.documentElement.classList.contains("sapUiTheme-sap_horizon_dark");
}

// container that carries the ch_dark / ch_light class. falls back to document.body before init.js created it
function cpihRoot() {
  return document.getElementById("cpihelperglobal") || document.body;
}

/* ------------------------------------------------------------------ modal */

// Replacement for $(el).modal(...). Supports what the code base used:
//  - .close.icon, .actions .deny/.negative/.cancel and .actions .approve/.positive/.ok close the modal
//    (onDeny / onApprove can return false to keep it open)
//  - click on the dimmer and ESC close the top most closable modal
//  - showing a modal hides the other open ones unless allowMultiple is set
//  - settings are remembered per element, show() without settings reuses them like .modal("show") did
const cpihModal = (() => {
  const stack = [];
  const settingsOf = new WeakMap();
  let dimmer = null;

  function getDimmer() {
    if (!dimmer || !dimmer.isConnected) {
      dimmer = document.createElement("div");
      dimmer.className = "cpiHelper_dimmer";
      dimmer.addEventListener("mousedown", (event) => {
        if (event.target !== dimmer) return;
        const top = stack[stack.length - 1];
        if (top && settingsOf.get(top)?.closable !== false) hide(top);
      });
    }
    // lives next to the modals so it gets the theme class and stacks right below them
    const root = cpihRoot();
    if (dimmer.parentElement !== root) root.appendChild(dimmer);
    return dimmer;
  }

  function updateDimmer() {
    const d = getDimmer();
    d.classList.toggle("active", stack.length > 0);
    // the dimmer sits below the top most modal, older modals of an allowMultiple stack are dimmed as well
    stack.forEach((modal, index) => (modal.style.zIndex = String(1001 + index * 2)));
    d.style.zIndex = String(1000 + Math.max(0, stack.length - 1) * 2);
    document.documentElement.classList.toggle("cpiHelper_modal_open", stack.length > 0);
  }

  function onModalClick(event) {
    const modal = event.currentTarget;
    const settings = settingsOf.get(modal) || {};
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(".cpiHelper.ui.modal, .ui.modal") !== modal) return;

    if (target.closest(".close.icon") && target.closest(".close.icon").parentElement === modal) {
      hide(modal);
      return;
    }
    const button = target.closest(".actions .button, .actions button");
    if (!button || !modal.contains(button) || button.classList.contains("disabled") || button.disabled) return;
    if (button.matches(".deny, .negative, .cancel")) {
      if (settings.onDeny && settings.onDeny.call(modal, button) === false) return;
      hide(modal);
    } else if (button.matches(".approve, .positive, .ok")) {
      if (settings.onApprove && settings.onApprove.call(modal, button) === false) return;
      hide(modal);
    }
  }

  function show(target, settings) {
    const modal = cpihQs(target);
    if (!modal) return null;
    if (settings) settingsOf.set(modal, { closable: true, ...settings });
    else if (!settingsOf.has(modal)) settingsOf.set(modal, { closable: true });
    const current = settingsOf.get(modal);

    if (!modal.dataset.cpihModal) {
      modal.dataset.cpihModal = "1";
      modal.addEventListener("click", onModalClick);
    }
    // plugins create their own modals, keep every modal inside the themed container
    if (!modal.parentElement || (modal.parentElement !== cpihRoot() && !modal.closest("#cpihelperglobal"))) {
      cpihRoot().appendChild(modal);
    }

    if (!current.allowMultiple) {
      [...stack].filter((other) => other !== modal).forEach((other) => hide(other));
    }
    const alreadyShown = stack.includes(modal);
    if (!alreadyShown) {
      stack.push(modal);
      modal._cpihLastFocus = document.activeElement;
    }
    modal.classList.add("visible", "active");
    updateDimmer();
    if (!alreadyShown) {
      current.onShow?.call(modal);
      requestAnimationFrame(() => {
        if (!modal.contains(document.activeElement)) modal.focus({ preventScroll: true });
        current.onVisible?.call(modal);
      });
    }
    if (!modal.hasAttribute("tabindex")) modal.setAttribute("tabindex", "-1");
    return modal;
  }

  function hide(target) {
    cpihQsa(target).forEach((modal) => {
      const index = stack.indexOf(modal);
      if (index === -1) return;
      const settings = settingsOf.get(modal) || {};
      if (settings.onHide && settings.onHide.call(modal) === false) return;
      stack.splice(index, 1);
      modal.classList.remove("visible", "active");
      updateDimmer();
      const lastFocus = modal._cpihLastFocus;
      modal._cpihLastFocus = null;
      if (lastFocus && lastFocus.isConnected && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
      settings.onHidden?.call(modal);
    });
  }

  function hideAll() {
    [...stack].reverse().forEach((modal) => hide(modal));
  }

  function isShown(target) {
    const modal = cpihQs(target);
    return !!modal && stack.includes(modal);
  }

  function top() {
    return stack[stack.length - 1] || null;
  }

  // capture phase: UI5 calls preventDefault on Escape when a form element has the focus, a bubbling
  // listener then depends on the order of registration. the exceptions are checked here instead
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;
      const modal = top();
      if (!modal || settingsOf.get(modal)?.closable === false) return;
      const target = event.target instanceof Element ? event.target : null;
      // Esc closes the search box of the payload editor, the result list of a search or leaves the fullscreen editor
      if (target?.closest(".ace_search")) return;
      if (target?.closest(".ui.search")?.querySelector(".results.visible")) return;
      if (modal.querySelector(".cpiHelper_payload_fullscreen")) return;
      event.preventDefault();
      event.stopPropagation();
      hide(modal);
    },
    true
  );

  return { show, hide, hideAll, isShown, top };
})();

// Replacement for $.modal("confirm", ...). Resolves with true (yes) or false (no / closed).
function cpihConfirm({ title = "Are you sure?", content = "", approveText = "Yes", denyText = "No" } = {}) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "cpiHelper ui tiny modal cpiHelper_confirm_modal";
    modal.innerHTML = `
      <div class="header"></div>
      ${content ? '<div class="content"></div>' : ""}
      <div class="actions">
        <button class="ui deny button" type="button"></button>
        <button class="ui primary approve button" type="button"></button>
      </div>`;
    modal.querySelector(".header").textContent = title;
    if (content) {
      const contentElement = modal.querySelector(".content");
      if (content instanceof Element) contentElement.appendChild(content);
      else contentElement.innerHTML = content;
    }
    modal.querySelector(".deny").textContent = denyText;
    modal.querySelector(".approve").textContent = approveText;
    let answer = false;
    cpihRoot().appendChild(modal);
    cpihModal.show(modal, {
      allowMultiple: true,
      onApprove: () => {
        answer = true;
      },
      onHidden: () => {
        modal.remove();
        resolve(answer);
      },
    });
  });
}

/* ------------------------------------------------------------------ toast */

// Replacement for $.toast(...). Returns a handle with close().
// options: message (text or html), title, type (success | error | warning | info), displayTime (ms, 0 = sticky),
// closeIcon, showProgress (true | "top" | "bottom"), position ("bottom center" | "bottom right" | ...), onVisible, onRemove
function cpihToast(options = {}) {
  const { message = "", title = "", displayTime = 3000, closeIcon = false, showProgress = "bottom", position = "bottom center", onVisible, onRemove } = options;
  const type = String(options.type || "").toLowerCase();

  const containerId = "cpiHelper_toasts_" + position.replace(/\s+/g, "_");
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.className = "cpiHelper_toast_container " + position;
  }
  if (container.parentElement !== cpihRoot()) cpihRoot().appendChild(container);

  const toast = document.createElement("div");
  toast.className = `cpiHelper ui toast ${type}`.trim();
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.innerHTML = `
    ${closeIcon ? '<i class="close icon" role="button" aria-label="Close"></i>' : ""}
    <div class="content">
      ${title ? '<div class="header"></div>' : ""}
      <div class="message"></div>
    </div>
    ${showProgress && displayTime ? `<div class="cpiHelper_toast_progress ${showProgress === "top" ? "top" : "bottom"}"></div>` : ""}`;
  if (title) toast.querySelector(".header").textContent = title;
  const messageElement = toast.querySelector(".message");
  if (message instanceof Element) messageElement.appendChild(message);
  else messageElement.innerHTML = String(message);

  let timer = null;
  let closed = false;
  const handle = {
    element: toast,
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      toast.classList.add("closing");
      setTimeout(() => {
        toast.remove();
        onRemove?.();
      }, 150);
    },
  };
  toast._cpihToast = handle;

  const start = () => {
    if (!displayTime) return;
    const progress = toast.querySelector(".cpiHelper_toast_progress");
    if (progress) {
      progress.style.animationDuration = displayTime + "ms";
      progress.style.animationPlayState = "running";
    }
    timer = setTimeout(handle.close, displayTime);
  };
  // hovering keeps the toast open, the same as the old behaviour
  toast.addEventListener("mouseenter", () => {
    clearTimeout(timer);
    const progress = toast.querySelector(".cpiHelper_toast_progress");
    if (progress) progress.style.animationPlayState = "paused";
  });
  toast.addEventListener("mouseleave", () => {
    if (closed || !displayTime) return;
    const progress = toast.querySelector(".cpiHelper_toast_progress");
    if (progress) progress.style.animationPlayState = "running";
    timer = setTimeout(handle.close, 1500);
  });
  toast.querySelector(".close.icon")?.addEventListener("click", handle.close);

  // newest on top
  container.prepend(toast);
  start();
  if (onVisible) requestAnimationFrame(() => onVisible(handle));
  return handle;
}

function cpihCloseToasts() {
  document.querySelectorAll(".cpiHelper_toast_container .ui.toast").forEach((toast) => toast._cpihToast?.close());
}

/* ------------------------------------------------------------------ tabs */

// Replacement for $(".menu .item").tab(). One delegated handler serves every
// <div class="ui menu"><a class="item" data-tab="x"></div> ... <div class="ui tab" data-tab="x"> pair,
// the tab panels are looked up in the closest ancestor that contains them.
function cpihTabContext(menuItem, name) {
  let context = menuItem.closest(".menu")?.parentElement;
  while (context && !context.querySelector(`.ui.tab[data-tab="${CSS.escape(name)}"]`)) {
    context = context.parentElement;
  }
  return context;
}

function cpihActivateTab(contextOrItem, name) {
  const scope = cpihQs(contextOrItem);
  if (!scope) return;
  const item = scope.matches?.(".item[data-tab]") && !name ? scope : scope.querySelector(`.menu .item[data-tab="${CSS.escape(name)}"]`);
  if (!item) return;
  const tabName = item.dataset.tab;
  const menu = item.closest(".menu");
  const context = cpihTabContext(item, tabName);
  if (!menu || !context) return;
  const names = [...menu.querySelectorAll(".item[data-tab]")].map((element) => element.dataset.tab);
  menu.querySelectorAll(".item[data-tab]").forEach((element) => element.classList.toggle("active", element === item));
  names.forEach((other) => {
    context.querySelectorAll(`.ui.tab[data-tab="${CSS.escape(other)}"]`).forEach((panel) => panel.classList.toggle("active", other === tabName));
  });
  context.dispatchEvent(new CustomEvent("cpih-tab-change", { bubbles: true, detail: { tab: tabName } }));
}

document.addEventListener("click", (event) => {
  const item = event.target instanceof Element ? event.target.closest(".ui.menu .item[data-tab]") : null;
  if (!item || item.classList.contains("disabled")) return;
  if (item.tagName === "A") event.preventDefault();
  cpihActivateTab(item);
});

/* ------------------------------------------------------------------ table sort */

// Replacement for $(table).tablesort(). Click on a header sorts by that column, again reverses.
// A cell can carry data-sort-value, otherwise the text is compared (numbers numerically).
function cpihTableSort(target) {
  cpihQsa(target).forEach((table) => {
    if (table.dataset.cpihSortable) return;
    table.dataset.cpihSortable = "1";
    table.classList.add("sortable");
    const headers = table.querySelectorAll("thead th");
    headers.forEach((header, column) => {
      if (header.classList.contains("no-sort")) return;
      header.addEventListener("click", () => {
        const body = table.tBodies[0];
        if (!body) return;
        const descending = header.classList.contains("ascending");
        headers.forEach((other) => other.classList.remove("sorted", "ascending", "descending"));
        header.classList.add("sorted", descending ? "descending" : "ascending");
        const valueOf = (row) => {
          const cell = row.cells[column];
          return cell ? (cell.dataset.sortValue ?? cell.textContent.trim()) : "";
        };
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
        const rows = [...body.rows].sort((a, b) => collator.compare(valueOf(a), valueOf(b)) * (descending ? -1 : 1));
        rows.forEach((row) => body.appendChild(row));
      });
    });
  });
}

/* ------------------------------------------------------------------ search */

// Replacement for $(".ui.search").search({ type: "category" }).
// <div class="ui search"><div class="ui icon input"><input class="prompt"></div><div class="results"></div></div>
// source: [{ title, category?, description? }], onSelect(result)
function cpihSearch(target, { source = [], onSelect, minCharacters = 1, maxResults = 25, searchFields = ["title"] } = {}) {
  cpihQsa(target).forEach((container) => {
    const input = container.querySelector("input.prompt, input");
    let results = container.querySelector(".results");
    if (!input) return;
    if (!results) {
      results = document.createElement("div");
      results.className = "results";
      container.appendChild(results);
    }
    let matches = [];
    let activeIndex = -1;

    const close = () => {
      results.classList.remove("visible");
      activeIndex = -1;
    };
    const select = (index) => {
      const result = matches[index];
      if (!result) return;
      input.value = result.title;
      close();
      onSelect?.(result);
    };
    const render = () => {
      const query = input.value.trim().toLowerCase();
      results.innerHTML = "";
      if (query.length < minCharacters) return close();
      matches = source.filter((entry) => searchFields.some((field) => String(entry[field] ?? "").toLowerCase().includes(query))).slice(0, maxResults);
      if (!matches.length) {
        results.innerHTML = '<div class="message empty"><div class="header">No Results</div></div>';
      } else {
        const groups = new Map();
        matches.forEach((entry, index) => {
          const key = entry.category || "";
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push({ entry, index });
        });
        groups.forEach((entries, category) => {
          const group = document.createElement("div");
          group.className = "category";
          if (category) {
            const name = document.createElement("div");
            name.className = "name";
            name.textContent = category;
            group.appendChild(name);
          }
          entries.forEach(({ entry, index }) => {
            const result = document.createElement("a");
            result.className = "result";
            result.dataset.index = String(index);
            const titleElement = document.createElement("div");
            titleElement.className = "title";
            titleElement.textContent = entry.title;
            result.appendChild(titleElement);
            if (entry.description) {
              const description = document.createElement("div");
              description.className = "description";
              description.textContent = entry.description;
              result.appendChild(description);
            }
            result.addEventListener("mousedown", (event) => {
              event.preventDefault();
              select(index);
            });
            group.appendChild(result);
          });
          results.appendChild(group);
        });
      }
      activeIndex = -1;
      results.classList.add("visible");
    };
    const highlight = () => {
      results.querySelectorAll(".result").forEach((element) => element.classList.toggle("active", Number(element.dataset.index) === activeIndex));
      results.querySelector(".result.active")?.scrollIntoView({ block: "nearest" });
    };

    input.addEventListener("input", render);
    input.addEventListener("focus", () => input.value && render());
    input.addEventListener("blur", close);
    input.addEventListener("keydown", (event) => {
      if (!results.classList.contains("visible")) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!matches.length) return;
        activeIndex = (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
        highlight();
      } else if (event.key === "Enter") {
        event.preventDefault();
        select(activeIndex >= 0 ? activeIndex : 0);
      } else if (event.key === "Escape") {
        // only close the result list, not the modal around it
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    });
  });
}

/* ------------------------------------------------------------------ misc */

// fade an element out and remove it (replacement for .fadeOut(...).remove())
function cpihFadeOut(target, duration = 300, remove = true) {
  cpihQsa(target).forEach((element) => {
    element.style.transition = `opacity ${duration}ms`;
    element.style.opacity = "0";
    setTimeout(() => (remove ? element.remove() : (element.style.display = "none")), duration);
  });
}

/* ------------------------------------------------------------------ copy buttons */

// Name/Value tables (trace properties and headers, log viewer, plugin tables) and elements with the class
// cpiHelper_copyable get a small copy button that shows on hover. Tables are recognised by their header row,
// so the builders do not need to know about it. The name column only takes the room its names need.
const CPIH_COPY_BUTTON = '<button type="button" class="cpiHelper_copyCell" title="Copy" aria-label="Copy"><i class="copy outline icon"></i></button>';

function cpihIsKeyValueTable(table) {
  const headers = [...table.querySelectorAll(":scope > thead > tr > th")].map((th) => th.textContent.trim().toLowerCase());
  return headers.length === 2 && ["name", "key", "field name"].includes(headers[0]) && headers[1] === "value";
}

function cpihEnhanceCopyTargets(root) {
  if (!(root instanceof Element)) return;
  const tables = root.matches("table.ui.table") ? [root] : [...root.querySelectorAll("table.ui.table:not(.cpiHelper_kvTable)")];
  tables.forEach((table) => {
    if (table.classList.contains("cpiHelper_kvTable") || !cpihIsKeyValueTable(table)) return;
    table.classList.add("cpiHelper_kvTable");
    table.querySelectorAll(":scope > tbody > tr > td").forEach((cell) => {
      if (cell.colSpan > 1 || cell.querySelector(":scope > .cpiHelper_copyCell")) return;
      // the name gets a wrapper, it may wrap only beyond a maximum width
      if (cell.cellIndex === 0) {
        const name = document.createElement("span");
        name.className = "cpiHelper_kvName";
        name.append(...cell.childNodes);
        cell.appendChild(name);
      }
      cell.insertAdjacentHTML("beforeend", CPIH_COPY_BUTTON);
    });
  });
  const copyables = root.matches(".cpiHelper_copyable") ? [root] : [...root.querySelectorAll(".cpiHelper_copyable")];
  copyables.forEach((element) => {
    if (element.nextElementSibling?.classList.contains("cpiHelper_copyCell")) return;
    element.insertAdjacentHTML("afterend", CPIH_COPY_BUTTON);
  });
}

function cpihCopyText(text) {
  if (typeof copyText === "function") return copyText(text);
  navigator.clipboard.writeText(text).then(() => cpihToast({ message: "Copied to clipboard" }));
}

document.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest(".cpiHelper_copyCell") : null;
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  let text;
  if (button.previousElementSibling?.classList.contains("cpiHelper_copyable")) {
    text = button.previousElementSibling.textContent;
  } else {
    const cell = button.closest("td, th");
    const copy = cell.cloneNode(true);
    copy.querySelectorAll(".cpiHelper_copyCell").forEach((element) => element.remove());
    text = copy.textContent;
  }
  cpihCopyText(text.trim());
});

// popups, tabs and plugin panels render later and lazily, so watch the CPI Helper container
(function watchCopyTargets() {
  let pending = new Set();
  const flush = () => {
    const roots = [...pending];
    pending = new Set();
    roots.forEach((root) => root.isConnected && cpihEnhanceCopyTargets(root));
  };
  const observer = new MutationObserver((mutations) => {
    const wasEmpty = pending.size === 0;
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => node instanceof Element && pending.add(node)));
    if (wasEmpty && pending.size) requestAnimationFrame(flush);
  });
  const attach = () => {
    const root = document.getElementById("cpihelperglobal");
    if (!root) return false;
    observer.observe(root, { childList: true, subtree: true });
    cpihEnhanceCopyTargets(root);
    return true;
  };
  if (!attach()) {
    const retry = setInterval(() => attach() && clearInterval(retry), 1000);
    setTimeout(() => clearInterval(retry), 120000);
  }
})();
