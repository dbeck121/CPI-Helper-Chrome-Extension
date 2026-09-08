var keepAliveState = { lastPing: 0, lastStatus: "not pinged yet" };

var plugin = {
  metadataVersion: "1.0.0",
  id: "keepAlive",
  name: "Session Keep Alive",
  version: "1.0.0",
  author: "Alexander Aigner",
  email: "alexander.aigner@snapconsult.com",
  website: "https://www.linkedin.com/in/alexander-aigner-at/",
  description:
    "Sends a small request to the tenant in a fixed interval so the idle session timeout does not kick in while you are reading or writing code. This only helps against <b>idle</b> timeouts. A hard maximum session lifetime cannot be extended and you will still be logged out at some point.",

  settings: {
    info: {
      text: "Interval in seconds between two keep alive requests. Empty or invalid values fall back to 30 seconds. The heartbeat ticks every 3 seconds, so the effective interval is rounded up to the next multiple of 3.",
      type: "label",
    },
    intervalSeconds: {
      text: "Interval (seconds)",
      placeholder: "30",
      type: "textinput",
      scope: "browser",
    },
    showToast: {
      text: "Show a toast on every keep alive request (for testing)",
      type: "checkbox",
      scope: "browser",
    },
  },

  heartbeat: async (pluginHelper, settings) => {
    const rawInterval = parseFloat(settings["keepAlive---intervalSeconds"]);
    const intervalMs = (isNaN(rawInterval) || rawInterval <= 0 ? 30 : rawInterval) * 1000;

    if (Date.now() - keepAliveState.lastPing < intervalMs) {
      return;
    }
    keepAliveState.lastPing = Date.now();

    // cheapest authenticated endpoint of the tenant (same one getCsrfToken uses); touching it resets the idle timer
    const url = "/" + pluginHelper.urlExtension + "api/1.0/user";

    // useCache=false and showInfo=false: never cached, no toast and no working indicator on failure
    const response = await makeCallPromiseV2("GET", url, false, "application/json", undefined, false, undefined, false);

    keepAliveState.lastStatus = `${new Date().toLocaleTimeString()}: ${response.successful ? "ok" : "failed"} (status ${response.status})`;
    log.log("keepAlive: " + keepAliveState.lastStatus);

    if (settings["keepAlive---showToast"] === true) {
      showToast(keepAliveState.lastStatus, "Keep alive", response.successful ? "success" : "error");
    }
  },
};

pluginList.push(plugin);
