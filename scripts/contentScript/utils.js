// ============================================================================
// CPI Helper — content script · utils
// Extracted from scripts/contentScript.js lines 1249-1610 during the
// 2026-05-26 contentScript decomposition refactor. Behaviour unchanged.
// ============================================================================

function copyText(input) {
  navigator.clipboard.writeText(input).then(
    function () {
      showToast("Copied to clipboard");
      log.log("Async: Copying to clipboard was successful!");
    },
    function (err) {
      log.error("Async: Could not copy text: ", err);
    }
  );
}

function getConfirmation(message) {
  var retVal = confirm(message);
  if (retVal == true) {
    return true;
  } else {
    return false;
  }
}

//the sidebar that shows messages
var sidebar = {
  //indicator if active or not
  active: null,
  //function to deactivate the sidebar
  deactivate: function () {
    this.active = false;
    clearTimeout(getLogsTimer);
    document.getElementById("cpiHelper_content").remove();
  },

  //function to create and initialise the message sidebar
  init: function () {
    if (this.active == true) {
      return;
    }

    this.active = true;
    var elem = document.createElement("div");
    elem.innerHTML = `
    <div id="cpiHelper_contentheader" style="color:var(--cpi-text-color)" content="${hostData.count}" >
      <span id='sidebar_modal_minimize' class='cpiHelper_closeButton_sidebar'>CPI Helper</span>
      <span id='sidebar_modal_close' data-sap-ui-icon-content="&#xe03e" class='cpiHelper_closeButton_sidebar sapUiIcon sapUiIconMirrorInRTL' style='font-size: 1.2rem;padding-inline-start: 1rem;font-family: SAP-icons'></span>
    </div>
    <div id="outerFrame" >
      <div>
        <div style="padding-left:0px" id="updatedText" class="contentText">
        <span id="cpiHelper_sidebar_refresh_text" style="padding-left: 0px; padding-top: 0px;">
    </span>
    <button id="cpiHelper_sidebar_refresh_icon" title="Refresh" style="background:none;border:none;cursor:pointer;vertical-align:middle;margin-left:0.5em;">
      <i class="sync alternate icon"></i>
    </button>
        </div>
        <div style="padding-left:0px; padding-top:0px" id="deploymentText" class="contentText"></div>
        <div><table id="messageList" class="contentText"></table></div>
      </div>
    </div>
    <div id="cpiHelper_messageSidebar_pluginArea" class="ui vertical fluid menu cpiHelper_hidden" style="color:#000"> 
      <div class="ui centered header cpiHelper_hidden">
      <div class="content">Plugin Page</div>
      <span data-sap-ui-icon-content="&#xe03e" class='cpiHelper_closeButton_sidebar sapUiIcon sapUiIconMirrorInRTL' style='font-size: 1.2rem;padding-inline-start: 1rem;font-family: SAP-icons'></span>
    </div>
    `;
    elem.id = "cpiHelper_content";
    elem.classList.add("cpiHelper");
    elem.setAttribute("hidden", true);
    elem.style = "width:max-content;min-width: 14rem";
    body().appendChild(elem);
    elem.style = "width:max-content;min-width: 14rem";
    // set inital parameters.
    chrome.storage.sync.get(["set_ch_popup_mouse"], function (result) {
      popuparea = document.querySelector("#cpiHelper_content");
      if (result["set_ch_popup_mouse"]) {
        popuparea.style.left = result["set_ch_popup_mouse"].left;
        popuparea.style.top = result["set_ch_popup_mouse"].top;
      }
    });
    //plugin area setup popup+join mode
    chrome.storage.sync.get(["openSidebarOnStartup"], function (result) {
      pluginarea = document.querySelector("#cpiHelper_messageSidebar_pluginArea");
      if (result["openSidebarOnStartup"]) {
        pluginarea.classList.add("sidebar");
        pluginarea.classList.toggle("fluid");
        document.querySelector("#cpiHelper_messageSidebar_pluginArea span").addEventListener("click", () => {
          pluginarea.classList.toggle("fluid");
          twoClasssToggleSwitch(pluginarea, "visible", "cpiHelper_hidden");
          twoClasssToggleSwitch(document.querySelector("#sidebar_Plugin"), "plus", "minus");
        });
      }
    });
    //add minimize button on CPI helper title & color match with tenant color
    var span = document.getElementById("sidebar_modal_minimize");
    var content_header = document.getElementById("cpiHelper_contentheader");
    var outerFrame_element = document.getElementById("outerFrame");
    var borderofouterFrame = getComputedStyle(outerFrame_element).borderRadius.split(" ");
    span.onclick = () => {
      if (outerFrame_element.offsetHeight > 0) {
        content_header.style["min-width"] = getComputedStyle(outerFrame_element).width;
        outerFrame_element.style.display = "none";
        content_header.style["border-bottom-left-radius"] = borderofouterFrame[2];
        content_header.style["border-bottom-right-radius"] = borderofouterFrame[3];
      } else {
        outerFrame_element.style.display = "block";
        content_header.style["border-bottom-left-radius"] = borderofouterFrame[0];
        content_header.style["border-bottom-right-radius"] = borderofouterFrame[1];
      }
    };

    //add close button
    var span = document.getElementById("sidebar_modal_close");
    span.onclick = (element) => {
      sidebar.deactivate();
    };

    //activate dragging for message bar
    dragElement(document.getElementById("cpiHelper_content"));

    //lastMessageHashList must be empty when message sidebar is created
    cpiData.messageSidebar.lastMessageHashList = [];
    setTimeout(() => document.getElementById("cpiHelper_content").removeAttribute("hidden"), 200);
    //refresh messages
    messageSidebarPluginContent(true);
    refreshActive = true;
    renderMessageSidebar()
      .then(() => {
        refreshActive = false;
      })
      .catch(() => {
        refreshActive = false;
      });
  },
};

//function that handles the dragging
function dragElement(elmnt) {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  if (document.getElementById(elmnt.id + "header")) {
    /* if present, the header is where you move the DIV from:*/
    document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
  } else {
    /* otherwise, move the DIV from anywhere inside the DIV:*/
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  let debounceTimeout;
  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // calculate the new top and left positions
    newtop = elmnt.offsetTop - pos2;
    newleft = elmnt.offsetLeft - pos1;
    maxheight = window.innerHeight - document.getElementById("cpiHelper_contentheader").offsetHeight;
    maxwidth = window.innerWidth - document.getElementById("cpiHelper_contentheader").offsetWidth;
    // bounding position based on max top and width. making position relative in case of resize.
    let mouse_top = (elmnt.style.top = ((newtop < 0 || newtop >= maxheight ? (newtop < 0 ? 0 : newtop >= maxheight ? maxheight : newtop) : newtop) * 100) / window.innerHeight + "%");
    let mouse_left = (elmnt.style.left = ((newleft < 0 || newleft >= maxwidth ? (newleft < 0 ? 0 : newleft >= maxwidth ? maxwidth : newleft) : newleft) * 100) / window.innerWidth + "%");
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      syncChromeStoragePromise("set_ch_popup_mouse", {
        top: mouse_top,
        left: mouse_left,
      });
      log.log("popup location is stored!!");
    }, 3000);
  }

  function closeDragElement() {
    /* stop moving when mouse button is released:*/
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function injectCss(cssStyle, id, className) {
  var style = document.createElement("style");
  style.type = "text/css";
  style.appendChild(document.createTextNode(cssStyle));
  id && (style.id = id);
  className && style.classList.add(className);
  document.getElementsByTagName("head")[0].appendChild(style);
}

function removeElementsWithId(name) {
  document.getElementById(name).remove();
  return true;
}

function removeElementsWithClass(classToDelete) {
  let elements = document.getElementsByClassName(classToDelete);
  for (let i = elements.length - 1; i >= 0; i--) {
    elements[i].remove(element);
  }
  return true;
}
function formatDuration(durationMs) {
  const h = Math.floor(durationMs / (1000 * 60 * 60)) % 24;
  const m = Math.floor(durationMs / (1000 * 60)) % 60;
  const s = Math.floor(durationMs / 1000) % 60;
  const ms = durationMs % 1000;

  return `${h ? h + "h " : ""}${m ? m + "m " : ""}${s ? s + "s " : ""}${ms}ms`.trim();
}

async function errorPopupOpen(MessageGuid) {
  var resp = await getMessageProcessingLogRuns(MessageGuid, false);

  var customHeaders = await makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogs('" + MessageGuid + "')?$format=json&$expand=CustomHeaderProperties", false);
  customHeaders = JSON.parse(customHeaders).d;

  //Duration
  var stepStart = new Date(parseInt(customHeaders.LogStart.substr(6, 13)));
  stepStart.setTime(stepStart.getTime() - stepStart.getTimezoneOffset() * 60 * 1000);
  var stepStop = new Date(parseInt(customHeaders.LogEnd.substr(6, 13)));
  stepStop.setTime(stepStop.getTime() - stepStop.getTimezoneOffset() * 60 * 1000);

  //custom Headers and Properties
  propertyArray = [];
  customHeaders?.CustomHeaderProperties?.results.forEach((element) => propertyArray.push(element?.Name + ": " + element?.Value?.substr(0, 150)));
  // Error Collect
  errorDetails = [];
  if (resp != null || resp.length != 0) {
    let error = false;
    for (var i = 0; i < resp.length; i++) {
      if (resp[i].Error) {
        error = true;
        let logtext = resp[i].Error;
        let explain = lookupError(resp[i].Error);
        if (explain) {
          logtext += "<br>Possible explanation: " + explain;
        }
        errorDetails.push(logtext);
      }
    }
  }
  return {
    status: customHeaders.Status,
    customstatus: customHeaders.CustomStatus,
    duration: formatDuration(stepStop - stepStart),
    errors: errorDetails,
    property: propertyArray,
  };
}
async function popupTable(message) {
  let data = await errorPopupOpen(message);
  log.debug(data);
  let popupHTML = `<table class="ui celled very compact table">
  <tbody>
    <tr class="center aligned">
      <td class="info">Status</td>
      <td class="${getStatusColor(data.status)}">${getStatusIcon(data.status)}${data.status}</td>
    </tr>
    <tr class="center aligned">
      <td class="info">Custom Status</td>
      <td class="${getStatusColor(data.customstatus)}">${getStatusIcon(data.customstatus)}${data.customstatus}</td>
    </tr>
    <tr class="center aligned">
      <td class="info">Duration</td>
      <td>${data.duration}</td>
    </tr>`;

  if (data.errors.length > 0 || data.property.length > 0) {
    popupHTML += `<tr><td colspan="2" style="height: 10vh; padding: 0;">
      <div class="ui fluid scrolling segment" style="text-wrap: pretty;width: unset;word-break: break-word;">`;
    if (data.property.length > 0) {
      popupHTML += data.property.join("<br>");
    }
    if (data.errors.length > 0) {
      popupHTML += `<h5 class="ui horizontal red divider header">Errors</h5>`;
      popupHTML += data.errors.map((e) => `<span class="ui red text">${e}</span>`).join("<div class='ui divider'></div>");
    }
    popupHTML += `</div></td></tr>`;
  }
  popupHTML += `</tbody></table>`;
  return popupHTML;
}
function apireserror(message) {
  cpiClearToasts();
  showToast("Please wait while we prepare...");
  // onVisible used to chain the popupTable call after the toast became
  // visible; with vanilla DOM the toast is in the document by the next
  // microtask, so we just kick off the work right away.
  Promise.resolve()
    .then(() => popupTable(message))
    .then((resolved) => {
      cpiClearToasts();
      showToast(resolved);
      // onRemove cleanup ran when Semantic UI auto-removed the toast.
      // showToast auto-dismisses after 3s; schedule the matching cleanup.
      setTimeout(() => {
        document.querySelectorAll(".cpiHelper_sidebar_iconbutton").forEach((i) => i.classList.remove("cpiHelper_sidebar_iconbutton"));
      }, 3000);
    })
    .catch((error) => {
      log.error("Error loading data:", error);
    });
}

function lookupError(message) {
  if (/unable to find valid certification path to requested target/.test(message)) {
    return "Probably you did not add a certificate for the https host that you are caling to the keystore";
  }

  return null;
}

//to check for errors and inline trace
async function getMessageProcessingLogRuns(MessageGuid, store = true) {
  var top_mode_count = await storageGetPromise("cpi_top_mode");
  top_mode_count = top_mode_count == null && top_mode_count == undefined ? "&$top=300" : `& $top=${parseInt(top_mode_count)} `; //Default
  if (top_mode_count === "&$top=0") {
    top_mode_count = "";
  }
  //Plugin over-write
  if (await getStorageValue("traceModifer", "isActive", null)) {
    var top_mode_count_flow = await storageGetPromise(`traceModifer_${cpiData.integrationFlowId} `);
    console.debug("traceModifer_flow", cpiData.integrationFlowId, top_mode_count, top_mode_count_flow);
    top_mode_count = (top_mode_count_flow == null && top_mode_count_flow == undefined) || top_mode_count_flow == 0 ? top_mode_count : `& $top=${parseInt(top_mode_count_flow)} `;
  }

  return makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogs('" + MessageGuid + "')/Runs?$inlinecount=allpages&$format=json&$top=200", store)
    .then((responseText) => {
      var resp = JSON.parse(responseText);
      var status = resp.d.results[0].OverallState;
      //take the correct run log (last or second last) for displaying the inline trace, depending on message status.
      if (resp.d.results.length > 1 && status != "COMPLETED" && status != "ESCALATED") {
        return resp.d.results[1].Id;
      } else {
        return resp.d.results[0].Id;
      }
    })
    .then((runId) => {
      return makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogRuns('" + runId + "')/RunSteps?$inlinecount=allpages&$format=json" + top_mode_count, store);
    })
    .then((response) => {
      return JSON.parse(response).d.results.filter((e) => e.StepStop != null);
    })
    .catch((e) => {
      log.log(e);
      return null;
    });
}
