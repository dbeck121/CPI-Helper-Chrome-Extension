// ============================================================================
// CPI Helper — Core UI Layer (vanilla, no jQuery)
// ============================================================================
// Provides the global UI primitives that plugins consume:
//   - showToast(message, title, type)
//   - showBigPopup(content, header, parameters, count, maxcount, type)
//   - showWaitingPopup(content, classname, title, time)
//   - workingIndicator(status)
//   - createTabHTML(objects, idPart, overwriteActivePosition)
//   - showLicensePopup(options)
//   - openIflowInfoPopup()
//   - openTrace(messageGuid)
//
// Modal lifecycle: this module keeps the existing Semantic UI CSS classes
// (.ui.modal.active.visible + .ui.page.dimmer.modals.active.visible) so
// any remaining `$('#x').modal('hide')` calls from plugins still cleanly
// remove the dimmer Semantic UI knows how to look up. We never call into
// Semantic UI's JS or jQuery from this file.
// ============================================================================

// ---- internal modal lifecycle ----------------------------------------------

const _cpiModalState = new WeakMap(); // modal element -> { onHidden, observer }

function _cpiTeardownDimmerIfIdle() {
  if (!document.querySelector(".ui.modal.active.visible")) {
    const dimmer = document.querySelector(".ui.page.dimmer.modals.active.visible");
    if (dimmer) dimmer.remove();
    document.body.classList.remove("blurring", "dimmable", "dimmed");
  }
}

function _cpiCloseModal(modalEl, viaExternalChange = false) {
  if (!modalEl || modalEl._cpiClosing) return;
  modalEl._cpiClosing = true;

  if (!viaExternalChange) {
    modalEl.classList.remove("active", "visible");
    modalEl.style.display = "";
  }

  const state = _cpiModalState.get(modalEl);
  if (state) {
    if (state.observer) state.observer.disconnect();
    _cpiModalState.delete(modalEl);
    if (typeof state.onHidden === "function") {
      try {
        state.onHidden();
      } catch (err) {
        console.error("[CPI Helper] modal onHidden callback failed:", err);
      }
    }
  }

  _cpiTeardownDimmerIfIdle();
  delete modalEl._cpiClosing;
}

let _cpiGlobalListenersBound = false;
function _cpiEnsureGlobalListeners() {
  if (_cpiGlobalListenersBound) return;
  _cpiGlobalListenersBound = true;

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = document.querySelector(".ui.modal.active.visible");
    if (open) _cpiCloseModal(open);
  });

  document.addEventListener("click", (e) => {
    // Click on dimmer closes the topmost open modal
    if (e.target.matches(".ui.page.dimmer.modals.active.visible")) {
      const open = document.querySelector(".ui.modal.active.visible");
      if (open) _cpiCloseModal(open);
      return;
    }
    // Click on the modal's .close.icon
    if (e.target.matches(".ui.modal .close.icon")) {
      const modal = e.target.closest(".ui.modal");
      if (modal) _cpiCloseModal(modal);
    }
  });
}

function _cpiOpenModal(modalEl, options = {}) {
  _cpiEnsureGlobalListeners();

  let dimmer = document.querySelector(".ui.page.dimmer.modals.active.visible");
  if (!dimmer) {
    dimmer = document.createElement("div");
    dimmer.className = "ui page dimmer modals transition visible active";
    document.body.appendChild(dimmer);
  }
  if (options.blurring !== false) {
    document.body.classList.add("blurring", "dimmable", "dimmed");
  }

  modalEl.classList.add("active", "visible");
  modalEl.style.display = "block";

  // Anchor the modal to the top of the viewport with explicit top + max-height
  // bounds rather than transform-centering. The vertical-center approach
  // (top: 50%; translate(-50%, -50%)) is fragile because if the content
  // somehow overrides max-height, the top half of the modal disappears
  // above the screen. Pinning top guarantees the modal is always fully
  // visible regardless of how tall its content tries to be.
  modalEl.style.position = "fixed";
  modalEl.style.zIndex = "1001";
  modalEl.style.display = "flex";
  modalEl.style.flexDirection = "column";
  modalEl.style.left = "50%";
  modalEl.style.transform = "translateX(-50%)";
  modalEl.style.maxWidth = "calc(100vw - 4em)";
  modalEl.style.margin = "0";
  modalEl.style.bottom = "auto";
  modalEl.style.height = "auto";
  if (modalEl.classList.contains("fullscreen")) {
    modalEl.style.top = "1em";
    modalEl.style.maxHeight = "calc(100vh - 2em)";
  } else {
    modalEl.style.top = "3vh";
    modalEl.style.maxHeight = "94vh";
  }
  // Make the scrollable content area actually scroll within the modal
  // (rather than letting the modal box overflow the viewport).
  const scrollingContent = modalEl.querySelector(".scrolling.content");
  if (scrollingContent) {
    scrollingContent.style.flex = "1 1 auto";
    scrollingContent.style.minHeight = "0";
    scrollingContent.style.overflow = "auto";
    scrollingContent.style.maxHeight = "none";
  }

  // Watch for external state changes (e.g., a plugin calling
  // `$('#cpiHelper_semanticui_modal').modal('hide')`).
  const observer = new MutationObserver(() => {
    if (modalEl._cpiClosing) return;
    if (!modalEl.classList.contains("active")) {
      _cpiCloseModal(modalEl, true);
    }
  });
  observer.observe(modalEl, { attributes: true, attributeFilter: ["class"] });

  _cpiModalState.set(modalEl, { onHidden: options.onHidden, observer });

  if (typeof options.onShow === "function") {
    try {
      options.onShow();
    } catch (err) {
      console.error("[CPI Helper] modal onShow callback failed:", err);
    }
  }
}

// ---- working indicator -----------------------------------------------------

function workingIndicator(status) {
  let icon = document.getElementById("cpiHelper_workingIndicator");
  if (!icon) {
    icon = createElementFromHTML(`<i id='cpiHelper_workingIndicator' class='sync alternate loading icon' hidden></i>`);
    body().appendChild(icon);
  }
  if (status) {
    icon.removeAttribute("hidden");
  } else {
    icon.setAttribute("hidden", "");
  }
}

// ---- toast -----------------------------------------------------------------

function _cpiEnsureToastContainer() {
  let container = document.getElementById("cpiHelper_toast_container");
  if (!container) {
    container = document.createElement("div");
    container.id = "cpiHelper_toast_container";
    container.style.cssText = [
      "position: fixed",
      "bottom: 1.5em",
      "left: 50%",
      "transform: translateX(-50%)",
      "z-index: 10000",
      "display: flex",
      "flex-direction: column-reverse",
      "gap: 0.5em",
      "pointer-events: none",
      "max-width: min(560px, 90vw)",
    ].join("; ");
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, title, type = "") {
  const isDark = document.documentElement.classList.contains("sapUiTheme-sap_horizon_dark");
  const container = _cpiEnsureToastContainer();

  const toast = document.createElement("div");
  const typeClasses = type ? type.trim().split(/\s+/).join(" ") : "";
  toast.className = `ui floating toast ${typeClasses} ${isDark ? "ch_dark" : ""}`.trim();
  toast.style.cssText = "pointer-events: auto; transition: opacity 250ms ease-out;";

  const content = document.createElement("div");
  content.className = "content";
  if (title) {
    const headerEl = document.createElement("div");
    headerEl.className = "header";
    headerEl.textContent = title;
    content.appendChild(headerEl);
  }
  const messageEl = document.createElement("div");
  messageEl.className = "message";
  messageEl.textContent = message != null ? String(message) : "";
  content.appendChild(messageEl);
  toast.appendChild(content);

  const progress = document.createElement("div");
  progress.className = "ui bottom attached active progress";
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.style.cssText = "width: 100%; transition: width 3s linear;";
  progress.appendChild(bar);
  toast.appendChild(progress);

  // newestOnTop: prepend
  container.prepend(toast);

  // Trigger progress animation on next frame
  requestAnimationFrame(() => {
    bar.style.width = "0%";
  });

  // Dismiss on click
  toast.addEventListener("click", () => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 250);
  });

  // Auto-dismiss after 3s
  setTimeout(() => {
    if (!toast.isConnected) return;
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// ---- waiting popup ---------------------------------------------------------

function showWaitingPopup(content = undefined, classname = "small", title = "CPI Helper Is thinking", time = undefined) {
  const modal = document.getElementById("cpiHelper_waiting_model");
  if (!modal) return;

  modal.innerHTML = `
      <div class="ui positive icon message">
        <i class="sync alternate loading icon"></i>
        <div class="content">
          <div class="header">${title}</div>
          <p>${content || `Please Wait while we fetch content for you.`}</p>
        </div>
    </div>`;
  modal.className = `cpiHelper ui modal ${classname || ""}`.trim();

  _cpiOpenModal(modal, { blurring: true });

  if (time) {
    setTimeout(() => _cpiCloseModal(modal), time);
  }
}

// ---- big popup -------------------------------------------------------------

async function showBigPopup(
  content,
  header,
  parameters = {
    fullscreen: true,
    iconInButton: "",
    iconType: "",
    large: false,
    callback: null,
    closeText: "Close",
    onclose: () => {
      const waiting = document.getElementById("cpiHelper_waiting_model");
      const big = document.getElementById("cpiHelper_semanticui_modal");
      if (waiting) _cpiCloseModal(waiting);
      if (big) _cpiCloseModal(big);
    },
  },
  count = 0,
  maxcount = 0,
  type = "mouse"
) {
  const buttonParameters = ["deny", "ui", "button"];
  let icon = "";
  if (parameters.iconInButton) {
    icon = `<i class="${parameters.iconInButton} icon"></i>`;
  }
  if (parameters.iconType) {
    buttonParameters.push(parameters.iconType);
  }
  if (!parameters.closeText) parameters.closeText = "Close";

  // Hide whatever is currently showing
  const waiting = document.getElementById("cpiHelper_waiting_model");
  if (waiting && waiting.classList.contains("active")) _cpiCloseModal(waiting);
  const modal = document.getElementById("cpiHelper_semanticui_modal");
  if (!modal) {
    showToast("", "Element is missing.. Reload the page", "error");
    return;
  }
  if (modal.classList.contains("active")) _cpiCloseModal(modal);

  modal.className = "cpiHelper ui modal";
  if (parameters.large) modal.classList.add("large");
  if (parameters.fullscreen) modal.classList.add("fullscreen");

  modal.innerHTML = `
        <i class="close icon" style="color:var(--cpi-text-color)"></i>
        <div class="header" maxcount="${maxcount}" count="${count}">
          CPI Helper ${header ? "- " + header : ""}
        </div>
        <div class="scrolling content">
          <div class="description" id="cpiHelper_bigPopup_content_semanticui" style="min-height: 50vh; transition: all 100ms ease-in-out;">
            <div class="ui active inverted dimmer">
              <div class="ui loader"></div>
            </div>
          </div>
        </div>
        <div class="actions">
          ${maxcount && count ? '<div class="ui negative animated button"><div class="visible content">Prev</div><div class="hidden content"><i class="angle double left icon"></i></div></div>' : ""}
          ${maxcount && count !== maxcount - 1 ? '<div class="ui positive animated button"><div class="visible content">Next</div><div class="hidden content"><i class="angle double right icon"></i></div></div>' : ""}
          <div class="${buttonParameters.join(" ")}">${icon}${parameters.closeText}</div>
        </div>
      `;

  // Close button (.deny) — Semantic UI auto-bound this; we have to wire it ourselves.
  const denyBtn = modal.querySelector(".actions .deny");
  if (denyBtn) {
    denyBtn.addEventListener("click", () => _cpiCloseModal(modal));
  }

  if (maxcount > 0) {
    ["negative", "positive"].forEach((cls, index) => {
      const button = modal.querySelector(`.${cls}`);
      if (!button) return;
      button.addEventListener("click", () => {
        const headerEl = modal.querySelector(".header");
        const currentCount = headerEl ? headerEl.getAttribute("count") : "0";

        const sortedArray = Array.from(document.querySelectorAll(".cpiHelper_onclick[inline_cpi_child]"))
          .map((e) => parseInt(e.getAttribute("inline_cpi_child"), 10))
          .sort((a, b) => a - b);

        console.log(sortedArray, currentCount, sortedArray[currentCount], index === 0 ? "previous" : "next");

        if (sortedArray[currentCount]) {
          const element = findNearest(sortedArray, sortedArray[currentCount], index === 0 ? "previous" : "next");
          const target = document.querySelector(`[inline_cpi_child='${element}'] .cpiHelper_inlineInfo`);
          if (target) target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          showToast(`${index ? "Next" : "Previous"} Step ${element} will be displayed shortly`);
          _cpiCloseModal(modal);
          showWaitingPopup();
        } else {
          showToast(`${index ? "Next" : "Previous"} Step is not found`, "something went wrong", "error");
        }
      });
    });
  }

  const infoContent = modal.querySelector("#cpiHelper_bigPopup_content_semanticui");

  if (typeof content === "string") {
    infoContent.innerHTML = content;
  } else if (typeof content === "function") {
    const result = await content();
    infoContent.replaceChildren();
    if (result instanceof Node) {
      infoContent.appendChild(result);
    } else if (typeof result === "string") {
      infoContent.innerHTML = result;
    }
  } else if (content && typeof content === "object") {
    infoContent.replaceChildren();
    if (content instanceof Node) {
      infoContent.appendChild(content);
    }
  }

  if (parameters.callback) {
    parameters.callback();
  }

  _cpiOpenModal(modal, {
    blurring: true,
    onShow: () => {
      // Re-anchor: if anything detached the modal from #cpihelperglobal, put it back.
      const globalEl = document.getElementById("cpihelperglobal");
      if (globalEl && modal.parentElement !== globalEl) {
        globalEl.appendChild(modal);
      }
    },
    onHidden: () => {
      if (parameters.onclose instanceof Function) parameters.onclose();
    },
  });
}

// ---- tabs (already vanilla in the original) --------------------------------

async function createTabHTML(objects, idPart, overwriteActivePosition) {
  return new Promise(async (resolve, reject) => {
    /*
      {label:"Hallo",
       content: "",
       active}
    }
    */

    const html = document.createElement("div");
    html.classList.add("cpiHelper_tabs");

    let checked = 'checked=""';
    for (let i = 0; i < objects.length; i++) {
      checked = "";
      if ((overwriteActivePosition != null && overwriteActivePosition == i) || (overwriteActivePosition != null && overwriteActivePosition == objects[i].label) || (overwriteActivePosition == null && objects[i].active)) {
        checked = 'checked="checked"';
      }

      const input = createElementFromHTML(`<input name="tabs-${idPart}" type="radio" id="tab-${idPart}-${i}" ${checked} class="cpiHelper_tabs_input"/>`);

      if (typeof objects[i].content == "function") {
        input.onclick = async (event) => {
          let contentElement = document.getElementById(idPart + "-" + i + "-content");
          if (contentElement.innerHTML == '<div class="cpiHelper_infoPopUp_content">Please Wait...</div>') {
            let contentResponse = await objects[i].content(objects[i]);
            if (typeof contentResponse == "object") {
              contentElement.innerHTML = "";
              contentElement.appendChild(contentResponse);
            }
            if (typeof contentResponse == "string") {
              contentElement.innerHTML = contentResponse;
            }
            if (typeof contentResponse == "function") {
              contentElement.innerHTML = contentResponse(objects[i]);
            }
          }
        };
      }

      const label = createElementFromHTML(`<label for="tab-${idPart}-${i}" class="cpiHelper_tabs_label">${objects[i].label}</label>`);

      const content = createElementFromHTML(` <div id="${idPart}-${i}-content" class="cpiHelper_tabs_panel"></div>`);

      if (typeof objects[i].content == "string") {
        content.innerHTML = objects[i].content;
      }

      if (typeof objects[i].content == "object") {
        content.appendChild(objects[i].content);
      }

      if (typeof objects[i].content == "function") {
        content.innerHTML = '<div class="cpiHelper_infoPopUp_content">Please Wait...</div>';
        if (objects[i].active) {
          let contentResponse = await objects[i].content(objects[i]);
          if (typeof contentResponse == "object") {
            content.innerHTML = "";
            content.appendChild(contentResponse);
          }
          if (typeof contentResponse == "string") {
            content.innerHTML = contentResponse;
          }
          if (typeof contentResponse == "function") {
            content.innerHTML = contentResponse(objects[i]);
          }
        }
      }

      html.appendChild(input);
      html.appendChild(label);
      html.appendChild(content);
    }

    return resolve(html);
  });
}

// ---- license popup ---------------------------------------------------------

async function showLicensePopup(options = {}) {
  const licenseUrl = chrome.runtime.getURL("docs/LICENSE");
  let licenseText = "";
  try {
    const response = await fetch(licenseUrl);
    licenseText = await response.text();
  } catch (e) {
    licenseText = "Could not load license text. Please visit: https://www.gnu.org/licenses/gpl-3.0.en.html";
  }

  const licenseContent = `
    <div class="ui segment">
      <h3 class="ui header">
        <i class="legal icon"></i>
        <div class="content">
          GNU General Public License v3
        </div>
      </h3>
      <div style="margin-top: 0.1rem; margin-bottom: 1rem;">
        This extension is free and open-source software licensed under the GNU GPL v3.
        <br><br>
        <strong>By using this extension, you agree to the terms and conditions of this license.</strong>
      </div>
      <div class="ui segment" style="max-height: 400px; overflow-y: auto; font-family: monospace; white-space: pre-wrap; font-size: 0.9em;">
${licenseText}
      </div>
    </div>
  `;

  showBigPopup(licenseContent, "License Agreement - GNU GPL v3", {
    fullscreen: false,
    closeText: "I Agree",
    iconInButton: "checkmark",
    iconType: "positive",
    ...options,
  });
}

// ---- iflow info popup ------------------------------------------------------

async function openIflowInfoPopup() {
  async function getInfoContent() {
    await getIflowInfo(null, false, false);
    await getIflowInfoExtended();

    var x = document.createElement("div");
    x.classList.add("cpiHelper_infoPopUp_content");
    x.innerHTML = "";

    var deployedOn = cpiData?.flowData?.artifactInformation?.deployedOn;
    if (deployedOn) {
      let date = new Date(deployedOn);
      date.setTime(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
      deployedOn = date.toLocaleString();
    }

    var textElement = `
      <h4 class="ui horizontal divider left aligned header">
        <i class="info icon"></i>
        iFlow Info
      </h4>
      `;
    x.appendChild(createElementFromHTML(textElement));
    textElement = `<div class="cpiHelper_infoPopUp_items">
      <div>Name: ${cpiData?.flowData?.artifactInformation?.name}</div>
      <div>Runtime: ${cpiData.runtimeLocationId}</div>
      <div>SymbolicName: ${cpiData?.flowData?.artifactInformation?.symbolicName}</div>
      <div>DeploymentState: ${cpiData?.flowData?.artifactInformation?.deployState}</div>
      ${
        cpiData?.flowData?.artifactInformation?.deployState !== "UNDEPLOYED"
          ? `
      <div>Trace: ${cpiData?.flowData?.logConfiguration?.traceActive}</div>
      <div>DeployedVersion: ${cpiData?.flowData?.artifactInformation?.version}</div>
      <div>DeployedOn: ${deployedOn}</div>
      <div>SemanticState: ${cpiData?.flowData?.artifactInformation?.semanticState}</div>
      <div>DeployedBy: ${cpiData?.flowData?.artifactInformation?.deployedBy}</div>
      `
          : ""
      }
    </div>`;

    x.appendChild(createElementFromHTML(textElement));

    if (cpiData?.flowData?.endpointInformation && cpiData?.flowData?.endpointInformation.length > 0) {
      cpiData.flowData.endpointInformation.forEach((element) => {
        if (element.endpointInstances && element.endpointInstances.length > 0) {
          var e = document.createElement("div");
          e.classList.add("cpiHelper_infoPopUp_items");
          e.innerHTML = `<div>Endpoints:</div>`;
          x.appendChild(e);
          for (var i = 0; i < element.endpointInstances.length; i++) {
            let f = document.createElement("div");
            f.className = "contentText";
            f.innerText = `${element.endpointInstances[i]?.endpointCategory}: ${element.endpointInstances[i]?.endpointUrl}`;
            var quickCopyToClipboardButton = createElementFromHTML(
              "<button class='cpiHelper_inlineInfo-button' ><span data-sap-ui-icon-content='' data-text='" +
                `${element.endpointInstances[i]?.endpointUrl}` +
                "' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>"
            );
            quickCopyToClipboardButton.onclick = (event) => {
              copyText(event.srcElement.getAttribute("data-text"));
            };
            f.appendChild(quickCopyToClipboardButton);
            e.appendChild(f);
          }
        }
      });
    }

    async function createTableForVariables() {
      var variableList = await makeCallPromise(
        "GET",
        "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.ListDataStoreEntriesCommand?storeName=sap_global_store&allStores=true&maxNum=100000",
        false,
        "application/json",
        null,
        false
      );

      variableList = JSON.parse(variableList).entries;

      if (variableList == null || variableList.length == 0) {
        return document.createElement("div");
      }

      variableList = variableList.filter((element) => !element.qualifier || element.qualifier == cpiData?.flowData?.artifactInformation?.symbolicName);

      if (variableList == null || variableList.length == 0) {
        return document.createElement("div");
      }

      var result = document.createElement("table");
      result.classList.add("cpiHelper_infoPopUp_Table");

      const tr0 = document.createElement("tr");
      const tr0th1 = document.createElement("th");
      tr0th1.innerText = "Store";
      const tr0th2 = document.createElement("th");
      tr0th2.innerText = "Name";
      tr0th2.style.width = "100%";

      tr0.appendChild(document.createElement("td"));
      tr0.appendChild(tr0th1);
      tr0.appendChild(tr0th2);
      result.appendChild(tr0);

      var even = "";
      variableList.forEach((item) => {
        let tr = document.createElement("tr");
        tr.id = item.id + item.storeName;
        tr.className = even;

        let tdfunctions = document.createElement("td");
        tdfunctions.style.whiteSpace = "nowrap";

        let showButton = createElementFromHTML("<button><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");

        tdfunctions.appendChild(showButton);

        let downloadButton = createElementFromHTML("<button><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");
        tdfunctions.appendChild(downloadButton);

        let deleteButton = createElementFromHTML("<button><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");
        tdfunctions.appendChild(deleteButton);

        tr.appendChild(tdfunctions);

        let td1 = document.createElement("td");
        td1.innerText = item.qualifier == null ? "global" : "local";
        tr.appendChild(td1);

        let td2 = document.createElement("td");
        td2.innerText = item.id;
        tr.appendChild(td2);

        downloadButton.onclick = async (element) => {
          let payload = { storeName: item.storeName, id: item.id };
          if (item.qualifier) {
            payload.qualifier = item.qualifier;
          }
          var response = await makeCallPromise("POST", "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStorePayloadCommand", false, "", JSON.stringify(payload), true, "application/json;charset=UTF-8");
          var value = response.match(/<payload>(.*)<\/payload>/gs)[0];
          value = value.substring(9, value.length - 10);

          window.open("data:application/zip;base64," + value);
        };

        showButton.onclick = async (element) => {
          const text = document.getElementById(item.id + item.storeName + "_value");

          if (text.classList.contains("cpiHelper_infoPopUp_TR_hide")) {
            try {
              let payload = {
                storeName: item.storeName,
                id: item.id,
              };
              if (item.qualifier) {
                payload.qualifier = item.qualifier;
              }

              var response = await makeCallPromise(
                "POST",
                "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStoreVariableCommand",
                false,
                "",
                JSON.stringify(payload),
                true,
                "application/json;charset=UTF-8"
              );
              var value = response.match(/<value>(.*)<\/value>/gs)[0];

              var agressiveMode = false;
              if (!value) {
                aggressiveMode = true;
                function base64ToBuffer(str) {
                  str = window.atob(str);
                  var buffer = new ArrayBuffer(str.length),
                    view = new Uint8Array(buffer);
                  for (var i = 0; i < str.length; i++) {
                    view[i] = str.charCodeAt(i);
                  }
                  return buffer;
                }

                var response = await makeCallPromise(
                  "POST",
                  "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStorePayloadCommand",
                  false,
                  "",
                  JSON.stringify(payload),
                  true,
                  "application/json;charset=UTF-8"
                );
                var base = response.match(/<payload>(.*)<\/payload>/gs)[0];
                base = base.substring(9, base.length - 10);

                var new_zip = new JSZip();
                await new_zip.loadAsync(base64ToBuffer(base));

                value = await new_zip.files[Object.keys(new_zip.files)[0]].async("string");
              } else {
                value = atob(value.substring(7, value.length - 8));
              }

              let valueTd = document.createElement("td");
              valueTd.colSpan = 4;

              valueTd.innerText = value;
              text.innerHTML = "";
              text.appendChild(valueTd);
              if (agressiveMode) {
                showToast("Aggressive mode was used to show variable");
              }

              text.classList.remove("cpiHelper_infoPopUp_TR_hide");
            } catch (error) {
              showToast("It was not possible to extract the data.", "Please download and try manually.");
            }
          } else {
            text.classList.add("cpiHelper_infoPopUp_TR_hide");
            text.innerHTML = "<td colspan=4>Please wait...</td>";
          }
        };

        deleteButton.onclick = async (element) => {
          var doDelete = getConfirmation(`Do you really want to delete variable \"${item.id}\"? You can not undo this.`);
          if (doDelete) {
            try {
              let payload = {
                storeName: item.storeName,
                ids: [item.id],
              };
              if (item.qualifier) {
                payload.qualifier = item.qualifier;
              }
              var response = await makeCallPromise(
                "POST",
                "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.DeleteDataStoreEntryCommand",
                false,
                "",
                JSON.stringify(payload),
                true,
                "application/json;charset=UTF-8"
              );
              showToast("Variable deleted.");
              let cpiHelper_infoPopUp_Variables = document.getElementById("cpiHelper_infoPopUp_Variables");

              cpiHelper_infoPopUp_Variables.appendChild(await createTableForVariables());
              cpiHelper_infoPopUp_Variables.children[0].remove();
            } catch (err) {
              showToast("Do you have sufficient rights?", "Can not delete variable", "error");
            }
          }
        };

        let trShowButton = document.createElement("tr");
        trShowButton.className = even;
        trShowButton.classList.add("cpiHelper_infoPopUp_TR_hide");
        trShowButton.id = item.id + item.storeName + "_value";
        trShowButton.innerHTML = "<td colspan=4>Please wait...</td>";

        result.appendChild(tr);
        result.appendChild(trShowButton);

        even = even == "even" ? "" : "even";
      });

      return result;
    }
    try {
      var variablesDiv = document.createElement("div");
      variablesDiv.id = "cpiHelper_infoPopUp_Variables";
      variablesDiv.classList.add("cpiHelper_infoPopUp_items");
      variablesDiv.appendChild(await createTableForVariables());
      x.appendChild(variablesDiv);
    } catch (error) {
      log.error("Error creating variable table: ", error);
    }

    if (deployedOn) {
      var undeploybutton = document.createElement("button");
      undeploybutton.classList.add("ui");
      undeploybutton.classList.add("button");

      undeploybutton.innerText = "Undeploy this IFlow";
      undeploybutton.id = "undeploybutton";
      undeploybutton.addEventListener("click", (a) => {
        undeploy(cpiData?.flowData?.artifactInformation?.tenantId, cpiData?.flowData?.artifactInformation?.id);
      });
      x.appendChild(undeploybutton);
    }
    var textElement2 = `
<h4 class="ui horizontal divider left aligned header">
  <i class="envelope icon"></i>
  News
</h4>
`;
    x.appendChild(createElementFromHTML(textElement2));
    textElement2 = `<div class="cpiHelper_infoPopUp_items">

  <p>For news and interesting blog posts about SAP CI, <b>please follow our company <a href="https://www.linkedin.com/company/kangoolutions" target="_blank">LinkedIn-Page</a></b>.</p>
  <div><p>We are a bunch of passionate SAP CI developers from Cologne, Germany. If you want to work with us then you can reach us through our website <a href="https://kangoolutions.com" target="_blank">kangoolutions.com</a>. Or maybe you want to become part of the team? Then have a look <a href="https://ich-will-zur.kangoolutions.com/" target="_blank">here</a> (German only). Unfortunately, we can only consider applicants with german residence due to legal reasons.</p></div>
  <h4 class="ui horizontal divider left aligned header">
  <i class="envelope icon"></i>
  General Information
</h4>
  <div>Created by: Dominic Beckbauer and Kangoolutions.com</div>
  <div>License: <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">GNU GPL v3</a></div>
  <div>Please also check our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">Github
  Page</a>.</div>
  </div>`;

    x.appendChild(createElementFromHTML(textElement2));

    var whatsNewButton = document.createElement("button");
    whatsNewButton.classList.add("ui");
    whatsNewButton.classList.add("button");

    whatsNewButton.innerText = "Whats New?";
    whatsNewButton.addEventListener("click", (a) => {
      whatsNewCheck(false);
      const m = document.getElementById("cpiHelper_semanticui_modal");
      if (m) _cpiOpenModal(m, { blurring: true });
      statistic("info_popup_whatsnew_click");
    });
    x.appendChild(whatsNewButton);

    var licenseButton = document.createElement("button");
    licenseButton.classList.add("ui");
    licenseButton.classList.add("button");
    licenseButton.innerText = "License (GNU GPL v3)";
    licenseButton.addEventListener("click", async (a) => {
      await showLicensePopup();
      statistic("info_popup_license_click");
    });
    x.appendChild(licenseButton);

    var recrutingButton = document.createElement("button");
    recrutingButton.classList.add("ui");
    recrutingButton.classList.add("button");

    var lang = navigator.language || navigator.userLanguage;

    if (lang == "de-DE") {
      recrutingButton.innerText = "Werde Berater bei Kangoolutions";
      recrutingButton.addEventListener("click", (a) => {
        recrutingPopup(true);
        const m = document.getElementById("cpiHelper_semanticui_modal");
        if (m) _cpiOpenModal(m, { blurring: true });
        statistic("info_popup_recruting_click");
      });
      x.appendChild(recrutingButton);
    }
    return x;
  }

  showBigPopup(getInfoContent, "General Information", { fullscreen: false });
}

// ---- open trace (already vanilla) ------------------------------------------

function openTrace(MessageGuid) {
  log.debug("MessageGuid");
  makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogs('" + MessageGuid + "')/Runs?$format=json", false)
    .then((responseText) => {
      var resp = JSON.parse(responseText);
      var status = resp.d.results[0].OverallState;
      if (resp.d.results.length > 1 && status != "COMPLETED") {
        var runId = resp.d.results[1].Id;
      } else {
        var runId = resp.d.results[0].Id;
      }

      let url = "/" + cpiData.urlExtension + "shell/monitoring/MessageProcessingRun/" + encodeURIComponent(JSON.stringify({ edge: { runtimeLocationId: cpiData.runtimeLocationId }, messageProcessingLog: MessageGuid, RunId: runId }));
      window.open(url, "_blank");
    })
    .catch((e) => {
      log.error("Error while opening Trace: " + e);
    });
}

// ---- compatibility shim for the modal hide() pattern used by plugins -------
// Many plugins call `$('#cpiHelper_semanticui_modal').modal('hide')` directly.
// jQuery + Semantic UI are still loaded in this phase, so those calls keep
// working untouched. The MutationObserver registered in _cpiOpenModal will
// pick up the resulting class change and run any onHidden callback the core
// passed in.
