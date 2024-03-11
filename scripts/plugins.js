// ----------------------
// content in message sidebar
// ----------------------

//creates plugin content area in message sidebar

async function messageSidebarPluginContent(forceRender = false) {

    let activeness = false;
    for (element of pluginList) {
        var settings = await getPluginSettings(element.id);
        if (settings[element.id + "---isActive"] === true && (element?.messageSidebarContent?.onRender && (!element?.messageSidebarContent?.static || forceRender == true))) {
            activeness = true;
            var div = document.getElementById("cpiHelper_messageSidebar_pluginArea_" + element.id)
            if (!div) {
                div = document.createElement("fieldset");
                div.id = "cpiHelper_messageSidebar_pluginArea_" + element.id;
                div.classList = "ui fluid segment";
            }
            div.innerHTML = ""
            div.appendChild(createElementFromHTML("<div class='ui tiny header'>" + element.name + "</div>"));
            div.appendChild(element.messageSidebarContent.onRender(cpiData, settings));
            document.querySelector('#cpiHelper_messageSidebar_pluginArea').appendChild(div);
        }
    }
    const ctxbtnclose = document.querySelector('#cpiHelper_contentheader')
    const pluginArea = document.querySelector('#cpiHelper_messageSidebar_pluginArea');


    if (ctxbtnclose.childElementCount == 2) {
        if (activeness == true) {
            ctxbtnclose.insertBefore(createElementFromHTML(`<i id='sidebar_Plugin' class="cpiHelper_closeButton_sidebar calendar ${pluginArea.classList.contains('visible') ? 'plus' : 'minus'} icon"></i>`), ctxbtnclose.childNodes[2]);
            document.querySelector('#sidebar_Plugin').classList.remove('cpiHelper_hidden');
            document.querySelector('#sidebar_Plugin').addEventListener('click', () => {
                twoClasssToggleSwitch(pluginArea, 'visible', 'cpiHelper_hidden')
                twoClasssToggleSwitch(document.querySelector('#sidebar_Plugin'), 'plus', 'minus')
            });
        }
        // twoClasssToggleSwitch(pluginArea, 'visible', 'cpiHelper_hidden')
        chrome.storage.sync.get(["openSidebarOnStartup"], function (result) {
            if (activeness) {
                twoClasssToggleSwitch(pluginArea, 'visible', 'cpiHelper_hidden')
                if (result["openSidebarOnStartup"]) {
                    twoClasssToggleSwitch(document.querySelector('#cpiHelper_messageSidebar_pluginArea>.header'), 'cpiHelper_hidden', 'visible');
                    twoClasssToggleSwitch(pluginArea, 'visible', 'cpiHelper_hidden')
                    twoClasssToggleSwitch(document.querySelector('#sidebar_Plugin'), 'plus', 'minus')
                }
            }
        })
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
                var button = createElementFromHTML(`<button title='${plugin.messageSidebarButton.title}' id='cpiHelperPlugin--${plugin.id}' 
                class='${runInfoElement.messageGuid + flash}'>
                ${(plugin?.messageSidebarButton?.icon?.type === "icon") ?
                        `<span data-sap-ui-icon-content="&#${plugin.messageSidebarButton.icon.text}" class="sapUiIcon sapUiIconMirrorInRTL" style="font-family: SAP-icons; font-size: 0.9rem;"></span>`
                        : plugin.messageSidebarButton.icon.text.substring(0, 3)}
                     </button>`);
                button.onclick = async (btn) => {
                    let pluginID = btn.target.id.replace("cpiHelperPlugin--", "")
                    let pluginItem = pluginList.find((element) => element.id == pluginID)
                    let pluginsettings = await getPluginSettings(pluginID);
                    let pluginbtnstatus = document.querySelector(`[id='cpiHelperPlugin--${pluginID}'].${runInfoElement.messageGuid}`)
                    isactivebutton = !pluginbtnstatus.classList.contains("cpiHelper_plugin-active")
                    pluginItem.messageSidebarButton.onClick(cpiData, pluginsettings, runInfoElement, isactivebutton);
                    if (!isactivebutton) {
                        pluginbtnstatus.classList.remove("cpiHelper_plugin-active")
                    } else {
                        document.querySelectorAll(`#outerFrame button`).forEach(e => e.classList.remove("cpiHelper_plugin-active"));
                        pluginbtnstatus.classList.add("cpiHelper_plugin-active")
                    }
                    statistic("messagebar_btn_plugin_click", pluginID)
                };
                pluginButtons.push(button);
            }
        }
    }
    return pluginButtons;
}

//type = scriptCollectionButton, scriptButton, xsltButton
async function createPluginButtons(type) {
    var pluginButtons = [];
    for (var plugin of pluginList) {
        var settings = await getPluginSettings(plugin.id);
        if (settings[plugin.id + "---isActive"] === true) {
            if (plugin[type] && !plugin[type].condition || plugin[type] && plugin[type].condition(cpiData, settings)) {
                var button = createElementFromHTML(`<button title='${plugin[type].title}' id='cpiHelperPlugin--${plugin.id}' class='cpiHelper_pluginButton_${type} mini ui button cpiHelper_pluginButton'>
                ${(plugin?.messageSidebarButton?.icon?.type === "icon") ?
                        `<span data-sap-ui-icon-content="&#${plugin.messageSidebarButton.icon.text}" class="sapUiIcon sapUiIconMirrorInRTL" style="font-family: SAP-icons; font-size: 0.9rem;"></span>` : plugin[type]?.title}</button>`);
                button.onclick = async (btn) => {
                    let pluginID = btn.target.id.replace("cpiHelperPlugin--", "")
                    let pluginItem = pluginList.find((element) => element.id == pluginID)
                    let pluginsettings = await getPluginSettings(pluginID);
                    pluginItem[type].onClick(cpiData, pluginsettings);
                    statistic("messagebar_btn_plugin_click", pluginID)
                };
                pluginButtons.push(button);
            }
        }
    }
    return pluginButtons;
}

/* old. replaced withcreatePluginButtons
async function createPluginScriptCollectionButtons() {
    var pluginButtons = [];
    for (var plugin of pluginList) {
        var settings = await getPluginSettings(plugin.id);
        if (settings[plugin.id + "---isActive"] === true) {
            if (plugin.scriptCollectionButton && !plugin.scriptCollectionButton.condition || plugin.scriptCollectionButton && plugin.scriptCollectionButton.condition(cpiData, settings)) {
                var button = createElementFromHTML("<button title='" + plugin.scriptCollectionButton.title + "' id='cpiHelperPlugin--" + plugin.id + "' class='cpiHelper_pluginButton_scriptCollection mini ui button'>" + plugin?.scriptCollectionButton?.text + "</button>");
 
                button.onclick = async (btn) => {
                    let pluginID = btn.target.id.replace("cpiHelperPlugin--", "")
                    let pluginItem = pluginList.find((element) => element.id == pluginID)
                    let pluginsettings = await getPluginSettings(pluginID);
                    pluginItem.scriptCollectionButton.onClick(cpiData, pluginsettings);
                    statistic("messagebar_btn_plugin_click", pluginID)
                };
 
                pluginButtons.push(button);
            }
        }
    }
    return pluginButtons;
}
 
async function createPluginScriptButtons() {
    var pluginButtons = [];
    for (var plugin of pluginList) {
        var settings = await getPluginSettings(plugin.id);
        if (settings[plugin.id + "---isActive"] === true) {
            if (plugin.scriptButton && !plugin.scriptButton.condition || plugin.scriptButton && plugin.scriptButton.condition(cpiData, settings)) {
                var button = createElementFromHTML("<button title='" + plugin.scriptButton.title + "' id='cpiHelperPlugin--" + plugin.id + "' class='cpiHelper_pluginButton_script mini ui button'>" + plugin?.scriptButton?.text + "</button>");
 
                button.onclick = async (btn) => {
                    let pluginID = btn.target.id.replace("cpiHelperPlugin--", "")
                    let pluginItem = pluginList.find((element) => element.id == pluginID)
                    let pluginsettings = await getPluginSettings(pluginID);
                    pluginItem.scriptButton.onClick(cpiData, pluginsettings);
                    statistic("messagebar_btn_plugin_click", pluginID)
                };
 
                pluginButtons.push(button);
            }
        }
    }
    return pluginButtons;
}
 
*/

// ----------------------
//plugin popup 
// ----------------------

//creates Fields for Plugin Popup
async function createPluginPopupUI(plugin) {

    var container = document.createElement('div');
    container.classList.add("card");
    container.appendChild(createElementFromHTML(`<div class="extra content">
        <img class="right floated mini ui image" src=${plugin.settings["icon"] ? chrome.runtime.getURL(plugin.settings["icon"].src) : ""}>
        <div class="header">${plugin.name}</div>
        <a href=${plugin.website} target="_blank" class="meta">${plugin.author}</a>
    </div>`));
    container.appendChild(createElementFromHTML(`<div class="content">${plugin.description}</div>`));
    if (await getStorageValue(plugin.id, "isActive", null)) {
        if (JSON.stringify(plugin.settings) !== '{}') {
            var subcontainer = document.createElement('div');
            subcontainer.classList = "ui segment"
            for (var key of Object.keys(plugin.settings)) {
                if (plugin.settings[key].type == "checkbox") {
                    var checkbox = document.createElement('input');
                    checkbox.id = `cpiHelper_popup_plugins-${plugin.id}-${key}`;
                    checkbox.key = `${getStoragePath(plugin.id, key, plugin.settings[key].scope)}`
                    checkbox.type = 'checkbox';
                    checkbox.checked = await getStorageValue(plugin.id, key, plugin.settings[key].scope);

                    checkbox.addEventListener('change', function () {
                        log.log(checkbox.checked);
                        chrome.storage.sync.set({ [this.key]: this.checked }, function () {
                            log.log(`${plugin.id}--${key}` + " is set to " + checkbox.checked);

                        });
                    });

                    var checkBoxLabel = document.createElement('label');
                    checkBoxLabel.htmlFor = checkbox.id;
                    checkBoxLabel.innerText = ` ${plugin.settings[key].text}`;
                    var div = document.createElement('div');
                    div.classList = "ui checkbox toggle";
                    div.appendChild(checkbox);
                    div.appendChild(checkBoxLabel);
                    subcontainer.appendChild(div);
                }

                if (plugin.settings[key].type == "textinput") {
                    var outerDiv = document.createElement('div');
                    var text = document.createElement('input');
                    text.id = `cpiHelper_popup_plugins-${plugin.id}-${key}`;
                    text.key = `${getStoragePath(plugin.id, key, plugin.settings[key].scope)}`
                    text.type = 'text';
                    text.value = await getStorageValue(plugin.id, key, plugin.settings[key].scope);

                    text.addEventListener('input', function (a) {
                        //log.log(a);
                        log.log(this.key + " is set to " + this.value);
                        chrome.storage.sync.set({ [this.key]: this.value });
                    });
                    var div = document.createElement('div');
                    div.classList = "ui fluid input"
                    div.appendChild(text);
                    div.appendChild(createElementFromHTML(`<div class="ui basic label" for="cpiHelper_popup_plugins-${plugin.id}-${key}"> ${plugin.settings[key].text}</div>`));
                    outerDiv.appendChild(div);
                    subcontainer.appendChild(outerDiv);
                }
                if (plugin.settings[key].type == "label") {
                    var label = document.createElement('div');
                    label.id = `cpiHelper_popup_plugins - ${plugin.id} -${key} `;
                    label.innerText = plugin.settings[key].text;

                    var div = document.createElement('div');
                    div.classList = "ui label"
                    div.appendChild(label);
                    subcontainer.appendChild(div);

                }
                if (plugin.settings[key].type == "text") {
                    var text = document.createElement('div');
                    text.id = `cpiHelper_popup_plugins - ${plugin.id} -${key} `;
                    text.innerHTML = plugin.settings[key].text
                    var div = document.createElement('div');
                    div.classList = plugin.settings[key].class
                    div.appendChild(text);
                    subcontainer.appendChild(div);
                }
                if (plugin.settings[key].type == "button") {
                    var btn = document.createElement('button');
                    btn.classList = plugin.settings[key].class
                    btn.id = `cpiHelper_popup_plugins - ${plugin.id} -${key} `;
                    btn.innerHTML = plugin.settings[key].title
                    btn.onclick = plugin.settings[key].fun
                    subcontainer.appendChild(btn);
                }
            }
            if (subcontainer.childElementCount > 0) { container.appendChild(subcontainer) }
        }
    }
    var activeCheckbox = document.createElement('input');
    activeCheckbox.id = `cpiHelper_popup_plugins-${plugin.id}`;
    activeCheckbox.type = 'checkbox';
    activeCheckbox.style = "display:none"
    activeCheckbox.checked = await getStorageValue(plugin.id, "isActive")
    activeCheckbox.addEventListener('change', async function () {
        containerbox = document.querySelector(`#cpiHelper_popup_plugins-${plugin.id}`).parentNode
        log.log(activeCheckbox.checked);
        await syncChromeStoragePromise(getStoragePath(plugin.id, "isActive"), activeCheckbox.checked);
        activeCheckbox.checked ? containerbox.classList.add('checked') : containerbox.classList.remove('checked');
        statistic("toggle_plugin_active", plugin.id, activeCheckbox.checked)
        showBigPopup(await createContentNodeForPlugins(), "Plugins")
    });
    var div = document.createElement('div');
    div.classList = `extra content ui toggle ${activeCheckbox.checked ? 'checked' : ""}`;
    div.style.padding = 0;
    div.appendChild(activeCheckbox);
    div.appendChild(createElementFromHTML(`<label for="cpiHelper_popup_plugins-${plugin.id}"> Activate</label>`));
    container.appendChild(div);
    return container;
}

//creates the content for the plugin popup
async function createContentNodeForPlugins() {

    var pluginUIList = document.createElement("div")
    pluginUIList.id = "cpiHelper_popup_plugins";
    pluginUIList.classList = 'ui cards'
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