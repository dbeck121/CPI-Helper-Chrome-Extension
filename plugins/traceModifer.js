clearalldata = () => {
    $.modal('confirm', {
        title: 'Are you sure to clear data?',
        handler: async (choice) => {
            if (choice) {
                chrome.storage.local.get(null, (items) => {
                    for (i of Object.keys(items)) {
                        if (i.startsWith("traceModifer_")) {
                            chrome.storage.local.remove([i], () => { var error = chrome.runtime.lastError; if (error) { console.error(error); } })
                            $.toast({ displayTime: 2000, title: 'Trace Modifer', message: i.replace('traceModifer_', "") + ' is removed', showProgress: 'bottom', classProgress: 'red' })
                        }
                    }
                });
                $.toast({ displayTime: 2000, title: 'Trace Modifer', message: 'All data cleared', showProgress: 'bottom', classProgress: 'green' })
            }
        }
    });
    ;
}

var plugin = {
    metadataVersion: "1.0.0",
    id: "traceModifer",
    name: "Trace Step Modifier (Beta)",
    version: "1.5.0",
    author: "Developed by Omkar",
    email: "omk14p@outlook.com",
    website: "https://incpi.github.io",
    description: `New Feature: Performance Statatics checkbox to enable inline trace.<br>The CPI Helper plugin lets developers use trace step modifiers in integration flows.<br/>
     But be careful: the plugin changes the global variable you set for each flow. it will use global instead if input is blank. <a href="https://incpi.github.io/cpihelper-plugin/">Read More</a>`,
    settings: {
        "detail": {
            "type": "text", "class": "ui fluid segment", "text": "Set null which will use global.<br/>Set Global (Scope: browser)<br/>Set flow modifer count (Scope: Iflow)"
        },
        "text": {
            "type": "text", "text": `Enter a number or leave blank. 0 => traces all steps and may freeze your browser. <br /> Blank => uses the global variable from the extension page.
            <br />Clear All: delete the saved data from the trace step modifier. Useful for starting over.`
        },
        "set_button": { "type": "button", "class": "ui fluid blue button", "title": "Clear All", "fun": clearalldata }
    },
    messageSidebarContent: {
        "static": true,
        "onRender": (pluginHelper, settings) => {
            var div = document.createElement("div");
            var inputtrace = document.createElement("div");
            inputtrace.classList = "ui mini fluid input"
            inputtrace.innerHTML = `<input type="number" id="traceModifer_${pluginHelper.currentArtifactId}" placeholder="Global"  min="0" name="cpi_traceModifer_mode"><br/>`;
            const inputSteps = inputtrace.querySelector(`#traceModifer_${pluginHelper.currentArtifactId}`)
            chrome.storage.local.get([`traceModifer_${pluginHelper.currentArtifactId}`], (result) => {
                data = result[`traceModifer_${pluginHelper.currentArtifactId}`];
                inputSteps.value = ((data !== null && data !== undefined) || data != "") ? parseInt(data) : 0
            })
            inputSteps.addEventListener('change', () => {
                data = inputSteps.value
                if ((data === null && data === undefined) || data === "") {
                    chrome.storage.local.remove([`traceModifer_${pluginHelper.currentArtifactId}`], function () {
                        var error = chrome.runtime.lastError;
                        if (error) {
                            console.error(error);
                        }
                    })
                } else {
                    chrome.storage.local.set(JSON.parse(`{ "traceModifer_${pluginHelper.currentArtifactId}":"${data}"}`))
                }
            })
            div.appendChild(inputtrace)
            div.innerHTML += `<div class="ui divider"></div>`
            var stats = document.createElement("div");
            stats.classList = "traceModifer"
            stats.innerHTML += `
            <div class="ui buttons fluid segment">
                <label class="ui violet mini circular left bottom floating label">MIN</label>
                <label class="ui red mini circular right bottom floating label">MAX</label>
            </div>`
            div.appendChild(stats);
            return div;
        }
    },
    messageSidebarButton: {
        "icon": { "type": "icon", "text": "xe0d9" },
        "title": "Trace Modifier",
        "onClick": async (pluginHelper, settings, runInfo) => {
            performancebutton = document.querySelector(`button[id="cpiHelperPlugin--traceModifer"].${runInfo.messageGuid}`)
            if (performancebutton.classList.contains('cpiHelper_inlineInfo-active')) {
                hideInlineTrace();
                performancebutton.classList.remove("cpiHelper_inlineInfo-active");
                showToast("Performance Stats Deactivated");
            } else {
                hideInlineTrace();
                var inlineTrace = await showInlineTrace(runInfo.messageGuid,true);
                if (inlineTrace) {
                    showToast("Performance Stats Activated");
                    performancebutton.classList.add("cpiHelper_inlineInfo-active");
                } else {
                    showToast("Performance Stats not possible", "No data found.", "warning");
                }
            }
        },
        "condition": (pluginHelper, settings, runInfo) => {
            return runInfo.logLevel === "trace";
        },
    },
};

pluginList.push(plugin);