function workingIndicator(status) {
  // log.log(`CPI-Helper show indicator: $status`)
  //create snackbar div element
  if (!document.querySelector("#cpiHelper_workingIndicator")) {
    body().appendChild(
      createElementFromHTML(
        `<i id='cpiHelper_workingIndicator' class='sync alternate loading icon' hidden></i>`
      )
    );
  }
  var x = $("#cpiHelper_workingIndicator");
  status ? x.removeAttr("hidden") : x.attr("hidden", "");
}

//snackbar for messages (e.g. trace is on)
function showToast(message, title, type = "") {
  //type = success, error, warning
  $.toast({
    class:
      ($("html").hasClass("sapUiTheme-sap_horizon_dark") ? " inverted " : "") +
      type,
    position: "bottom center",
    showProgress: "bottom",
    ...(title ? { title: title } : {}),
    message,
    newestOnTop: true,
  });
}
function showWaitingPopup(
  content = undefined,
  classname = "small",
  title = "CPI Helper Is thinking"
) {
  $("#cpiHelper_waiting_model")
    .modal({
      title: title,
      class: classname,
      closeIcon: false,
      blurring: true,
      time: time,
      content:
        content ||
        `<div class="ui positive  icon message">
          <i class="notched circle loading icon"></i>
          <div class="content">
            <div class="header">
              Please Wait...
            </div>
            <p>We're fetching content for you.</p>
          </div>
        </div>`,
    })
    .modal("show");
    if (time){
    setTimeout(() => {
      $("#cpiHelper_waiting_model").modal("hide");
    }, time);}
}
async function showBigPopup(
  content,
  header,
  parameters = { fullscreen: true, callback: null },
  count = 0,
  maxcount = 0,
  type = "mouse"
) {
  //create traceInfo div element
  var x = document.getElementById("cpiHelper_semanticui_modal");
  $("#cpiHelper_semanticui_modal").modal("hide");
  if (x && type !== "undefined") {
    x.classList = "cpiHelper ui modal";
  }
  x.innerHTML = `
  <i class="close icon" style="color:var(--cpi-text-color)"></i>
  <div class="header" ${maxcount !== 0 ? `maxcount="${maxcount}"` : ""} ${
    count !== 0 ? `count="${count}"` : ""
  }>
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
    ${
      maxcount !== 0 && count !== 0
        ? `<div class="ui negative animated button"><div class="visible content">Prev</div><div class="hidden content"><i class="angle double left icon"></i></div></div>`
        : ""
    }
    ${
      maxcount !== 0 && count !== maxcount - 1
        ? `<div class="ui positive animated button"><div class="visible content">Next</div><div class="hidden content"><i class="angle double right icon"></i></div></div>`
        : ""
    }
    <div class="ui black deny button">Close</div>
  </div>
`;

  // Add next-prev Button logic start

  ["negative", "positive"].forEach((type, index) => {
    const button = document.querySelector(
      `#cpiHelper_semanticui_modal .${type}`
    );
    if (button) {
      button.addEventListener("click", (index) => {
        sortedarray = Array.from(
          document.querySelectorAll("[inline_cpi_child]"),
          (e) => parseInt(e.getAttribute("inline_cpi_child"), 10)
        ).sort((a, b) => a - b);
        let element = findNearest(
          sortedarray,
          sortedarray[$("#cpiHelper_semanticui_modal .header").attr("count")],
          index === 0 ? "previous" : "next"
        );
        $(`[inline_cpi_child=${element}] .cpiHelper_inlineInfo`).trigger(
          "click"
        );
        showToast(
          `${
            index != 0 ? "Next" : "Previous"
          } Step ${element} will be displayed shortly`
        );
        $("#cpiHelper_semanticui_modal").modal("hide");
        showWaitingPopup();
      });
    }
  });
  // Add next-prev Button logic End
  $(x).toggleClass("fullscreen", parameters.fullscreen);
  if (!$("#cpiHelper_semanticui_modal").hasClass("active")) {
    $("#cpiHelper_semanticui_modal")
      .modal({ autoShow: true, detachable: false, blurring: true })
      .modal("show");
  }

  var infocontent = document.getElementById(
    "cpiHelper_bigPopup_content_semanticui"
  );
  if (typeof content == "string") {
    infocontent.innerHTML = content;
  }

  if (typeof content == "object") {
    infocontent.innerHTML = "";
    infocontent.appendChild(content);
  }

  if (typeof content == "function") {
    var result = await content();
    infocontent.innerHTML = "";
    infocontent.appendChild(result);
  }

  if (parameters.callback) {
    parameters.callback();
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
      if (
        (overwriteActivePosition != null && overwriteActivePosition == i) ||
        (overwriteActivePosition != null &&
          overwriteActivePosition == objects[i].label) ||
        (overwriteActivePosition == null && objects[i].active)
      ) {
        checked = 'checked="checked"';
      }

      //input button
      let input = createElementFromHTML(
        `<input name="tabs-${idPart}" type="radio" id="tab-${idPart}-${i}" ${checked} class="cpiHelper_tabs_input"/>`
      );

      if (typeof objects[i].content == "function") {
        input.onclick = async (event) => {
          let contentElement = document.getElementById(
            idPart + "-" + i + "-content"
          );
          if (
            contentElement.innerHTML ==
            '<div class="cpiHelper_infoPopUp_content">Please Wait...</div>'
          ) {
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

      let label = createElementFromHTML(
        `<label for="tab-${idPart}-${i}" class="cpiHelper_tabs_label">${objects[i].label}</label>`
      );

      //content of tab
      let content = createElementFromHTML(
        ` <div id="${idPart}-${i}-content" class="cpiHelper_tabs_panel"></div>`
      );

      if (typeof objects[i].content == "string") {
        content.innerHTML = objects[i].content;
      }

      if (typeof objects[i].content == "object") {
        content.appendChild(objects[i].content);
      }

      if (typeof objects[i].content == "function") {
        content.innerHTML =
          '<div class="cpiHelper_infoPopUp_content">Please Wait...</div>';
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
