// Initialises the CPI Helper global DOM container (#cpihelperglobal) and
// keeps its theme class (ch_dark / ch_light) in sync with SAP's <html> theme.
// The container hosts the two reusable modal divs that scripts/ui.js
// populates dynamically (showBigPopup, showWaitingPopup).

function isHtmlDarkTheme() {
  return document.documentElement.classList.contains("sapUiTheme-sap_horizon_dark");
}

async function Themesync() {
  const isDark = isHtmlDarkTheme();
  const global = document.getElementById("cpihelperglobal");
  if (global) {
    global.classList.remove("ch_dark", "ch_light");
    global.classList.add(isDark ? "ch_dark" : "ch_light");
  }
  await chrome.storage.sync.set({ CPIhelperThemeInfo: !isDark });
}

function createGlobalId(id = "cpihelperglobal") {
  let global = document.getElementById(id);
  const toggleDarkMode = () => {
    const el = document.getElementById("cpihelperglobal");
    if (el) {
      el.className = isHtmlDarkTheme() ? "ch_dark" : "ch_light";
    }
  };

  if (!global) {
    console.log("Global element not found. Inserting element...");
    if (id === "cpihelperglobal") {
      const wrapper = document.createElement("div");
      wrapper.id = "cpihelperglobal";
      wrapper.className = isHtmlDarkTheme() ? "ch_dark" : "ch_light";
      wrapper.innerHTML = `
        <div class="cpiHelper ui modal" id="cpiHelper_semanticui_modal"></div>
        <div class="cpiHelper ui modal" id="cpiHelper_waiting_model"></div>
      `;
      document.body.appendChild(wrapper);
    } else {
      const parent = document.getElementById("cpihelperglobal");
      if (parent) {
        const child = document.createElement("div");
        child.id = id;
        parent.appendChild(child);
      }
    }
    toggleDarkMode();

    const observer = new MutationObserver(async function (mutationsList) {
      for (const mutation of mutationsList) {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          toggleDarkMode();
          await Themesync();
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });
  }
  return document.getElementById(id);
}

function runGlobalIdForOneMinute() {
  const interval = 800;
  const duration = 60 * 1000;

  let intervalId = setInterval(() => {
    createGlobalId();
  }, interval);

  setTimeout(() => {
    clearInterval(intervalId);
    console.log("Interval cleared after 1 minute");
  }, duration);
}

runGlobalIdForOneMinute();

const body = (id = "cpihelperglobal") => {
  let element = document.querySelector(`#${id}`);
  if (!element) {
    createGlobalId();
    element = document.querySelector(`#${id}`);
  }
  return element;
};
