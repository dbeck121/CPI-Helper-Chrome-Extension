//GNU GPL v3
//Please visit our github page: https://github.com/dbeck121/CPI-Helper-Chrome-Extension

'use strict';

//chrome doesn't pass a previousTabId param to the callback
//thus check if 3 params are passed
function pageChangeListener(chromeTabId, firefoxTabId, isFirefox) {
  const tabId = isFirefox ? firefoxTabId : chromeTabId;
  const showPage = (tab) => {
    if (tab.match('.*?hana\.ondemand\.com\/(itspaces|shell)\/.*?'))
      chrome.pageAction.show(tabId);
  }
  let tabPromise = chrome.tabs.get(tabId, showPage);
  if (tabPromise instanceof Promise)
    tabPromise.then(showPage);
}

//activate on this site
chrome.runtime.onInstalled.addListener(function () {
  chrome.tabs.onActivated.addListener(pageChangeListener);
});

//scan Headers for X-CSRF Token
chrome.webRequest.onBeforeSendHeaders.addListener(
  function (details) {

    for (var i = 0; i < details.requestHeaders.length; ++i) {
      if (details.requestHeaders[i].name == "X-CSRF-Token") {
        var xcsrftoken = details.requestHeaders[i].value;
        var tenant = details.url.split("/")[2].split(".")[0];

        //xcsrf token will be saved in a local object with name xcsrf_<tenant>
        var name = 'xcsrf_' + tenant;
        var obj = {};
        obj[name] = xcsrftoken;

        chrome.storage.local.set(obj, function () {
          console.log("xcsrf token saved");
        });
        break;
      }
    }
    return { requestHeaders: details.requestHeaders };

  },
  { urls: ["https://*.hana.ondemand.com/itspaces/api/1.0/workspace*/artifacts/*/iflows/*?lockinfo=true&webdav=LOCK", "https://*.hana.ondemand.com/itspaces/api/1.0/workspace*/odata/*?lockinfo=true&webdav=LOCK", "https://*.platform.sapcloud.cn/itspaces/api/1.0/workspace*/artifacts/*/iflows/*?lockinfo=true&webdav=LOCK", "https://*.platform.sapcloud.cn/itspaces/api/1.0/workspace*/odata/*?lockinfo=true&webdav=LOCK"] },
  ["requestHeaders"]);

chrome.management.getSelf((item) => {
  var obj = {};
  obj["installtype"] = item.installType;

  chrome.storage.local.set(obj, function () {
    console.log("xcsrf token saved");
  });
})