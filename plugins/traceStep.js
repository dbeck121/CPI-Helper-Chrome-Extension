var plugin = {
    metadataVersion: "1.0.0",
    id: "traceModifer",
    name: "Trace Step Modifier (Beta)",
    version: "1.0.0",
    author: "incpi",
    email: "omk14p@outlook.com",
    website: "https://incpi.github.io",
    description: "change flow Trace Step to overwrite global varibale.",
    settings: {
        "detail": { "type": "text", "text": "Set null which will use global.<br/>Set Global (Scope: browser)<br/>Set flow modifer count (Scope: Iflow)" }
    },
    messageSidebarContent: {
        "static": true,
        "onRender": (pluginHelper, settings) => {
            var div = document.createElement("div");
            div.classList = "ui mini input"
            div.innerHTML = `<input type="number" id="top_${pluginHelper.currentArtifactId}" placeholder="Global"  min="0" name="cpi_top_mode">`;
            const inputSteps = div.querySelector(`#top_${pluginHelper.currentArtifactId}`)
            chrome.storage.local.get([`top_${pluginHelper.currentArtifactId}`], (result) => {
                data = result[`top_${pluginHelper.currentArtifactId}`];
                inputSteps.value = ((data !== null && data !== undefined) || data != "") ? parseInt(data) : 0
            })
            inputSteps.addEventListener('change', () => {
                data = inputSteps.value
                if ((data === null && data === undefined) || data === "") {
                    chrome.storage.local.remove([`top_${pluginHelper.currentArtifactId}`], function () {
                        var error = chrome.runtime.lastError;
                        if (error) {
                            console.error(error);
                        }
                    })
                } else {
                    chrome.storage.local.set(JSON.parse(`{ "top_${pluginHelper.currentArtifactId}":"${data}"}`))
                }
            })
            
            return div;
        }
    },
};

pluginList.push(plugin);