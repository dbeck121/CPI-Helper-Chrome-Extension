var plugin = {
    metadataVersion: "1.0.0",
    id: "exampleid1",
    name: "example1",
    version: "0.0.1",
    author: "Kangoolutions",
    website: "https://kangoolutions.com",
    description: "Example plugin",
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
        "onClick": (pluginHelper) => {
            console.log("clicked");
            console.log(pluginHelper);
        }
    },
    messageSidebarContent: {
        "onRender": (pluginHelper, settings) => {

            var div = document.createElement("div");
            div.innerText = "Example content";

            return div;
        }
    }
};

pluginList.push(plugin);