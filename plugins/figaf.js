var getFigafHost = (settings) => {
    var figafHost = settings["figaf---FigafURL"];
    if (!figafHost.endsWith("/")) {
        figafHost = figafHost + "/";
    }
    return figafHost;
}

var getFigafAgentSystemId = (pluginHelper, settings) => {
    return settings[`figaf---${pluginHelper.tenant}---FigafAgentSystemId`];
}

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
        "FigafURL": { "text": "Figaf URL", "type": "textinput", scope: "browser" },
        "FigafAgentSystemId": { "text": "Figaf Agent System Id (optional)", "type": "textinput", scope: "tenant" },
        "icon": { "src": "images/plugin_logos/figaf_logo-or3aup2a4kcerbzkw8qe9fj133kv700baqsm2nnpj4.png", "type": "icon" }
    },
    messageSidebarButton: {
        "icon": { "text": "F", "type": "text" },
        "title": "Record in Figaf",
        "onClick": (pluginHelper, settings, runInfo) => {
            var currentIflowId = pluginHelper.currentIflowId ? pluginHelper.currentIflowId : pluginHelper.lastVisitedIflowId;
            var figafHost = getFigafHost(settings);
            var figafAgentSystemId = getFigafAgentSystemId(pluginHelper, settings);
            var figafUrl = `${figafHost}#/cpi-helper-integration?operation=record-messages&tenantHost=${pluginHelper.tenant}&systemId=${figafAgentSystemId}&objectType=${pluginHelper.currentArtifactType}&packageTechnicalName=${pluginHelper.currentPackageId}&artifactTechnicalName=${currentIflowId}&messageGuid=${runInfo.messageGuid}`;
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
                var figafHost = getFigafHost(settings);
                var figafAgentSystemId = getFigafAgentSystemId(pluginHelper, settings);
                var figafUrl = `${figafHost}#/cpi-helper-integration?operation=navigate&tenantHost=${pluginHelper.tenant}&systemId=${figafAgentSystemId}&objectType=${pluginHelper.currentArtifactType}&packageTechnicalName=${pluginHelper.currentPackageId}&artifactTechnicalName=${pluginHelper.currentArtifactId}`;
                window.open(figafUrl);
            });

            var synchronizeButton = document.createElement("button");
            synchronizeButton.innerText = "Synchronize";
            synchronizeButton.addEventListener("click", () => {
                var figafHost = getFigafHost(settings);
                var figafAgentSystemId = getFigafAgentSystemId(pluginHelper, settings);
                var figafUrl = `${figafHost}#/cpi-helper-integration?operation=synchronize&tenantHost=${pluginHelper.tenant}&systemId=${figafAgentSystemId}&objectType=${pluginHelper.currentArtifactType}&packageTechnicalName=${pluginHelper.currentPackageId}&artifactTechnicalName=${pluginHelper.currentArtifactId}`;
                window.open(figafUrl);
            });

            var div = document.createElement("div");
            div.appendChild(navigateButton);
            div.appendChild(synchronizeButton);
            return div;
        }
    },
    scriptCollectionButton: {
        "text": "Open in Figaf",
        "title": "Open in Figaf",
        "onClick": (pluginHelper, settings) => {
            var objectType = "Script Collection";
            var resourceNameElement = document.querySelector('bdi[id$="--ceFileLabel-bdi"]');
            var resourceObjectType = "";
            var resourceName = "";
            if (resourceNameElement) {
                resourceName = resourceNameElement.textContent;
                resourceObjectType = "Script";
            }

            var figafHost = getFigafHost(settings);
            var figafAgentSystemId = getFigafAgentSystemId(pluginHelper, settings);
            var figafUrl = `${figafHost}#/cpi-helper-integration?operation=navigate&tenantHost=${pluginHelper.tenant}&systemId=${figafAgentSystemId}&objectType=${objectType}&resourceObjectType=${resourceObjectType}&resourceName=${resourceName}&packageTechnicalName=${pluginHelper.currentPackageId}&artifactTechnicalName=${pluginHelper.currentArtifactId}`;
            window.open(figafUrl);
        },
        condition: (pluginHelper, settings) => {
            //condition can be null or a function that returns true or false
            return true
        }
    },
    scriptButton: {
        "text": "Open in Figaf",
        "title": "Open in Figaf",
        "onClick": (pluginHelper, settings) => {
            var objectType = "IFlow";
            var resourceObjectType = "Script";
            var artifactTechnicalName = pluginHelper.currentIflowId ? pluginHelper.currentIflowId : pluginHelper.lastVisitedIflowId;
            var resourceName = pluginHelper.currentArtifactId;

            var figafHost = getFigafHost(settings);
            var figafAgentSystemId = getFigafAgentSystemId(pluginHelper, settings);
            var figafUrl = `${figafHost}#/cpi-helper-integration?operation=navigate&tenantHost=${pluginHelper.tenant}&systemId=${figafAgentSystemId}&objectType=${objectType}&resourceObjectType=${resourceObjectType}&resourceName=${resourceName}&packageTechnicalName=${pluginHelper.currentPackageId}&artifactTechnicalName=${artifactTechnicalName}`;
            window.open(figafUrl);

        },
        condition: (pluginHelper, settings) => {
            return true
        }
    },
    xsltButton: {
        "text": "Open in Figaf",
        "title": "Open in Figaf",
        "onClick": (pluginHelper, settings) => {
            var objectType = "IFlow";
            var resourceObjectType = "XSLT";
            var artifactTechnicalName = pluginHelper.currentIflowId ? pluginHelper.currentIflowId : pluginHelper.lastVisitedIflowId;
            var resourceName = pluginHelper.currentArtifactId;

            var figafHost = getFigafHost(settings);
            var figafAgentSystemId = getFigafAgentSystemId(pluginHelper, settings);
            var figafUrl = `${figafHost}#/cpi-helper-integration?operation=navigate&tenantHost=${pluginHelper.tenant}&systemId=${figafAgentSystemId}&objectType=${objectType}&resourceObjectType=${resourceObjectType}&resourceName=${resourceName}&packageTechnicalName=${pluginHelper.currentPackageId}&artifactTechnicalName=${artifactTechnicalName}`;
            window.open(figafUrl);
        },
        condition: (pluginHelper, settings) => {
            return true
        }
    }
};

pluginList.push(plugin);