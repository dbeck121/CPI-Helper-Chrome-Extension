//GNU GPL v3
//Please visit our github page: https://github.com/dbeck121/CPI-Helper-Chrome-Extension

'use strict';

function pageChangeListener(tabId, changeInfo, tabInfo) {
  chrome.pageAction.show(tabId);
}

//activate on this site
chrome.runtime.onInstalled.addListener(function () {
  chrome.tabs.onUpdated.addListener(pageChangeListener, {
    urls: '.*?hana\.ondemand\.com\/(itspaces|shell)\/.*?'
  });
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