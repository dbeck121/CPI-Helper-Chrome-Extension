var plugin = {
    metadataVersion: "1.0.0",
    id: "figaf",
    name: "Figaf",
    version: "1.0.0",
    author: "Figaf",
    email: "support@figaf.com",
    website: "https://figaf.com",
    description: "Simplify your SAP Cloud Integration work with Figaf. Learn more at <a href=\"https://figaf.com\" target=\"_blank\">figaf.com</a>",
    settings: {
        "FigafURL": { "text": "Figaf URL", "type": "text", scope: "browser" },
        "FigafAgentSystemId": { "text": "Figaf Agent System Id (optional)", "type": "text", scope: "tenant" }
    },
    messageSidebarButton: {
        "text": "F",
        "title": "Record in Figaf",
        "icon": "",
        "onClick": (pluginHelper, settings, runInfo) => {
            var figafHost = settings["figaf---FigafURL"];
            var figafAgentSystemId = settings[`figaf---${pluginHelper.tenant}---FigafAgentSystemId`];
            var figafUrl = `${figafHost}/irt/#/cpi-helper-integration?operation=record-messages&tenantHost=${pluginHelper.tenant}&systemId=${figafAgentSystemId}&iflowName=${pluginHelper.integrationFlowId}&messageGuid=${runInfo.messageGuid}`;
            window.open(figafUrl);
        },
        "condition": (pluginHelper, settings, runInfo) => {
            var date = new Date();
            date.setHours(date.getHours() - 1);
            return runInfo.logLevel === "trace" && runInfo.logStart > date;
        }
    },
    messageSidebarContent: {
        "onRender": (pluginHelper, settings) => {
            var navigateButton = document.createElement("button");
            navigateButton.innerText = "Navigate";
            navigateButton.addEventListener("click", () => {
                var figafHost = settings["figaf---FigafURL"];
                var figafAgentSystemId = settings[`figaf---${pluginHelper.tenant}---FigafAgentSystemId`];
                var figafUrl = `${figafHost}/irt/#/cpi-helper-integration?operation=navigate&tenantHost=${pluginHelper.tenant}&systemId=${figafAgentSystemId}&iflowName=${pluginHelper.integrationFlowId}`;
                window.open(figafUrl);
            });

            var synchronizeButton = document.createElement("button");
            synchronizeButton.innerText = "Synchronize";
            synchronizeButton.addEventListener("click", () => {
                var figafHost = settings["figaf---FigafURL"];
                var figafAgentSystemId = settings[`figaf---${pluginHelper.tenant}---FigafAgentSystemId`];
                var figafUrl = `${figafHost}/irt/#/cpi-helper-integration?operation=synchronize&tenantHost=${pluginHelper.tenant}&systemId=${figafAgentSystemId}&iflowName=${pluginHelper.integrationFlowId}`;
                window.open(figafUrl);
            });

            var div = document.createElement("div");
            div.appendChild(navigateButton);
            div.appendChild(synchronizeButton);
            return div;
        }
    }
};

pluginList.push(plugin);