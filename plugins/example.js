var plugin = {
    metadataVersion: "1.0.0",
    id: "exampleid1",
    name: "example for developers",
    version: "0.0.1",
    author: "Kangoolutions",
    email: "cpihelper@kangoolutions.com",
    website: "https://yourwebsite.com",
    description: "Only for plugin developers",
    settings: {
        "text1": { "text": "This is a plugin", "type": "label" },
        "textField1": { "text": "Tenant URL", "type": "text", scope: "tenant" },
        "textField2": { "text": "Iflow xy", "type": "text", scope: "iflow" },
        "textField3": { "text": "general", "type": "text", scope: "browser" },
    },
    messageSidebarButton: {
        "text": "E",
        "title": "Example Title",
        "icon": "",
        "onClick": (pluginHelper, settings, runInfo) => {
            console.log("clicked");
            console.log(pluginHelper);
            console.log(settings);
            console.log(runInfo);
        },
        "condition": (pluginHelper, settings, runInfo) => {
            //eg runInfo.logLevel === "trace"
            return runInfo.logLevel === "trace";
        }
    },
    messageSidebarContent: {
        "static": true,
        "onRender": (pluginHelper, settings) => {
            console.log("render");
            console.log(pluginHelper);
            console.log(settings);
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
    scriptButton: {
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
    },

};

pluginList.push(plugin);