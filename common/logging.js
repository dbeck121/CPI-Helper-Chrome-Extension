// small leveled logger with the surface of ulog/anylogger that the code base used:
// log(...), log.error/warn/info/log/debug/trace(...), log.level (number, accepts level names), log.ERROR ... log.TRACE
// and log.output = "exporter", which also records every line for downloadLog()
const logLevels = { error: 1, warn: 2, info: 3, log: 4, debug: 5, trace: 6 };
const levelMap = Object.fromEntries(Object.entries(logLevels).map(([name, value]) => [value, name]));
logsarray = [];

function createLogger(name) {
  let level = logLevels.warn;
  let recording = false;
  const logger = (...args) => logger.log(...args);
  Object.entries(logLevels).forEach(([method, value]) => {
    logger[method.toUpperCase()] = value;
    logger[method] = (...args) => {
      if (value > level) return;
      if (recording) logsarray.push([new Date().toISOString(), method, name, ...args].join(" "));
      const consoleMethod = method === "trace" ? "debug" : method;
      console[consoleMethod](`${new Date().toLocaleTimeString()} ${method} ${name}`, ...args);
    };
  });
  Object.defineProperty(logger, "level", {
    get: () => level,
    set: (value) => {
      const numeric = typeof value === "number" ? value : (logLevels[String(value).toLowerCase()] ?? Number(value));
      level = numeric >= 1 && numeric <= 6 ? numeric : logLevels.warn;
    },
  });
  Object.defineProperty(logger, "output", {
    get: () => (recording ? "exporter" : "console"),
    set: (value) => (recording = value === "exporter"),
  });
  return logger;
}

var log = createLogger("cpihelper");
log("Logger active for CPI-Helper on level: " + log.level);
// if url contains query parameter cpihelper_debug=true, use custom logger
log.log("Checking for debug mode in url", window.location.href);
if (window.location.href.indexOf("cpihelper_debug=true") > -1) {
  log.level = log.DEBUG;
  log.log("debug mode active");
}

//default timeout is 60 seconds
var timeout = null;

// if url contains query parameter cpihelper_debug_download_duration=xxx, use custom timeout
log.log("Checking for timeout in url parameter cpihelper_debug_download_duration that triggers log download");
if (window.location.href.indexOf("cpihelper_debug_download_duration=") > -1) {
  timeout_string = window.location.href.split("cpihelper_debug_download_duration=")[1].split("&")[0];
  timeout = parseInt(timeout_string);
  // if timeout is not a number, set it to 60 seconds
  if (isNaN(timeout)) {
    log.log("timeout is not a number, setting it to 60 seconds");
    timeout = 60000;
  }
  log.log("timeout set to " + timeout + " milliseconds");
  adjustLogLevelByTime(timeout);
  setTimeout(function () {
    log.log("url:", window.location.href);
    log.log("Version " + chrome.runtime.getManifest().version);
    log.log("Downloading logs");
    downloadLog();
  }, timeout);
}

function downloadLog() {
  if (logsarray.length > 0) {
    var blob = new Blob(
      logsarray.map((entry) => entry + "\r\n"),
      { type: "text/plain;charset=utf-8" }
    );
    var filename = "cpihelper_logs-" + new Date().toISOString() + ".txt";
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    body().appendChild(a); // we need to append the element to the dom -> otherwise it will not work in firefox
    a.click();
    a.remove();
    logsarray = [];
  } else {
    log.warn("No Log available or debug is not enabled.");
  }
}

function adjustLogLevelByTime(timeout = document.getElementById("timeout")?.value) {
  let defaultLogLevel = String(levelMap[log.level]);
  let timerId = null;
  if (timerId) {
    clearTimeout(timerId);
  } else {
    log.level = document.getElementById("logLevel")?.value;
    log.log(String(levelMap[log.level]) + " mode active " + timeout + " ms");
    showToast(String(levelMap[log.level]) + " is activated for " + timeout + " ms");
    if (log.level === logLevels.debug) {
      log.output = "exporter";
    }
    timerId = setTimeout(() => {
      log.level = defaultLogLevel;
      showToast(String(levelMap[log.level]) + " Switched Back.");
      timerId = null;
      const logLevelSelect = document.getElementById("logLevel");
      if (logLevelSelect) logLevelSelect.value = defaultLogLevel;
    }, parseInt(timeout) * 1000);
  }
}

//default set:
async function defaultdebug() {
  const logLevelSelect = document.getElementById("logLevel");
  const timeoutSelect = document.getElementById("timeout");
  if (logLevelSelect) logLevelSelect.value = String(levelMap[log.level]);
  if (timeoutSelect) timeoutSelect.value = "60";
  document.getElementById("downloadButton")?.addEventListener("click", (e) => {
    downloadLog();
    log.log("clear logs after download");
  });
  document.getElementById("debug-form")?.addEventListener("submit", (event) => {
    timeout = parseInt(document.getElementById("timeout")?.value);
    log.debug(`timeout is ${timeout}`);
    event.preventDefault();
    adjustLogLevelByTime();
    setTimeout(() => {
      downloadLog();
    }, timeout * 1000);
  });
}
