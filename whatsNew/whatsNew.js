async function whatsNewCheck(showOnlyOnce = true) {
    var manifestVersion = chrome.runtime.getManifest().version;
  
    check = await storageGetPromise("whatsNewV" + manifestVersion);
  
    silentupdates = ["3.0.3", "3.14.4"]
  
    //const FIGAF_IMG = chrome.runtime.getURL("images/figaf_logo-or3aup2a4kcerbzkw8qe9fj133kv700baqsm2nnpj4.png");
    const FIGAF_IMG = chrome.runtime.getURL("images/figaf_logo.png");
    const Kangoolutions_Logo = chrome.runtime.getURL("images/kangoolutions_icon.png");
    const md = window.markdownit();
    if (!check && !silentupdates.includes(manifestVersion) || showOnlyOnce == false) {
        html = `<div class="ui message">
        <img class="ui small floated image" src="${Kangoolutions_Logo}">
        <div class="content">
            <div class="header"> You updated successfully to version ${manifestVersion} </div>
            <p>Developed by a great community and Kangoolutions GmbH from Cologne, Germany! Follow our <a
                    href="https://www.linkedin.com/company/kangoolutions" target="_blank">LinkedIn page</a> for
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
                    <div class="four wide column">
                        <a href="https://figaf.com/cpihelper-and-figaf" target="_blank"><img
                                class="ui big left floated image" src="${FIGAF_IMG}"></a>
                    </div>
                    <div class="twelve wide column">
                        <div class="ui header">This release is sponsored by Figaf </div>
                        <p>
                        <b>Live Event on SAP PI to Integration Suite Migration in Copenhagen</b><br>
Considering a migration to the SAP Integration Suite? Figaf is hosting an in-depth event in Copenhagen on September 17-18. This event will equip you with essential knowledge for planning your migration.
                      </p>
                    </div>
                    <div class="sixteen wide column" style="padding-top: 0px;">
                    <p>
                        <br>Experts from Figaf, SAP, and partners will provide insights, covering key topics such as migration strategies, tools, and best practices. Attendees will have opportunities to engage in hands-on sessions, network with peers, and gain valuable tips for a smooth transition.
                      </p>
                    </div>
                     <div class="sixteen wide column">
                    For more details, visit the <a href="https://figaf.com/cpihelper15" target="_blank"><u>event page</u></a>.
                    </div>
                </div>
            </div>
            <h3 class="ui header">
                <i class="bell icon"></i>
                <div class="content">
                   New Release
                </div>
            </h3>
            <p>
                CPI Helper is free and open source, so perhaps you would like to assist us in contributing new features and
                bug fixes. Our community is expanding, and we would like to give a special thanks to Daniel Graversen and
                his amazing Figaf Tools, which have helped me dedicate more time to developing the CPI Helper.<br />
            </p>
            </h3>
            <h3 class="ui header">
                <i class="bell icon"></i>
                <div class="content">
                    What's New?
                </div>
            </h3>
            <a class="ui red center right ribbon label" style="position: absolute;">FireFox limited support</a>  
            <div class="changeloglist">${
                Object.entries(
                    whats_new_log.trim().split('\n').reduce((acc, line) => {
                        const match = line.match(/\[([^\]]+)\](.*)/);
                        if (match) {
                            const [_, header, description] = match;
                            (acc[header.trim()] = acc[header.trim()] || []).push(description.trim());
                        }
                        return acc;
                    }, {})
                ).sort(([a], [b]) => a.localeCompare(b)).map(([header, descs]) => `
                    <div class="ui block header">
                        <div class="ui sub header">${header}</div>
                        <div class="description" style="font-weight: normal;">
                            <ul class="list">
                                ${descs.map(desc => `<li>${md.renderInline(desc)}</li>`).join('')}
                            </ul>
                        </div>
                    </div>`).join('')}</div>
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
            <p>To learn more about CPI Helper features and what's new on our <a
                    href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">Github
                    Page</a>.</p>
            <p>Unfortunately, SAP does not work together with us and does not inform us when the APIs change. So be
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
                target='_blank' href="https://www.linkedin.com/in/dominic-beckbauer-515894188/">LinkedIn</a></p>
            <h3 class="ui header">
                <i class="glasses icon"></i>
                <div class="content">
                    More Details
                </div>
            </h3>
            <div>License: <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">GNU GPL v3</a>
            </div>
            <div>Please also check our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">Github Page</a>.
            </div>
            <div>Created by: Dominic Beckbauer and Kangoolutions.com</div>
        </div>
    </div>`;
    await showBigPopup(html, "Your SAP CI Toolbox since 1963", {
      fullscreen: false,
      callback: () => {
        $(".menu .item").tab();
      },
    });

    var obj = {};
    obj["whatsNewV" + manifestVersion] = "show";
    chrome.storage.local.set(obj, function () {
      log.log("whats new displayed and saved");
    });

    return true;
  }
  return false;

  //persist so that the popup does not appear again
}

async function recrutingPopup(force = false) {
    if(force = false) {
        return true
    }

    //shows a popup if browser language is German and if timestamp is not set or today is after timestamp in chrome storage

    //show only for a fraction of user for testing

    const Kangoolutions_Logo = chrome.runtime.getURL("images/kangoolutions_icon.png");

    var randomGroup = parseInt(await storageGetPromise("recrutingPopupRandomGroup"));

    if (!randomGroup) {
        randomGroup = Math.floor(Math.random() * 100);
        var obj = {}
        obj["recrutingPopupRandomGroup"] = randomGroup
        await storageSetPromise(obj)
    }

    var lang = navigator.language || navigator.userLanguage;
    var timestamp = parseInt(await storageGetPromise("recrutingPopupTimestamp"));
    var today = +new Date();

    if (!timestamp) {
        var oneweek = +new Date() + 30 * 24 * 60 * 60 * 1000;

        var obj = {};
        obj["recrutingPopupTimestamp"] = oneweek;
        chrome.storage.local.set(obj, function () {
            log.log("recruting popup timestamp set to today + " + 7 + " days");
        });
    }

    if (lang == "de-DE" && (force || (!timestamp && randomGroup <= 80) || (timestamp && timestamp < today))) {
        statistic("recrutingPopup", "show")
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
            <div class="item">Einen sicheren und langfristigen Job</div>
            <div class="item">Arbeiten aus dem Home Office oder ab und zu mal beim Kunden vor Ort</div>
            <div class="item">Minimale Hierarchien </div>
            <div class="item">Eigenverantwortung und Freiraum, statt Formularen und starren Prozessen</div>
            <div class="item">Eine junge Firma, mit jungen Menschen und feinen Events</div>
            <div class="item">Mitgestaltungsmöglichkeit beim Aufbau unserer Firma</div>
            <div class="item">Summer Event mit der ganzen Firma (2023 auf Sizilien und 2024 auf Kreta).</div>
        </div>
        <p>Wir haben viel Humor und das vielleicht coolste Team der Welt. Lass uns doch mal plaudern:
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
        chrome.storage.local.set(obj, function () {
          log.log("recruting popup timestamp set to today + " + days + " days");
        });

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
      window.open("https://ich-will-zur.kangoolutions.com/", "_blank");
      $("#cpiHelper_semanticui_modal").modal("hide");
    };

    //create br
    var br = document.createElement("br");
    var span = document.createElement("span");
    span.textContent = "Erinnere mich: ";
    popup.appendChild(br);

    popup.appendChild(nextStepButtion);
    popup.appendChild(br);
    popup.appendChild(
      createRemindButtopn(
        "Schon ok... Erinnere mich nicht mehr",
        9999,
        "violet"
      )
    );

    popup.appendChild(br);
    popup.appendChild(span);
    popup.appendChild(createRemindButtopn("Morgen", 1));

    popup.appendChild(createRemindButtopn("In einer Woche", 7));

    popup.appendChild(createRemindButtopn("In einem halben Jahr", 190));

    await showBigPopup(popup, "Wir suchen Verstärkung!", { fullscreen: false });
  }
}
