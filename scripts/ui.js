function workingIndicator(status) {
  // log.log(`CPI-Helper show indicator: $status`)
  //create snackbar div element
  if (!document.querySelector("#cpiHelper_workingIndicator")) {
    body().appendChild(createElementFromHTML(`<i id='cpiHelper_workingIndicator' class='sync alternate loading icon' hidden></i>`));
  }
  var x = $("#cpiHelper_workingIndicator");
  status ? x.removeAttr("hidden") : x.attr("hidden", "");
}

//snackbar for messages (e.g. trace is on)
function showToast(message, title, type = "") {
  //type = success, error, warning
  $.toast({
    class: type + ($("html").hasClass("sapUiTheme-sap_horizon_dark") ? " ch_dark " : ""),
    position: "bottom center",
    showProgress: "bottom",
    ...(title ? { title: title } : {}),
    message,
    newestOnTop: true,
  });
}
function showWaitingPopup(content = undefined, classname = "small", title = "CPI Helper Is thinking", time = undefined) {
  $("#cpiHelper_waiting_model").html(`
      <div class="ui positive  icon message">
        <i class="sync alternate loading icon"></i>
        <div class="content">
          <div class="header">${title}</div>
          <p>${content || `Please Wait while we fetch content for you.`}</p>
        </div>
    </div>`);
  $("#cpiHelper_waiting_model")
    .modal({
      class: classname,
      closeIcon: false,
      blurring: true,
      closable: true,
      detachable: false,
    })
    .modal("show");
  if (time) {
    setTimeout(() => {
      $("#cpiHelper_waiting_model").modal("hide");
    }, time);
  }
}
async function showBigPopup(
  content,
  header,
  parameters = {
    fullscreen: true,
    iconInButton: "", //can be checkmark
    iconType: "", //can be positive, negative, etc
    large: false,
    callback: null,
    closeText: "Close",
    onclose: () => {
      $("#cpiHelper_waiting_model, #cpiHelper_semanticui_modal").modal("hide");
    },
  },
  count = 0,
  maxcount = 0,
  type = "mouse"
) {
  //collects all parameters for the popup button
  let buttonParameters = ["deny", "ui", "button"];
  let icon = "";
  if (parameters.iconInButton) {
    icon = `<i class="${parameters.iconInButton} icon"></i>`;
  }

  if (parameters.iconType) {
    buttonParameters.push(parameters.iconType);
  }

  if (!parameters.closeText) parameters.closeText = "Close";
  $("#cpiHelper_waiting_model, #cpiHelper_semanticui_modal").modal("hide");
  var $modal = $("#cpiHelper_semanticui_modal");
  if ($modal.length) {
    $modal.attr("class", "cpiHelper ui modal");
    if (parameters.large) {
      $modal.addClass("large");
    }

    $modal.html(`
          <i class="close icon" style="color:var(--cpi-text-color)"></i>
          <div class="header" maxcount="${maxcount}" count="${count}">
            CPI Helper ${header ? "- " + header : ""}
          </div>
          <div class="scrolling content">
            <div class="description" id="cpiHelper_bigPopup_content_semanticui" style="min-height: 50vh; transition: all 100ms ease-in-out;">
              <div class="ui active inverted dimmer">
                <div class="ui loader"></div>
              </div>
            </div>
          </div>
          <div class="actions">
            ${maxcount && count ? '<div class="ui negative animated button"><div class="visible content">Prev</div><div class="hidden content"><i class="angle double left icon"></i></div></div>' : ""}
            ${maxcount && count !== maxcount - 1 ? '<div class="ui positive animated button"><div class="visible content">Next</div><div class="hidden content"><i class="angle double right icon"></i></div></div>' : ""}
            <div class="${buttonParameters.join(" ")}">${icon}${parameters.closeText}</div>
          </div>
        `);

    if (maxcount > 0) {
      ["negative", "positive"].forEach((type, index) => {
        const $button = $modal.find(`.${type}`);
        if ($button.length) {
          $button.on("click", () => {
            const sortedArray = $(".cpiHelper_onclick[inline_cpi_child]")
              .map((_, e) => parseInt($(e).attr("inline_cpi_child"), 10))
              .get()
              .sort((a, b) => a - b);
            console.log(sortedArray, $("#cpiHelper_semanticui_modal .header").attr("count"), sortedArray[$("#cpiHelper_semanticui_modal .header").attr("count")], index === 0 ? "previous" : "next");
            if (sortedArray[$("#cpiHelper_semanticui_modal .header").attr("count")]) {
              let element = findNearest(sortedArray, sortedArray[$("#cpiHelper_semanticui_modal .header").attr("count")], index === 0 ? "previous" : "next");
              $(`[inline_cpi_child=${element}] .cpiHelper_inlineInfo`).trigger("click");
              showToast(`${index ? "Next" : "Previous"} Step ${element} will be displayed shortly`);
              $modal.modal("hide");
              showWaitingPopup();
            } else {
              showToast(`${index ? "Next" : "Previous"} Step is not found`, "something went wrong", "error");
            }
          });
        }
      });
    }

    var $infocontent = $("#cpiHelper_bigPopup_content_semanticui");

    if (typeof content === "string") {
      $infocontent.html(content);
    } else if (typeof content === "object") {
      $infocontent.empty().append(content);
    } else if (typeof content === "function") {
      const result = await content();
      $infocontent.empty().append(result);
    }

    if (parameters.callback) {
      parameters.callback();
    }

    $modal
      .toggleClass("fullscreen", parameters.fullscreen)
      .modal({
        detachable: false,
        blurring: true,
        autoShow: true,
        onShow: function () {
          if (!$modal.parent().is("#cpihelperglobal")) {
            $("#cpihelperglobal").append($modal); // Ensuring the modal stays within its parent container
          }
        },
        onHidden: function () {
          if (parameters.onclose && parameters.onclose instanceof Function) {
            parameters.onclose();
          }
        },
      })
      .modal("show");
  } else {
    showToast("", "Element is missing.. Reload the page", "error");
  }
}

async function createTabHTML(objects, idPart, overwriteActivePosition) {
  return new Promise(async (resolve, reject) => {
    /*
      {label:"Hallo",
       content: "",
       active}
    }
    */

    html = document.createElement("div");
    html.classList.add("cpiHelper_tabs");

    let checked = 'checked=""';
    for (let i = 0; i < objects.length; i++) {
      checked = "";
      if ((overwriteActivePosition != null && overwriteActivePosition == i) || (overwriteActivePosition != null && overwriteActivePosition == objects[i].label) || (overwriteActivePosition == null && objects[i].active)) {
        checked = 'checked="checked"';
      }

      //input button
      let input = createElementFromHTML(`<input name="tabs-${idPart}" type="radio" id="tab-${idPart}-${i}" ${checked} class="cpiHelper_tabs_input"/>`);

      if (typeof objects[i].content == "function") {
        input.onclick = async (event) => {
          let contentElement = document.getElementById(idPart + "-" + i + "-content");
          if (contentElement.innerHTML == '<div class="cpiHelper_infoPopUp_content">Please Wait...</div>') {
            let contentResponse = await objects[i].content(objects[i]);
            if (typeof contentResponse == "object") {
              contentElement.innerHTML = "";
              contentElement.appendChild(contentResponse);
            }
            if (typeof contentResponse == "string") {
              contentElement.innerHTML = contentResponse;
            }
            if (typeof contentResponse == "function") {
              contentElement.innerHTML = contentResponse(objects[i]);
            }
          }
        };
      }

      let label = createElementFromHTML(`<label for="tab-${idPart}-${i}" class="cpiHelper_tabs_label">${objects[i].label}</label>`);

      //content of tab
      let content = createElementFromHTML(` <div id="${idPart}-${i}-content" class="cpiHelper_tabs_panel"></div>`);

      if (typeof objects[i].content == "string") {
        content.innerHTML = objects[i].content;
      }

      if (typeof objects[i].content == "object") {
        content.appendChild(objects[i].content);
      }

      if (typeof objects[i].content == "function") {
        content.innerHTML = '<div class="cpiHelper_infoPopUp_content">Please Wait...</div>';
        if (objects[i].active) {
          let contentResponse = await objects[i].content(objects[i]);
          if (typeof contentResponse == "object") {
            content.innerHTML = "";
            content.appendChild(contentResponse);
          }
          if (typeof contentResponse == "string") {
            content.innerHTML = contentResponse;
          }
          if (typeof contentResponse == "function") {
            content.innerHTML = contentResponse(objects[i]);
          }
        }
      }

      html.appendChild(input);
      html.appendChild(label);
      html.appendChild(content);
    }

    return resolve(html);
  });
}

// Function to show license popup
async function showLicensePopup(options = {}) {
  const licenseUrl = chrome.runtime.getURL("docs/LICENSE");
  let licenseText = "";
  try {
    const response = await fetch(licenseUrl);
    licenseText = await response.text();
  } catch (e) {
    licenseText = "Could not load license text. Please visit: https://www.gnu.org/licenses/gpl-3.0.en.html";
  }

  const licenseContent = `
    <div class="ui segment">
      <h3 class="ui header">
        <i class="legal icon"></i>
        <div class="content">
          GNU General Public License v3
        </div>
      </h3>
      <div style="margin-top: 0.1rem; margin-bottom: 1rem;">
        This extension is free and open-source software licensed under the GNU GPL v3.
        <br><br>
        <strong>By using this extension, you agree to the terms and conditions of this license.</strong>
      </div>
      <div class="ui segment" style="max-height: 400px; overflow-y: auto; font-family: monospace; white-space: pre-wrap; font-size: 0.9em;">
${licenseText}
      </div>
    </div>
  `;

  showBigPopup(licenseContent, "License Agreement - GNU GPL v3", {
    fullscreen: false,
    closeText: "I Agree",
    iconInButton: "checkmark",
    iconType: "positive",
    ...options,
  });
}

//opens the popup that is triggered bei the info button
async function openIflowInfoPopup() {
  async function getInfoContent() {
    await getIflowInfo(null, false, false);
    await getIflowInfoExtended();

    var x = document.createElement("div");
    x.classList.add("cpiHelper_infoPopUp_content");
    x.innerHTML = "";

    var deployedOn = cpiData?.flowData?.artifactInformation?.deployedOn;
    if (deployedOn) {
      let date = new Date(deployedOn);
      //handle time zone differences
      date.setTime(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
      deployedOn = date.toLocaleString();
    }

    var textElement = `
      <h4 class="ui horizontal divider left aligned header">
        <i class="info icon"></i>
        iFlow Info
      </h4>
      `;
    x.appendChild(createElementFromHTML(textElement));
    textElement = `<div class="cpiHelper_infoPopUp_items">
      <div>Name: ${cpiData?.flowData?.artifactInformation?.name}</div>
      <div>Runtime: ${cpiData.runtimeLocationId}</div>
      <div>SymbolicName: ${cpiData?.flowData?.artifactInformation?.symbolicName}</div>
      <div>DeploymentState: ${cpiData?.flowData?.artifactInformation?.deployState}</div>
      ${
        cpiData?.flowData?.artifactInformation?.deployState !== "UNDEPLOYED"
          ? `
      <div>Trace: ${cpiData?.flowData?.logConfiguration?.traceActive}</div>
      <div>DeployedVersion: ${cpiData?.flowData?.artifactInformation?.version}</div>
      <div>DeployedOn: ${deployedOn}</div>
      <div>SemanticState: ${cpiData?.flowData?.artifactInformation?.semanticState}</div>
      <div>DeployedBy: ${cpiData?.flowData?.artifactInformation?.deployedBy}</div>
      `
          : ""
      }
    </div>`;

    x.appendChild(createElementFromHTML(textElement));

    if (cpiData?.flowData?.endpointInformation && cpiData?.flowData?.endpointInformation.length > 0) {
      cpiData.flowData.endpointInformation.forEach((element) => {
        if (element.endpointInstances && element.endpointInstances.length > 0) {
          var e = document.createElement("div");
          e.classList.add("cpiHelper_infoPopUp_items");
          e.innerHTML = `<div>Endpoints:</div>`;
          x.appendChild(e);
          for (var i = 0; i < element.endpointInstances.length; i++) {
            let f = document.createElement("div");
            f.className = "contentText";
            f.innerText = `${element.endpointInstances[i]?.endpointCategory}: ${element.endpointInstances[i]?.endpointUrl}`;
            var quickCopyToClipboardButton = createElementFromHTML(
              "<button class='cpiHelper_inlineInfo-button' ><span data-sap-ui-icon-content='' data-text='" +
                `${element.endpointInstances[i]?.endpointUrl}` +
                "' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>"
            );
            quickCopyToClipboardButton.onclick = (event) => {
              copyText(event.srcElement.getAttribute("data-text"));
            };
            f.appendChild(quickCopyToClipboardButton);
            e.appendChild(f);
          }
        }
      });
    }
    //JSON?
    // List Variables
    // GET https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/Operations/com.sap.esb.monitoring.datastore.access.command.ListDataStoreEntriesCommand?storeName=sap_global_store&allStores=true&maxNum=100000

    async function createTableForVariables() {
      var variableList = await makeCallPromise(
        "GET",
        "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.ListDataStoreEntriesCommand?storeName=sap_global_store&allStores=true&maxNum=100000",
        false,
        "application/json",
        null,
        false
      );

      variableList = JSON.parse(variableList).entries;

      //check if variables exist
      if (variableList == null || variableList.length == 0) {
        return document.createElement("div");
      }

      //filter only global variables or variables from this flow
      variableList = variableList.filter((element) => !element.qualifier || element.qualifier == cpiData?.flowData?.artifactInformation?.symbolicName);

      //check if array is now empty
      if (variableList == null || variableList.length == 0) {
        return document.createElement("div");
      }

      //if not, build table
      var result = document.createElement("table");
      result.classList.add("cpiHelper_infoPopUp_Table");

      tr0 = document.createElement("tr");
      tr0th1 = document.createElement("th");
      tr0th1.innerText = "Store";
      tr0th2 = document.createElement("th");
      tr0th2.innerText = "Name";
      tr0th2.style.width = "100%";

      tr0.appendChild(document.createElement("td"));
      tr0.appendChild(tr0th1);
      tr0.appendChild(tr0th2);
      result.appendChild(tr0);

      var even = "";
      variableList.forEach((item) => {
        let tr = document.createElement("tr");
        tr.id = item.id + item.storeName;
        tr.className = even;

        let tdfunctions = document.createElement("td");
        tdfunctions.style.whiteSpace = "nowrap";

        let showButton = createElementFromHTML("<button><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");

        tdfunctions.appendChild(showButton);

        let downloadButton = createElementFromHTML("<button><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");
        tdfunctions.appendChild(downloadButton);

        let deleteButton = createElementFromHTML("<button><span data-sap-ui-icon-content='' class='sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem;'></span></button>");
        tdfunctions.appendChild(deleteButton);

        tr.appendChild(tdfunctions);

        let td1 = document.createElement("td");
        td1.innerText = item.qualifier == null ? "global" : "local";
        tr.appendChild(td1);

        let td2 = document.createElement("td");
        td2.innerText = item.id;
        tr.appendChild(td2);

        downloadButton.onclick = async (element) => {
          let payload = { storeName: item.storeName, id: item.id };
          if (item.qualifier) {
            payload.qualifier = item.qualifier;
          }
          var response = await makeCallPromise("POST", "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStorePayloadCommand", false, "", JSON.stringify(payload), true, "application/json;charset=UTF-8");
          var value = response.match(/<payload>(.*)<\/payload>/gs)[0];
          value = value.substring(9, value.length - 10);

          window.open("data:application/zip;base64," + value);
        };

        showButton.onclick = async (element) => {
          text = document.getElementById(item.id + item.storeName + "_value");

          if (text.classList.contains("cpiHelper_infoPopUp_TR_hide")) {
            try {
              let payload = {
                storeName: item.storeName,
                id: item.id,
              };
              if (item.qualifier) {
                payload.qualifier = item.qualifier;
              }

              var response = await makeCallPromise(
                "POST",
                "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStoreVariableCommand",
                false,
                "",
                JSON.stringify(payload),
                true,
                "application/json;charset=UTF-8"
              );
              var value = response.match(/<value>(.*)<\/value>/gs)[0];

              //aggressive mode means we look into the zip file from variable
              var agressiveMode = false;
              if (!value) {
                aggressiveMode = true;
                function base64ToBuffer(str) {
                  str = window.atob(str); // creates a ASCII string
                  var buffer = new ArrayBuffer(str.length),
                    view = new Uint8Array(buffer);
                  for (var i = 0; i < str.length; i++) {
                    view[i] = str.charCodeAt(i);
                  }
                  return buffer;
                }

                var response = await makeCallPromise(
                  "POST",
                  "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStorePayloadCommand",
                  false,
                  "",
                  JSON.stringify(payload),
                  true,
                  "application/json;charset=UTF-8"
                );
                var base = response.match(/<payload>(.*)<\/payload>/gs)[0];
                base = base.substring(9, base.length - 10);

                var new_zip = new JSZip();
                await new_zip.loadAsync(base64ToBuffer(base));

                value = await new_zip.files[Object.keys(new_zip.files)[0]].async("string");
              } else {
                //when no aggressive mode, data has still to be transformed from base64
                value = atob(value.substring(7, value.length - 8));
              }

              let valueTd = document.createElement("td");
              valueTd.colSpan = 4;

              valueTd.innerText = value;
              text.innerHTML = "";
              text.appendChild(valueTd);
              if (agressiveMode) {
                showToast("Aggressive mode was used to show variable");
              }

              text.classList.remove("cpiHelper_infoPopUp_TR_hide");
            } catch (error) {
              showToast("It was not possible to extract the data.", "Please download and try manually.");
            }
          } else {
            text.classList.add("cpiHelper_infoPopUp_TR_hide");
            text.innerHTML = "<td colspan=4>Please wait...</td>";
          }
        };

        deleteButton.onclick = async (element) => {
          var doDelete = getConfirmation(`Do you really want to delete variable \"${item.id}\"? You can not undo this.`);
          if (doDelete) {
            //delete Variable
            try {
              let payload = {
                storeName: item.storeName,
                ids: [item.id],
              };
              if (item.qualifier) {
                payload.qualifier = item.qualifier;
              }
              var response = await makeCallPromise(
                "POST",
                "/" + cpiData.urlExtension + "Operations/com.sap.esb.monitoring.datastore.access.command.DeleteDataStoreEntryCommand",
                false,
                "",
                JSON.stringify(payload),
                true,
                "application/json;charset=UTF-8"
              );
              showToast("Variable deleted.");
              let cpiHelper_infoPopUp_Variables = document.getElementById("cpiHelper_infoPopUp_Variables");

              cpiHelper_infoPopUp_Variables.appendChild(await createTableForVariables());
              cpiHelper_infoPopUp_Variables.children[0].remove();
            } catch (err) {
              showToast("Do you have sufficient rights?", "Can not delete variable", "error");
            }
          }
        };

        let trShowButton = document.createElement("tr");
        trShowButton.className = even;
        trShowButton.classList.add("cpiHelper_infoPopUp_TR_hide");
        trShowButton.id = item.id + item.storeName + "_value";
        trShowButton.innerHTML = "<td colspan=4>Please wait...</td>";

        result.appendChild(tr);
        result.appendChild(trShowButton);

        even = even == "even" ? "" : "even";
      });

      return result;
    }
    try {
      var variablesDiv = document.createElement("div");
      variablesDiv.id = "cpiHelper_infoPopUp_Variables";
      variablesDiv.classList.add("cpiHelper_infoPopUp_items");
      variablesDiv.appendChild(await createTableForVariables());
      x.appendChild(variablesDiv);
    } catch (error) {
      log.error("Error creating variable table: ", error);
    }

    //Get Variable XCSRF
    //https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/Operations/com.sap.esb.monitoring.datastore.access.command.GetDataStoreVariableCommand
    // {"storeName":"sap_global_store","id":"keywordsSinceIds","qualifier":"Sentiment_Engagement_-_Twitter_Keywords_Search_Integration_Flow"}

    //delete variables XCSRF
    // POST https://p0349-tmn.hci.eu1.hana.ondemand.com/itspaces/Operations/com.sap.esb.monitoring.datastore.access.command.DeleteDataStoreEntryCommand
    // {"storeName":"sap_global_store","ids":["dateglobal"]}

    //undeploy button
    if (deployedOn) {
      var undeploybutton = document.createElement("button");
      undeploybutton.classList.add("ui");
      undeploybutton.classList.add("button");

      undeploybutton.innerText = "Undeploy this IFlow";
      undeploybutton.id = "undeploybutton";
      undeploybutton.addEventListener("click", (a) => {
        undeploy(cpiData?.flowData?.artifactInformation?.tenantId, cpiData?.flowData?.artifactInformation?.id);
      });
      x.appendChild(undeploybutton);
    }
    var textElement2 = `
<h4 class="ui horizontal divider left aligned header">
  <i class="envelope icon"></i>
  News
</h4>
`;
    x.appendChild(createElementFromHTML(textElement2));
    //more information about cpi helper
    textElement2 = `<div class="cpiHelper_infoPopUp_items">

  <p>For news and interesting blog posts about SAP CI, <b>please follow our company <a href="https://www.linkedin.com/company/kangoolutions" target="_blank">LinkedIn-Page</a></b>.</p>
  <div><p>We are a bunch of passionate SAP CI developers from Cologne, Germany. If you want to work with us then you can reach us through our website <a href="https://kangoolutions.com" target="_blank">kangoolutions.com</a>. Or maybe you want to become part of the team? Then have a look <a href="https://ich-will-zur.kangoolutions.com/" target="_blank">here</a> (German only). Unfortunately, we can only consider applicants with german residence due to legal reasons.</p></div>
  <h4 class="ui horizontal divider left aligned header">
  <i class="envelope icon"></i>
  General Information
</h4>
  <div>Created by: Dominic Beckbauer and Kangoolutions.com</div>
  <div>License: <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">GNU GPL v3</a></div>
  <div>Please also check our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">Github
  Page</a>.</div>
  </div>`;

    x.appendChild(createElementFromHTML(textElement2));

    var whatsNewButton = document.createElement("button");
    whatsNewButton.classList.add("ui");
    whatsNewButton.classList.add("button");

    whatsNewButton.innerText = "Whats New?";
    whatsNewButton.addEventListener("click", (a) => {
      whatsNewCheck(false);
      $("#cpiHelper_semanticui_modal").modal({ autoShow: true, detachable: false, blurring: true }).modal("show");
      statistic("info_popup_whatsnew_click");
    });
    x.appendChild(whatsNewButton);

    //add a new "license" button
    var licenseButton = document.createElement("button");
    licenseButton.classList.add("ui");
    licenseButton.classList.add("button");
    licenseButton.innerText = "License (GNU GPL v3)";
    licenseButton.addEventListener("click", async (a) => {
      await showLicensePopup();
      statistic("info_popup_license_click");
    });
    x.appendChild(licenseButton);

    //add a new "become part of the team" button
    var recrutingButton = document.createElement("button");
    recrutingButton.classList.add("ui");
    recrutingButton.classList.add("button");

    var lang = navigator.language || navigator.userLanguage;

    if (lang == "de-DE") {
      recrutingButton.innerText = "Werde Berater bei Kangoolutions";
      recrutingButton.addEventListener("click", (a) => {
        recrutingPopup(true);
        $("#cpiHelper_semanticui_modal")
          .modal({
            autoShow: true,
            detachable: false,
            blurring: true,
          })
          .modal("show");
        statistic("info_popup_recruting_click");
      });
      x.appendChild(recrutingButton);
    }
    return x;
  }

  showBigPopup(getInfoContent, "General Information", { fullscreen: false });
}

//opens a new window with the Trace for a MessageGuid
function openTrace(MessageGuid) {
  log.debug("MessageGuid");
  //we have to get the RunID first
  makeCallPromise("GET", "/" + cpiData.urlExtension + cpiData.runtimePathExtension + "odata/api/v1/MessageProcessingLogs('" + MessageGuid + "')/Runs?$format=json", false)
    .then((responseText) => {
      var resp = JSON.parse(responseText);
      var status = resp.d.results[0].OverallState;
      if (resp.d.results.length > 1 && status != "COMPLETED") {
        var runId = resp.d.results[1].Id;
      } else {
        var runId = resp.d.results[0].Id;
      }

      let url = "/" + cpiData.urlExtension + "shell/monitoring/MessageProcessingRun/" + encodeURIComponent(JSON.stringify({ edge: { runtimeLocationId: cpiData.runtimeLocationId }, messageProcessingLog: MessageGuid, RunId: runId }));
      window.open(url, "_blank");
    })
    .catch((e) => {
      log.error("Error while opening Trace: " + e);
    });
}
