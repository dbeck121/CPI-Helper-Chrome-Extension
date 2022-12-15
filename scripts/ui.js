function workingIndicator(status) {
  //  console.log(`CPI-Helper show indicator: $status`)
  //css for snackbar is already there. see initIflowPage()

  //create snackbar div element
  if (status) {
    var x = document.getElementById("cpiHelper_workingIndicator");
    if (!x) {
      x = document.createElement('div');
      x.id = "cpiHelper_workingIndicator";
      document.body.appendChild(x);
    }

    x.className = "cpiHelper_workingIndicator_show dot-flashing";
  } else {

    var x = document.getElementById("cpiHelper_workingIndicator");
    if (x) {
      x.className = x.className.replace("cpiHelper_workingIndicator_show", "");
      x.className = x.className.replace("dot-flashing", "");
    }
  }
}

//snackbar for messages (e.g. trace is on)
function showToast(title, message, type = "") {

  //type = success, error, warning

  $.toast({
    class: type,
    position: 'bottom center',
    title,
    message,
    newestOnTop: true

  })
    ;
}

async function showBigPopup(content, header, parameters = { fullscreen: true, callback: null }) {
  //create traceInfo div element
  var x = document.getElementById("cpiHelper_semanticui_modal");

  if (x) {
    x.remove()
  }

  if (header) {
    header = "- " + header;
  } else {
    header = "";
  }

  var textElement = `
  <div>
    <i class="close icon"></i>
    <div class="header">
      CPI Helper ${header}
    </div>
    <div class="scrolling content">
      
      <div class="description" id="cpiHelper_bigPopup_content_semanticui" style="min-height: 50vh; transition: all 100ms ease-in-out;">
        <div class="ui active inverted dimmer">
        <div class="ui loader"></div>

      </div>
    </div>

    </div>
    <div class="actions">
      <div class="ui black deny button" onclick="$('#cpiHelper_semanticui_modal').modal('hide');">
        Close
      </div>
  
    </div>
    </div>
    `;



  x = createElementFromHTML(textElement)
  x.classList.add("cpiHelper");
  x.classList.add("ui");
  x.classList.add("modal");

  x.id = "cpiHelper_semanticui_modal"
  document.body.appendChild(x);


  if (parameters.fullscreen) {
    x.classList.add("fullscreen");
  } else {
    x.classList.remove("fullscreen")
  }

  $('#cpiHelper_semanticui_modal').modal('show');






  var infocontent = document.getElementById("cpiHelper_bigPopup_content_semanticui");
  if (typeof (content) == "string") {
    infocontent.innerHTML = content;
  }

  if (typeof (content) == "object") {
    infocontent.innerHTML = "";
    infocontent.appendChild(content);
  }

  if (typeof (content) == "function") {
    var result = await content();
    infocontent.innerHTML = "";
    infocontent.appendChild(result);
  }

  if (parameters.callback) {
    parameters.callback()
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

      if (typeof (objects[i].content) == "function") {
        input.onclick = async (event) => {

          let contentElement = document.getElementById(idPart + "-" + i + "-content");
          if (contentElement.innerHTML == '<div class="cpiHelper_infoPopUp_content">Please Wait...</div>') {
            let contentResponse = await objects[i].content(objects[i]);
            if (typeof (contentResponse) == "object") {
              contentElement.innerHTML = "";
              contentElement.appendChild(contentResponse);
            }
            if (typeof (contentResponse) == "string") {
              contentElement.innerHTML = contentResponse;
            }
            if (typeof (contentResponse) == "function") {
              contentElement.innerHTML = contentResponse(objects[i]);
            }
          }
        }
      }


      let label = createElementFromHTML(`<label for="tab-${idPart}-${i}" class="cpiHelper_tabs_label">${objects[i].label}</label>`);

      //content of tab
      let content = createElementFromHTML(` <div id="${idPart}-${i}-content" class="cpiHelper_tabs_panel"></div>`);

      if (typeof (objects[i].content) == "string") {
        content.innerHTML = objects[i].content;
      }

      if (typeof (objects[i].content) == "object") {
        content.appendChild(objects[i].content);
      }

      if (typeof (objects[i].content) == "function") {
        content.innerHTML = '<div class="cpiHelper_infoPopUp_content">Please Wait...</div>';
        if (objects[i].active) {
          let contentResponse = await objects[i].content(objects[i]);
          if (typeof (contentResponse) == "object") {
            content.innerHTML = "";
            content.appendChild(contentResponse);
          }
          if (typeof (contentResponse) == "string") {
            content.innerHTML = contentResponse;
          }
          if (typeof (contentResponse) == "function") {
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
