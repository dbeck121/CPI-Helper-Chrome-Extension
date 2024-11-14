var plugin = {
  metadataVersion: "1.0.0",
  id: "WHINT_IFD",
  name: "WHINT® Interface Documentation",
  version: "1.2.",
  author: "whitepaper.id GmbH",
  email: "support@whitepaper-id.com",
  website: "https://whitepaper-id.com",
  description: "Navigate directly to your Technical Interface Documentation in Microsoft SharePoint. See <a href='https://www.integration-excellence.com/whint-solutions/ifd-sap-cpi/' target='_blank'>integration-excellence.com</a> for more details.",
  settings: {
    spBaseUrl: {
      text: "SharePoint URL",
      type: "textinput",
      scope: "tenant",
    },
    spSep: {
      text: "Package-/IFlow separator",
      type: "textinput",
      scope: "tenant",
    },
    spSuffix: {
      text: "Suffix",
      type: "textinput",
      scope: "tenant",
    },
    spOpenFolder: {
      text: "Go to folder",
      type: "checkbox",
      scope: "tenant",
    },
  },
  messageSidebarContent: {
    static: true,
    onRender: (pluginHelper, settings) => {
      const path = location.pathname.split("/");
      const a = document.createElement("a");
      a.innerText = "Open in SharePoint";
      a.setAttribute("target", "_blank");
      a.setAttribute(
        "href",
        settings[`WHINT_IFD---${pluginHelper.tenant}---spBaseUrl`] +
          "/" +
          path[path.length - 3] +
          (!settings[`WHINT_IFD---${pluginHelper.tenant}---spOpenFolder`] ? settings[`WHINT_IFD---${pluginHelper.tenant}---spSep`] + pluginHelper.integrationFlowId + "." + settings[`WHINT_IFD---${pluginHelper.tenant}---spSuffix`] : "")
      );
      const div = document.createElement("div");
      div.appendChild(a);
      return div;
    },
  },
};
pluginList.push(plugin);