var plugin = {
  metadataVersion: "1.0.0",
  id: "zz_developer_tools",
  name: "ZZ_Developer Tools",
  version: "0.1.0",
  author: "Kangoolutions",
  email: "cpihelper@kangoolutions.com",
  website: "https://kangoolutions.com",
  description: "Adds a button to the CPI Helper toolbar to open developer tools",
  settings: {},

  toolbarButton: {
    title: "DevTools",
    onClick: async (pluginHelper, settings) => {
      console.log("helper plugin clicked");

      var textElement = `
<div>
  <div class="ui segment">
      <div class="ui top attached tabular menu">
          <a class="item active" data-tab="one">Read Storage</a>
          <a class="item" data-tab="two">Set Storage</a>
      </div>
      <div class="ui bottom attached tab segment active" data-tab="one">
          <h3>Local Storage</h3>
          <div 
          id="cpiHelper_zz_developer_tools_localStorage"
          style="
              font-family: monospace;
              background-color: #f5f5f5;
              border: 1px solid #ddd;
              padding: 10px;
              overflow: auto;
              white-space: pre-wrap;
          ">
          </div>
          <h3>Sync Storage</h3>
          <div 
          id="cpiHelper_zz_developer_tools_syncStorage"
          style="
              font-family: monospace;
              background-color: #f5f5f5;
              border: 1px solid #ddd;
              padding: 10px;
              overflow: auto;
              white-space: pre-wrap; /* Zeilenumbruch innerhalb des Elements */
          ">
          </div>
      </div>

      <div class="ui bottom attached tab segment" data-tab="two">
      WIP
      </div>
  </div>
</div>
  `;

      x = createElementFromHTML(textElement);
      pluginHelper.functions.popup(x, "Developer Tools", {
        fullscreen: false,
        callback: async () => {
          var localStorage = await chrome.storage.local.get();
          var syncStorage = await chrome.storage.sync.get();
          $(".tabular.menu .item").tab();
          document.getElementById("cpiHelper_zz_developer_tools_localStorage").innerText = JSON.stringify(localStorage, null, 2);
          document.getElementById("cpiHelper_zz_developer_tools_syncStorage").innerText = JSON.stringify(syncStorage, null, 2);
        },
      });
    },
  },
};

pluginList.push(plugin);
