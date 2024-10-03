var plugin = {
  metadataVersion: "1.0.0",
  id: "messageidlogs",
  name: "Get Message ID logs",
  version: "1.0.0",
  author: "Kangoolutions",
  email: "cpihelper@kangoolutions.com",
  website: "https://github.com/dbeck121/CPI-Helper-Chrome-Extension",
  description: "Paste a message ID and check logs.",
  settings: {},

  messageSidebarContent: {
    static: true,
    onRender: (pluginHelper, settings) => {
      var div = document.createElement("div");
      //textbogs for id
      var input = document.createElement("input");
      input.type = "text";
      input.id = "cpi_helper_runid_plugin_messageId";
      input.classList.add("sapMInputBaseInner");
      input.placeholder = "Message ID";
      div.appendChild(input);
      var button = document.createElement("button");
      button.innerHTML = "logs";
      button.onclick = async (x) => {
        //get text from input
        var id = document.getElementById("cpi_helper_runid_plugin_messageId").value;
        await showBigPopup(await createContentNodeForLogs(id, false), "Logs");
      };
      div.appendChild(button);
      return div;
    },
  },
  scriptCollectionButton: null,
  scriptButton: null,
  messageMappingButton: null,
  xsltButton: null,
  heartbeat: null,
};

pluginList.push(plugin);
