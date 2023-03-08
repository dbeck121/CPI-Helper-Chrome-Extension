// ----------------------
// content in message sidebar
// ----------------------

//creates plugin content area in message sidebar

async function messageSidebarPluginContent(forceRender = false) {
    var pluginArea = document.getElementById('cpiHelper_messageSidebar_pluginArea');
    //pluginArea.innerHTML = "";

    for (element of pluginList) {
        var settings = await getPluginSettings(element.id);

        if (settings[element.id + "---isActive"] === true) {
            if (element?.messageSidebarContent?.onRender && (!element?.messageSidebarContent?.static || forceRender == true)) {
                var div = document.getElementById("cpiHelper_messageSidebar_pluginArea_" + element.id)
                if (!div) {
                    div = document.createElement("fieldset");
                    div.id = "cpiHelper_messageSidebar_pluginArea_" + element.id;
                }

                div.innerHTML = ""

                div.appendChild(createElementFromHTML("<legend>" + element.name + "</legend>"));
                div.appendChild(element.messageSidebarContent.onRender(cpiData, settings));
                pluginArea.appendChild(div);
            }
        }
    }
}


// ----------------------
// buttons in message sidebar
// ----------------------

//creates buttons in message sidebar
async function createPluginButtonsInMessageSidebar(runInfoElement, i, flash) {
    var pluginButtons = [];
    for (var plugin of pluginList) {
        var settings = await getPluginSettings(plugin.id);
        if (settings[plugin.id + "---isActive"] === true) {
            if (plugin.messageSidebarButton && !plugin.messageSidebarButton.condition || plugin.messageSidebarButton && plugin.messageSidebarButton.condition(cpiData, settings, runInfoElement)) {
                var button = createElementFromHTML("<button title='" + plugin.messageSidebarButton.title + "' id='cpiHelperPlugin--" + plugin.id + "' class='" + runInfoElement.messageGuid + flash + "'>" + plugin?.messageSidebarButton?.text?.substring(0, 3) + "</button>");

                button.onclick = async (btn) => {
                    let pluginID = btn.target.id.replace("cpiHelperPlugin--", "")
                    let pluginItem = pluginList.find((element) => element.id == pluginID)
                    let pluginsettings = await getPluginSettings(pluginID);
                    pluginItem.messageSidebarButton.onClick(cpiData, pluginsettings, runInfoElement);
                    statistic("messagebar_btn_plugin_click", pluginID)
                };

                pluginButtons.push(button);
            }
        }
    }
    return pluginButtons;
}

// ----------------------
//plugin popup 
// ----------------------

//creates Fields for Plugin Popup
async function createPluginPopupUI(plugin) {

    var container = document.createElement('fieldset');
    container.appendChild(createElementFromHTML(`<legend>${plugin.name} ${plugin.version} ${plugin.id}</legend>`));

    var activeCheckbox = document.createElement('input');
    activeCheckbox.id = `cpiHelper_popup_plugins-${plugin.id}`;
    activeCheckbox.type = 'checkbox';

    activeCheckbox.checked = await getStorageValue(plugin.id, "isActive")
    activeCheckbox.addEventListener('change', async function () {
        console.log(activeCheckbox.checked);
        await syncChromeStoragePromise(getStoragePath(plugin.id, "isActive"), activeCheckbox.checked);
        statistic("toggle_plugin_active", plugin.id, activeCheckbox.checked)
        showBigPopup(await createContentNodeForPlugins(), "Plugins")

    });

    var div = document.createElement('div');
    div.appendChild(activeCheckbox);
    div.appendChild(createElementFromHTML(`<label for="cpiHelper_popup_plugins-${plugin.id}"> activate</label>`));
    div.appendChild(createElementFromHTML(`<br>`));
    div.appendChild(createElementFromHTML(`<span>${plugin.description}</span>`));
    div.appendChild(createElementFromHTML(`<br>`));

    container.appendChild(div);

    if (await getStorageValue(plugin.id, "isActive", null)) {
        if (plugin.settings) {

            for (var key of Object.keys(plugin.settings)) {
                if (plugin.settings[key].type == "checkbox") {
                    var checkbox = document.createElement('input');
                    checkbox.id = `cpiHelper_popup_plugins-${plugin.id}-${key}`;
                    checkbox.key = `${getStoragePath(plugin.id, key, plugin.settings[key].scope)}`
                    checkbox.type = 'checkbox';
                    checkbox.checked = await getStorageValue(plugin.id, key, plugin.settings[key].scope);

                    checkbox.addEventListener('change', function () {
                        console.log(checkbox.checked);
                        chrome.storage.sync.set({ [this.key]: this.checked }, function () {
                            console.log(`${plugin.id}--${key}` + " is set to " + checkbox.checked);
                        });
                    });

                    var checkBoxLabel = document.createElement('label');
                    checkBoxLabel.htmlFor = checkbox.id;
                    checkBoxLabel.innerText = ` ${plugin.settings[key].text}`;

                    var div = document.createElement('div');
                    div.appendChild(checkbox);
                    div.appendChild(checkBoxLabel);
                    container.appendChild(div);
                }

                if (plugin.settings[key].type == "text") {
                    var text = document.createElement('input');
                    text.id = `cpiHelper_popup_plugins-${plugin.id}-${key}`;
                    text.key = `${getStoragePath(plugin.id, key, plugin.settings[key].scope)}`
                    text.type = 'text';
                    text.value = await getStorageValue(plugin.id, key, plugin.settings[key].scope);

                    text.addEventListener('input', function (a) {
                        console.log(a);
                        chrome.storage.sync.set({ [this.key]: this.value }, function () {
                            console.log(`${this.key} ` + " is set to " + text.value);
                        });
                    });
                    var div = document.createElement('div');
                    div.appendChild(text);
                    div.appendChild(createElementFromHTML(`<label for="cpiHelper_popup_plugins-${plugin.id}-${key}"> ${plugin.settings[key].text}</label>`));

                    container.appendChild(div);
                }
                if (plugin.settings[key].type == "label") {
                    var label = document.createElement('label');
                    label.id = `cpiHelper_popup_plugins - ${plugin.id} -${key} `;
                    label.innerText = plugin.settings[key].text;

                    var div = document.createElement('div');
                    div.appendChild(label);
                    container.appendChild(div);

                }

            }
        }
    }
    return container;


}

//creates the content for the plugin popup
async function createContentNodeForPlugins() {

    var pluginUIList = document.createElement("div")
    pluginUIList.id = "cpiHelper_popup_plugins";

    for (var element of pluginList) {
        pluginUIList.appendChild(await createPluginPopupUI(element));
    }
    return pluginUIList;
}

// creates the path for a storage element
function getStoragePath(pluginId, key, type = null) {
    return `${pluginId}---${type == "tenant" || type == "iflow" ? cpiData.tenant + "---" : ""}${type == "iflow" ? cpiData.integrationFlowId + "---" : ""}${key}`;
}

async function getStorageValue(pluginId, key, type = null) {
    var result = await callChromeStoragePromise(getStoragePath(pluginId, key, type));
    if (!result) {
        return ""
    }
    return result;
}

async function getPluginSettings(id) {
    var storage = await callChromeStoragePromise(null);
    var settings = Object.keys(storage)
        .filter(key => key.startsWith(id))
        .reduce((obj, key) => {
            obj[key] = storage[key];
            return obj;
        }, {});
    return settings;
}