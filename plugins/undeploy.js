var plugin = {
    metadataVersion: "1.0.0",
    id: "undeploy",
    name: "undeploy plugin",
    version: "1.0.0",
    author: "Kangoolutions",
    email: "cpihelper@kangoolutions.com",
    website: "https://kangoolutions.com",
    description: "Adds an undeploy button to the message sidebar.",

    settings: {
       
    },

    messageSidebarContent: {
        "onRender": (pluginHelper, settings) => {
            var button = document.createElement("button");
            button.innerText = "Undeploy";
            button.addEventListener("click", () => {
                console.log("undeploy plugin clicked");
                pluginHelper.functions.undeploy();
            });
            return button;
        }
    }

}

pluginList.push(plugin);