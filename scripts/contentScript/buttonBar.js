// ============================================================================
// CPI Helper — content script · buttonBar
// Extracted from scripts/contentScript.js lines 458-755 during the
// 2026-05-26 contentScript decomposition refactor. Behaviour unchanged.
// ============================================================================

var powertrace = null;
var recrutingTimerSet = false;

// Function to update runtime location dropdown options
function updateRuntimeLocationDropdown(traceDropdownMenu = null) {
  if (!traceDropdownMenu) {
    traceDropdownMenu = document.getElementById("__trace_dropdown_menu");
  }
  if (!traceDropdownMenu) {
    return; // Dropdown not yet created
  }

  // Determine default selection if not set
  let currentSelection = cpiData.runtimeLocationId;

  // Rebuild dropdown items
  let dropdownItems = "";
  if (cpiData.runtimeLocations && cpiData.runtimeLocations.length > 0) {
    cpiData.runtimeLocations.forEach((location) => {
      const isSelected = location.id === currentSelection;
      const isActive = cpiData.runtimeLocationWithActiveIFlow.find((loc) => loc.id === location.id);
      const checkmark = isSelected ? "✓ " : "&nbsp;&nbsp;";
      const bgColor = isSelected && isActive ? "#c8e6c9" : isSelected ? "#e3f2fd" : "";
      dropdownItems += `<div class="__trace_dropdown_item" data-location-id="${location.id}" style="padding: 4px 10px; cursor: pointer; font-size: 13px; background: ${bgColor}; ${isSelected ? "font-weight: bold;" : ""}">${checkmark}${location.id}</div>`;
    });
  } else {
    dropdownItems = `<div class="__trace_dropdown_item" style="padding: 4px 10px; cursor: default; font-size: 13px; color: #888;">No runtime locations</div>`;
  }

  traceDropdownMenu.innerHTML = dropdownItems;
  log.debug("Runtime location dropdown updated");
}

// Make update function globally accessible
cpiData.functions.updateRuntimeLocationDropdown = updateRuntimeLocationDropdown;

async function buildButtonBar() {
  //check if the header object is ready
  let area = document.querySelector("[id*='--iflowObjectPageHeader-actions']");
  if (!area) {
    area = document.querySelector(".sapUxAPObjectPageHeaderIdentifierActions");
  }

  if (!area) {
    log.error("header object not ready");
    return;
  }

  try {
    var headerBar = document.querySelector("[id*='--iflowObjectPageHeader-identifierLine']");
    headerBar.style.overflow = "visible";
  } catch (e) {
    log.error("error when trying to set padding-bottom of headerbar");
  }

  // Load runtime location info before creating dropdown
  await getIflowInfo(null, true, true);

  // get status of powertrace button
  var powertraceText = await refreshPowerTrace();
  if (!document.getElementById("__buttonxx")) {
    whatsNewCheck();

    //timer for recruiting popup in some seconds
    if (recrutingTimerSet == false) {
      setTimeout(() => {
        //     recrutingPopup();
      }, 600000);
      recrutingTimerSet = true;
    }

    // Create More button
    var moreButton = createElementFromHTML(
      `<button id="__more_button" title="More Options" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right; margin-left: 0px;">
        <span class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable">
          <span class="sapMBtnContent">
            <span class="sapUiIcon sapUiIconMirrorInRTL" style="font-family: SAP-icons; font-size: 1rem;">&#xe1e2;</span>
          </span>
        </span>
      </button>`
    );

    // Create More dropdown menu
    var moreDropdownMenu = createElementFromHTML(
      `<div id="__more_dropdown_menu" style="display: none; position: fixed; background: var(--sapGroup_ContentBackground, #fff); border: 1px solid var(--sapList_BorderColor, #ccc); border-radius: 0.25rem; box-shadow: var(--sapContent_Shadow2); min-width: 140px; z-index: 1000;">
          <div class="__more_dropdown_item" id="__more_logs" style="padding: 0.5rem 1rem; cursor: pointer; font-size: 0.875rem; border-bottom: 1px solid var(--sapList_BorderColor, #eee); display: flex; align-items: center; color: var(--sapList_TextColor, #32363a);"><span class="sapUiIcon sapUiIconMirrorInRTL" style="font-family: SAP-icons; font-size: 1rem; margin-right: 0.5rem;">&#xe011;</span>Logs</div>
          <div class="__more_dropdown_item" id="__more_plugins" style="padding: 0.5rem 1rem; cursor: pointer; font-size: 0.875rem; display: flex; align-items: center; color: var(--sapList_TextColor, #32363a);"><span class="sapUiIcon sapUiIconMirrorInRTL" style="font-family: SAP-icons; font-size: 1rem; margin-right: 0.5rem;">&#xe192;</span>Plugins</div>
      </div>`
    );

    // Create trace button
    var tracebutton = createElementFromHTML(
      `<button id="__buttonxx" accesskey="2" data-sap-ui="__buttonxx" title="Enable traces Kbd : 2" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxx-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button134345-content"><bdi id="button134345-BDI-content" class="${powertraceText}">Trace</bdi></span></span></button>`
    );

    var infobutton = createElementFromHTML(
      ' <button id="__buttoninfo" accesskey="4" data-sap-ui="__buttoninfo" title="Info Kbd : 4" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxy-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button13-content"><bdi id="__button134343-BDI-content">Info</bdi></span></span></button>'
    );
    infobutton.addEventListener("click", (btn) => {
      statistic("headerbar_btn_info_click");
      openIflowInfoPopup();
    });

    var runtimeButton;
    var runtimeButtonContainer;
    // Create runtime button container with dropdown
    if (cpiData.runtimeLocations && cpiData.runtimeLocations.length > 1) {
      //cpiData.runtimeLocations.length > 1) {
      runtimeButtonContainer = createElementFromHTML(
        `<div id="__runtime_button_container" style="display: inline-block; float: right; position: relative; margin-left: 10px;">
        <button id="__runtime_button" title="Select Runtime Location" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="margin: 0 !important;">
          <span class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable">
            <span class="sapMBtnContent">
              <bdi>Runtime</bdi>
            </span>
          </span>
        </button>
        <div id="__trace_dropdown_menu" style="display: none; position: absolute; top: 100%; right: 0; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 160px; z-index: 1000; margin-top: 2px;">
        </div>
      </div>`
      );
      runtimeButton = runtimeButtonContainer.querySelector("#__runtime_button");
      // Close dropdown when clicking outside (registered once)
      document.addEventListener("click", (e) => {
        if (!runtimeButtonContainer.contains(e.target)) {
          runtimeButtonContainer.querySelector("#__trace_dropdown_menu").style.display = "none";
        }
        if (!moreButton.contains(e.target) && !moreDropdownMenu.contains(e.target)) {
          moreDropdownMenu.style.display = "none";
        }
      });

      // Handle dropdown item selection (registered once)
      runtimeButtonContainer.querySelector("#__trace_dropdown_menu").addEventListener("click", (e) => {
        const item = e.target.closest(".__trace_dropdown_item");
        if (item) {
          const locationId = item.getAttribute("data-location-id");
          const location = cpiData.runtimeLocations.find((loc) => loc.id === locationId);
          setRuntimeLocation(location || { id: locationId });

          runtimeButtonContainer.querySelector("#__trace_dropdown_menu").style.display = "none";
        }
      });

      runtimeButton.addEventListener("click", async (e) => {
        e.stopPropagation();

        var traceDropdownMenu = runtimeButtonContainer.querySelector("#__trace_dropdown_menu");
        const isVisible = traceDropdownMenu.style.display === "block";

        if (!isVisible) {
          // Update runtime info on click to ensure fresh data
          await getIflowInfo(null, true, false);
          updateRuntimeLocationDropdown();
        }

        traceDropdownMenu.style.display = isVisible ? "none" : "block";
      });
    }

    var logsItem = moreDropdownMenu.querySelector("#__more_logs");
    var pluginsItem = moreDropdownMenu.querySelector("#__more_plugins");

    //Create Toggle Message Bar Button
    var messagebutton = createElementFromHTML(
      ' <button id="__buttonxy" accesskey="3" data-sap-ui="__buttonxy" title="Messages Kbd : 3" class="sapMBtn sapMBtnBase spcHeaderActionButton" style="display: inline-block; float: right;"><span id="__buttonxy-inner" class="sapMBtnHoverable sapMBtnInner sapMBtnText sapMBtnTransparent sapMFocusable"><span class="sapMBtnContent" id="__button13-content"><bdi id="__button18778-BDI-content">Messages</bdi></span></span></button>'
    );

    area.style.textAlign = "right";
    document.querySelector("[id*='--searchStep-I']").accessKey = "s";
    area = document.querySelector("[id*='--iflowObjectPageHeader-actions']");
    if (!area) {
      area = document.querySelector(".sapUxAPObjectPageHeaderIdentifierActions");
    }
    //   area.addEventListener("click", () => {
    //     document.querySelector("[id*='--searchStep-I']").accessKey = "s";
    //   });

    //create div for better alignment of runtime button
    var buttonbarDiv = document.createElement("div");
    // ensure the container sits above other elements and is positioned for its dropdowns
    buttonbarDiv.style.position = "relative";
    buttonbarDiv.style.zIndex = "4";
    buttonbarDiv.style.display = "flex";
    buttonbarDiv.style.flexWrap = "wrap";
    buttonbarDiv.style.justifyContent = "flex-end";

    buttonbarDiv.appendChild(tracebutton);
    buttonbarDiv.appendChild(messagebutton);
    buttonbarDiv.appendChild(infobutton);
    buttonbarDiv.appendChild(moreButton);

    if (runtimeButtonContainer) {
      runtimeButtonContainer.style.flexBasis = "100%";
      buttonbarDiv.appendChild(runtimeButtonContainer);
    }

    area.appendChild(buttonbarDiv);

    // Append dropdown to body to avoid clipping or relative positioning issues
    document.body.appendChild(moreDropdownMenu);

    // Toggle More dropdown
    moreButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = moreDropdownMenu.style.display === "block";

      if (!isVisible) {
        moreDropdownMenu.style.visibility = "hidden";
        moreDropdownMenu.style.display = "block";
        const rect = moreButton.getBoundingClientRect();
        const width = moreDropdownMenu.offsetWidth;
        moreDropdownMenu.style.top = rect.bottom + 2 + "px";
        moreDropdownMenu.style.left = rect.right - width + "px";
        moreDropdownMenu.style.visibility = "visible";
      } else {
        moreDropdownMenu.style.display = "none";
      }
    });

    tracebutton.addEventListener("click", async () => {
      // Validate runtime location availability
      if (!cpiData.runtimeLocationId) {
        showToast("Please select a runtime location first.", "No runtime location selected", "error");
        return;
      }

      const btn = document.getElementById("button134345-BDI-content");
      btn.classList.toggle("cpiHelper_powertrace");
      const objName = `${cpiData.integrationFlowId}_${cpiData.runtimeLocationId}_powertraceLastRefresh`;
      if (btn.classList.contains("cpiHelper_powertrace")) {
        setLogLevel("TRACE", cpiData.integrationFlowId);
        statistic("set_log_level", "TRACE");
        const objectToStore = {};
        objectToStore[objName] = new Date().getTime().toString();
        await storageSetPromise(objectToStore);
        log.log("powertraceLastRefresh saved");
      } else {
        showToast("Trace will not be retriggered anymore.");
        const objectToStore = {};
        objectToStore[objName] = null;
        await storageSetPromise(objectToStore);
        log.log("powertraceLastRefresh Cleared");
      }
    });
    messagebutton.addEventListener("click", (btn) => {
      if (sidebar.active) {
        sidebar.deactivate();
      } else {
        sidebar.init();
        log.debug("headerbar message btn clicked.");
        statistic("headerbar_btn_message_click");
      }
    });

    logsItem.addEventListener("click", async (btn) => {
      statistic("headerbar_btn_logs_click");
      // the logs popup opens and it shows the sidebar. the sidebar elements are updated
      showBigPopup(await createContentNodeForLogs(null, true), "Logs");
      updateArtifactList();
      updateLogList();
      moreDropdownMenu.style.display = "none";
    });

    pluginsItem.addEventListener("click", async (btn) => {
      statistic("headerbar_btn_plugins_click");
      // the logs popup opens and it shows the sidebar. the sidebar elements are updated
      showBigPopup(await createContentNodeForPlugins(), "Plugins");
      moreDropdownMenu.style.display = "none";
    });

    log.debug("Artifect from checks for sidebar", cpiData.currentArtifactType);
    if ((sidebar.active == null || sidebar.active == false) && cpiData.currentArtifactType) {
      chrome.storage.sync.get(["openMessageSidebarOnStartup"], function (result) {
        var openMessageSidebarOnStartupValue;
        // default mode is closed to reduce traffic on backend
        if (result["openMessageSidebarOnStartup"] == undefined || result["openMessageSidebarOnStartup"] == null) {
          chrome.storage.sync.set({
            openMessageSidebarOnStartup: false,
          });
          openMessageSidebarOnStartupValue = false;
        } else {
          openMessageSidebarOnStartupValue = result["openMessageSidebarOnStartup"];
        }

        if (openMessageSidebarOnStartupValue) {
          log.debug("opened sidebar on startup");
          sidebar.init();
        }
      });
    }
  }

  // reapply status of powertrace button (needed after returning from script/message mapping
  await refreshPowerTrace();
}

//Collect Infos to Iflow
