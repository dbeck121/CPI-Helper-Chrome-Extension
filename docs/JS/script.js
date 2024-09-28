import { baseUrl, readme, plugin_data } from "./content.js";

async function fetchReadmeFile(lst, baseUrl) {
    try {
        const promises = lst.map((item) => {
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: baseUrl + item.path, // URL to fetch markdown content
                    success: function (readmeText) {
                        const md = window.markdownit();
                        const arrayread = readmeText.split(
                            new RegExp("^" + item.divider + " ", "gm")
                        );
                        let htmlContent = "";
                        for (const key in arrayread) {
                            htmlContent +=
                                "<div class='mt-4 mb-4'>" +
                                md.render(
                                    `${
                                        key == 0
                                            ? arrayread[key]
                                            : item.divider +
                                              " " +
                                              arrayread[key]
                                    }`
                                ) +
                                "</div>";
                        }
                        $(`#${item.id}`).html(htmlContent);
                        resolve();
                    },
                    error: function (xhr, status, error) {
                        console.error(
                            "Failed to fetch",
                            item.path,
                            "Error:",
                            error
                        );
                        reject(error);
                    }
                });
            });
        });
        await Promise.all(promises);

        // Perform UI updates after all promises have resolved
        lst.forEach((item) => {
            uiUpdates(item.id);
        });
    } catch (error) {
        console.error("Error fetching readme files:", error);
        throw error; // Throw the error
    }
}

async function uiUpdates(id) {
    try {
        $(`#${id} table`).first().css("display", "none");
        $(`#${id} table`).each(function () {
            $(this).addClass("ui selectable celled table");
        });
        $(`#${id} h1, #${id} h2`).each(function (index) {
            const newId = `${$(this).parent().parent().attr("id")}_${$(this)
                .text()
                .replace(/\s/g, "")}`;
            $(this).attr("id", newId);
        });
        $(`#${id} h1, #${id} h2`).each(function () {
            $(this).addClass("jumbotron text-primary opacity-75 p-1 mt-n3");
            $('<hr class="mt-0 mb-2">').insertAfter(this);
        });
        $("table").addClass("table table-striped table-hover");
        $("thead").addClass("table-dark");
    } catch (error) {
        console.error("Error updating UI:", error);
    }
}

// Function to fetch and render readme files
async function fetchAndRenderReadmeFiles() {
    try {
        // Fetch readme files and wait for completion
        await fetchReadmeFile(readme, baseUrl);
        console.log("Readme files fetched and rendered successfully.");
    } catch (error) {
        console.error("Error fetching and rendering readme files:", error);
    }
}

// Function to create a card element
function createCard(cardData) {
    const card = document.createElement("div");
    card.className = "col mb-4";
    card.innerHTML = `
      <div class="card h-100">
        <div class="card-header d-flex justify-content-between align-items-center">
          <b>${cardData.name}</b>
          ${
              cardData.logo_src == ""
                  ? ""
                  : `<img src="${
                        baseUrl + cardData.logo_src
                    }" class="card-image" width="32" alt="${
                        cardData.name
                    } Logo">`
          }
        </div>
        <div class="card-body">
          <p class="card-text">${cardData.description}</p>
        </div>
        <div class="card-footer p-0">
          <a href="${
              cardData.devSite
          }" class="btn btn-primary rounded-0 rounded-bottom w-100">Developer Site</a>
        </div>
      </div>
    `;
    return card;
}

// Function to render cards
function renderCards(data, id) {
    const cardRow = document.getElementById(id);
    data.forEach((cardData) => {
        const card = createCard(cardData);
        cardRow.appendChild(card);
    });
}

// init
fetchAndRenderReadmeFiles()
    .then(() => {
        $("#changelog").append($("#readmeDiv_Changelog").parent());
        $("#privacy").append($("#readmeDiv_PrivacyandDataProtection").parent());
        console.log("Elements appended successfully.");
        $("pre code").addClass("language-js");
        $("pre code.language-js").each((i, element) => {
            Prism.highlightElement(element);
        });
        renderCards(plugin_data, "pluginRow");
        $("#readmeDiv > div").slice(-2).remove();
        $("#readmeDiv > div").slice(0, 2).remove();
    })
    .catch((error) => console.error("Error:", error));
