var plugin = {
    metadataVersion: "1.0.0",
    id: "WHINT_IFD",
    name: "WHINT® Interface Documentation",
    version: "1.1.",
    author: "whitepaper.id GmbH",
    email: "support@whitepaper-id.com",
    website: "https://whitepaper-id.com",
    description: "Navigate directly to your Technical Interface Documentation in Microsoft SharePoint. See <a href='https://www.integration-excellence.com/whint-solutions/ifd-sap-cpi/' target='_blank'>integration-excellence.com</a> for more details.",
    settings: {
        spBaseUrl: { text: "SharePoint URL (<i>e.g. https://company.sharepoint.com/sites/my-site/shared documents/documentation</i>)", type: "text", scope: "tenant" },
        spSep: { text: "Package-/IntegrationFlow ID Separator (<i>default: /</i>)", type: "text", scope: "tenant" }
    },
    messageSidebarContent: {
        static: true,
        onRender: (pluginHelper, settings) => {

            const path = location.pathname.split('/');        
            const a = document.createElement("a");

            a.innerText = "Open in SharePoint";
            a.setAttribute("target", "_blank");
            a.setAttribute("href", 
                settings[`WHINT_IFD---${pluginHelper.tenant}---spBaseUrl`] + '/' + path[path.length - 3] + 
                settings[`WHINT_IFD---${pluginHelper.tenant}---spSep`] + pluginHelper.integrationFlowId + '.pdf?web=1'
            );

            const div = document.createElement("div")
            div.appendChild(a);

            return div;
        }
    }
};

pluginList.push(plugin);