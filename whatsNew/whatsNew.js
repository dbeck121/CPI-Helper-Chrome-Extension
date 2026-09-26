async function whatsNewCheck(showOnlyOnce = true, initialTab = null) {
  var manifestVersion = chrome.runtime.getManifest().version;

  //new version
  var is_new_version = false;

  var last_version = await storageGetPromise("cpiHelper_Version");
  var version_text = `You are using version ${manifestVersion}. `;

  if (last_version != manifestVersion) {
    is_new_version = true;
    if (!last_version) {
      version_text = `Welcome new user to CPI-Helper. You are running now on version ${manifestVersion}. `;
    } else {
      version_text = `You updated to version ${manifestVersion} from ${last_version}. `;
    }
  }

  // 3.x -> 4.x: a one time welcome with a tour of the new toolbar (scripts/celebration.js) instead of this dialog.
  // saved before it shows, the check runs again for every artifact that builds a toolbar
  if (showOnlyOnce && isV4Upgrade(last_version, manifestVersion) && !(await storageGetPromise(CELEBRATION_STORAGE_KEY))) {
    await storageSetPromise({ [CELEBRATION_STORAGE_KEY]: true, cpiHelper_Version: manifestVersion });
    showV4Celebration();
    return true;
  }

  silentupdates = ["3.0.3", "3.14.4"];

  const FIGAF_IMG = chrome.runtime.getURL("images/figaf_logo.png");
  const FIGAF_VIBE_SCREENSHOT = chrome.runtime.getURL("images/figaf-vibe-coding/figaf vibe code org.png");
  const Kangoolutions_Logo = chrome.runtime.getURL("images/kangoolutions_icon.png");
  const TOOLBAR_SCREENSHOT = chrome.runtime.getURL("images/whatsnew/4.0-toolbar.png");
  const TOOLBAR_PLUGINS_SCREENSHOT = chrome.runtime.getURL("images/whatsnew/4.0-plugins.png");
  const devtoberfestPicture = chrome.runtime.getURL("images/devtoberfestPicture.png");
  const md = window.markdownit();

  // old
  var devtoberfest = `
         <h3 class="ui header">
                <i class="bell icon"></i>
                <div class="content">
                 SAP Devtoberfest 2024
                </div>
            </h3>
 
    
    
        <div style="margin-top: 0.1rem;">📅 Thank you for an amazing session at SAP Devtoberfest. It was wonderful meeting you!</div>
        <div style="text-align: left; margin: 20px;">If you missed the session, you can watch the recording on <a href="https://www.youtube.com/watch?v=uSwSQbc_ULU" target="_blank" style="color: green; text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">YouTube</a>.</div>

    
    
        <div class="ui segment cpihelper83782">
            <a href="https://community.sap.com/t5/devtoberfest/speed-up-your-sap-cloud-integration-development-with-cpi-helper/ev-p/13802891" target="_blank"><img
                                    class="ui center image" src="${devtoberfestPicture}"></a>
        
        </div>
    
    `;

  if ((is_new_version && !silentupdates.includes(manifestVersion)) || showOnlyOnce == false) {
    html = `<div class="ui message">
        <img class="ui small floated image" src="${Kangoolutions_Logo}">
        <div class="content">
            <div class="header">${version_text}</div>
            <p>Created by a dedicated community and Kangoolutions GmbH in Germany! <strong>By using this extension, you agree to the <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension/blob/dev/docs/LICENSE" target="_blank" style="color: green; text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">Open Source GNU GPL v3 license</a>.</strong> Follow us on  <a
                    href="https://www.linkedin.com/company/kangoolutions" target="_blank" style="color: green; text-decoration: none;" 
    onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">LinkedIn</a>, explore our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank" style="color: green; text-decoration: none;" 
    onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">GitHub</a> repository, and watch Devtoberfest 2024 session on <a href="https://www.youtube.com/watch?v=uSwSQbc_ULU" target="_blank" style="color: green; text-decoration: none;" 
    onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">Youtube</a> to discover more about the CPI-Helper.</p>
        </div>
    </div>
    <div class="ui segment">
        <div class="ui top attached tabular menu" id="cpiHelper_whatsnew_tabs">
            <a class="item active" data-tab="one">News</a>
            <a class="item" data-tab="changes">What changed</a>
            <a class="item" data-tab="two">Features</a>
            <a class="item" data-tab="three">About</a>
            <a class="item" data-tab="four">Devtoberfest</a>
        </div>
        <div class="ui bottom attached tab segment active" data-tab="one">
            <div class="ui segment" style="overflow: hidden;">
                <div class="ui grid">
                    <div class="four wide column">
                        <a href="https://figaf.com/cpihelper-and-figaf" target="_blank"><img
                                class="ui big image" style="float: left; margin-right: 20px;" src="${FIGAF_IMG}"></a>
                    </div>
                    <div class="twelve wide column">
  
     <div class="ui header">This release is sponsored by Figaf </div>

<p>Why rebuild hundreds of mappings that already work?</p>
<p>Moving to SAP Integration Suite does not mean you have to rebuild everything as MAGs from day one. Keep what works. Modernize where it adds value.</p>
<p><a href="https://figaf.com/cpihelper27" target="_blank"><u>👉 Read the 10 things to know</u></a> before you start</div>
</p>


                    </div>
                     <div class="sixteen wide column" style="paddingTop: '0px'">
                 </div>
            </div>
            <div class="ui info message">
                <b>New in 4.0:</b> the buttons moved into a floating toolbar that is on every CPI page, with a search for the whole tenant (Ctrl/⌘ + K), and plugins got their own section in it.
                <a href="#" class="cpihelperWhatsNewShowChanges">See what changed</a>
            </div>
            <h3 class="ui header">
                <i class="bell icon"></i>
                <div class="content">
                    What's New?
                </div>
            </h3>
            <a class="ui red top right ribbon label" style="position: absolute;">FireFox limited support</a>  
            <div class="changeloglist">${Object.entries(
              whats_new_log
                .trim()
                .split("\n")
                .reduce((acc, line) => {
                  const match = line.match(/\[([^\]]+)\](.*)/);
                  if (match) {
                    const [_, header, description] = match;
                    (acc[header.trim()] = acc[header.trim()] || []).push(description.trim());
                  }
                  return acc;
                }, {})
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(
                ([header, descs]) => `
                    <div class="ui block header">
                        <div class="ui sub header">${header}</div>
                        <div class="description" style="font-weight: normal;">
                            <ul class="list">
                                ${descs.map((desc) => `<li>${md.renderInline(desc)}</li>`).join("")}
                            </ul>
                        </div>
                    </div>`
              )
              .join("")}</div>
            <div class="ui list">
                <h3 class="ui header">
                    <a href="https://www.linkedin.com/company/kangoolutions" target="_blank"><i class="linkedin icon"></i></a>
                    <div class="content">Follow us on <a href="https://www.linkedin.com/company/kangoolutions" target="_blank">LinkedIn</a></div>
                </h3>
                <h3 class="ui header">
                    <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank"> <i class="github icon"></i></a>
                    <div class="content"> More details on <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">Github</a></div>
                </h3>
            </div>
        </div>
        <div class="ui bottom attached tab segment" data-tab="changes">
            <h3 class="ui header">
                <i class="magic icon"></i>
                <div class="content">What changed in 4.0</div>
            </h3>
            <a href="${TOOLBAR_SCREENSHOT}" target="_blank"><img class="ui fluid bordered rounded image" src="${TOOLBAR_SCREENSHOT}" alt="The new CPI Helper toolbar next to the message popup"></a>
            <h4 class="ui header">A toolbar instead of the buttons in the header</h4>
            <ul class="ui list">
                <li><b>Trace, Messages, Info, Logs and Runtime</b> live in a toolbar that floats above the page. Drag it by its header wherever it bothers you least, it remembers the place.</li>
                <li><b>Wide or compact:</b> the switch at the bottom toggles between icons with labels and icons only. In the compact variant hovering an icon shows its name and keyboard shortcut.</li>
                <li>The header of the toolbar and of the message popup has the <b>color of your tenant</b>, as set in the browser popup.</li>
                <li>The toolbar also shows up on <b>API and MCP Server</b> pages. There the integration cell is the default runtime.</li>
            </ul>
            <h4 class="ui header">Search and jump from anywhere</h4>
            <ul class="ui list">
                <li>The toolbar is on <b>every CPI page</b> now. Outside of an iFlow it has Search, Jump to, Recent and Plugins.</li>
                <li><b>Search</b> (or <b>Ctrl/⌘ + K</b>) finds every iFlow, API, mapping and package of the tenant and the monitor pages. On an iFlow it also runs actions: start or stop the trace, deploy, trace and deploy, open the message sidebar, info, logs and your plugins. Deploy still asks in the dialog of the CPI.</li>
                <li><b>Jump to</b> opens the monitor pages. On an iFlow it also has the messages of this iFlow, its deployment status and its package.</li>
                <li><b>Recent</b> lists your last artifacts. Star the ones you need often, favorites stay on top.</li>
                <li>A red number on Jump to shows the <b>failed messages of the past hour</b>. It can be switched off in the browser popup.</li>
                <li>While an iFlow is in edit mode the toolbar does not navigate away, save or cancel first. Ctrl/⌘ + click opens a page in a new tab.</li>
            </ul>
            <a href="${TOOLBAR_PLUGINS_SCREENSHOT}" target="_blank"><img class="ui fluid bordered rounded image" src="${TOOLBAR_PLUGINS_SCREENSHOT}" alt="Compact toolbar with an open plugin panel"></a>
            <h4 class="ui header">Plugins moved into the toolbar</h4>
            <ul class="ui list">
                <li>Active plugins have their own section in the toolbar. <b>A plugin with a single action runs it directly</b>, e.g. Undeploy or Version History.</li>
                <li><b>A plugin with more content opens a panel</b> next to the toolbar, e.g. the notepad. It closes when you click somewhere else or press Escape.</li>
                <li>Plugins are switched on and off under <b>Manage plugins</b>, the last entry of the section. The message popup shows messages only now, and the setting "Plugin page as separate sidebar" is gone.</li>
                <li>Plugin developers: see <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension/blob/main/docs/readme/PluginREADME.md" target="_blank">toolbarButton and the new icon field</a> in the plugin documentation.</li>
            </ul>
            <h4 class="ui header">A new payload viewer</h4>
            <ul class="ui list">
                <li>Trace bodies open <b>formatted right away</b>. Pretty print keeps CDATA, comments and big JSON numbers exactly as they are, Raw shows the original.</li>
                <li><b>Drag the handle below the editor</b> to make it bigger, CPI Helper remembers the height. The fullscreen button uses the whole window, Escape leaves it.</li>
                <li>Search, fold, wrap, font size, theme and edit sit in the toolbar above the payload.</li>
            </ul>
            <h4 class="ui header">A better inline trace</h4>
            <ul class="ui list">
                <li>The new <b>Changes</b> tab of a step (experimental) shows side by side what the step did to body, headers and properties.</li>
                <li><b>All steps of a message</b> are highlighted, the first ones right away and the rest while you look (up to 5,000 instead of 300).</li>
                <li>Steps that ran many times, e.g. after a splitter, open fast: a run loads only when you open it.</li>
                <li>Hover a name or value in the trace, log and info tables to <b>copy</b> it.</li>
            </ul>
            <h4 class="ui header">Snippets (extremely experimental)</h4>
            <div class="ui negative message">Danger zone: Snippets use internals of the SAP iFlow editor and a lot will not work. Check your iFlow before you save, and cancel the edit if anything looks wrong. <b>You alone are responsible for what you do and what you break.</b></div>
            <ul class="ui list">
                <li>Copy steps in the iFlow editor, open <b>Snippets</b> in the toolbar and save them under a name.</li>
                <li><b>Use</b> puts a snippet back into the CPI clipboard: select the Integration Process or Local Integration Process in edit mode and press Paste, also in another iFlow.</li>
                <li>Snippets with start elements such as <b>Timer</b> or <b>Start Message</b> only go into an Integration Process, not into a Local Integration Process.</li>
                <li>Rename the steps of a snippet, duplicate it, or share it with <b>Copy as text</b> and <b>Import</b>. Connections, senders and receivers are not copied by the editor.</li>
            </ul>
            <button type="button" class="ui primary button cpihelperWhatsNewTour"><i class="map signs icon"></i>Take the tour again</button>
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
            <p>Discover more about CPI Helper features and the latest updates on our <a
                    href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">GitHub
                    Page</a> and watch the recording of the recent Devtoberfest session on <a href="https://www.youtube.com/watch?v=uSwSQbc_ULU" target="_blank" style="color: green; text-decoration: none;" 
    onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">Youtube</a>.</p>
          <p>Please be patient if something isn't working perfectly, as SAP doesn't collaborate with us or inform us of API changes. We work on this project in our free time, so adapting to SAP's updates can sometimes take a while.</p>
        </div>
        <div class="ui bottom attached tab segment" data-tab="three">
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
         <p>We are a small team of passionate SAP CI developers based in Cologne, Germany. To learn more about us, please visit our website at <a href="https://kangoolutions.com" target="_blank">kangoolutions.com</a>.</p>
            <h3 class="ui header">
                <i class="comment icon"></i>
                <div class="content">
                    Take Part
                </div>
            </h3>
            <p>The CPI Helper is free and open-source. If you'd like to contribute or if you've discovered any bugs, please visit our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">GitHub page</a> and our <a href="https://kangoolutions.com" target="_blank">homepage</a>. You can also connect with the lead developer, Dominic Beckbauer, on <a href="https://www.linkedin.com/in/dominic-beckbauer-515894188/" target="_blank">LinkedIn</a>.</p>
            <h3 class="ui header">
                <i class="glasses icon"></i>
                <div class="content">
                    More Details
                </div>
            </h3>
            <div>License: <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">GNU GPL v3</a>
            </div>
            <div>By using this extension, you agree to the <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension/blob/dev/docs/LICENSE" target="_blank">Open Source GNU GPL v3 license</a>.
            </div>
            <div>Please also explore our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">Github Page</a>.
            </div>
            <div>Created by: Dominic Beckbauer and Kangoolutions.com</div>
        </div>
        <div class="ui bottom attached tab segment" data-tab="four">
            ${devtoberfest}
        </div>
    </div>`;

    await showBigPopup(html, "Your SAP CI Toolbox since 1963", {
      fullscreen: false,
      large: true,
      iconType: "positive",
      closeText: "OK",
      iconInButton: "checkmark",
      callback: () => {
        document.querySelector(".cpihelperWhatsNewShowChanges")?.addEventListener("click", (event) => {
          event.preventDefault();
          cpihActivateTab(document.querySelector("#cpiHelper_bigPopup_content_semanticui"), "changes");
        });
        if (initialTab) {
          cpihActivateTab(document.querySelector("#cpiHelper_bigPopup_content_semanticui"), initialTab);
        }
        // the tour needs the toolbar, which only exists on artifact pages
        const tourButton = document.querySelector(".cpihelperWhatsNewTour");
        if (!getFloatingToolbar()) {
          tourButton?.remove();
        }
        tourButton?.addEventListener("click", () => {
          cpihModal.hide("#cpiHelper_semanticui_modal");
          startToolbarTour();
        });
        cpihQsa(".cpihelperFigafScreenshot").forEach((screenshot) => {
          screenshot.addEventListener("click", function () {
            const overlay = createElementFromHTML(`
              <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <div style="max-width: 90vw; max-height: 90vh; overflow: auto; background: white; padding: 10px; border-radius: 5px;">
                  <img src="${FIGAF_VIBE_SCREENSHOT}" style="width: auto; height: auto; max-width: none;" />
                </div>
              </div>
            `);

            overlay.addEventListener("click", function () {
              cpihFadeOut(this, 300);
            });

            document.body.appendChild(overlay);
          });
        });
      },
      onclose: async () => {
        //should only appear one time
        var licenseShown = await storageGetPromise("cpiHelper_LicenseShown");

        if (!licenseShown) {
          await showLicensePopup({
            onclose: async () => {
              await storageSetPromise({ cpiHelper_LicenseShown: true });
            },
          });
        }
      },
    });

    await storageSetPromise({ cpiHelper_Version: manifestVersion });

    return true;
  }
  return false;

  //persist so that the popup does not appear again
}

// Recruiting popup for German speaking users: shown once, at a random moment within a year after CPI Helper first
// saw the user. Never again after it was shown, after "Interessiert mich nicht", or for users who chose
// "Erinnere mich nicht mehr" in the old version (that set a timestamp 9999 days ahead).
const RECRUITING_SHOW_AT_KEY = "recruitingPopupShowAt";
const RECRUITING_DONE_KEY = "recruitingPopupDone";
const RECRUITING_LEGACY_TIMESTAMP_KEY = "recrutingPopupTimestamp";
var recruitingPopupScheduled = false;

// only browsers set to German (Germany)
function isGermanSpeakingUser() {
  return (navigator.language || navigator.userLanguage) === "de-DE";
}

async function recruitingPopupDue() {
  if (!isGermanSpeakingUser()) return false;
  if (await storageGetPromise(RECRUITING_DONE_KEY)) return false;
  const legacy = parseInt(await storageGetPromise(RECRUITING_LEGACY_TIMESTAMP_KEY));
  if (legacy && legacy > Date.now() + 5 * 365 * 24 * 60 * 60 * 1000) {
    await storageSetPromise({ [RECRUITING_DONE_KEY]: "declined-before" });
    return false;
  }
  let showAt = parseInt(await storageGetPromise(RECRUITING_SHOW_AT_KEY));
  if (!showAt) {
    showAt = Date.now() + Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000);
    await storageSetPromise({ [RECRUITING_SHOW_AT_KEY]: showAt });
    log.log("recruiting popup scheduled for " + new Date(showAt).toISOString());
  }
  return showAt <= Date.now();
}

// checked a few minutes after a CPI page opened, only when nothing else is shown at that moment
function scheduleRecruitingPopup(delay = 3 * 60 * 1000) {
  setTimeout(async () => {
    try {
      if (!extensionAlive() || cpihModal.top() || document.getElementById("cpiHelper_celebration")) return;
      if (await recruitingPopupDue()) await recrutingPopup(false);
    } catch (error) {
      log.debug("recruiting popup check failed", error);
    }
  }, delay);
}

async function recrutingPopup(force = false) {
  const Kangoolutions_Logo = chrome.runtime.getURL("images/kangoolutions_icon.png");
  // shown once: whatever the user does now, the automatic popup does not come back
  if (!force) await storageSetPromise({ [RECRUITING_DONE_KEY]: "shown" });
  statistic("recrutingPopup", force ? "show_from_info" : "show");

  var html = `<div>
    <div class="ui message">
        <img class="ui small floated image" src="${Kangoolutions_Logo}">
        <div class="content">
            <div class="header">                Werde ein weiterer Held mit der Mission Daten- und Prozessintegration!            </div>
            <p>Wir wollen moderne Beratung auf Augenhöhe liefern. Unsere Kunden sind super happy mit uns und daher suchen wir aktuell wirklich überall nach den Besten für unser Team.</p>
        </div>
    </div>
    <div class="ui segment">
        <h3 class="ui header">
            <i class="comments icon"></i>
            <div class="content">                Berater*in für SAP Integration gesucht            </div>
        </h3>
        <p>
            Kannst du dir vorstellen unsere Kunden als SAP Integrationsspezialist*in zu unterstützen?
            Das erwartet dich:
        <p>
        <div class="ui bulleted list">
            <div class="item">Fordernde und knifflige Aufgabenstellungen</div>
            <div class="item">Arbeiten aus dem Home Office oder ab und zu mal beim Kunden vor Ort</div>
            <div class="item">Minimale Hierarchien </div>
            <div class="item">Eigenverantwortung und Freiraum, statt Formularen und starren Prozessen</div>
            <div class="item">Summer Event mit der ganzen Firma (2023 auf Sizilien und 2024 auf Kreta).</div>
        </div>
        <p>Wir haben viel Humor und das vielleicht coolste <a href="https://kangoolutions.com/team/" target="_blank">Team</a> der Welt. Lass uns doch mal plaudern:
        </p>
    </div>
    </div>`;

  var popup = createElementFromHTML(html);

  var nextStepButton = document.createElement("button");
  nextStepButton.className = "ui teal button";
  nextStepButton.innerHTML = 'Jau! Ich will mehr wissen.<i class="right arrow icon"></i>';
  nextStepButton.onclick = function () {
    statistic("recrutingPopup", "nextStep");
    window.open("https://kangoolutions.com/karriere/", "_blank");
    cpihModal.hide("#cpiHelper_semanticui_modal");
  };

  var notInterestedButton = document.createElement("button");
  notInterestedButton.className = "ui button";
  notInterestedButton.textContent = "Interessiert mich nicht";
  notInterestedButton.onclick = async function () {
    statistic("recrutingPopup", "notInterested");
    await storageSetPromise({ [RECRUITING_DONE_KEY]: "not-interested" });
    cpihModal.hide("#cpiHelper_semanticui_modal");
  };

  var actions = document.createElement("div");
  actions.className = "cpiHelper_recruiting_actions";
  actions.append(nextStepButton, notInterestedButton);
  popup.appendChild(actions);

  await showBigPopup(popup, "Wir suchen Verstärkung!", { fullscreen: false });
}
