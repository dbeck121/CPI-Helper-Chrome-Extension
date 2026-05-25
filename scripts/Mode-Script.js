function navigationButton() {
  //main Frame
  if (!document.getElementById("__cpihelper")) {
    log.log("adding navigation for main page");
    const cloudbutton = createElementFromHTML(`<button id="__cpihelper" aria-label="CPI Helper" title="CPI Helper" class="sapMBtnBase sapMBtn sapMBarChild">
        <span id="__cpihelper-inner" class="sapMBtnInner sapMBtnHoverable sapMFocusable sapMBtnIconFirst sapMBtnTransparent">
          <span id="__cpihelper-img" data-sap-ui="__cpihelper-img" role="presentation" aria-hidden="true" data-sap-ui-icon-content="&#xe21d" class="sapUiIcon sapMBtnCustomIcon sapMBtnIcon sapMBtnIconLeft" style="font-family: SAP-icons;"></span>
        </span>
        <span id="__cpihelper-tooltip" class="sapUiInvisibleText">CPI Helper</span>
      </button>`);
    const toolHeader = document.getElementById("shell--toolHeader");
    const fourthChild = toolHeader ? toolHeader.children[3] : null;
    if (fourthChild) {
      fourthChild.insertAdjacentElement("afterend", cloudbutton);
    }
    document.getElementById("__cpihelper")?.addEventListener("click", async () => {
      await showBigPopup(
        `<div class="ui blue secondary pointing centered fluid menu">
    <div class="active item" data-tab="homepage">Search Credentials & Log Mode</div>
    </div>
    <div data-tab="homepage" class="ui active loading tab"><div id="GlobalCH_Tab1"></div></div>`,
        "",
        {
          fullscreen: true,
          callback: async () => {
            cpiInitTabs(document.getElementById("cpiHelper_bigPopup_content_semanticui"));
            await fromInitialLoadingTo();
          },
        }
      );
      await defaultdebug();
    });
  }
}
/*const icons = chrome.runtime.getManifest().icons | chrome.runtime.getURL(icons['16'])*/
async function getSecurityNamelist() {
  const response = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.km.api.commands.SecurityMaterialsListCommand", false, "application/json"))
    .artifactInformations.filter((e) => (e.deployState = "DEPLOYED"))
    .reduce((result, obj) => {
      const credentialKindTag = obj.tags.find((tag) => tag.name === "sec:credential.kind");
      var key = credentialKindTag ? credentialKindTag.value : obj.type === "TOKEN_CREDENTIAL" ? obj.tags.find((tag) => tag.name === "provider").value : null;
      if (key != null) {
        if (key === "oauth2:default") {
          key = obj.tags.find((tag) => tag.name === "sec:grant.type").value;
        }
        if (key === "OAuth2SAMLBearerAssertion") {
          key = obj.tags.find((tag) => tag.name === "targetSystemType").value;
        }
        result[key] = result[key] || [];
        result[key].push(String(obj.name));
      }
      return result;
    }, {});
  const Mat_category = {
    CloudFoundry: "OAuth2 SAML Bearer Assertion \n (BTP CF)",
    default: "User Credentials",
    openconnectors: "User Credentials \n (Open Connectors)",
    client_credentials: "OAuth2 Client Credentials",
    SuccessFactors: "OAuth2 SAML Bearer Assertion \n (SuccessFactors)",
    successfactors: "User Credentials \n (SuccessFactors)",
    CloudSystem: "OAuth2 SAML Bearer Assertion \n (BTP Neo)",
    Generic: "OAuth2 Authorization Code \n (Generic)",
    Microsoft_365: "OAuth2 Authorization Code \n (Microsoft 365)",
  };
  return Object.entries(response).flatMap(([key, titles]) => titles.map((title) => ({ title, category: Mat_category[key] })));
}

async function fromInitialLoadingTo() {
  const data_content = createElementFromHTML(`
    <div class="ui container form-container" style='margin:1em'>
     <h3 class="ui header">Find Credentials from Security Matrials:</h3>
      <div class="ui search">
        <div class="ui icon input">
          <input class="prompt" type="text" placeholder="Search Credentials..." style="width: 100%;">
          <i class="search icon"></i>
        </div>
        <div class="results" style="position: relative; max-height: 320px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 0.25rem; background: white; margin-top: 0.25rem; display: none;"></div>
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
        <div class="ui message info">Use this feature if you are facing problems with CPI Helper and you would like to provide more details to the developers.</div>
        <div class="ui warning message">
            <div class="header">
              Download happens Automatically on time expires, when debug mode is selected
            </div>
            <ul class="list">
              <li>Please download Log file if it's not auto downloaded.</li>
              <li>For others modes, use Dev tools (console).</li>
            </ul>
          </div>
      </div>
    </div>`);
  const tab1 = document.getElementById("GlobalCH_Tab1");
  if (tab1) {
    tab1.appendChild(data_content);
    if (tab1.parentElement) tab1.parentElement.classList.remove("loading");
  }

  const source = await getSecurityNamelist();
  const searchInput = data_content.querySelector(".ui.search input.prompt");
  const resultsDiv = data_content.querySelector(".ui.search .results");

  const renderResults = (query) => {
    resultsDiv.replaceChildren();
    if (!query || query.length < 1) {
      resultsDiv.style.display = "none";
      return;
    }
    const lower = query.toLowerCase();
    const matches = source.filter((s) => s.title && s.title.toLowerCase().includes(lower)).slice(0, 50);
    if (!matches.length) {
      resultsDiv.style.display = "none";
      return;
    }
    matches.forEach((m) => {
      const item = document.createElement("div");
      item.className = "result";
      item.style.cssText = "padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid #f0f0f0;";
      item.textContent = m.category ? `${m.title}  —  ${m.category.replace(/\n/g, " ")}` : m.title;
      item.addEventListener("mouseenter", () => (item.style.background = "#f5f5f5"));
      item.addEventListener("mouseleave", () => (item.style.background = ""));
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        copyText(m.title);
        searchInput.value = m.title;
        resultsDiv.style.display = "none";
      });
      resultsDiv.appendChild(item);
    });
    resultsDiv.style.display = "block";
  };

  searchInput.addEventListener("input", () => renderResults(searchInput.value.trim()));
  searchInput.addEventListener("blur", () => setTimeout(() => (resultsDiv.style.display = "none"), 150));
  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim()) renderResults(searchInput.value.trim());
  });
}
