async function Themesync() {
  // const { darkmodeonstartup } = await chrome.storage.sync.get('darkmodeonstartup');
  const isDarkTheme = $('html').hasClass('sapUiTheme-sap_horizon');
  $("#cpihelperglobal").removeClass("ch_dark ch_light").addClass(!isDarkTheme ? "ch_dark" : "ch_light");
  await chrome.storage.sync.set({ "CPIhelperThemeInfo": isDarkTheme });
}

function createGlobalId(id = "cpihelperglobal") {
  let global = $(`#${id}`);
  const toggleDarkMode = () => {
    $("#cpihelperglobal").attr("class", $("html").hasClass("sapUiTheme-sap_horizon_dark") ? "ch_dark" : "ch_light");
    // chrome.storage.sync.get("CPIhelperThemeInfo", (theme) => {
      // chrome.storage.sync.get("darkmodeOnStartup", (local) => {
        // let isDarkmode = !(theme['CPIhelperThemeInfo'])
        // if (!isDarkmode) {
        //   isDarkmode = (local['darkmodeOnStartup'])
        // }
        // $("#cpihelperglobal").attr('class', (isDarkmode ? "ch_dark" : "ch_light"))
      // });
    // });
  }
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
 //   toggleDarkMode();
  /*  const observer = new MutationObserver(async function (mutationsList) {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          toggleDarkMode();
          await Themesync()
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });
    */
  }
  return $(`#${id}`);
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

// Start the function
runGlobalIdForOneMinute();



const body = (id = "cpihelperglobal") => {
  let element = document.querySelector(`#${id}`);
  if (!element) {
    createGlobalId();
    element = document.querySelector(`#${id}`);
  }
  return element;
};