async function whatsNewCheck(showOnlyOnce = true) {

  var manifestVersion = chrome.runtime.getManifest().version;

  check = await storageGetPromise("whatsNewV" + manifestVersion);

  silentupdates = ["3.0.3"]

  const FIGAF_IMG = chrome.runtime.getURL("images/figaf-editor.png");

  if (!check && !silentupdates.includes(manifestVersion) || showOnlyOnce == false) {
    html = `<div class="ui icon positive message">
              <i class="info icon"></i>
              <div class="content">
                <div class="header">
                  You updated successfully to version ${manifestVersion}
                </div>
                <p>Follow our <a href="https://www.linkedin.com/company/kangoolutions" target="_blank">LinkedIn page</a> for
                  updates and news about CPI Helper.</p>
              </div>
            </div>
            <div class="ui segment">
              <div class="ui top attached tabular menu" id="cpiHelper_whatsnew_tabs">
                <a class="item active" data-tab="one">News</a>
                <a class="item" data-tab="two">Features</a>
                <a class="item" data-tab="three">About</a>
              </div>
            <div class="ui bottom attached tab segment" data-tab="one">
              <div class="ui segment">
                <div class="ui grid">
                  <div class="six wide column">
                    <a href="https://figaf.com/cpihelper-and-figaf" target="_blank"><img class="ui left floated image"
                        src="${FIGAF_IMG}"></a>
                  </div>
                  <div class="ten wide column">
                    <div class="ui header">This release is sponsored by Figaf </div>
                    <p>Figaf has improved the developer workflow with CPIHelper. It will allows you to go to Figaf
                      from a Groovy or XSLT Editor. In Figaf you can also run the code with your existing test
                      cases from the editor. Once you have checked the result, click upload, and the script is in
                      your iFlow.
                    </p>
                    Read more <a href="https://figaf.com/cpihelper8" target="_blank"><u>here</u></a>.
                  </div>
                </div>
              </div>
              <h3 class="ui header">
                <i class="bell icon"></i>
                <div class="content">
                  What's New?
                </div>
              </h3>
              <div class="ui list">
                <a class="item"><i class="right triangle icon"></i>
                  <div class="content">
                    <div class="header">Feature</div>
                    <div class="description">Powertrace survives page reload</div>
                  </div>
                </a>
                <a class="item"><i class="right triangle icon"></i>
                  <div class="content">
                    <div class="header">Feature</div>
                    <div class="description">Improved "flying error dialog". No mouse over but you need to klick
                      now. Thanks to Omkar Patel</div>
                  </div>
                </a>
                <a class="item"><i class="right triangle icon"></i>
                  <div class="content">
                    <div class="header">Feature</div>
                    <div class="description">Many more ui improvements. Thanks to Omkar Patel</div>
                  </div>
                </a>
                <a class="item"><i class="right triangle icon"></i>
                <div class="content">
                  <div class="header">Feature</div>
                  <div class="description">Improved Plugin UI</div>
                </div>
              </a>
                <a class="item"><i class="right triangle icon"></i>
                  <div class="content">
                    <div class="header">Bugfix</div>
                    <div class="description">Many bugfixes</div>
                  </div>
                </a>
                <h3 class="ui header">
                  <a href="https://www.linkedin.com/company/kangoolutions" target="_blank"><i
                      class="linkedin icon"></i></a>
                  <div class="content">
                    Follow us on <a href="https://www.linkedin.com/company/kangoolutions" target="_blank">LinkedIn</a>
                  </div>
                </h3>
                <h3 class="ui header">
                  <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank"> <i
                      class="github icon"></i></a>
                  <div class="content">
                    More details on <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension"
                      target="_blank">Github</a>
                  </div>
                </h3>
              </div>
            </div>
            <div class="ui bottom attached tab segment" data-tab="two">
              <h3 class="ui header">
                <i class="project diagram icon"></i>
                <div class="content">
                  Main Features
                </div>
              </h3>
              <div class="ui list">
                <a class="item">
                  <i class="right triangle icon"></i>
                  <div class="content">
                    <div class="description">Message Sidebar with Logs and InlineTrace</div>
                  </div>
                </a>
                <a class="item">
                  <i class="right triangle icon"></i>
                  <div class="content">
                    <div class="description">Log Viewer</div>
                  </div>
                </a>
                <a class="item">
                  <i class="right triangle icon"></i>
                  <div class="content">
                    <div class="description">PowerTrace - Trace keeps running even after 10 minutes</div>
                  </div>
                </a>
              </div>
              <p>To learn more about CPI Helper features and what's new on our <a
                  href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">Github
                  Page</a>.</p>
              <p>Unfortunately, SAP does not work with us together and does not inform us when the APIs change. So be
                gentle if sth. does not work. We do this in our free time and sometimes it takes a while to adapt to
                SAP changes.</p>
            </div>
            <div class="ui bottom attached tab segment active" data-tab="three">
              <h3 class="ui header">
                <a href="https://www.linkedin.com/company/kangoolutions" target="_blank"><i class="linkedin icon"></i></a>
                <div class="content">
                  Follow us on <a href="https://www.linkedin.com/company/kangoolutions" target="_blank">LinkedIn</a></a>
                </div>
              </h3>
              <h3 class="ui header">
                <i class="user icon"></i>
                <div class="content">
                  About us
                </div>
              </h3>
              <p>We are a small company of passionate SAP CI developers from Cologne, Germany. If you want to learn
                more about us, please visit our website <a href="https://kangoolutions.com"
                  target="_blank">kangoolutions.com</a>. Or maybe you want to become part of the team? Then have a
                look <a href="https://ich-will-zur.kangoolutions.com/" target="_blank">here</a> (German only).
                Unfortunately, we can only consider applicants with german residence due to legal reasons.</p>
              <h3 class="ui header">
                <i class="comment icon"></i>
                <div class="content">
                  Take Part
                </div>
              </h3>
              <p>The CPI Helper is free and Open Source. If you want to contribute (especially improve overall CPI
                Helper visual design. We really aren't frontend developers) or you have found any bugs then have a
                look at our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">GitHub
                  Page</a> and our <a href="https://kangoolutions.com" target="_blank">Homepage</a>. You can find
                the main developer Dominic Beckbauer on <a
                  href="https://www.linkedin.com/in/dominic-beckbauer-515894188/">LinkedIn</a></p>
              <h3 class="ui header">
                <i class="glasses icon"></i>
                <div class="content">
                  More Details
                </div>
              </h3>
              <div>License: <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">GNU GPL v3</a>
              </div>
              <div>Please also check our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension"
                  target="_blank">Github
                  Page</a>.
              </div>
              <div>Created by: Dominic Beckbauer and Kangoolutions.com</div>
              </div></div>`;
    await showBigPopup(html, "Your SAP CI Toolbox since 1963", { "fullscreen": false, callback: () => { $('.menu .item').tab(); } });

    var obj = {};
    obj["whatsNewV" + manifestVersion] = "show";
    chrome.storage.local.set(obj, function () {
      log.log("whats new displayed and saved");
    });
  }

  //persist so that the popup does not appear again
}