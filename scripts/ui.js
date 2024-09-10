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
    class: type + ($("html").hasClass("sapUiTheme-sap_horizon_dark") ? " ch_dark " : ""),
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
  title = "CPI Helper Is thinking",
  time = undefined
) {
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
async function showBigPopup(content, header, parameters = { fullscreen: true, callback: null, onclose: null }, count = 0, maxcount = 0, type = "mouse") {
  $("#cpiHelper_waiting_model, #cpiHelper_semanticui_modal").modal("hide");
  var $modal = $("#cpiHelper_semanticui_modal");
  if ($modal.length) {
    $modal.attr("class", "cpiHelper ui modal");

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
            <div class="ui black deny button">Close</div>
          </div>
        `);

    ["negative", "positive"].forEach((type, index) => {
      const $button = $modal.find(`.${type}`);
      if ($button.length) {
        $button.on("click", () => {
          const sortedArray = $(".cpiHelper_onclick[inline_cpi_child]").map((_, e) => parseInt($(e).attr("inline_cpi_child"), 10)).get().sort((a, b) => a - b);
          console.log(sortedArray, $("#cpiHelper_semanticui_modal .header").attr("count"), sortedArray[$("#cpiHelper_semanticui_modal .header").attr("count")], index === 0 ? "previous" : "next");
          if (sortedArray[$("#cpiHelper_semanticui_modal .header").attr("count")]) {
            let element = findNearest(sortedArray, sortedArray[$("#cpiHelper_semanticui_modal .header").attr("count")], index === 0 ? "previous" : "next");
            $(`[inline_cpi_child=${element}] .cpiHelper_inlineInfo`).trigger("click");
            showToast(`${index ? "Next" : "Previous"} Step ${element} will be displayed shortly`);
            $modal.modal("hide");
            showWaitingPopup();
          } else {
            showToast(`${index ? "Next" : "Previous"} Step is not found`, "something went wrong", "error")
          }
        });
      }
    });

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

    $modal.toggleClass("fullscreen", parameters.fullscreen).modal({
      detachable: false,
      blurring: true,
      autoShow: true,
      onShow: function () {
        if (!$modal.parent().is("#cpihelperglobal")) {
          $('#cpihelperglobal').append($modal);  // Ensuring the modal stays within its parent container
        }
      },
      onHidden: function () {
        if (parameters.onclose  && parameters.onclose instanceof Function) {
          parameters.onclose();
        }
      }
    }).modal("show");
    
  } else {
    showToast("", "Element is missing.. Reload the page", "error")
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
