// ----------------------
// buttons in message sidebar
// ----------------------

//creates buttons in message sidebar
function createPluginButtonsInMessageSidebar() {
    var pluginButtons = [];
    for (var plugin of pluginList) {
        if (plugin.messageSidebarButton) {
            var button = createElementFromHTML(`<button title='${plugin.messageSidebarButton.title}' id='trace--" + i + "' class='" + resp[i].MessageGuid + flash + "'>${plugin.messageSidebarButton.text}</button>`);

            var pluginStorage = {};

            button.onclick = () => {
                plugin.messageSidebarButton.onClick(cpiData, pluginStorage);
            };

            pluginButtons.push(button);
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
        showBigPopup(await createContentNodeForPlugins(), "Plugins")

    });

    var div = document.createElement('div');
    div.appendChild(activeCheckbox);
    div.appendChild(createElementFromHTML(`<label for="cpiHelper_popup_plugins-${plugin.id}">activate</label>`));
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

                    checkbox.addEventListener('change', function () {
                        console.log(checkbox.checked);
                        chrome.storage.sync.set({ [this.key]: this.value }, function () {
                            console.log(`${plugin.id}--${key}` + " is set to " + checkbox.checked);
                        });
                    });

                    var div = document.createElement('div');
                    div.appendChild(checkbox);
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