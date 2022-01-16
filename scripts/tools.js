
var callCache = new Map();
function makeCallPromise(method, url, useCache, accept, payload, includeXcsrf, contentType, showInfo = true) {
  return new Promise(async function (resolve, reject) {
    var cache;
    if (useCache) {
      cache = callCache.get(method + url);
    }
    if (cache) {
      resolve(cache);
    } else {

      var xhr = new XMLHttpRequest();
      xhr.withCredentials = true;

      xhr.open(method, url);
      if (accept) {
        //Example for accept: 'application/json' 
        xhr.setRequestHeader('Accept', accept);
      }

      if (contentType) {
        xhr.setRequestHeader('Content-type', contentType);
      }

      if (includeXcsrf) {
        var tenant = document.location.href.split("/")[2].split(".")[0];
        var name = 'xcsrf_' + tenant;
        var xcsrf = await storageGetPromise(name)
        xhr.setRequestHeader("X-CSRF-Token", xcsrf);
      }

      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          if (useCache) {
            callCache.set(method + url, xhr.responseText);
          }
          showInfo ? workingIndicator(false) : {};
          resolve(xhr.responseText);
        } else {
          showInfo ? workingIndicator(false) : {};
          showInfo ? showSnackbar("CPI-Helper has run into a problem while loading data.") : {};

          reject({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.ontimeout = function () {

        showInfo ? showSnackbar("CPI-Helper has run into a timeout. Please refresh site and try again.") : {};
        showInfo ? workingIndicator(false) : {};
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
  }
  );

}


//function to make http calls
async function makeCall(type, url, includeXcsrf, payload, callback, contentType, showInfo = true) {
  //console.log("make call")
  var xhr = new XMLHttpRequest();
  xhr.withCredentials = true;
  xhr.open(type, url, true);

  if (contentType) {
    xhr.setRequestHeader('Content-type', contentType);
  }

  if (includeXcsrf) {
    var tenant = document.location.href.split("/")[2].split(".")[0];
    var name = 'xcsrf_' + tenant;
    var xcsrf = await storageGetPromise(name)
    xhr.setRequestHeader("X-CSRF-Token", xcsrf);
  }

  xhr.timeout = 4000; // Set timeout to 4 seconds (4000 milliseconds)
  xhr.ontimeout = function () {

    showInfo ? showSnackbar("CPI-Helper has run into a timeout. Please refresh site and try again.") : {};
    showInfo ? workingIndicator(false) : {};

  }


  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4) {
      callback(xhr);
      showInfo ? workingIndicator(false) : {};
    }
  }

  showInfo ? workingIndicator(true) : {};
  xhr.send(payload);
}

var formatTrace = function (input, id) {

  var encodeHTML = function (str) {

    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#010;').replace(/'/g, "&#039;");
  }

  var formatXml = function (sourceXml) {
    var xmlDoc = new DOMParser().parseFromString(sourceXml, 'application/xml');
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
      '  <xsl:output indent="yes"/>',
      '</xsl:stylesheet>',
    ].join('\n'), 'application/xml');

    var xsltProcessor = new XSLTProcessor();
    xsltProcessor.importStylesheet(xsltDoc);
    var resultDoc = xsltProcessor.transformToDocument(xmlDoc);
    var resultXml = new XMLSerializer().serializeToString(resultDoc);
    return resultXml;
  };

  var prettify = function (input) {
    var stringToFormat;
    var type;


    try {
      stringToFormat = JSON.stringify(JSON.parse(input), null, 4);
      type = "json";
    } catch (error) {

    }

    if (stringToFormat == null) {
      if (input.trim()[0] == "<") {
        stringToFormat = formatXml(input);
        stringToFormat = encodeHTML(stringToFormat);
        type = "xml";
      }
    }

    if (stringToFormat == null) {
      type = "unknown";
      stringToFormat = input;
    }

    PR.prettyPrint();
    showSnackbar("Autodetect content: " + type);
    return PR.prettyPrintOne(stringToFormat, null, 1);

  }




  var copyButton = document.createElement("button");
  copyButton.innerText = "Copy";
  copyButton.onclick = (input) => {

    var text;
    //check who is active
    var unformatted = document.getElementById("cpiHelper_traceText_unformatted_" + id);
    var formatted = document.getElementById("cpiHelper_traceText_formatted_" + id);

    if (unformatted.classList.contains("cpiHelper_traceText_active")) {
      text = unformatted.innerText;
    } else {
      text = formatted.innerText;
    }

    copyText(text);
  };

  var beautifyButton = document.createElement("button");
  beautifyButton.innerText = "Try to Beautify";
  beautifyButton.onclick = (event) => {

    //check who is active
    var unformatted = document.getElementById("cpiHelper_traceText_unformatted_" + id);
    var formatted = document.getElementById("cpiHelper_traceText_formatted_" + id);

    if (unformatted.classList.contains("cpiHelper_traceText_active")) {
      unformatted.classList.remove("cpiHelper_traceText_active");
      formatted.classList.add("cpiHelper_traceText_active");
      this.innerText = "Uglify";
    } else {
      formatted.classList.remove("cpiHelper_traceText_active");
      unformatted.classList.add("cpiHelper_traceText_active");
      this.innerText = "Try to Beautify";
    }

    if (formatted.innerHTML == "") {
      var pre = document.createElement("pre");
      pre.classList.add("prettyprint");
      pre.classList.add("linenums");
      pre.style.border = "none";
      pre.style.whiteSpace = "pre-wrap";
      pre.style.margin = "0px";
      pre.innerHTML = prettify(unformatted.innerText);
      formatted.appendChild(pre);
    }

  }

  var result = document.createElement("div");
  result.appendChild(beautifyButton);
  result.appendChild(copyButton);

  var unformattedTrace = document.createElement("div");
  var formattedTrace = document.createElement("div");
  formattedTrace.id = "cpiHelper_traceText_formatted_" + id;
  formattedTrace.classList.add("cpiHelper_traceText");



  unformattedTrace.classList.add("cpiHelper_traceText");
  unformattedTrace.classList.add("cpiHelper_traceText_active");
  unformattedTrace.id = "cpiHelper_traceText_unformatted_" + id;
  unformattedTrace.innerText = input;
  result.appendChild(unformattedTrace);
  result.appendChild(formattedTrace);
  return result;
}