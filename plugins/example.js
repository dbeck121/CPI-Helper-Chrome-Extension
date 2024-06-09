var plugin = {
    metadataVersion: "1.0.0",
    id: "exampleid1",
    name: "example for developers",
    version: "0.0.1",
    author: "Kangoolutions",
    email: "cpihelper@kangoolutions.com",
    website: "https://github.com/dbeck121/CPI-Helper-Chrome-Extension",//"https://yourwebsite.com"
    description: "Only for plugin developers",
    settings: {
        "text1": { "text": "This is a plugin", "type": "label" },
        "textField1": { "text": "Tenant URL", "type": "textinput", scope: "tenant" },
        "textField2": { "text": "Iflow xy", "type": "textinput", scope: "iflow" },
        "textField3": { "text": "general", "type": "textinput", scope: "browser" },
        "icon": { "type": "icon", "src": "/images/plugin_logos/example.png" }
    },
    messageSidebarButton: {
        "icon": { "text": "E", "type": "text" },
        "title": "Example Title",
        "onClick": (pluginHelper, settings, runInfo, active) => {
            log.log("clicked");
            log.log(pluginHelper);
            log.log(settings);
            log.log(runInfo);
            log.log(active);
        },
        "condition": (pluginHelper, settings, runInfo) => {
            //eg runInfo.logLevel === "trace"
            return runInfo.logLevel === "trace";
        }
    },
    messageSidebarContent: {
        "static": true,
        "onRender": (pluginHelper, settings) => {
            log.log("render");
            log.log(pluginHelper);
            log.log(settings);
            var div = document.createElement("div");
            div.innerText = "Example content ";
            var button = document.createElement("button")
            button.innerHTML = "click for popup"
            var popupContent = document.createElement("h1")
            popupContent.innerText = "Hello World!"
            button.onclick = (x) => pluginHelper.functions.popup(popupContent, "Header")
            div.appendChild(button)
            return div;
        }
    },
    scriptCollectionButton: {
        "icon": { "text": "E", "type": "text" },
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
    scriptButton: {
        "icon": { "text": "E", "type": "text" },
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
    messageMappingButton: {
        "icon": { "text": "MM", "type": "text" },
        "title": "Example Title MM",
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
    xsltButton: {
        "icon": { "text": "XSLT", "type": "text" },
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
    heartbeat:  async (pluginHelper, settings) => {
        console.log("this function is running every 3 seconds");
        console.log(pluginHelper);
    }

};

pluginList.push(plugin);