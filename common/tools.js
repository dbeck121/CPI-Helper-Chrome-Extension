/**
 * Returns a promise that resolves with the value of the specified key in Chrome storage.
 * If no key is specified, resolves with the entire storage object.
 * @param {string} key - The key to retrieve from storage. Optional.
 * @returns {Promise} A promise that resolves with the value of the specified key in storage.
 */
function callChromeStoragePromise(key) {
  return new Promise(async function (resolve, reject) {
    log.debug("callChromeStoragePromise: ", key);
    var input = key ? [key] : null;
    var storage = await chrome.storage.sync.get(input);
    if (!key) {
      resolve(storage);
      log.debug("callChromeStoragePromise response: ", storage);
    }
    resolve(storage[key]);
  });
}

function syncChromeStoragePromise(keyName, value) {
  return new Promise(async function (resolve, reject) {
    log.debug("syncChromeStoragePromise: ", keyName, value);
    myobj = {};
    myobj[keyName] = value;
    await chrome.storage.sync.set(myobj);
    if (typeof dropPluginStorageSnapshot === "function") dropPluginStorageSnapshot();
    resolve();
  });
}

/**
 * Returns a promise that resolves with the CSRF token for the current user.
 * If the user is not logged in, returns a rejected promise with an error object.
 * @param {boolean} showInfo - Whether to show/hide the working indicator and toast messages. Optional.
 * @returns {Promise} A promise that resolves with the CSRF token for the current user.
 */
async function getCsrfToken(showInfo = false) {
  return new Promise(async function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    log.log("getCsrfToken");

    xhr.open("GET", absolutePath("/" + cpiData.urlExtension + "api/1.0/user"));
    xhr.setRequestHeader("X-CSRF-Token", "Fetch");

    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        showInfo ? workingIndicator(false) : {};
        log.debug("getCsrfToken response status: ", xhr.status);
        log.debug("getCsrfToken response text: ", xhr.responseText.substring(0, 50));
        resolve(xhr.getResponseHeader("x-csrf-token"));
      } else {
        showInfo ? workingIndicator(false) : {};
        log.debug("getCsrfToken response status: ", xhr.status);
        log.debug("getCsrfToken response text: ", xhr.responseText.substring(0, 300));
        showInfo ? showToast("CPI-Helper has run into a problem while catching X-CSRF-Token.", "", "error") : {};

        reject({
          status: this.status,
          statusText: xhr.statusText,
        });
      }
    };
    xhr.ontimeout = function () {
      log.log("getCsrfToken timeout");
      showInfo ? showToast("CPI-Helper has run into a timeout while refreshing X-CSRF-Token.", "Please refresh page and try again.", "error") : {};
      showInfo ? workingIndicator(false) : {};
    };

    xhr.onerror = function () {
      reject({
        status: this.status,
        statusText: xhr.statusText,
      });
    };
    showInfo ? workingIndicator(true) : {};
    xhr.send();
  });
}

/**
 * Returns a promise that resolves with the value of the specified key in the cache. Used for http calls cache
 **/

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.setCounter = 0; // Counter for the number of set calls
  }

  set(id, data, ttl = 600) {
    const expireTime = Date.now() + ttl * 1000;
    this.cache.set(id, { data, expireTime });

    // Increment the counter and perform cleanup every 20th call
    this.setCounter++;
    if (this.setCounter >= 20) {
      this.cleanUp();
      this.setCounter = 0; // Reset the counter
    }
  }

  get(id) {
    const cachedItem = this.cache.get(id);

    if (!cachedItem) {
      return null;
    }

    const currentTime = Date.now();

    if (currentTime >= cachedItem.expireTime) {
      this.cache.delete(id);
      return null;
    }

    return cachedItem.data;
  }

  delete(id) {
    this.cache.delete(id);
  }

  // Method to clean up expired entries
  cleanUp() {
    const currentTime = Date.now();
    for (const [id, { expireTime }] of this.cache.entries()) {
      if (currentTime >= expireTime) {
        this.cache.delete(id);
      }
    }
  }
}

const httpCache = new SimpleCache();

/**
 * Returns a promise that resolves with an XMLHttpRequest object for the specified URL.
 * @param {string} method - The HTTP method to use for the request.
 * @param {string} url - The URL to send the request to.
 * @param {string} accept - The value of the Accept header to send with the request. Optional.
 * @param {string} payload - The payload to send with the request. Optional.
 * @param {boolean} includeXcsrf - Whether to include the X-CSRF-Token header in the request. Optional.
 * @param {string} contentType - The value of the Content-Type header to send with the request. Optional.
 * @param {boolean} showInfo - Whether to show/hide the working indicator, X-CSRF-Token indicator, and toast messages. Optional.
 * @returns {Promise} A promise that resolves with an XMLHttpRequest object for the specified URL.
 */
//just an helper class.... do not use
async function makeCallPromiseXHR(method, url, accept, payload, includeXcsrf, contentType, showInfo = true) {
  return new Promise(async function (resolve, reject) {
    log.debug("makecallpromisexhr " + new Date().toISOString());

    var xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.open(method, absolutePath(url));
    if (accept) {
      //Example for accept: 'application/json'
      xhr.setRequestHeader("Accept", accept);
    }

    if (contentType) {
      xhr.setRequestHeader("Content-type", contentType);
    }

    if (includeXcsrf) {
      var xcsrf = await getCsrfToken(true);
      log.debug("includeXcsrf: ", xcsrf);

      xhr.setRequestHeader("X-CSRF-Token", xcsrf);
    }

    xhr.setRequestHeader("X-CPI-Helper-Client", "extension");
    xhr.setRequestHeader("X-CPI-Helper-Version", chrome.runtime.getManifest().version);

    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        showInfo ? workingIndicator(false) : {};

        log.debug("makeCallPromise response status: ", xhr.status);
        log.debug("makeCallPromise response text: ", xhr.responseText.substring(0, 100));

        resolve(xhr);
      } else {
        showInfo ? workingIndicator(false) : {};
        showInfo ? showToast("CPI-Helper has run into a problem while loading data.", "", "error") : {};

        log.log("makeCallPromise response status: ", xhr.status);

        log.log("makeCallPromise response text: ", xhr.responseText);

        reject(xhr);
      }
    };
    xhr.timeout = 60000; // Set timeout to 60 seconds
    xhr.ontimeout = function (e) {
      log.log("make call promisexhr timeout");
      log.log("timeout " + new Date().toISOString());
      log.log(e.toString());
      showInfo ? showToast("CPI-Helper has run into a timeout", "Please refresh page and try again.", "error") : {};
      showInfo ? workingIndicator(false) : {};
      reject({
        status: 0,
        statusText: "timeout",
      });
    };

    xhr.onerror = function () {
      reject({
        status: this.status,
        statusText: xhr.statusText,
      });
    };
    showInfo ? workingIndicator(true) : {};
    xhr.send(payload);
  });
}

async function makeCallPromise(method, url, useCache, accept, payload, includeXcsrf, contentType, showInfo = true) {
  log.debug("makeCallPromise: ", method, url, useCache, accept, payload, includeXcsrf, contentType, showInfo);

  var cache;

  //check if useCache is boolean or number
  if ((typeof useCache == "boolean" && useCache == true) || (typeof useCache == "number" && useCache > 0)) {
    cache = httpCache.get(method + url);
  }

  if (cache) {
    log.debug("makeCallPromise cache hit");
    return cache.responseText;
  }

  var xhr = await makeCallPromiseXHR(method, url, accept, payload, includeXcsrf, contentType, (showInfo = true));

  if (xhr.status >= 200 && xhr.status < 300) {
    if (typeof useCache == "boolean") {
      httpCache.set(method + url, { responseText: xhr.responseText, status: xhr.status, statusText: xhr.statusText });
    } else {
      httpCache.set(method + url, { responseText: xhr.responseText, status: xhr.status, statusText: xhr.statusText }, useCache);
    }
    return xhr.responseText;
  }

  return {
    status: xhr.status,
    statusText: xhr.statusText,
    responseText: xhr.responseText,
    successful: false,
  };
}

async function makeCallPromiseV2(method, url, useCache, accept, payload, includeXcsrf, contentType, showInfo = true) {
  log.debug("makeCallPromise: ", method, url, useCache, accept, payload, includeXcsrf, contentType, showInfo);

  var cache;

  //check if useCache is boolean or number
  if ((typeof useCache == "boolean" && useCache == true) || (typeof useCache == "number" && useCache > 0)) {
    cache = httpCache.get(method + url);
  }

  if (cache) {
    log.debug("makeCallPromise cache hit");
    return cache;
  }

  var xhr = await makeCallPromiseXHR(method, url, accept, payload, includeXcsrf, contentType, showInfo).catch((error) => {
    httpCache.delete(method + url); // In case of error, ensure that the cache is cleared for this entry

    return { successful: false, status: error.status, statusText: error.statusText, responseText: error.responseText };
  });

  if (xhr.status >= 200 && xhr.status < 300) {
    if (typeof useCache == "number") {
      httpCache.set(method + url, { successful: true, responseText: xhr.responseText, status: xhr.status, statusText: xhr.statusText }, useCache);
    } else {
      httpCache.set(method + url, { successful: true, responseText: xhr.responseText, status: xhr.status, statusText: xhr.statusText });
    }
    return { successful: true, responseText: xhr.responseText, status: xhr.status, statusText: xhr.statusText };
  }

  return xhr;
}

let absolutePath = function (href) {
  var link = document.createElement("a");
  link.href = href;
  return link.protocol + "//" + link.host + link.pathname + link.search + link.hash;
};

function downloadFile(fileContent, format, filename) {
  // Create a Blob with the file content
  const blob = new Blob([fileContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.${format == "text" ? "txt" : format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// payload viewer settings that survive popups: editor height, font size and wrap
const PAYLOAD_VIEWER_STORAGE_KEY = "cpiHelper_payloadViewer";
// above this size the payload opens raw, formatting stays one click away
const PAYLOAD_VIEWER_AUTO_FORMAT_LIMIT = 2 * 1024 * 1024;

async function getPayloadViewerSettings() {
  try {
    const stored = await chrome.storage.local.get(PAYLOAD_VIEWER_STORAGE_KEY);
    return { height: 0, fontSize: 14, wrap: true, ...(stored?.[PAYLOAD_VIEWER_STORAGE_KEY] || {}) };
  } catch (error) {
    return { height: 0, fontSize: 14, wrap: true };
  }
}

async function savePayloadViewerSettings(changes) {
  try {
    const current = await getPayloadViewerSettings();
    await chrome.storage.local.set({ [PAYLOAD_VIEWER_STORAGE_KEY]: { ...current, ...changes } });
  } catch (error) {
    log.debug("payload viewer settings not saved", error);
  }
}

// Payload viewer: one read only Ace editor with toolbar (pretty / raw, copy, download, wrap, theme, font size, fold, search, edit,
// fullscreen), drag handle to resize (height is remembered) and a lossless formatter (common/formatter.js)
var formatTrace = function (input, id, traceId, filename) {
  id = id.replaceAll(":", "_");
  var result = document.createElement("div");
  if (!input) {
    result.innerHTML = '<div class="cpiHelper_infoPopUp_content">No elements found. If this should be part of the trace of an adapter step, try other tabs with same step Id on top of this popup.</div>';
    return result;
  }

  const type = cpihDetectPayloadType(input);
  const bytes = new TextEncoder().encode(input).length;
  const kb = Math.round((bytes / 1024) * 100) / 100;
  let pretty = bytes <= PAYLOAD_VIEWER_AUTO_FORMAT_LIMIT && (type === "xml" || type === "json");
  let formatted = null;
  let editorManager = null;
  let settings = { height: 0, fontSize: 14, wrap: true };

  result.className = "cpiHelper_payload";
  result.id = "cpiHelper_payload_" + id;
  result.innerHTML = `
    <div class="cpiHelper_payload_toolbar" role="toolbar" aria-label="Payload">
      <div class="cpiHelper_payload_group cpiHelper_payload_segmented" role="group" aria-label="View">
        <button type="button" data-action="pretty" title="Formatted view">Pretty</button>
        <button type="button" data-action="raw" title="Original payload">Raw</button>
      </div>
      <div class="cpiHelper_payload_group">
        <button type="button" data-action="copy" title="Copy to clipboard"><i class="copy icon"></i>Copy</button>
        <button type="button" data-action="download" title="Download body"><i class="download icon"></i>Body</button>
        ${traceId ? '<button type="button" data-action="archive" title="Download trace archive"><i class="download icon"></i>Trace</button>' : ""}
      </div>
      <div class="cpiHelper_payload_group">
        <button type="button" data-action="search" title="Search (Ctrl+F)"><i class="search icon"></i></button>
        <button type="button" data-action="fold" title="Collapse all">Fold</button>
        <button type="button" data-action="unfold" title="Expand all">Unfold</button>
        <button type="button" data-action="wrap" aria-pressed="true" title="Wrap long lines">Wrap</button>
        <button type="button" data-action="smaller" title="Smaller font">A-</button>
        <button type="button" data-action="bigger" title="Bigger font">A+</button>
        <button type="button" data-action="theme" title="Switch editor theme">Theme</button>
        <button type="button" data-action="edit" aria-pressed="false" title="Allow editing">Edit</button>
      </div>
      <span class="cpiHelper_payload_info"></span>
      <button type="button" class="cpiHelper_payload_fullscreenButton" data-action="fullscreen" title="Fullscreen (Esc to leave)" aria-pressed="false">&#x26F6;</button>
    </div>
    <div class="cpiHelper_payload_hint" hidden></div>
    <div class="cpiHelper_payload_editor" id="cpiHelper_traceText_formatted_${id}"></div>
    <div class="cpiHelper_payload_resize" role="separator" aria-orientation="horizontal" title="Drag to resize, double click to reset"></div>`;

  const toolbar = result.querySelector(".cpiHelper_payload_toolbar");
  const button = (action) => toolbar.querySelector(`[data-action="${action}"]`);
  const hint = result.querySelector(".cpiHelper_payload_hint");
  const editorElement = result.querySelector(".cpiHelper_payload_editor");
  const lines = input.split(/\r\n|\r|\n/).length;
  result.querySelector(".cpiHelper_payload_info").textContent = `${type.toUpperCase()} · ${lines} lines · ${kb < 1024 ? kb + " KB" : Math.round((kb / 1024) * 100) / 100 + " MB"}`;

  const showHint = (text, kind = "") => {
    hint.hidden = !text;
    hint.className = "cpiHelper_payload_hint " + kind;
    hint.textContent = text || "";
  };
  if (kb > 25000) {
    showHint("Maybe the original payload is larger, the trace only keeps this much.", "warning");
  } else if (!pretty && (type === "xml" || type === "json")) {
    showHint("Large payload, shown raw. Pretty formats it, that can take a moment.");
  }

  const render = () => {
    if (!editorManager) return;
    if (pretty) {
      if (formatted === null) formatted = cpihPrettifyPayload(input).text;
      editorManager.setContent(formatted);
    } else {
      editorManager.setContent(input);
    }
    button("pretty").setAttribute("aria-pressed", String(pretty));
    button("raw").setAttribute("aria-pressed", String(!pretty));
  };

  const applyHeight = (height) => {
    if (height > 0) editorElement.style.height = Math.max(120, height) + "px";
    else editorElement.style.removeProperty("height");
  };

  // Ace needs a visible element with a size, the viewer often sits in a tab that is not shown yet
  const init = async () => {
    settings = await getPayloadViewerSettings();
    applyHeight(settings.height);
    editorManager = new EditorManager(editorElement, type, cpihIsDark() ? "github_dark" : "textmate", 2, true, settings.fontSize, "markbegin", settings.wrap);
    button("wrap").setAttribute("aria-pressed", String(settings.wrap));
    render();
    const validationError = type === "xml" || type === "json" ? cpihValidatePayload(input, type) : null;
    if (validationError) showHint(`Not valid ${type.toUpperCase()}: ${validationError}. The payload is shown as it is.`, "warning");
  };
  // Ace watches the size of its element on its own once it runs
  const observer = new ResizeObserver(() => {
    if (!result.isConnected || editorElement.offsetWidth === 0 || editorElement.offsetHeight === 0) return;
    observer.disconnect();
    requestAnimationFrame(init);
  });
  observer.observe(editorElement);

  // fullscreen, Esc leaves it without closing the popup around it
  const onFullscreenKey = (event) => {
    if (event.key !== "Escape" || event.target.closest?.(".ace_search")) return;
    event.preventDefault();
    event.stopPropagation();
    setFullscreen(false);
  };
  const setFullscreen = (on) => {
    result.classList.toggle("cpiHelper_payload_fullscreen", on);
    result.closest(".ui.modal")?.classList.toggle("cpiHelper_has_fullscreen", on);
    button("fullscreen").setAttribute("aria-pressed", String(on));
    if (on) document.addEventListener("keydown", onFullscreenKey, true);
    else document.removeEventListener("keydown", onFullscreenKey, true);
    requestAnimationFrame(() => {
      editorManager?.resize();
      editorManager?.editor.focus();
    });
  };

  toolbar.addEventListener("click", async (event) => {
    const target = event.target.closest("button[data-action]");
    if (!target) return;
    switch (target.dataset.action) {
      case "pretty":
        if (!pretty) {
          pretty = true;
          showHint("");
          render();
        }
        break;
      case "raw":
        if (pretty) {
          pretty = false;
          render();
        }
        break;
      case "copy":
        copyText(editorManager ? editorManager.getContent() : input);
        break;
      case "download":
        downloadFile(input, type, filename || `CPI_${traceId}_${id}`);
        showToast("Download of body is complete.");
        break;
      case "archive": {
        var response = await makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.GetTraceArchiveCommand?traceIds=" + traceId, true);
        var value = response.match(/<payload>(.*)<\/payload>/gs)[0];
        value = value.substring(9, value.length - 10);
        window.open("data:application/zip;base64," + value);
        showToast("Download complete.");
        break;
      }
      case "search":
        editorManager?.openSearch();
        break;
      case "fold":
        editorManager?.foldAll();
        break;
      case "unfold":
        editorManager?.unfoldAll();
        break;
      case "wrap": {
        const wrap = editorManager ? editorManager.toggleWrap() : true;
        target.setAttribute("aria-pressed", String(wrap));
        savePayloadViewerSettings({ wrap });
        break;
      }
      case "smaller":
      case "bigger": {
        if (!editorManager) break;
        const fontSize = Math.min(28, Math.max(9, Number(editorManager.getFontSize()) + (target.dataset.action === "bigger" ? 1 : -1)));
        editorManager.setFontSize(fontSize);
        savePayloadViewerSettings({ fontSize });
        break;
      }
      case "theme":
        editorManager?.toggleTheme();
        break;
      case "edit":
        if (editorManager) target.setAttribute("aria-pressed", String(!editorManager.toggleReadOnly()));
        break;
      case "fullscreen":
        setFullscreen(!result.classList.contains("cpiHelper_payload_fullscreen"));
        break;
    }
  });

  // drag handle: resizes the editor, the height is remembered for the next payload
  const handle = result.querySelector(".cpiHelper_payload_resize");
  handle.addEventListener("pointerdown", (event) => {
    if (result.classList.contains("cpiHelper_payload_fullscreen")) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startHeight = editorElement.offsetHeight;
    result.classList.add("cpiHelper_payload_resizing");
    const onMove = (moveEvent) => applyHeight(startHeight + moveEvent.clientY - startY);
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      result.classList.remove("cpiHelper_payload_resizing");
      savePayloadViewerSettings({ height: editorElement.offsetHeight });
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp, { once: true });
    handle.addEventListener("pointercancel", onUp, { once: true });
  });
  handle.addEventListener("dblclick", () => {
    applyHeight(0);
    savePayloadViewerSettings({ height: 0 });
  });

  return result;
};

var formatHeadersAndPropertiesToTable = function (inputList) {
  inputList = inputList.sort(function (a, b) {
    return a.Name.toLowerCase() > b.Name.toLowerCase() ? 1 : -1;
  });

  if (inputList == null || inputList.length == 0) {
    return '<div class="cpiHelper_infoPopUp_content">No elements found. If this should be part of the trace of an adapter step, try other tabs with same step Id on top of this popup.</div>';
  }

  result = `<table class='ui basic striped selectable compact table'>
  <thead><tr class="blue"><th>Name</th><th>Value</th></tr></thead>
  <tbody>`;
  inputList.forEach((item) => {
    result += "<tr><td>" + item.Name + '</td><td style="word-break: break-all;">' + htmlEscape(item.Value) + "</td></tr>";
  });
  result += "</tbody></table>";
  return result;
};

var htmlEscape = function (rawStr) {
  if (!rawStr || typeof rawStr != "string") {
    return rawStr;
  }
  return rawStr.replace(/[\u00A0-\u9999<>\&]/g, function (i) {
    return "&#" + i.charCodeAt(0) + ";";
  });
};

// deflate-raw or gzip with the native CompressionStream (replaces pako). bytes: Uint8Array or string
async function cpihCompress(bytes, format = "deflate-raw") {
  const input = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function createElementFromHTML(htmlString) {
  var div = document.createElement("div");
  div.innerHTML = htmlString.trim();
  return div.firstChild;
}

function isDevMode() {
  return !("update_url" in chrome.runtime.getManifest());
}

function stage() {
  if (isDevMode()) {
    return "dev";
  }

  return "prod";
}

//we send anonymous data to check which functions are used and which are not used to improve the extension. No personal data or data like tenant name, artifact content and names etc. is transfered and stored.
async function statistic(event, value = null, value2 = null) {
  log.debug(event, value, value2);
}

async function onInitStatistic() {
  var lastInitDay = await storageGetPromise("lastInitDay");
  var lastInitMonth = await storageGetPromise("lastInitMonth");
  var today = new Date().toISOString().substring(0, 10);
  var tomonth = new Date().toISOString().substring(0, 7);
  if (!lastInitDay || lastInitDay != today) {
    var sessionId = (Math.random().toString(36) + "00000000000000000").slice(2, 15 + 2);
    var obj = {};
    obj["sessionId"] = sessionId;
    await storageSetPromise(obj);
    statistic("init", "day", lastInitMonth != tomonth ? "month" : "");
  }

  var obj = {};
  obj["lastInitDay"] = today;
  obj["lastInitMonth"] = tomonth;
  await storageSetPromise(obj);
}

async function storageGetPromise(name) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([name], function (result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[name]);
      }
    });
  });
}

async function storageSetPromise(obj) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(obj, function () {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve("OK");
      }
    });
  });
}

// status color name used by the ui classes
function getStatusColor(status) {
  switch (status) {
    case "PROCESSING":
      return "warning";
    case "FAILED":
      return "negative";
    case "COMPLETED":
      return "positive";
    case "ESCALATED":
    case "RETRY":
      return "orange";
    case "CANCELLED":
      return "info";
    default:
      return "grey";
  }
}
function getStatusColorCode(status, isDarkMode = !document.documentElement.classList.contains("sapUiTheme-sap_horizon_dark")) {
  const colors = {
    PROCESSING: isDarkMode ? "#e76500" : "#f7bf00",
    STARTING: isDarkMode ? "#e76500" : "#f7bf00",
    FAILED: isDarkMode ? "#f53232" : "#fa6161",
    ESCALATED: isDarkMode ? "#e76500" : "#f7bf00",
    RETRY: isDarkMode ? "#e76500" : "#f7bf00",
    CANCELLED: isDarkMode ? "#788fa6" : "#a9b4be",
    ABANDONED: isDarkMode ? "#788fa6" : "#a9b4be",
    STORED: isDarkMode ? "#30914c" : "#6dad1f",
    DEPLOYED: isDarkMode ? "#30914c" : "#6dad1f",
    STARTED: isDarkMode ? "#30914c" : "#6dad1f",
    COMPLETED: isDarkMode ? "#30914c" : "#6dad1f",
    default: isDarkMode ? "#788fa6" : "#a9b4be",
  };
  return colors[status] || colors.default;
}
function getStatusIcon(status) {
  let Icon;
  switch (status) {
    case "PROCESSING":
      Icon = "angle double right";
      break;
    case "FAILED":
      Icon = "times";
      break;
    case "COMPLETED":
      Icon = "check";
      break;
    case "ESCALATED":
      Icon = "exclamation";
      break;
    case "RETRY":
      Icon = "redo";
      break;
    case "CANCELLED":
      Icon = "ban";
      break;
    default:
      return "";
  }
  return `<i class="${Icon} icon"></i>`;
}

function adjustColorLimiter(ihex, limit, dim, abovelimit = false) {
  /**
   * Adjusts a hex color based on the threshold specified by @abovelimit.
   * If @abovelimit is true, adjusts the color darker by @dim; if false, adjusts lighter.
   * @param {string} hexColor - The input hex color (e.g., '#RRGGBB' or '#RGB').
   * @param {number} limit - The threshold limit for adjusting the color.
   * @param {number} dim - The amount of lightness to adjust (positive for lighter, negative for darker).Reccomanded to use Flag.
   * @param {boolean} abovelimit - Indicates whether to adjust the color above or below the limit.
   * @returns {string} - The adjusted hex color.
   */
  let h, s, l, ohex;
  var list = hexToHsl(ihex, true).split(" ");
  h = parseInt(list[0]);
  s = parseInt(list[1]);
  l = parseInt(list[2]);
  l = Math.max(0, Math.min(l > limit === abovelimit ? l + dim * (abovelimit ? -1 : 1) : l, 100));
  ohex = hslToHex(h, s, l);
  return ohex;
}

function hslToHex(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex, values = false) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  var r = parseInt(result[1], 16);
  var g = parseInt(result[2], 16);
  var b = parseInt(result[3], 16);
  var cssString = "";
  ((r /= 255), (g /= 255), (b /= 255));
  var max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  var h,
    s,
    l = (max + min) / 2;
  if (max == min) {
    h = s = 0; // achromatic
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  cssString = values ? `${h} ${s} ${l}` : `hsl(${h}deg ${s}% ${l}%)`;
  return cssString;
}
/**
 * Finds the nearest previous or next integer in an array relative to a target value.
 *
 * used: @incpi -
 * findNearest(array, target); Output: { previous: 3, next: 5 }
 * findNearest(array, target, 'next'); Output: 5
 * findNearest(array, target, 'previous'); Output: 3
 * @param {number[]} array - The array of numbers to search through.
 * @param {number} target - The target value to find the nearest integers to.
 * @param {string} [direction='both'] - The direction to search for nearest integer(s).
 *                                      'both' returns both previous and next,
 *                                      'previous' returns only the previous nearest,
 *                                      'next' returns only the next nearest.
 * @returns {Object|number|null} - The nearest previous and next integers as an object
 *                                 if direction is 'both', or a single integer if
 *                                 direction is 'previous' or 'next'. Returns null if no
 *                                 nearest integer is found in the specified direction.
 */
function findNearest(array, target, direction = "both") {
  let prev = null;
  let next = null;

  array.forEach((num) => {
    if (num < target && (prev === null || num > prev)) {
      prev = num;
    }
    if (num > target && (next === null || num < next)) {
      next = num;
    }
  });

  if (direction === "previous") {
    return prev;
  } else if (direction === "next") {
    return next;
  } else {
    return { previous: prev, next: next };
  }
}
