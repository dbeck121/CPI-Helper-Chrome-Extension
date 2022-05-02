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
        }
    },
    messageSidebarContent: {
        "onRender": (pluginHelper, settings) => {
            console.log("clicked");
            console.log(pluginHelper);
            console.log(settings);
            var div = document.createElement("div");
            div.innerText = "Example content";
            return div;
        }
    }
};

pluginList.push(plugin);