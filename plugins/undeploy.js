var plugin = {
  metadataVersion: "1.0.0",
  id: "undeploy",
  name: "undeploy plugin",
  version: "1.0.0",
  author: "Kangoolutions",
  email: "cpihelper@kangoolutions.com",
  website: "https://kangoolutions.com",
  description: "Adds an undeploy button to the CPI Helper toolbar.",
  settings: {},
  toolbarButton: {
    title: "Undeploy",
    onClick: (pluginHelper, settings) => {
      console.log("undeploy plugin clicked");
      pluginHelper.functions.undeploy();
    },
  },
};

pluginList.push(plugin);
