# Plugin Engine (early beta)
|[Home](/README.md)|[Contribution](/docs/readme/contributing.md)|[Code of conduct](/docs/readme/code_of_conduct.md)|[License](/docs/LICENSE)|
|-|-|-|-|

The CPI-Helper has a basic plugin engine so that developers can create their own plugins. Plugins must be added to the git and shipped to Chrome Store to be available for everyone.
The cpi helper hacks into the CPI (CI) but has only limited possibilities. There seems to be no way to access the javascript from the CPI itself. The plugin just adds its own javascript and uses some apis from cpi. This means it is probably not possible to develop a plugin that adds custom modules or changes the iflow itself.

In case of questions, please open an issue in github.

## Steps for developing an own plugin

1. Clone git
2. Copy example.js in plugins folder and adopt to your needs. Please keep it in plugins folder.
3. register the file in manifest.json
4. If you want to ship it with CPI-Helper, make a pull-request with detailed description.

## Details

### Dos and Dont's

1. no calls to external pages except for opening new tabs
2. only very small text on messageSidebarButton
3. if you do not need settings, messageSidebarButton or messageSidebarContent, then do not add it to your plugin json
4. all plugins must be released under same license as CPI-Helper
5. the filename should not contain special characters or spaces. Be aware that the filename is case sensitiv
6. please open a ticket and start discussion if you need more than the provided functions and objects
7. Append any element under global cpihelper element. Must use `body().append` instead of `document.body.append` which directly append it to global tag.

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
 | checkbox  | "text": "xyz"                                          | a checkbox that is stored for each browser  | browser |
 | icon      | "src" : "/images/plugin_logos/[your Image Source].png" | image for plugin page                       | NA      |

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

### messageSidebarContent Button: 
can be used to show sth in message sidebar
 | FIELD NAME | VALUE                                    | DESCRIPTION                                                              |
 | ---------- | ---------------------------------------- | ------------------------------------------------------------------------ |
 | onRender   | (pluginHelper, settings) => {return div} | implement and return html element                                        |
 | static     | false                                    | set true to not reload plugin content with every message sidebar refresh |

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
    messageSidebarContent: { //can be used to show data in message sidebar plugin area
        "onRender": (pluginHelper, settings) => { //implement and return html element
            console.log(pluginHelper);
            console.log(settings);
            var div = document.createElement("div");
            div.innerText = "Example content";
            return div; //html element to return.
        },
        "static": false //set true to not reload plugin content with every message sidebar refresh
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
