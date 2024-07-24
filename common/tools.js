/**
 * Returns a promise that resolves with the value of the specified key in Chrome storage.
 * If no key is specified, resolves with the entire storage object.
 * @param {string} key - The key to retrieve from storage. Optional.
 * @returns {Promise} A promise that resolves with the value of the specified key in storage.
 */
function callChromeStoragePromise(key) {
  return new Promise(async function (resolve, reject) {
    log.debug("callChromeStoragePromise: ", key)
    var input = key ? [key] : null;
    var storage = await chrome.storage.sync.get(input)
    if (!key) {
      resolve(storage);
      log.debug("callChromeStoragePromise response: ", storage)
    }
    resolve(storage[key]);

  });
}

function syncChromeStoragePromise(keyName, value) {
  return new Promise(async function (resolve, reject) {
    log.debug("syncChromeStoragePromise: ", keyName, value)
    myobj = {};
    myobj[keyName] = value;
    await chrome.storage.sync.set(myobj)
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

  if (!cpiData.classicUrl) {
    return new Promise(async function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      log.log("getCsrfToken")
      xhr.open("GET", "/api/1.0/user");

      xhr.setRequestHeader("X-CSRF-Token", "Fetch");


      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {

          showInfo ? workingIndicator(false) : {};
          log.debug("getCsrfToken response status: ", xhr.status)
          log.debug("getCsrfToken response text: ", xhr.responseText.substring(0, 50))
          resolve(xhr.getResponseHeader("x-csrf-token"));
        } else {
          showInfo ? workingIndicator(false) : {};
          log.debug("getCsrfToken response status: ", xhr.status)
          log.debug("getCsrfToken response text: ", xhr.responseText.substring(0, 300))
          showInfo ? showToast("CPI-Helper has run into a problem while catching X-CSRF-Token.", "", "error") : {};

          reject({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.ontimeout = function () {
        log.log("getCsrfToken timeout")
        showInfo ? showToast("CPI-Helper has run into a timeout while refreshing X-CSRF-Token.", "Please refresh page and try again.", "error") : {};
        showInfo ? workingIndicator(false) : {};
      }

      xhr.onerror = function () {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      };
      showInfo ? workingIndicator(true) : {};
      xhr.send();
    }
    );


  } else {

    var tenant = document.location.href.split("/")[2].split(".")[0];
    var name = 'xcsrf_' + tenant;
    xcsrf = await storageGetPromise(name)
    return xcsrf

  }
}


var callCache = new Map();


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
async function makeCallPromiseXHR(method, url, accept, payload, includeXcsrf, contentType, showInfo = true) {
  return new Promise(async function (resolve, reject) {

    log.debug("makecallpromisexhr " + new Date().toISOString())


    var xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.open(method, absolutePath(url));
    if (accept) {
      //Example for accept: 'application/json' 
      xhr.setRequestHeader('Accept', accept);
    }

    if (contentType) {
      xhr.setRequestHeader('Content-type', contentType);
    }

    if (includeXcsrf) {
      var xcsrf = await getCsrfToken(true);
      log.debug("includeXcsrf: ", xcsrf)

      xhr.setRequestHeader("X-CSRF-Token", xcsrf);
    }

    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {

        showInfo ? workingIndicator(false) : {};

        log.debug("makeCallPromise response status: ", xhr.status)
        log.debug("makeCallPromise response text: ", xhr.responseText.substring(0, 100))

        resolve(xhr);
      } else {
        showInfo ? workingIndicator(false) : {};
        showInfo ? showToast("CPI-Helper has run into a problem while loading data.", "", "error") : {};

        log.log("makeCallPromise response status: ", xhr.status)

        log.log("makeCallPromise response text: ", xhr.responseText)

        reject(xhr);
      }
    };
    xhr.timeout = 60000; // Set timeout to 60 seconds
    xhr.ontimeout = function (e) {
      log.log("make call promisexhr timeout")
      log.log("timeout " + new Date().toISOString())
      log.log(e.toString())
      showInfo ? showToast("CPI-Helper has run into a timeout", "Please refresh page and try again.", "error") : {};
      showInfo ? workingIndicator(false) : {};
      reject({
        status: 0,
        statusText: "timeout"
      });
    }

    xhr.onerror = function () {
      reject({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    showInfo ? workingIndicator(true) : {};
    xhr.send(payload);

  }

  );

}

async function makeCallPromise(method, url, useCache, accept, payload, includeXcsrf, contentType, showInfo = true) {
  log.debug("makeCallPromise: ", method, url, useCache, accept, payload, includeXcsrf, contentType, showInfo)
  var cache;
  if (useCache) {
    cache = callCache.get(method + url);
  }
  if (cache) {
    log.debug("makeCallPromise cache hit")
    return cache;
  }

  var xhr = await makeCallPromiseXHR(method, url, accept, payload, includeXcsrf, contentType, showInfo = true)

  if (xhr.status >= 200 && xhr.status < 300) {
    if (useCache) {
      callCache.set(method + url, xhr.responseText);
    }
    return xhr.responseText
  }

  return {
    status: xhr.status,
    statusText: xhr.statusText,
  }
}


//function to make http calls
async function makeCall(type, url, includeXcsrf, payload, callback, contentType, showInfo = true) {
  log.debug("makeCall", type, url, includeXcsrf, payload, contentType, showInfo)
  var xhr = new XMLHttpRequest();
  xhr.withCredentials = true;
  xhr.open(type, absolutePath(url), true);

  if (contentType) {
    xhr.setRequestHeader('Content-type', contentType);
  }

  if (includeXcsrf) {
    xhr.setRequestHeader("X-CSRF-Token", await getCsrfToken(true));
  }

  xhr.timeout = 60000; // Set timeout to 60 seconds
  xhr.ontimeout = function (e) {
    log.debug("makeCall timeout")
    log.debug(e)
    showInfo ? showToast("CPI-Helper has run into a timeout!", "Please refresh page and try again.", "error") : {};
    showInfo ? workingIndicator(false) : {};

  }


  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4) {
      callback(xhr);
      showInfo ? workingIndicator(false) : {};
      log.debug("makeCall response status: ", xhr.status)
      log.debug("makeCall response text: ", xhr.responseText.substring(0, 100))
    }
  }

  showInfo ? workingIndicator(true) : {};
  xhr.send(payload);
}

let absolutePath = function (href) {
  var link = document.createElement("a");
  link.href = href;
  return (link.protocol + "//" + link.host + link.pathname + link.search + link.hash);
}

var formatTrace = function (input, id, traceId) {
  var tab_size = 2;
  var editorManager;
  var encodeHTML = function (str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#010;').replace(/'/g, "&#039;");
  }
  var decodeHTML = function (str) {
    return String(str).replace('&amp;', "&").replace('&lt;', "<").replace('&gt;', ">").replace('&quot;', "\"").replace('&#010;', "\n").replace("&#039;", '\'');
  }
  var formatXml = function (sourceXml, tab_size) {
    var xmlDeclarationmatch = sourceXml.match(/^<\?xml\s+version\s*=\s*(["'])[^\1]+\1\s+encoding\s*=\s*(["'])[^\2]+\2\s*\?>/)
    var xmlDeclaration = xmlDeclarationmatch ? `${xmlDeclarationmatch[0]}\n` : "";
    //tab_size not implemented yet.
    filterflag = 0;
    var xmlDoc = new DOMParser().parseFromString(`${sourceXml}`, 'application/xml');
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      var xmlDoc = new DOMParser().parseFromString(`<cpi_Helper>${sourceXml}</cpi_Helper>`, 'application/xml'); filterflag = 1;
    }
    var xsltDoc = new DOMParser().parseFromString([
      // describes how we want to modify the XML - indent everything
      '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
      '  <xsl:strip-space elements="*"/>',
      '  <xsl:template match="para[content-style][not(text())]">', // change to just text() to strip space in text nodes
      '    <xsl:value-of select="normalize-space(.)"/>',
      '  </xsl:template>',
      '  <xsl:template match="node()|@*">',
      '    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
      '  </xsl:template>',
      '  <xsl:output method="xml" indent="yes" omit-xml-declaration="no"/>',
      '</xsl:stylesheet>',
    ].join('\n'), 'application/xml');

    var xsltProcessor = new XSLTProcessor();
    xsltProcessor.importStylesheet(xsltDoc);
    var resultDoc = xsltProcessor.transformToDocument(xmlDoc);
    var resultXml = new XMLSerializer().serializeToString(resultDoc);
    if (filterflag === 1) { resultXml = resultXml.substring(12, resultXml.length - 13).replaceAll('\n  ', '\n'); }
    return xmlDeclaration + resultXml
  };
  var prettify_type = function (input) {

    if (input.trim()[0] == "<") {
      return "xml";
    }
    if (input.trim()[0] == "{" || input.trim()[0] == "[") {
      return "json";
    }
    let sqloccurence = input.substring(0, 100).toLowerCase().match(/select|from|where|update|insert|upsert|create table|union|join|values|group by/gm)?.length
    if (sqloccurence && sqloccurence >= 2 || input.substring(0, 2).match("--")?.length === 2 && sqloccurence >= 1 || input.substring(0, 6).match("--sql")) {
      return "sql"
    }
    return "text"
  }

  var prettify = function (input, tab_size) {
    tab_size = tab_size > 0 ? tab_size : 2;
    try {
      if (input.trim()[0] == "{" || input.trim()[0] == "[") {
        return JSON.stringify(JSON.parse(input), 1, tab_size);
      }
      else if (input.trim()[0] == "<") {
        return formatXml(input, tab_size);
      }
      else {
        return input
      }
    } catch (error) {
      showToast(error, "", "error")
      return input;
    }
  }

  if (traceId) {
    var downloadButton = document.createElement("button");
    downloadButton.innerText = "Download";
    downloadButton.onclick = async (element) => {
      var response = await makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.GetTraceArchiveCommand?traceIds=" + traceId, true);
      var value = response.match(/<payload>(.*)<\/payload>/sg)[0];
      value = value.substring(9, value.length - 10)

      window.open("data:application/zip;base64," + value);
      showToast("Download complete.");
    };
  }

  var copyButton = document.createElement("button");
  copyButton.innerText = "Copy";
  copyButton.onclick = (input) => {

    var text;
    //check who is active
    var unformatted = document.getElementById("cpiHelper_traceText_unformatted_" + id);
    if (unformatted.classList.contains("cpiHelper_traceText_active")) {
      text = unformatted.innerText;
    } else {
      text = editorManager.getContent();
    }
    copyText(text);
  };

  var themeButton = document.createElement("button");
  themeButton.innerText = "Color Mode";
  themeButton.onclick = (event) => editorManager.toggleTheme();

  var readonlyButton = document.createElement("button");
  readonlyButton.innerText = "Edit";
  readonlyButton.onclick = (event) => { readonlyButton.innerText = editorManager.toggleReadOnly() ? "Edit" : "Read Only"; }

  var beautifyButton = document.createElement("button");
  beautifyButton.innerText = "Beautify";
  beautifyButton.onclick = (event) => {
    var $unformatted = $("#cpiHelper_traceText_unformatted_" + id);
    var $formatted = $("#cpiHelper_traceText_formatted_" + id);
    var isActive = $unformatted.hasClass("cpiHelper_traceText_active");
    $unformatted.toggleClass("cpiHelper_traceText_active", !isActive);
    $formatted.toggleClass("cpiHelper_traceText_active", isActive);
    $("#beautifyButton").text(isActive ? "Linearize" : "Beautify");
    if ($formatted.text().trim() === "") {
      editorManager = new EditorManager("cpiHelper_traceText_formatted_" + id, prettify_type(input), $('html.sapUiTheme-sap_horizon_dark') ? "github_dark" : "textmate");
      editorManager.setContent(prettify(input, tab_size))
    }
  }

  var result = document.createElement("div");
  if (!input) {
    result.innerHTML = '<div class="cpiHelper_infoPopUp_content">No elements found. If this should be part of the trace of an adapter step, try other tabs with same step Id on top of this popup.</div>';
    return result;
  }

  result.appendChild(beautifyButton);
  result.appendChild(copyButton);
  if (traceId) {
    result.appendChild(downloadButton);
    result.appendChild(themeButton);
    result.appendChild(readonlyButton);
  }

  var textEncoder = new TextEncoder().encode(input)
  if (textEncoder.length) {
    var span = document.createElement("span");
    var kb = Math.round(textEncoder.length / 1024 * 100) / 100;

    var additionalText = "";
    if (kb > 2000) {
      additionalText += " - large payload. Beautify could take a while. Browser might freeze.";
    }
    if (kb > 25000) {
      additionalText += " - maybe original payload is larger but we can't show it here and load more";
    }

    span.innerText = " Length unformated: " + input.split(/\r\n|\r|\n/).length + " lines; Size unformated: " + textEncoder.length + " bytes, " + kb + " KB, " + Math.round(kb / 1024 * 100) / 100 + " MB" + additionalText;
    result.appendChild(span);
  }
  var unformattedTrace = document.createElement("code");
  unformattedTrace.classList.add("cpiHelper_traceText");
  unformattedTrace.classList.add("cpiHelper_traceText_active");
  unformattedTrace.id = "cpiHelper_traceText_unformatted_" + id;
  unformattedTrace.innerText = input;
  var formattedTrace = document.createElement("div");
  formattedTrace.id = "cpiHelper_traceText_formatted_" + id;
  formattedTrace.classList.add("cpiHelper_traceText");
  formattedTrace.classList.add("cpi_editor");
  var wrap = document.createElement("pre");
  wrap.appendChild(unformattedTrace)
  result.appendChild(wrap);
  result.appendChild(formattedTrace);
  return result;
}

var formatHeadersAndPropertiesToTable = function (inputList) {

  inputList = inputList.sort(function (a, b) { return a.Name.toLowerCase() > b.Name.toLowerCase() ? 1 : -1 });

  if (inputList == null || inputList.length == 0) {
    return '<div class="cpiHelper_infoPopUp_content">No elements found. If this should be part of the trace of an adapter step, try other tabs with same step Id on top of this popup.</div>';
  }

  result = `<table class='ui basic striped selectable compact table'>
  <thead><tr class="black"><th>Name</th><th>Value</th></tr></thead>
  <tbody>`
  inputList.forEach(item => {
    result += "<tr><td>" + item.Name + "</td><td style=\"word-break: break-all;\">" + htmlEscape(item.Value) + "</td></tr>"
  });
  result += "</tbody></table>";
  return result;
}

var htmlEscape = function (rawStr) {
  if (!rawStr || typeof rawStr != "string") {
    return rawStr;
  }
  return rawStr.replace(/[\u00A0-\u9999<>\&]/g, function (i) {
    return '&#' + i.charCodeAt(0) + ';';
  });
}

function createElementFromHTML(htmlString) {
  var div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  return div.firstChild;
}

function twoClasssToggleSwitch(e, class1, class2) {
  e.classList.toggle(class1)
  e.classList.toggle(class2)
}

function isDevMode() {
  return !('update_url' in chrome.runtime.getManifest());
}

function stage() {
  if (isDevMode()) {
    return "dev"
  }

  return "prod"
}

//we send anonymous data to check which functions are used and which are not used to improve the extension. No personal data or data like tenant name, artifact content and names etc. is transfered and stored.
async function statistic(event, value = null, value2 = null) {

  log.debug(event, value, value2)
  try {
    var sessionId = await storageGetPromise("sessionId")
    var installtype = await storageGetPromise("installtype")
    var img = document.createElement("img");
    img.src = `https://mmjs2inijoe3rpwsdmqbgtyvdu0ldvfj.lambda-url.eu-central-1.on.aws?version=${chrome.runtime.getManifest().version}&event=${event}&session=${sessionId}&value=${value}&value2=${value2}&installtype=${installtype}&nonse=${Date.now()}`;
  } catch (e) {
    log.log(e)
  }
}

async function onInitStatistic() {
  var lastInitDay = await storageGetPromise("lastInitDay")
  var lastInitMonth = await storageGetPromise("lastInitMonth")
  var today = new Date().toISOString().substring(0, 10);
  var tomonth = new Date().toISOString().substring(0, 7);
  if (!lastInitDay || lastInitDay != today) {

    var sessionId = (Math.random().toString(36) + '00000000000000000').slice(2, 15 + 2)
    var obj = {};
    obj["sessionId"] = sessionId
    await storageSetPromise(obj);
    statistic("init", "day", lastInitMonth != tomonth ? "month" : "")
  }

  var obj = {};
  obj["lastInitDay"] = today
  obj["lastInitMonth"] = tomonth
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

// get from fomantic class to consume in code
function getStatusColor(status) {
  switch (status) {
    case "PROCESSING": return "warning";
    case "FAILED": return "negative";
    case "COMPLETED": return "positive";
    case "ESCALATED":
    case "RETRY": return "orange";
    case "CANCELLED": return "grey";
    default: return "info";
  }
}
function getStatusIcon(status) {
  let Icon;
  switch (status) {
    case "PROCESSING": Icon = "angle double right"; break;
    case "FAILED": Icon = "times"; break;
    case "COMPLETED": Icon = "check"; break;
    case "ESCALATED": Icon = "exclamation"; break;
    case "RETRY": Icon = "redo"; break;
    case "CANCELLED": Icon = "ban"; break;
    default: return "";
  }
  return `<i class="${Icon} icon"></i>`
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
  var list = hexToHsl(ihex, true).split(" ")
  h = parseInt(list[0]);
  s = parseInt(list[1]);
  l = parseInt(list[2]);
  l = Math.max(0, Math.min((l > limit === abovelimit) ? l + dim * (abovelimit ? -1 : 1) : l, 100));
  ohex = hslToHex(h, s, l)
  return ohex
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
  const toHex = x => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex, values = false) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  var r = parseInt(result[1], 16);
  var g = parseInt(result[2], 16);
  var b = parseInt(result[3], 16);
  var cssString = '';
  r /= 255, g /= 255, b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;
  if (max == min) {
    h = s = 0; // achromatic
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  cssString = values ? `${h} ${s} ${l}` : `hsl(${h}deg ${s}% ${l}%)`
  return cssString
}