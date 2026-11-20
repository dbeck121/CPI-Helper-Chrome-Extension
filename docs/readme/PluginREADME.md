# Plugin Engine
|[Home](/README.md)|[Contribution](/docs/readme/contributing.md)|[Code of conduct](/docs/readme/code_of_conduct.md)|[License](/docs/LICENSE)|
|-|-|-|-|

The CPI-Helper has a basic plugin engine so that developers can create their own plugins. Plugins must be added to the git and shipped to Chrome Store to be available for everyone.
The cpi helper hacks into the CPI (CI) but has only limited possibilities. There seems to be no way to access the javascript from the CPI itself. The plugin just adds its own javascript and uses some apis from cpi. This means it is probably not possible to develop a plugin that adds custom modules or changes the iflow itself.

In case of questions, please open an issue in github.

## Steps for developing an own plugin

1. Clone git
2. Copy example.js in plugins folder and adopt to your needs. Please keep it in plugins folder.
3. register the file in manifest.json
4. If you want to ship it with CPI-Helper, open an issue first, then make a pull request that follows the [contribution rules](/docs/readme/contributing.md) and the PR template (screenshots, data flow statement, security checklist).

### Private plugins (unpacked extension only)

Plugins for your own requirements that are not useful for everyone (e.g. customer specific plugins) can live in `plugins/custom/` without changing `manifest.json`. The folder is gitignored and not part of the release zip.

To update CPI Helper, replace everything except `plugins/custom/`. Private plugins are your responsibility: `pluginList`, `cpiData` and the helpers are not a versioned API and can change with new versions, so check your plugins after an update.

1. Put your plugin file into `plugins/custom/`, e.g. `plugins/custom/myPlugin.js` (same format as `example.js`)
2. List it in `plugins/custom/plugins.json`: `["myPlugin.js"]`
3. Reload the CPI page (after a change to `manifest.json` or `background.js` also reload the extension)
4. Open the plugins popup and activate the "Private plugins" card (once per browser, the card only shows when `plugins.json` exists). Then activate your plugin like any other

`background.js` injects the listed files into the same context as the other plugins, so `pluginList`, `cpiData`, `log`, jQuery and the UI helpers are available. Private plugins run with the same rights as the CPI Helper itself: they can read everything in your tenant. Only add code you trust.

## Details

### Rules

Plugins are off by default. When a user switches one on, CPI Helper warns that plugins are community code, not reviewed by the CPI Helper team, and used at their own risk. The rules make sure that switching a plugin off really means it does nothing.

1. **Nothing runs and no global names are declared while the plugin is off.** See below.
2. **No data to other servers** than the CPI tenant, unless that is the purpose of the plugin. Then only after the user triggered the action, and the `description` of the plugin names the service. Every PR states the data flow.
3. No `eval`, `new Function`, remote code, or unescaped tenant data or user input in `innerHTML`.
4. No new permissions, host permissions, web accessible resources or libraries without an issue discussed first. No minified or obfuscated code.
5. No passwords, tokens or keys in plugin settings or `chrome.storage.sync`, they sync through the Google account.
6. Changes on the tenant only after an explicit click, destructive ones ask with `cpihConfirm` first.
7. CSS is scoped to the plugin (classes prefixed with the plugin id), no global styles.
8. If the plugin needs an account, a license or a paid service, the `description` says so.
9. Only very small text on messageSidebarButton.
10. If you do not need settings, messageSidebarButton or messageSidebarContent, do not add it to your plugin object.
11. All plugins are released under the same license as CPI-Helper (GPL-3.0).
12. The filename has no special characters or spaces and equals the `id`. Filenames are case sensitive.
13. Open an issue if you need more than the provided functions and objects. Plugins do not change core files.
14. Append elements under the global cpihelper element. Use `body().append` instead of `document.body.append`.

### Nothing runs while the plugin is off

Every file in `plugins/` is loaded as a content script on every CPI page, whether the plugin is active or not, and all files share one global scope. The engine only calls the hooks (`onRender`, `onClick`, `condition`, `heartbeat`, ...) of active plugins. Everything outside the plugin object runs anyway.

So a plugin file has one of two shapes. Both are fine, the check accepts both.

**Recommended: a wrapper that only declares and registers.** Helpers, constants and state stay private to your plugin and do not clash with other plugins:

```js
(() => {
  const MAX_ROWS = 500;
  let observer = null;

  function format(text) {
    return text.trim();
  }

  const plugin = {
    metadataVersion: "1.0.0",
    id: "myplugin",
    // ...
    messageSidebarContent: {
      static: true,
      onRender: (pluginHelper, settings) => {
        if (!observer) {
          observer = new MutationObserver(() => { /* ... */ });
          observer.observe(document.body, { childList: true, subtree: true });
        }
        const div = document.createElement("div");
        div.textContent = format(" hello ");
        return div;
      },
    },
  };

  pluginList.push(plugin);
})();
```

Inside the wrapper only declarations are allowed: `const`/`let`/`var` with plain values (numbers, strings, objects, arrays, functions) and `function` declarations, plus `pluginList.push(plugin)`. Nothing that runs: no `addEventListener`, `setInterval`/`setTimeout`, `new MutationObserver(...)`, `document.querySelector(...)`, `chrome.storage` calls, `if`/`for` or injected `<script>` tags. Those belong in a hook, so they only start while the plugin is active. The wrapper takes no arguments and there is only one per file.

**Without a wrapper** the file has exactly two top-level statements, `var plugin = { ... };` and `pluginList.push(plugin);`. Helpers and state then go on the plugin object. Careful: every unwrapped plugin assigns the same global `plugin`, so after loading it points to the last plugin. Inside a hook never use `plugin.`, look up your own object by id:

```js
var plugin = {
  metadataVersion: "1.0.0",
  id: "myplugin",
  // ...
  state: { observer: null },
  helpers: {
    format(text) {
      return text.trim();
    },
  },
  messageSidebarContent: {
    static: true,
    onRender: (pluginHelper, settings) => {
      const self = pluginList.find((p) => p.id === "myplugin");
      if (!self.state.observer) {
        self.state.observer = new MutationObserver(() => { /* ... */ });
        self.state.observer.observe(document.body, { childList: true, subtree: true });
      }
      const div = document.createElement("div");
      div.textContent = self.helpers.format(" hello ");
      return div;
    },
  },
};

pluginList.push(plugin);
```

Some older plugins still declare helpers at top level. The automatic PR check blocks new violations and reports the old ones as warnings. Never rename the `id` of an existing plugin, it is the storage key of its settings.

### UI helpers (since 4.0)

jQuery and Fomantic UI are no longer part of CPI Helper. Plugins use plain DOM APIs and these globals from `common/ui-kit.js`:

| FUNCTION | USE |
| --- | --- |
| `pluginHelper.functions.popup(content, title)` / `showBigPopup(content, title, options)` | the big CPI Helper popup, content is a string, a node or an async function |
| `showToast(message, title, type)` / `cpihToast({ message, title, type, displayTime, closeIcon, position, onRemove })` | toast, type is `success`, `error`, `warning` or empty |
| `cpihConfirm({ title, content, approveText, denyText })` | yes/no dialog, resolves with `true` or `false` |
| `cpihModal.show(element, { closable, onShow, onHidden, onApprove, onDeny })` / `cpihModal.hide(element)` | own modals (`<div class="ui modal">` with `.header`, `.content`, `.actions`) |
| `cpihActivateTab(context, name)` | switch tabs programmatically; `.ui.menu .item[data-tab]` + `.ui.tab[data-tab]` pairs work without any call |
| `cpihTableSort(table)` | click to sort a table by its header cells |
| `cpihSearch(container, { source, onSelect })` | autocomplete for a `.ui.search` block |
| `cpihQs(selector)` / `cpihQsa(selector)` / `cpihIsDark()` | null safe query helpers, dark theme check |
| `formatTrace(text, id)` | payload viewer (Ace editor with pretty print, search, fullscreen) |

The markup keeps the familiar class names (`ui button`, `ui segment`, `ui message`, `ui table`, `ui form`, `ui toggle checkbox`, ...), they are styled by `css/ui.css` and follow the light and dark CPI theme. A failing hook is logged and does not affect other plugins.

## Plugin Implemetation metadata v1.0.0
### metadata description
 | FIELD NAME      | VALUE                     | DESCRIPTION                                                       |
 | --------------- | ------------------------- | ----------------------------------------------------------------- |
 | metadataVersion | 1.0.0                     | specify metadata version here                                     |
 | id              | exampleid1                | the id of the plugin. same as file name and no special characters |
 | name            | example 1                 | A readable name of the plugin                                     |
 | version         | 0.0.1                     | the code version of the plugin                                    |
 | author          | Kangoolutions             | the name (first and last) or company of the author                |
 | website         | https://kangoolutions.com | The website and where can we reach the author                     |
 | email           | author@company.com        | an email where to reach the author                                |
 | description     | Example plugin            | a short description what the plugin does                          |

### Settings : 
defines the settings and appearance in plugin popup
 | TYPE      | FIELD Value                                            | DESCRIPTION                                 | SCOPE   |
 | --------- | ------------------------------------------------------ | ------------------------------------------- | ------- |
 | label     | "text": "This is a plugin"                             | a label with additional info                | NA      |
 | textinput | "text": "Tenant URL"                                   | a textfield that is stored for each tenant  | tenant  |
 | textinput | "text": "Iflow xy"                                     | a textfield that is stored for each iflow   | iflow   |
 | textinput | "text": "general"                                      | a textfield that is stored for each browser | browser |
 | textinput | "text": "URL", "placeholder": "https://example.com"   | optional placeholder shown when field is empty; works on any textinput scope | any |
 | checkbox  | "text": "xyz"                                          | a checkbox that is stored for each browser  | browser |
 | radio     | "text": "Pick an option", "options": [{value, label, default?}] | a radio button group; one option can be marked default: true; stored per browser | browser |
 | select    | "text": "Interval", "options": [{value, label, default?}] | a dropdown; same options shape as radio, one option can be marked default: true | any |
 | icon      | "src" : "/images/plugin_logos/[your Image Source].png" | image for plugin page                       | NA      |

**`showWhen`** (optional) — any setting can include `"showWhen": { "key": "<settingKey>", "value": "<settingValue>" }` to conditionally show it only when another setting in the same plugin equals the specified value. Commonly used to reveal a custom URL textinput only when a `radio` is set to `"custom"`. A `select` toggles linked settings the same way.

### messageSidebarButton: 
if you want to add a button to message sidebar
 | FIELD     | FIELD VALUE                             | DESCRIPTION                                                                            |
 | --------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
 | icon*     | "text": "E", "type": "text"             | please keep it short (will be truncated after 3 letters)                               |
 | icon*     | "text": "xe088", "type": "icon"         | unicode for link icon Type = icon (From SAP UI5)/text & text HTML/Text for the button. |
 | title     | Example Title                           | hover title                                                                            |
 | onClick   | (pluginHelper, settings, runInfo, active) => {} | write the javascript you need in the onclick method                             |
 | condition | (pluginHelper, settings, runInfo) => {} | can be missing. that means it is always true                                           |

\*type text/icon (icon field)
onClick:
 | PARAMETERS   | DESCRIPTION                                                                 |
 | ------------ | --------------------------------------------------------------------------- |
 | pluginHelper | an object with additional iflow information and functions that you can user |
 | settings     | data that is stored (see settings element)                                  |
 | runInfo      | details to the message run that belongs to the specific button              |
 | active    | boolean type, status of button          | 
 
 | Logging Notes:  | Example                                                                     |
 | --------------- | --------------------------------------------------------------------------- |
 | not recommended | log.log(document.getElementById("__xmlview0--ceFileLabel-bdi").textContent) |
 | recommended     | log.log(document.querySelector('bdi[id$="--ceFileLabel-bdi"]').textContent) |

### toolbarButton: 
a button in the plugin section of the floating CPI Helper toolbar that runs an action directly, without a panel. Use it when your plugin would only render a single button anyway
 | FIELD NAME | VALUE                                   | DESCRIPTION                                                              |
 | ---------- | --------------------------------------- | ------------------------------------------------------------------------ |
 | title      | "Undeploy"                              | label in the toolbar (defaults to the plugin name)                       |
 | onClick    | (pluginHelper, settings) => {}          | runs on click, may be async                                              |
 | icon       | "text": "xe088", "type": "icon"         | optional, same format as the messageSidebarButton icon                   |

If a plugin has both `toolbarButton` and `messageSidebarContent`, only the toolbarButton is shown.

### messageSidebarContent Button: 
gives the plugin a button in the plugin section of the floating CPI Helper toolbar. A click opens a panel next to the toolbar that shows what `onRender` returns (before 4.0 this was the plugin area of the message sidebar). Use it for content: forms, inputs, several buttons, text.

`onRender` also runs without the panel being opened: when the toolbar is built and, unless `static` is set, on every message refresh. A plugin that returns nothing from `onRender` only uses it as a hook and gets no toolbar button.
 | FIELD NAME | VALUE                                    | DESCRIPTION                                                                                      |
 | ---------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
 | onRender   | (pluginHelper, settings) => {return div} | implement and return html element                                                                |
 | static     | false                                    | true: rendered once and kept (state like typed text stays). false: rendered again on every open  |
 | icon       | "text": "xe088", "type": "icon"          | optional, same format as the messageSidebarButton icon: SAP UI5 icon or "type": "text" (3 letters) |

Without `icon` the toolbar uses the plugin logo from `settings.icon`, else the initials of the plugin name.

onRender parameter:
 | FIELD            | DESCRIPTION                                                                 |
 | ---------------- | --------------------------------------------------------------------------- |
 | **pluginHelper** | an object with additional iflow information and functions that you can user |
 | **settings**     | data that is stored (see settings element)                                  |

### addtional buttons
 | FIELD                  | DESCRIPTION                                                  |
 | ---------------------- | ------------------------------------------------------------ |
 | scriptCollectionButton | a button that can be used to interact with script collection |
 | scriptButton           | a button that can be used to interact with scripts           |
 | xsltButton             | a button that can be used to interact with xslt              |


#### metadata description
## Example js
```
var plugin = {
    metadataVersion: "1.0.0", //specify metadata version here
    id: "exampleid1", //the id of the plugin. same as file name and no special characters
    name: "example 1", //A readable name of the plugin
    version: "0.0.1", //the code version of the plugin
    author: "Kangoolutions", //the name (first and last) or company of the author
    website: "https://kangoolutions.com", //The website and where can we reach the author
    email: "author@company.com", //an email where to reach the author
    description: "Example plugin", //a short description what the plugin does
    settings: { //defines the settings and appearance in plugin popup
        "text1": { "text": "This is a plugin", "type": "label" }, //a label with additional info
        "textField1": { "text": "Tenant URL", "type": "textinput", scope: "tenant" }, //a textfield that is stored for each tenant
        "textField2": { "text": "Iflow xy", "type": "textinput", scope: "iflow" }, //a textfield that is stored for each iflow
        "textField3": { "text": "general", "type": "textinput", scope: "browser" }, //a textfield that is stored for each browser
        "checkbox1": { "text": "xyz", "type": "checkbox", scope: "browser" }, //a checkbox that is stored for each browser
        "radioField1": { 
            "text": "Pick an option", 
            "type": "radio", 
            scope: "browser",           // radio is always browser-scoped
            "options": [
                { value: "option1", label: "Option 1", default: true }, // default: true marks the pre-selected option
                { value: "option2", label: "Option 2" },
                { value: "custom",  label: "Custom URL" }
            ]
        },
        "customUrl1": { 
            "text": "Custom URL", 
            "type": "textinput", 
            scope: "browser",
            "placeholder": "https://your-custom-ide.com/share/",
            "showWhen": { "key": "radioField1", "value": "custom" } // only visible when radioField1 === "custom"
        },
        "icon": { "type": "icon", "src": "/images/plugin_logos/[your Image Source].png" } // image for plugin page
    },

    messageSidebarButton: { //if you want to add a button to message sidebar "for each flow"
        "icon": { "text": "E", "type": "text" },
        "icon": { "text": "xe088", "type": "icon" }, //unicode for link icon Type = icon (From SAP UI5)/text & text HTML/Text for the button.
        // please keep it short (will be truncated after 3 letters)
        "title": "Example Title", //hover title
        "onClick": (pluginHelper, settings, runInfo, active) => { //write the javascript you need in the onclick method
            console.log("clicked");
            console.log(pluginHelper);
            console.log(settings);
            console.log(runInfo);
            console.log(active); //status of button (Boolean)
        },
        "condition": (pluginHelper, settings, runInfo) => { // can be missing. that means it is always true
            console.log(pluginHelper);
            console.log(settings);
            console.log(runInfo);
            //eg runInfo.logLevel === "trace"
            return true;
        }
    },
    toolbarButton: { //button in the plugin section of the toolbar that runs directly, no panel
        "icon": { "text": "xe088", "type": "icon" }, //optional
        "title": "Example Title", //defaults to the plugin name
        "onClick": (pluginHelper, settings) => {
            log.log("clicked");
        }
    },
    messageSidebarContent: { //button in the plugin section of the toolbar, onRender fills the panel it opens
        "icon": { "text": "xe088", "type": "icon" }, //optional, falls back to settings.icon, then to the initials of the name
        "onRender": (pluginHelper, settings) => { //implement and return html element
            console.log(pluginHelper);
            console.log(settings);
            var div = document.createElement("div");
            div.innerText = "Example content";
            return div; //html element to return.
        },
        "static": false //true: rendered once and kept, false: rendered again every time the panel opens
    },
    scriptCollectionButton: { //a button that can be used to interact with script collection
        "icon": { "text": "E", "type": "text" },
        "icon": { "text": "xe088", "type": "icon" }, //unicode for link icon Type = icon (From SAP UI5)/text & text HTML/Text for the button.
        "title": "Example Title",
        "onClick": (pluginHelper, settings) => {
            log.log("clicked");
            log.log(pluginHelper);
            log.log(settings);
            log.log(pluginHelper.currentArtifactId)
            log.log(pluginHelper.currentArtifactType)
            log.log(pluginHelper.currentPackageId)
            // not good: log.log(document.getElementById("__xmlview0--ceFileLabel-bdi").textContent)
            //better:
            log.log(document.querySelector('bdi[id$="--ceFileLabel-bdi"]').textContent)
        },
        condition: (pluginHelper, settings) => {
            //condition can be null or a function that returns true or false
            return true
        }
    },
    scriptButton: { //a button that can be used to interact with scripts
        "icon": { "text": "E", "type": "text" },
        "icon": { "text": "xe088", "type": "icon" }, //unicode for link icon Type = icon (From SAP UI5)/text & text HTML/Text for the button.
        "title": "Example Title",
        "onClick": (pluginHelper, settings) => {
            log.log("clicked");
            log.log(pluginHelper);
            log.log(settings);
            log.log(pluginHelper.currentArtifactId)
            log.log(pluginHelper.currentArtifactType)
            log.log(pluginHelper.currentIflowId)
            log.log(pluginHelper.currentPackageId)
            log.log(pluginHelper.lastVisitedIflowId)
        },
        condition: (pluginHelper, settings) => {
            return true
        }
    },
    xsltButton: { //a button that can be used to interact with xslt
        "icon": { "text": "E", "type": "text" },
        "icon": { "text": "xe088", "type": "icon" }, //unicode for link icon Type = icon (From SAP UI5)/text & text HTML/Text for the button.
        "title": "Example Title",
        "onClick": (pluginHelper, settings) => {
            log.log("clicked");
            log.log(pluginHelper);
            log.log(settings);
            log.log(pluginHelper.currentArtifactId)
            log.log(pluginHelper.currentArtifactType)
            log.log(pluginHelper.currentIflowId)
            log.log(pluginHelper.currentPackageId)
            log.log(pluginHelper.lastVisitedIflowId)
        },
        condition: (pluginHelper, settings) => {
            return true
        }
    },
}
pluginList.push(plugin);
```