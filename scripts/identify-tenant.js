{
  log.log("Initializing tentant identification");
  let host = window.location.host; // global variable to hold host name
  let documentTitleIntervalId; // used by the interval to set document title
  let observerIntervalId; // used to attach a MutationObserver callback
  var hostData = {
    title: "Cloud Integration",
    color: "#2185d0",
    icon: "default",
    loglevel: "warn",
    maxcount: 20, //max number fetch
    count: 10, // default visible
  };

  // Call the main functions
  monitorSyncStore();
  handleMessages();
  handleDOMChanges();
  getHostData((data) => {
    setData(data);
  });

  ////////////////////////
  /////// FUNCTIONS //////
  ////////////////////////

  // Handles changes made to the storage, even if on a different tab.
  function monitorSyncStore() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      //check if the change is for the current host
      if (changes[host]) {
        let storageChange = changes[host].newValue; // Get the new values

        // update the global object
        hostData.title = storageChange.title;
        hostData.color = storageChange.color;
        hostData.icon = storageChange.icon;
        hostData.loglevel = storageChange.loglevel;
        hostData.count = storageChange.count;
        // Update the page
        setData(hostData);
      }

      if (changes["darkmodeOnStartup"]) {
        $("#cpihelperglobal")
          .removeClass("ch_dark ch_light")
          .addClass(!changes[key].newValue ? "ch_dark" : "ch_light");
      }
    });
  }

  // Handles messages sent from the popup
  function handleMessages() {
    chrome.runtime.onMessage.addListener((message, sender, res) => {
      if (message == "get") {
        getHostData(res);
      }
      if (message.save) {
        hostData.title = message.save.title || hostData.title;
        hostData.color = message.save.color || hostData.color;
        hostData.icon = message.save.icon || hostData.icon;
        hostData.loglevel = message.save.loglevel || hostData.loglevel;
        hostData.count = message.save.count || hostData.count;
        let saveObject = {};
        saveObject[host] = hostData;
        saveHostData(saveObject);
        res(hostData);
      }
      return true;
    });
  }

  // Listen for changes to the DOM and update the UI5 header
  function handleDOMChanges() {
    clearInterval(observerIntervalId);
    let observer = new MutationObserver(mutationCallback);
    attachObserver(observer);
  }

  ////////////////////////
  /// Helper functions ///
  ////////////////////////

  // Handle DOM mutations
  function mutationCallback(mutations) {
    // Set the header background

    let relevantMutations = mutations.filter((mutation) => {
      return mutatiom.type === "childList";
    });

    for (let mutation of relevantMutations) {
      for (let addedNode of mutation.addedNodes) {
        if (addedNode.id === "shell--toolHeader") {
          addedNode.style.backgroundColor = hostData.color;
        }
      }
    }
  }

  // Initiate the MutationObserver when #shell--toolPage-header is available
  function attachObserver(observer) {
    //check if observer is array
    if (Array.isArray(observer)) {
      observer = observer[0];
    }

    let shellContent = document.getElementById("shell--toolPage-header");
    if (shellContent) {
      clearInterval(observerIntervalId);
      //seems like this is not needed anymore
      // observer.observe(shellContent, { childList: true, subtree: false });
    } else {
      if (!observerIntervalId) {
        log.log("Starting observer interval");
        observerIntervalId = setInterval(attachObserver, 3000, [observer]);
      }
    }
  }

  // Get the data for this host
  function getHostData(callback) {
    chrome.storage.sync.get([host], (response) => {
      if (response[host] == undefined) {
        saveHostData(hostData);
        return callback(hostData);
      }
      hostData = response[host];
      return callback(hostData);
    });
  }

  // Save the data for this host
  function saveHostData(newData, callback) {
    (hostData.title = newData.title || hostData.title),
      (hostData.color = newData.color || hostData.color),
      (hostData.icon = newData.icon || hostData.icon),
      (hostData.loglevel = newData.loglevel || hostData.loglevel),
      (hostData.count = newData.count || hostData.count);
    let saveObj = {};
    saveObj[host] = hostData;
    chrome.storage.sync.set(saveObj, callback);
  }

  // interval is used to overwrite SAPUI5 behaviour
  function setData({ title, color, icon, loglevel, count }) {
    clearInterval(documentTitleIntervalId);
    // Update element now
    setDocumentTitle(title);
    setHeaderColor(color);
    setFavIcon(icon);
    setLog(loglevel);
    setcount(count);
    // prepare interval function to keep elements updated
    let intervalCount = 2; // Times to run the interval function
    let intervalDelay = 3000;
    // set title again aftet 2sec
    log.log("Initiate title update sequence");
    documentTitleIntervalId = setInterval(() => {
      intervalCount--;
      setDocumentTitle(title);
      setHeaderColor(color);
      setLog(loglevel);
      setFavIcon(icon);
      if (intervalCount == 0) {
        log.log("Ending update sequence");
        clearInterval(documentTitleIntervalId);
      }
    }, intervalDelay);
  }

  function setDocumentTitle(title) {
    let text = title;

    if (cpiData.integrationFlowId) {
      text = text.replace(/\$iflow.name/g, cpiData.integrationFlowId);
    } else {
      text = text.replace(/\$iflow.name/g, "Cloud Integration");
    }

    if (document.title !== text) {
      document.title = text;
      log.log("Updating document title");
    }
  }

  function setHeaderColor(color) {
    //sync header with popup header
    const root = document.querySelector(":root");
    let theme = $("html").hasClass("sapUiTheme-sap_horizon");
    root.style.setProperty("--cpi-custom-color", adjustColorLimiter(color, !theme ? 80 : 20, 25, !theme));
    // Set the theme color meta tag
    let themeColorElement = document.querySelector("meta[name='theme-color']");
    if (themeColorElement) {
      themeColorElement.content = color;
    } else {
      let newElement = document.createElement("meta");
      newElement.name = "theme-color";
      newElement.content = color;
      document.head.appendChild(newElement);
    }
  }

  function setFavIcon(icon) {
    if (chrome.runtime.id == undefined) return;
    update = false;
    // icon will be 'red', 'green', etc
    let link = document.querySelector("link[rel*='icon']") || document.createElement("link");
    link.type = "image/x-icon";
    link.rel = "shortcut icon";
    link.href = chrome.runtime.getURL(`/images/favicons/${icon}.png`);
    document.getElementsByTagName("head")[0].appendChild(link);
  }

  function setLog(loglevel) {
    if (loglevel === String(levelMap[log.level])) return;
    log.level = loglevel ? loglevel : "warn";
    console.log(String(loglevel + " is activated"));
  }

  function setcount(count) {
    if (!count) {
      count = 10;
    }
    var countElement = document.querySelector("meta[name='cpi-count']");
    if (countElement && countElement.content !== count) {
      if (sidebar.active) {
        sidebar.deactivate();
        sidebar.init();
      }
      log.log("relaoded sidebar");
    }
    // Set the count meta tag
    if (countElement) {
      countElement.content = count;
    } else {
      let newElement = document.createElement("meta");
      newElement.name = "cpi-count";
      newElement.content = count;
      document.head.appendChild(newElement);
    }
  }
}
