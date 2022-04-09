//snackbar for messages (e.g. trace is on)
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
function showSnackbar(message) {
  //css for snackbar is already there. see initIflowPage()

  //create snackbar div element
  var x = document.getElementById("cpiHelper_snackbar");
  if (!x) {
    x = document.createElement('div');
    x.id = "cpiHelper_snackbar";
    document.body.appendChild(x);
  }
  x.innerHTML = message;
  x.className = "cpiHelper_snackbar_show";
  setTimeout(function () { x.className = x.className.replace("cpiHelper_snackbar_show", ""); }, 3000);
}

async function showBigPopup(content, header) {
  //create traceInfo div element
  var x = document.getElementById("cpiHelper_bigPopup");
  if (!x) {
    x = document.createElement('div');
    x.id = "cpiHelper_bigPopup";
    x.onclick = function(event) { /* Added modal close when clicking on to the background */
      console.log(event.target.id);
      if (event.target.id == 'cpiHelper_bigPopup') {
        x.remove();
      }
    }
    x.classList.add("cpiHelper");
    document.body.appendChild(x);
  }
  x.style.display = "block";
  x.innerHTML = "";

  if (header) {
    header = "- " + header;
  } else {
    header = "";
  }

  var textElement = `
     <div id="cpiHelper_bigPopup_outerFrame">
     <div id="cpiHelper_bigPopup_contentheader"><span style="margin-right: 1rem" id="" class="cpiHelper_closeButton">X</span>CPI Helper ${header}<span id="" style="float:right;" class="cpiHelper_closeButton">X</span></div>
       <div id="cpiHelper_bigPopup_content">
       Please Wait...
     </div> 
     </div>
     `;



  x.appendChild(createElementFromHTML(textElement));

  var spans = document.getElementsByClassName("cpiHelper_closeButton");
  for (span of spans) {
    span.onclick = (element) => {
      var x = document.getElementById("cpiHelper_bigPopup");
      x.remove();
    };
  }

  var infocontent = document.getElementById("cpiHelper_bigPopup_content");
  if (typeof (content) == "string") {
    infocontent.innerHTML = content;
  }

  if (typeof (content) == "object") {
    infocontent.innerHTML = "";
    infocontent.appendChild(content);
  }

  if (typeof (content) == "function") {
    infocontent.innerHTML = "";
    infocontent.appendChild(content());
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
