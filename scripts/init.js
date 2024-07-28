function GlobalId(id = "cpihelperglobal") {
    let global = $(`#${id}`);
    if (global.length === 0) {
        console.log("Global element not found. Inserting element...");
        let newElement = (id === 'cpihelperglobal')
            ? $(`<div id="${id}"><div class="cpiHelper" id="cpiHelper_semanticui_modal"></div></div>`)
            : $(`<div id="${id}"></div>`);
        $("body").append(newElement);
    }
    return $(`#${id}`);
}

function runGlobalIdForOneMinute() {
    const interval = 500;
    const duration = 60 * 1000;

    let intervalId = setInterval(() => {
        GlobalId();
    }, interval);

    setTimeout(() => {
        clearInterval(intervalId);
        console.log("Interval cleared after 1 minute");
    }, duration);
}

// Start the function
runGlobalIdForOneMinute();

const body = (id = 'cpihelperglobal') => document.querySelector(`#${id}`);