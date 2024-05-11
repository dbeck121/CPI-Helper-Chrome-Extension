function navigationButton() {
    //main Frame
    const data_content = `
        <div class="ui segment">
          <div class="ui container form-container" style='margin:1em'>
           <h3 class="ui header">Find Credentials from Security Matrials:</h3>
            <div class="ui search">
              <div class="ui icon input">
                <input class="prompt" type="text" placeholder="Search Credentials...">
                <i class="search icon"></i>
              </div>
              <div class="results"></div>
            </div>
            <h3 class="ui header">Log Mode Selector for CPI Helper:</h3>
            <div class="ui container">
              <form id="debug-form" class="ui form">
                <div class="field">
                  <label>Timeout:</label>
                  <select id="timeout" name="timeout" class="ui dropdown">
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                    <option value="120">2 minutes</option>
                    <option value="300">5 minutes</option>
                  </select>
                </div>
                <div class="field">
                  <label>Log Level:</label>
                  <select id="logLevel" name="logLevel" class="ui dropdown">
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="log">Log</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>
                <button type="submit" class="ui primary icon button"><i class="icon save"></i></button>
                <button type="button" id="downloadButton" class="ui icon button"><i class="icon download"></i></button>
              </form>
              <div class="ui warning message">
                  <i class="close icon"></i>
                  <div class="header">
                    Download happens Automatically on time expires, when debug mode is selected
                  </div>
                  <ul class="list">
                    <li>Please download Log file if it's not auto downloaded.</li>
                    <li>For others modes, use Dev tools (console).</li>
                  </ul>
                </div>
            </div>
          </div>
      </div>`
    if ($('#__cpihelper').length === 0) {
      log.log('adding navigation for main page');
      cloudbutton = $(`<button id="__cpihelper" aria-label="CPI Helper" title="CPI Helper" class="sapMBtnBase sapMBtn sapMBarChild">
        <span id="__cpihelper-inner" class="sapMBtnInner sapMBtnHoverable sapMFocusable sapMBtnIconFirst sapMBtnTransparent">
          <span id="__cpihelper-img" data-sap-ui="__cpihelper-img" role="presentation" aria-hidden="true" data-sap-ui-icon-content="&#xe21d" class="sapUiIcon sapMBtnCustomIcon sapMBtnIcon sapMBtnIconLeft" style="font-family: SAP-icons;"></span>
        </span>
        <span id="__cpihelper-tooltip" class="sapUiInvisibleText">CPI Helper</span>
      </button>`);
      $('#shell--toolHeader').children().eq(3).after(cloudbutton);
      $('#__cpihelper').on('click', async () => await showBigPopup(data_content, "CPI Helper", {
        "fullscreen": true,
        callback: async () => {
          data = await getSecurityNamelist();
          $('.ui.search')
            .search({
              source: data,
              preserveHTML : false,
              onSelect: (result, resp) => copyText(result.title),
              searchFields: ['title'],
              type: 'category',
              minCharacters: 1,
            });
        }
      }).then(async (e) => {
        await defaultdebug();
      }))
    }
  }
  /*const icons = chrome.runtime.getManifest().icons | chrome.runtime.getURL(icons['16'])*/
  async function getSecurityNamelist() {
    const response = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.km.api.commands.SecurityMaterialsListCommand", false, "application/json")).artifactInformations.filter(e => e.deployState = 'DEPLOYED').reduce((result, obj) => {
      const credentialKindTag = obj.tags.find(tag => tag.name === "sec:credential.kind");
      var key = credentialKindTag ? credentialKindTag.value : (
        obj.type === "TOKEN_CREDENTIAL" ? obj.tags.find(tag => tag.name === "provider").value : null
      )
      if (key != null) {
        if (key === 'oauth2:default') {
          key = obj.tags.find(tag => tag.name === "sec:grant.type").value;
        }
        if (key === 'OAuth2SAMLBearerAssertion') {
          key = obj.tags.find(tag => tag.name === "targetSystemType").value;
        }
        result[key] = result[key] || [];
        result[key].push(String(obj.name));
      }
      return result;
    }, {});
    const Mat_category = {
      "CloudFoundry": "OAuth2 SAML Bearer Assertion \n (BTP CF)",
      "default": "User Credentials",
      "openconnectors": "User Credentials \n (Open Connectors)",
      "client_credentials": "OAuth2 Client Credentials",
      "SuccessFactors": "OAuth2 SAML Bearer Assertion \n (SuccessFactors)",
      "successfactors": "User Credentials \n (SuccessFactors)",
      "CloudSystem": "OAuth2 SAML Bearer Assertion \n (BTP Neo)",
      "Generic": "OAuth2 Authorization Code \n (Generic)",
      "Microsoft_365":"OAuth2 Authorization Code \n (Microsoft 365)"
    }
    return Object.entries(response).flatMap(([key, titles]) =>
      titles.map(title => ({ title, category: Mat_category[key] }))
    )
  }