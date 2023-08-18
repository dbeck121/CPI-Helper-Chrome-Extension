var plugin = {
    metadataVersion: "1.0.0",
    id: "cpitransporter",
    name: "CPI Transporter",
    version: "1.0.0",
    author: "Contiva GmbH",
    email: "mail@contiva.com",
    website: "https://cpi-transporter.com",
    description: "[BETA] Open Transport System (cpi-transporter.com)",
    settings: {
        "text1": { "text": "Option to transport flows within or to another tenant", "type": "label" }
    },
    messageSidebarContent: {
        
        "onRender": (pluginHelper, settings) => {
            var button = document.createElement("button");
            button.innerText = "New Transport";
            button.addEventListener("click", () => {
                var flow = pluginHelper.integrationFlowId;
                var tenant = pluginHelper.tenant;
                var url = "https://cpi-transporter.com/api/transport/?system="+tenant+"&artifact="+flow;
                window.open(url,'_blank');
            });
            return button;
        }
    }
};
pluginList.push(plugin);
