async function fetchReadmeFile(lst, baseUrl = document.baseURI.match(/\d/g) == null ? document.baseURI : "/docs/") {
    for (i in lst) {
        console.log(baseUrl + lst[i].path)
        try {
            const response = await fetch(baseUrl + lst[i].path);
            if (!response.ok) {
                throw new Error("Failed to fetch " + lst[i].path);
            }
            const readmeText = await response.text();
            const md = window.markdownit();
            const arrayread = readmeText.split(new RegExp('^' + lst[i].divider + " ", 'gm'))
            htmlContent = ""
            for (const key in arrayread) {
                htmlContent += "<div class='ui segment'>" + md.render(`${(key == 0) ? arrayread[key] : lst[i].divider + " " + arrayread[key]}`) + "</div>"
            }
            document.getElementById(lst[i].id).innerHTML = htmlContent;
            await uiUpdates(lst[i].id)
        } catch (error) {
            console.error(`Error fetching ${baseUrl + lst[i].path}:`, error);
        }
    }
}
$('.menu .item').tab()
listofreadme = [
    { "id": "readmeDiv", "path": "readme/README.md", "divider": "##" },
    { "id": "PluginDiv", "path": "readme/PluginREADME.md", "divider": "##" },
    { "id": "cocDiv", "path": "readme/code_of_conduct.md", "divider": "##" },
    { "id": "contributionDiv", "path": "readme/contributing.md", "divider": "##" }
]
// Call the fetchReadmeFile function when the page loads
async function uiUpdates(id) {
    document.querySelector(`#${id} table`).style.display = 'none'
    document.querySelectorAll('table').forEach(e => e.classList = 'ui selectable celled table');
    document.querySelectorAll('h1,h2').forEach(e => e.classList = 'ui blue header');
    document.querySelectorAll('h3').forEach(e => e.classList = 'ui header');
}
window.onload = fetchReadmeFile(listofreadme);