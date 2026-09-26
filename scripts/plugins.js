// ----------------------
// content in message sidebar
// ----------------------

//creates plugin content area in message sidebar

async function getActivePlugins() {
  const plugins = [];
  for (const plugin of pluginList) {
    const settings = await getPluginSettings(plugin.id);
    if (settings[plugin.id + "---isActive"] === true) plugins.push(plugin);
  }
  return plugins;
}

// last node messageSidebarContent.onRender returned per plugin, null when it returned nothing, "failed" when it threw
var pluginContentNodes = new Map();

async function renderPluginContent(plugin) {
  const node = plugin.messageSidebarContent.onRender(cpiData, await getPluginSettings(plugin.id));
  pluginContentNodes.set(plugin.id, node instanceof Node ? node : null);
  return node;
}

// onRender used to run whenever the message popup rendered and some plugins rely on that: credentialHelper
// hooks into the page, settingsPaneResizer resizes on every refresh. so it runs when the toolbar is built
// and, for plugins that are not static, again on every message refresh
async function runPluginContentHooks(onlyNonStatic = false) {
  for (const plugin of await getActivePlugins()) {
    if (!plugin.messageSidebarContent?.onRender || plugin.toolbarButton?.onClick) continue;
    if (onlyNonStatic && plugin.messageSidebarContent.static) continue;
    try {
      await renderPluginContent(plugin);
    } catch (error) {
      // it may only fail while the page is still loading: keep the button, the panel renders again and shows the error
      pluginContentNodes.set(plugin.id, "failed");
      log.error(`plugin ${plugin.id}: messageSidebarContent.onRender failed`, error);
    }
  }
}

// content of the panel: a static plugin keeps its node, the others render again with the current data
async function getPluginPanelContent(plugin) {
  const cached = pluginContentNodes.get(plugin.id);
  if (plugin.messageSidebarContent.static && cached instanceof Node) return cached;
  return renderPluginContent(plugin);
}

// the plugin section of the floating toolbar. toolbarButton: the click runs onClick directly.
// messageSidebarContent: the click opens a panel with what onRender returns. a plugin whose onRender returns
// nothing only uses it as a hook and gets no button. run runPluginContentHooks() first
async function getToolbarPlugins() {
  const entries = [];
  for (const plugin of await getActivePlugins()) {
    if (plugin.toolbarButton?.onClick) {
      entries.push({ plugin, kind: "button" });
    } else if (plugin.messageSidebarContent?.onRender && pluginContentNodes.get(plugin.id)) {
      entries.push({ plugin, kind: "panel" });
    }
  }
  return entries;
}

// toolbarButton.icon or messageSidebarContent.icon, like messageSidebarButton.icon ({ type: "icon", text: "xe088" }
// for SAP-icons, { type: "text", text: "VH" }); without it the plugin logo from settings.icon, else the initials
function createPluginToolbarIcon(plugin) {
  const icon = plugin.toolbarButton?.icon || plugin.messageSidebarContent?.icon;
  if (icon?.type === "icon" && /^x?[0-9a-f]{3,5}$/i.test(icon.text || "")) {
    const glyph = document.createElement("span");
    glyph.className = "cpiHelper_floatingToolbar_pluginIcon sapUiIcon";
    glyph.style.fontFamily = "SAP-icons";
    glyph.dataset.sapUiIconContent = String.fromCodePoint(parseInt(icon.text.replace(/^x/i, ""), 16));
    return glyph;
  }

  const initials = document.createElement("span");
  initials.className = "cpiHelper_floatingToolbar_pluginIcon cpiHelper_floatingToolbar_pluginInitials";
  if (icon?.type === "text" && icon.text) {
    initials.textContent = String(icon.text).substring(0, 3);
    return initials;
  }

  const logo = plugin.settings?.icon?.src;
  if (logo) {
    const image = document.createElement("img");
    image.className = "cpiHelper_floatingToolbar_pluginIcon";
    image.alt = "";
    image.src = chrome.runtime.getURL(logo);
    return image;
  }

  initials.textContent =
    String(plugin.name || plugin.id)
      .split(/[\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?";
  return initials;
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
      if ((plugin.messageSidebarButton && !plugin.messageSidebarButton.condition) || (plugin.messageSidebarButton && plugin.messageSidebarButton.condition(cpiData, settings, runInfoElement))) {
        var button = createElementFromHTML(`<button title='${plugin.messageSidebarButton.title}' id='cpiHelperPlugin--${plugin.id}' 
                class='${runInfoElement.messageGuid + flash}'>
                ${
                  plugin?.messageSidebarButton?.icon?.type === "icon"
                    ? `<span data-sap-ui-icon-content="&#${plugin.messageSidebarButton.icon.text}" class="sapUiIcon sapUiIconMirrorInRTL" style="font-family: SAP-icons; font-size: 0.9rem;"></span>`
                    : plugin.messageSidebarButton.icon.text.substring(0, 3)
                }
                     </button>`);
        button.onclick = async (btn) => {
          let pluginID = btn.target.id.replace("cpiHelperPlugin--", "");
          let pluginItem = pluginList.find((element) => element.id == pluginID);
          let pluginsettings = await getPluginSettings(pluginID);
          let pluginbtnstatus = document.querySelector(`[id='cpiHelperPlugin--${pluginID}'].${runInfoElement.messageGuid}`);
          isactivebutton = !pluginbtnstatus.classList.contains("cpiHelper_plugin-active");
          pluginItem.messageSidebarButton.onClick(cpiData, pluginsettings, runInfoElement, isactivebutton);
          if (!isactivebutton) {
            pluginbtnstatus.classList.remove("cpiHelper_plugin-active");
          } else {
            document.querySelectorAll(`#outerFrame button`).forEach((e) => e.classList.remove("cpiHelper_plugin-active"));
            pluginbtnstatus.classList.add("cpiHelper_plugin-active");
          }
          statistic("messagebar_btn_plugin_click", pluginID);
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
      if ((plugin[type] && !plugin[type].condition) || (plugin[type] && plugin[type].condition(cpiData, settings))) {
        log.log(plugin[type].icon.class);
        var button = createElementFromHTML(`<button title='${plugin[type].title}' id='cpiHelperPlugin--${plugin.id}' class='cpiHelper_pluginButton_${type} ${
          plugin[type].icon.class ? plugin[type].icon.class : "mini ui tertiary"
        } button cpiHelper_pluginButton'>
                ${
                  plugin[type]?.icon?.type === "icon"
                    ? `<span data-sap-ui-icon-content="&#${plugin[type]?.icon.text}" class="sapUiIcon sapUiIconMirrorInRTL ${plugin[type].icon.class ? plugin[type].icon.class : ""}" style="font-family: SAP-icons; font-size: 0.9rem;"></span>`
                    : plugin[type]?.title
                }</button>`);
        button.onclick = async (btn) => {
          let pluginID = btn.target.id.replace("cpiHelperPlugin--", "");
          let pluginItem = pluginList.find((element) => element.id == pluginID);
          let pluginsettings = await getPluginSettings(pluginID);
          pluginItem[type].onClick(cpiData, pluginsettings);
          statistic("messagebar_btn_plugin_click", pluginID);
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
  var container = document.createElement("div");
  container.className = "ui card";
  container.appendChild(
    createElementFromHTML(`<div class="extra content">
        <img class="right floated mini ui image" src=${plugin.settings["icon"] ? chrome.runtime.getURL(plugin.settings["icon"].src) : ""}>
        <div class="header">${plugin.name}</div>
        <a href=${plugin.website} target="_blank" class="meta">${plugin.author}</a>
    </div>`)
  );
  container.appendChild(createElementFromHTML(`<div class="content">${plugin.description}</div>`));
  if (await getStorageValue(plugin.id, "isActive", null)) {
    if (JSON.stringify(plugin.settings) !== "{}") {
      var subcontainer = document.createElement("div");
      subcontainer.classList = "ui segment";
      for (var key of Object.keys(plugin.settings)) {
        if (plugin.settings[key].type == "checkbox") {
          var checkbox = document.createElement("input");
          checkbox.id = `cpiHelper_popup_plugins-${plugin.id}-${key}`;
          checkbox.key = `${getStoragePath(plugin.id, key, plugin.settings[key].scope)}`;
          checkbox.type = "checkbox";
          checkbox.checked = await getStorageValue(plugin.id, key, plugin.settings[key].scope);

          checkbox.addEventListener("change", function () {
            log.log(checkbox.checked);
            chrome.storage.sync.set({ [this.key]: this.checked }, function () {
              log.log(`${plugin.id}--${key}` + " is set to " + checkbox.checked);
            });
          });

          var checkBoxLabel = document.createElement("label");
          checkBoxLabel.htmlFor = checkbox.id;
          checkBoxLabel.innerText = ` ${plugin.settings[key].text}`;
          var div = document.createElement("div");
          div.classList = "ui checkbox toggle";
          div.appendChild(checkbox);
          div.appendChild(checkBoxLabel);
          subcontainer.appendChild(div);
        }

        if (plugin.settings[key].type == "radio") {
          var radioGroupDiv = document.createElement("div");
          radioGroupDiv.classList = "ui form";
          radioGroupDiv.style.marginBottom = "8px";

          var groupLabel = document.createElement("div");
          groupLabel.classList = "ui tiny header";
          groupLabel.style.marginBottom = "6px";
          groupLabel.innerText = plugin.settings[key].text;
          radioGroupDiv.appendChild(groupLabel);

          var savedRadioValue = await getStorageValue(plugin.id, key, plugin.settings[key].scope);

          for (var option of plugin.settings[key].options) {
            var radioWrapper = document.createElement("div");
            radioWrapper.classList = "field";
            radioWrapper.style.marginBottom = "4px";

            var radioDiv = document.createElement("div");
            radioDiv.classList = "ui radio checkbox";

            var radioInput = document.createElement("input");
            var radioId = `cpiHelper_popup_plugins-${plugin.id}-${key}-${option.value}`;
            radioInput.id = radioId;
            radioInput.type = "radio";
            radioInput.name = `cpiHelper_popup_plugins-${plugin.id}-${key}`;
            radioInput.value = option.value;
            radioInput.checked = (savedRadioValue !== "" && savedRadioValue === option.value) || ((!savedRadioValue || savedRadioValue === "") && option.default === true);

            radioInput.addEventListener(
              "change",
              (function (storageKey, val, pluginId, radioKey) {
                return function () {
                  if (this.checked) {
                    chrome.storage.sync.set({ [storageKey]: val }, function () {
                      log.log(radioKey + " set to " + val);
                    });
                    // Show/hide any textinputs with showWhen linked to this radio key
                    var allLinked = document.querySelectorAll(`[data-show-when-key="cpiHelper_popup_plugins-${pluginId}-${radioKey}"]`);
                    allLinked.forEach(function (el) {
                      el.style.display = el.dataset.showWhenValue === val ? "" : "none";
                    });
                  }
                };
              })(getStoragePath(plugin.id, key, plugin.settings[key].scope), option.value, plugin.id, key)
            );

            var radioLabel = document.createElement("label");
            radioLabel.htmlFor = radioId;
            radioLabel.innerText = option.label;

            radioDiv.appendChild(radioInput);
            radioDiv.appendChild(radioLabel);
            radioWrapper.appendChild(radioDiv);
            radioGroupDiv.appendChild(radioWrapper);
          }

          subcontainer.appendChild(radioGroupDiv);
        }

        if (plugin.settings[key].type == "select") {
          var selectOuterDiv = document.createElement("div");
          selectOuterDiv.classList = "inputbox-spacing";

          var select = document.createElement("select");
          select.id = `cpiHelper_popup_plugins-${plugin.id}-${key}`;
          select.key = `${getStoragePath(plugin.id, key, plugin.settings[key].scope)}`;
          select.classList = "ui dropdown";

          var savedSelectValue = await getStorageValue(plugin.id, key, plugin.settings[key].scope);

          for (var selectOption of plugin.settings[key].options) {
            var optionElement = document.createElement("option");
            optionElement.value = selectOption.value;
            optionElement.innerText = selectOption.label;
            optionElement.selected = savedSelectValue !== "" ? savedSelectValue == selectOption.value : selectOption.default === true;
            select.appendChild(optionElement);
          }

          select.addEventListener("change", function () {
            log.log(this.key + " is set to " + this.value);
            chrome.storage.sync.set({ [this.key]: this.value });
            // Show/hide any settings with showWhen linked to this select
            document.querySelectorAll(`[data-show-when-key="${this.id}"]`).forEach((el) => {
              el.style.display = el.dataset.showWhenValue === this.value ? "" : "none";
            });
          });

          var selectDiv = document.createElement("div");
          selectDiv.classList = "ui fluid input";
          selectDiv.appendChild(createElementFromHTML(`<div class="ui basic label" for="cpiHelper_popup_plugins-${plugin.id}-${key}"> ${plugin.settings[key].text}</div>`));
          selectDiv.appendChild(select);
          selectOuterDiv.appendChild(selectDiv);
          subcontainer.appendChild(selectOuterDiv);
        }

        if (plugin.settings[key].type == "textinput") {
          var outerDiv = document.createElement("div");
          outerDiv.classList = "inputbox-spacing";
          var text = document.createElement("input");
          text.id = `cpiHelper_popup_plugins-${plugin.id}-${key}`;
          text.key = `${getStoragePath(plugin.id, key, plugin.settings[key].scope)}`;
          text.placeholder = `${plugin.settings[key].placeholder == undefined ? plugin.settings[key].text : plugin.settings[key].placeholder}`;
          text.type = "text";
          text.value = await getStorageValue(plugin.id, key, plugin.settings[key].scope);

          text.addEventListener("input", function (a) {
            //log.log(a);
            log.log(this.key + " is set to " + this.value);
            chrome.storage.sync.set({ [this.key]: this.value });
          });
          var div = document.createElement("div");
          div.classList = "ui fluid input";
          div.appendChild(createElementFromHTML(`<div class="ui basic label" for="cpiHelper_popup_plugins-${plugin.id}-${key}"> ${plugin.settings[key].text}</div>`));
          div.appendChild(text);
          outerDiv.appendChild(div);

          // Handle showWhen: hide this textinput unless the linked radio matches
          if (plugin.settings[key].showWhen) {
            var showWhenKey = plugin.settings[key].showWhen.key;
            var showWhenValue = plugin.settings[key].showWhen.value;
            var currentRadioValue = await getStorageValue(plugin.id, showWhenKey, plugin.settings[showWhenKey]?.scope);
            var defaultRadioOption = plugin.settings[showWhenKey]?.options?.find((o) => o.default === true);

            var resolvedRadioValue = currentRadioValue !== "" ? currentRadioValue : defaultRadioOption?.value || "";

            outerDiv.style.display = resolvedRadioValue === showWhenValue ? "" : "none";

            // Store data attributes so radio change listeners can find and toggle this input
            outerDiv.dataset.showWhenKey = `cpiHelper_popup_plugins-${plugin.id}-${showWhenKey}`;
            outerDiv.dataset.showWhenValue = showWhenValue;
          }

          subcontainer.appendChild(outerDiv);
        }
        if (plugin.settings[key].type == "label") {
          var label = document.createElement("div");
          label.id = `cpiHelper_popup_plugins - ${plugin.id} -${key} `;
          label.innerText = plugin.settings[key].text;

          var div = document.createElement("div");
          div.classList = "ui pointing below label";
          div.appendChild(label);
          subcontainer.appendChild(div);
        }
        if (plugin.settings[key].type == "text") {
          var text = document.createElement("div");
          text.id = `cpiHelper_popup_plugins - ${plugin.id} -${key} `;
          text.innerHTML = plugin.settings[key].text;
          var div = document.createElement("div");
          div.classList = plugin.settings[key].class;
          div.appendChild(text);
          subcontainer.appendChild(div);
        }
        if (plugin.settings[key].type == "button") {
          var btn = document.createElement("button");
          btn.classList = plugin.settings[key].class;
          btn.id = `cpiHelper_popup_plugins - ${plugin.id} -${key} `;
          btn.innerHTML = plugin.settings[key].title;
          btn.onclick = plugin.settings[key].fun;
          subcontainer.appendChild(btn);
        }
      }
      if (subcontainer.childElementCount > 0) {
        container.appendChild(subcontainer);
      }
    }
  }
  var activeCheckbox = document.createElement("input");
  activeCheckbox.id = `cpiHelper_popup_plugins-${plugin.id}`;
  activeCheckbox.type = "checkbox";
  activeCheckbox.style = "display:none";
  activeCheckbox.checked = await getStorageValue(plugin.id, "isActive");
  activeCheckbox.addEventListener("change", async function () {
    containerbox = document.querySelector(`#cpiHelper_popup_plugins-${plugin.id}`).parentNode;
    log.log(activeCheckbox.checked);
    await syncChromeStoragePromise(getStoragePath(plugin.id, "isActive"), activeCheckbox.checked);
    activeCheckbox.checked ? containerbox.classList.add("checked") : containerbox.classList.remove("checked");
    statistic("toggle_plugin_active", plugin.id, activeCheckbox.checked);
    showBigPopup(await createContentNodeForPlugins(), "Plugins");
  });
  var div = document.createElement("div");
  div.classList = `extra content ui toggle ${activeCheckbox.checked ? "checked" : ""}`;
  div.style.padding = 0;
  div.appendChild(activeCheckbox);
  div.appendChild(createElementFromHTML(`<label for="cpiHelper_popup_plugins-${plugin.id}"> Activate</label>`));
  container.appendChild(div);
  return container;
}

async function runPluginHeartbeat() {
  for (var plugin of pluginList) {
    var settings = await getPluginSettings(plugin.id);
    if (settings[plugin.id + "---isActive"] === true) {
      if (plugin["heartbeat"]) {
        await plugin["heartbeat"](cpiData, settings);
      }
    }
  }
}

//creates the content for the plugin popup
async function createContentNodeForPlugins() {
  var pluginUIList = document.createElement("div");
  pluginUIList.id = "cpiHelper_popup_plugins";
  pluginUIList.className = "ui cards";

  //sort by alphabet and figaf plugins
  let sortedList = pluginList
    .sort((x, y) => {
      return x.id.toLowerCase() > y.id.toLowerCase() ? 1 : -1;
    })
    .sort((x, y) => {
      return x.id.toLowerCase().includes("figaf") && !y.id.toLowerCase().includes("figaf") ? -1 : 1;
    });
  for (var element of sortedList) {
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
    return "";
  }
  return result;
}

async function getPluginSettings(id) {
  var storage = await callChromeStoragePromise(null);
  var settings = Object.keys(storage)
    .filter((key) => key.startsWith(id))
    .reduce((obj, key) => {
      obj[key] = storage[key];
      return obj;
    }, {});
  return settings;
}
