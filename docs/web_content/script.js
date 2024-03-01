async function fetchReadmeFile(lst, baseUrl = document.baseURI.match(/\d\d\d\./g) == null ? window.location.origin + window.location.pathname : "/docs/") {
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
function changeTabFromQueryParam() {
    var urlParams = new URLSearchParams(window.location.search);
    var tabParam = urlParams.get('tab');
    if (tabParam) {
        var $targetTab = $('nav .item[data-tab="' + tabParam + '"]');
        if ($targetTab.length > 0) {
            $targetTab.tab('change tab', tabParam);
        } else {
            console.warn("Tab with data-tab='" + tabParam + "' not found.");
        }
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
fetchReadmeFile(listofreadme);
$(window).on('load', function () {
    changeTabFromQueryParam();
    $('nav .item').tab({
        onVisible: function (tabPath) {
            var urlParams = new URLSearchParams(window.location.search);
            urlParams.set('tab', tabPath);
            history.replaceState(null, null, '?' + urlParams.toString());
        }
    });
});