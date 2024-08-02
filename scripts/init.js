async function Themesync() {
  if (callChromeStoragePromise('CPIhelperThemeInfo') !== ($('html').hasClass('sapUiTheme-sap_horizon'))) {
    await syncChromeStoragePromise("CPIhelperThemeInfo", ($('html').hasClass('sapUiTheme-sap_horizon')))
  }
}

function createGlobalId(id = "cpihelperglobal") {
  let global = $(`#${id}`);
  const toggleDarkMode = () => $("#cpihelperglobal").attr("class", $("html").hasClass("sapUiTheme-sap_horizon_dark") ? "ch_dark" : "ch_light");
  if (global.length === 0) {
    console.log("Global element not found. Inserting element...");
    if (id === "cpihelperglobal") {
      $("body").append(`
        <div class=${$("html").hasClass("sapUiTheme-sap_horizon_dark") ? "ch_dark" : "ch_light"} id="${id}">
        <div class="cpiHelper ui modal" id="cpiHelper_semanticui_modal"></div>
        <div class="cpiHelper ui modal" id="cpiHelper_waiting_model"></div>
        </div>`);
    } else {
      $("#cpihelperglobal").append(`<div id="${id}"></div>`);
    }
    toggleDarkMode();
    const observer = new MutationObserver(async function (mutationsList) {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          toggleDarkMode();
          await Themesync()
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });
  }
  return $(`#${id}`);
}
const body = (id = "cpihelperglobal") => {
  let element = document.querySelector(`#${id}`);
  if (!element) {
    createGlobalId();
    element = document.querySelector(`#${id}`);
  }
  return element;
};

function runGlobalIdForOneMinute() {
  const interval = 500;
  const duration = 60 * 1000;

  let intervalId = setInterval(() => {
    createGlobalId();
  }, interval);

  setTimeout(() => {
    clearInterval(intervalId);
    console.log("Interval cleared after 1 minute");
  }, duration);
}

// Start the function
runGlobalIdForOneMinute();

