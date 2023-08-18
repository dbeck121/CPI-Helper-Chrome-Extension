# Plugin Engine (early beta)

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

### Plugin Implemetation metadata v1.0.0

#### metadata description

```

//example.js

var plugin = {

    metadataVersion: "1.0.0",                   //specify metadata version here
    id: "exampleid1",                           //the id of the plugin. same as file name and no special characters
    name: "example 1",                          //A readable name of the plugin
    version: "0.0.1",                           //the code version of the plugin
    author: "Kangoolutions",                    //the name (first and last) or company of the author
    website: "https://kangoolutions.com",       //The website and where can we reach the author
    email: "author@company.com",                //an email where to reach the author
    description: "Example plugin",              //a short description what the plugin does
    settings: {                                 //defines the settings and appearance in plugin popup
        "text1": { "text": "This is a plugin", "type": "label" },                   //a label with additional info
        "textField1": { "text": "Tenant URL", "type": "text", scope: "tenant" },    //a textfield that is stored for each tenant
        "textField2": { "text": "Iflow xy", "type": "text", scope: "iflow" },       //a textfield that is stored for each iflow
        "textField3": { "text": "general", "type": "text", scope: "browser" },      //a textfield that is stored for each browser
        "checkbox1": { "text": "xyz", "type": "checkbox", scope: "browser" },      //a checkbox that is stored for each browser
    },

    messageSidebarButton: {                    //if you want to add a button to message sidebar, add a "messageSidebarButton" element
        "text": "E",                           //text for the button. please keep it short (will be truncated after 3 letters)
        "title": "Example Title",              //hover title
        "icon": "",                            //icon for the button (not yet implemented)
        "onClick": (pluginHelper, settings, runInfo) => {         //write the javascript you need in the onclick method
            console.log("clicked");
            console.log(pluginHelper);
            console.log(settings);
            console.log(runInfo);
        },
        "condition": (pluginHelper, settings, runInfo) => {       // can be missing. that means it is always true
            console.log(pluginHelper);
            console.log(settings);
            console.log(runInfo);
            //eg runInfo.logLevel === "trace"
            return true;
        }
    },
    messageSidebarContent: {                    //can be used to show sth in message sidebar
        "onRender": (pluginHelper, settings) => {           //implement and return html element
            console.log(pluginHelper);
            console.log(settings);
            var div = document.createElement("div");
            div.innerText = "Example content";
            return div;                                     //html element to return.
        },
        "static": false             //set true to not reload plugin content with every message sidebar refresh
    },
    scriptCollectionButton: {                   //a button that can be used to interact with script collection
        "text": "Example Button",
        "title": "Example Title",
        "onClick": (pluginHelper, settings) => {
            log.log("clicked");
            log.log(pluginHelper);
            log.log(settings);
            log.log(pluginHelper.artifactId)
            log.log(pluginHelper.artifactType)
            log.log(pluginHelper.currentPackageId)
            log.log(document.getElementById("__xmlview0--ceFileLabel-bdi").textContent)
        },
        condition: (pluginHelper, settings) => {
            //condition can be null or a function that returns true or false
            return true
        }
    },
    scriptButton: {                             //a button that can be used to interact with scripts
        "text": "E",
        "title": "Example Title",
        "onClick": (pluginHelper, settings) => {
            log.log("clicked");
            log.log(pluginHelper);
            log.log(settings);
            log.log(pluginHelper.artifactId)
            log.log(pluginHelper.artifactType)
            log.log(pluginHelper.currentPackageId)
        },
        condition: (pluginHelper, settings) => {
            return true
        }
};

pluginList.push(plugin);
```

#### messageSidebarButton onClick parameter

pluginHelper: an object with additional iflow information and functions that you can user

settings: data that is stored (see settings element)

runInfo: details to the message run that belongs to the specific button

#### messageSidebarBmessageSidebarContentutton onRender parameter

pluginHelper: an object with additional iflow information and functions that you can user

settings: data that is stored (see settings element)
