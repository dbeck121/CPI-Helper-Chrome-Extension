async function fetchReadmeFile(lst, baseUrl = document.baseURI.match(/\d/g) == null ? document.baseURI : "/docs/") {
    try {
        for (const item of lst) {
            $.ajax({
                url: baseUrl + item.path,
                success: async function (readmeText) {
                    const md = window.markdownit();
                    const arrayread = readmeText.split(new RegExp('^' + item.divider + " ", 'gm'));
                    let htmlContent = "";
                    for (const key in arrayread) {
                        htmlContent += "<div class='ui segment'>" + md.render(`${(key == 0) ? arrayread[key] : item.divider + " " + arrayread[key]}`) + "</div>";
                    }
                    $(`#${item.id}`).html(htmlContent);
                    await uiUpdates(item.id);
                },
                error: function (xhr, status, error) {
                    console.error("Failed to fetch", item.path, "Error:", error);
                }
            });
        }
    } catch (error) {
        console.error("Error fetching readme files:", error);
    }
}
function changeTabFromHash() {
    var hash = window.location.hash.substring(1);
    if (hash) {
        $('nav .item').tab('change tab', hash);
    }
}

function updateHashFromTab(tabPath) {
    history.pushState(null, null, '#' + tabPath);
}

function updatemenulisten() {

    $('nav .item').tab({ onVisible: function (tabPath) { updateHashFromTab(tabPath); } });
    $(window).on('hashchange', changeTabFromHash);
    changeTabFromHash();
    console[activeTab !== null ? 'log' : 'warn']("Retrieved active tab:", null);
    var $tabMenu = $('nav .item[data-tab="' + activeTab + '"]');
    if ($tabMenu.length > 0) {
        $tabMenu.tab('change tab', activeTab);
    } else if (activeTab !== null) {
        console.error("Tab with data-tab='" + activeTab + "' not found.");
    }
}

async function uiUpdates(id) {
    try {
        $(`#${id} table`).first().css('display', 'none');
        $(`#${id} table`).each(function () {
            $(this).addClass('ui selectable celled table');
        });
        $(`#${id} h1, #${id} h2`).each(function (index) {
            var parentId = $(this).parent().parent().attr('id');
            var newId = parentId + '-header-' + (index + 1);
        });
        $(`#${id} h1, #${id} h2`).each(function () {
            $(this).addClass('ui blue header');
        });
    } catch (error) {
        console.error("Error updating UI:", error);
    }
}

const listofreadme = [
    { "id": "readmeDiv", "path": "readme/README.md", "divider": "##" },
    { "id": "PluginDiv", "path": "readme/PluginREADME.md", "divider": "##" },
    { "id": "cocDiv", "path": "readme/code_of_conduct.md", "divider": "##" },
    { "id": "contributionDiv", "path": "readme/contributing.md", "divider": "##" }
];

$(document).ready(function () {
    fetchReadmeFile(listofreadme);
    updatemenulisten();
});