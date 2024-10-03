var log = anylogger("cpihelper");
log.level = log.WARN;
log.format = "date time lvl name perf";
log("Logger active for CPI-Helper on level: " + log.level);
logsarray = [];
ulog.use({
  outputs: {
    exporter: {
      warn: function () {
        var args = [].slice.call(arguments);
        args.shift("Custom!!");
        logsarray.push(args.join(" "));
        console.warn.apply(console, args);
      },
      log: function () {
        var args = [].slice.call(arguments);
        args.shift("Custom!!");
        logsarray.push(args.join(" "));
        console.log.apply(console, args);
      },
      error: function () {
        var args = [].slice.call(arguments);
        args.shift("Custom!!");
        logsarray.push(args.join(" "));
        console.error.apply(console, args);
      },
      debug: function () {
        var args = [].slice.call(arguments);
        args.shift("Custom!!");
        logsarray.push(args.join(" "));
        console.debug.apply(console, args);
      },
    },
  },
});
const levelMap = Object.entries(ulog.levels).reduce((acc, [key, value]) => ({ ...acc, [value]: key }), {});
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

function adjustLogLevelByTime(timeout = $("#timeout").val()) {
  let defaultLogLevel = String(levelMap[log.level]);
  let timerId = null;
  if (timerId) {
    clearTimeout(timerId);
  } else {
    log.level = $("#logLevel").val();
    log.log(String(levelMap[log.level]) + " mode active " + timeout + " ms");
    showToast(String(levelMap[log.level]) + " is activated for " + timeout + " ms");
    if (log.level === ulog.levels.debug) {
      log.output = "exporter";
    }
    timerId = setTimeout(() => {
      log.level = defaultLogLevel;
      showToast(String(levelMap[log.level]) + " Switched Back.");
      timerId = null;
      $("#logLevel").dropdown("set selected", defaultLogLevel);
    }, parseInt(timeout) * 1000);
  }
}

//default set:
async function defaultdebug() {
  $("#logLevel").dropdown("set selected", String(levelMap[log.level]));
  $("#timeout").dropdown("set selected", "60");
  $(document).ready(function () {
    $("#downloadButton").on("click", (e) => {
      downloadLog();
      log.log("clear logs after download");
    });
    $("#debug-form").on("submit", (event) => {
      timeout = parseInt($("#timeout").val());
      log.debug(`timeout is ${timeout}`);
      event.preventDefault();
      adjustLogLevelByTime();
      setTimeout(() => {
        downloadLog();
      }, timeout * 1000);
    });
  });
}
