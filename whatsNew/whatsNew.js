async function whatsNewCheck(showOnlyOnce = true) {
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

  silentupdates = ["3.0.3", "3.14.4"];

  //const FIGAF_IMG = chrome.runtime.getURL("images/figaf_logo-or3aup2a4kcerbzkw8qe9fj133kv700baqsm2nnpj4.png");
  const FIGAF_IMG = chrome.runtime.getURL("images/figaf_logo.png");
  const Kangoolutions_Logo = chrome.runtime.getURL("images/kangoolutions_icon.png");
  const devtoberfestPicture = chrome.runtime.getURL("images/devtoberfestPicture.png");
  const devtoberfestInvite = chrome.runtime.getURL("images/Devtoberfest_CPIHelper.ics");
  const md = window.markdownit();

  var recentChanges = `
         <div class="ui segment">
         <h3 class="ui header">
                <i class="bell icon"></i>
                <div class="content">
                 API Changes
                </div>
            </h3>
 
    
    
        <div style="margin-top: 0.1rem;">
        Hi Developers,<br /><br />

It seems that the CPI-Helper is currently experiencing some issues. These are primarily due to recent changes in SAP's APIs. As you may know, we rely on some undocumented API calls, such as those used to activate trace. There have been updates, and the behavior varies between Neo and Cloud Foundry environments. We are in the process of learning and adapting to these changes, but there may still be some bugs that require attention. This is not an official plugin by SAP.</div>
  
        <div class="ui segment cpihelper83782">
          <h3 class="ui header">
            Known Problems:
          </h3>
          <div class="ui bulleted list">
            <div class="item">Trace is not working sometimes for some Integration Flows. Please undeploy, wait a minute and deploy them again if possible. A redeploy might not work.</div>
            </div>
        </div>
        </div>
    
    `;

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
            <p>Created by a dedicated community and Kangoolutions GmbH in Cologne, Germany! Follow us on  <a
                    href="https://www.linkedin.com/company/kangoolutions" target="_blank" style="color: green; text-decoration: none;" 
    onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">LinkedIn</a>, explore our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank" style="color: green; text-decoration: none;" 
    onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">GitHub</a> repository, and watch Devtoberfest 2024 session on <a href="https://www.youtube.com/watch?v=uSwSQbc_ULU" target="_blank" style="color: green; text-decoration: none;" 
    onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">Youtube</a> to discover more about the CPI-Helper.</p>
        </div>
    </div>
    <div class="ui segment">
        <div class="ui top attached tabular menu" id="cpiHelper_whatsnew_tabs">
            <a class="item active" data-tab="one">News</a>
            <a class="item" data-tab="two">Features</a>
            <a class="item" data-tab="three">About</a>
            <a class="item" data-tab="four">Devtoberfest</a>
        </div>
        <div class="ui bottom attached tab segment" data-tab="one">
            <div class="ui segment">
                <div class="ui grid">
                    <div class="four wide column">
                        <a href="https://figaf.com/cpihelper-and-figaf" target="_blank"><img
                                class="ui big left floated image" src="${FIGAF_IMG}"></a>
                    </div>
                    <div class="twelve wide column">
  
     <div class="ui header">This release is sponsored by Figaf </div>
  <p>Grow Your Integration Business with Figaf:</p>
  <p>Are you an integration consultant looking to deliver faster, more reliable SAP solutions? Partner with Figaf and get access to powerful tools that simplify testing, documentation, and migration—so you can focus on delivering value, not fixing errors.
</p>
                    </div>
                     <div class="sixteen wide column" style="paddingTop: '0px'">
               
👉 <a href="https://figaf.com/cpihelper20" target="_blank"><u>Read more</u></a> about Figaf's Partner Program and take your consultancy to the next level. </div>
                </div>
                </div>
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
            <div>Please also explore our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">Github Page</a>.
            </div>
            <div>Created by: Dominic Beckbauer and Kangoolutions.com</div>
        </div>
        <div class="ui bottom attached tab segment active" data-tab="four">
            ${devtoberfest}
        </div>
    </div>`;

    await showBigPopup(html, "Your SAP CI Toolbox since 1963", {
      fullscreen: false,
      large: true,
      callback: () => {
        $(".menu .item").tab();
        $(".cpihelper83782").popup({
          inline: true,
          hoverable: true,
          position: "bottom left",
          delay: {
            show: 300,
            hide: 800,
          },
        });
      },
      onclose: () => {
     //   showBigPopup(recentChanges, "Your SAP CI Toolbox since 1963", {
     //     fullscreen: false,
     //   });
      },
    });

    await storageSetPromise({ cpiHelper_Version: manifestVersion });

    return true;
  }
  return false;

  //persist so that the popup does not appear again
}

async function recrutingPopup(force = false) {
  //shows a popup if browser language is German and if timestamp is not set or today is after timestamp in chrome storage

  //show only for a fraction of user for testing

  //remove timestamps for testing
  //await chrome.storage.local.remove("recrutingPopupTimestamp");
  //await chrome.storage.local.remove("recrutingPopupRandomGroup");
  //var ts = 1728995035000;
  //var obj2 = {};
  //obj2["recrutingPopupTimestamp"] = ts;
  //await storageSetPromise(obj2);

  const Kangoolutions_Logo = chrome.runtime.getURL("images/kangoolutions_icon.png");

  var randomGroup = parseInt(await storageGetPromise("recrutingPopupRandomGroup"));

  if (!randomGroup) {
    randomGroup = Math.floor(Math.random() * 100);
    var obj = {};
    obj["recrutingPopupRandomGroup"] = randomGroup;
    await storageSetPromise(obj);
  }

  var lang = navigator.language || navigator.userLanguage;
  var timestamp = parseInt(await storageGetPromise("recrutingPopupTimestamp"));
  var today = +new Date();

  if (!timestamp) {
    //get random int between 1 and 11
    var randomTimestamp = Math.floor(Math.random() * 10) + 1;

    var oneweek = +new Date() + randomTimestamp * 24 * 60 * 60 * 1000*2;

    var obj = {};
    obj["recrutingPopupTimestamp"] = oneweek;
    await storageSetPromise(obj);
    log.log("recruting popup timestamp set to today + " + randomTimestamp + " days");
  } else {
    var hrts = new Date(timestamp);
    log.debug("recruting popup in human readable time: " + hrts);
  }

  if (lang == "de-DE" && (force || (!timestamp && randomGroup <= 50) || (timestamp && timestamp < today))) {
    statistic("recrutingPopup", "show");
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
        <p>Wir haben viel Humor und das vielleicht coolste <a href="https://kangoolutions.com/team/" style="color: green; text-decoration: none;" 
    onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'" target="_blank" >Team</a> der Welt. Lass uns doch mal plaudern:
        </p>
    </div>
    </div>`;

    var popup = createElementFromHTML(html);

    var createRemindButtopn = function (text, days, color = "teal") {
      var button = document.createElement("button");
      button.className = "ui " + color + " right labled icon button";
      var icon = document.createElement("i");
      icon.className = "right bell icon";
      button.textContent = text;
      button.appendChild(icon);

      button.style.marginBottom = "10px";

      button.onclick = async function () {
        statistic("recrutingPopup", "remind", days);

        //get unix timestamp for tomorrow
        var tomorrow = +new Date() + days * 24 * 60 * 60 * 1000;

        var obj = {};
        obj["recrutingPopupTimestamp"] = tomorrow;
        await storageSetPromise(obj);
        log.log("recruting popup timestamp set to today + " + days + " days");

        $("#cpiHelper_semanticui_modal").modal("hide");
      };
      return button;
    };

    var nextStepButtion = document.createElement("button");
    nextStepButtion.className = "ui teal right labled icon button";
    var icon = document.createElement("i");
    icon.className = "right arrow icon";

    nextStepButtion.textContent = "Jau! Ich will mehr wissen.";
    nextStepButtion.appendChild(icon);
    nextStepButtion.onclick = async function () {
      statistic("recrutingPopup", "nextStep");
      window.open("https://kangoolutions.com/karriere/", "_blank");
      $("#cpiHelper_semanticui_modal").modal("hide");
    };

    //create br
    var br = document.createElement("br");
    var span = document.createElement("span");
    span.textContent = "Erinnere mich: ";
    popup.appendChild(br);

    popup.appendChild(nextStepButtion);
    popup.appendChild(br);
    popup.appendChild(createRemindButtopn("Schon ok... Erinnere mich nicht mehr", 9999, "violet"));

    popup.appendChild(br);
    popup.appendChild(span);
    popup.appendChild(createRemindButtopn("Morgen", 1));

    popup.appendChild(createRemindButtopn("In einem Monat", 30));

    popup.appendChild(createRemindButtopn("In einem halben Jahr", 190));

    await showBigPopup(popup, "Wir suchen Verstärkung!", {
      fullscreen: false,
      onclose: async () => {
        if (!force) {
          //get unix timestamp for in 2 month
          var remindIn = +new Date() + 2 * 30 * 24 * 60 * 60 * 1000;
          var obj = {};
          obj["recrutingPopupTimestamp"] = remindIn;
          await storageSetPromise(obj);
        }
      },
    });
  }
}
