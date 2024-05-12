var plugin = {
    metadataVersion: "1.0.0",
    id: "timeline",
    name: "Timeline",
    version: "1.0.1",
    author: "Gregor Schütz, AGILITA AG",
    website: "https://www.agilita.ch/",
    email: "gregor.schuetz@agilita.ch",
    description: "<br><b>(Trace not needed)</b></br> Displays the timeline of a message.",
    settings: {
        "icon": { "type": "icon", "src": "/images/plugin_logos/AGILITAAG_Logo.jpg" }
    },
    messageSidebarButton: {
        "icon": { "type": "icon", "text": "xe088" },
        "title": "display timeline",
        "onClick": async (pluginHelper, settings, runInfo, active) => {
            // Data Prep for table
            // Get correlationId of current message
            const urlForCorrelationId = `/${pluginHelper.urlExtension}odata/api/v1/MessageProcessingLogs?$format=json&$filter=MessageGuid eq '${runInfo.messageGuid}'`;
            var dataOfCurrentMessage = JSON.parse(await makeCallPromise("GET", urlForCorrelationId, false)).d.results;

            // Get data for table
            // Order by LogStart so we know in what order it started
            const urlForPathData = `/${pluginHelper.urlExtension}odata/api/v1/MessageProcessingLogs?$format=json&$filter=CorrelationId eq '${dataOfCurrentMessage[0].CorrelationId}'&$orderby=LogStart`;
            var dataForTable = JSON.parse(await makeCallPromise("GET", urlForPathData, false)).d.results;

            // Popup
            var popupContent = document.createElement("div");

            // Place the table inside of the div
            popupContent.innerHTML = createContent(dataForTable, pluginHelper);

            // Add content inside of a popup
            pluginHelper.functions.popup(popupContent, "Timeline");

            // Add table sorting
            $('table').tablesort();
        }
    }
}

// Returns formatted date & time
function formatTimestamp(timestamp) {
    // Extract the timestamp number using a regular expression
    const matches = timestamp.match(/\/Date\((\d+)\)\//);

    // Parse the timestamp to a date object
    const date = new Date(parseInt(matches[1], 10));

    // Format the date parts
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

    return `{"date":"${year}-${month}-${day}","time":"${hours}:${minutes}:${seconds}.${milliseconds}"}`;
}

function createContent(data, pluginHelper) {
    // Table columns
    var popupContentPrefix = `
    <table class="ui sortable celled center aligned table" id='timelinetable'>
        <thead>
            <tr class="black">
                <th>Integration Flow Name</th>
                <th>Integration Package</th>
                <th>Status</th>
                <th class="sorted ascending">Start</th>
                <th>End</th>
            </tr>
        </thead>
        </tbody>`;

    // Creating a table entry for every connected artifact
    data.forEach(function (artifact) {
        // Status coloring for status field
        var statusColor = getStatusColor(artifact.Status);
        var start = JSON.parse(formatTimestamp(artifact.LogStart));
        var end = JSON.parse(formatTimestamp(artifact.LogEnd));
        var packageLink = `https://${pluginHelper.tenant}/${pluginHelper.urlExtension}shell/design/contentpackage/${artifact.IntegrationArtifact.PackageId}?section=ARTIFACTS`;
        // Displaying the currently viewed artifact differently than the connected artifacts
        // No link for currently viewed artifact (because we are already viewing it)
        // Has different background coloring and indicating text
        var link = `https://${pluginHelper.tenant}/${pluginHelper.urlExtension}shell/design/contentpackage/${artifact.IntegrationArtifact.PackageId}/integrationflows/${artifact.IntegrationArtifact.Id}`;
        popupContentPrefix += `
            <tr class="${statusColor}">
                <td data-label="Integration Flow Name" ${artifact.IntegrationArtifact.Id != pluginHelper.integrationFlowId
                ? `class="selectable"><a href="${link}" target="_blank">${artifact.IntegrationArtifact.Name}</a>`
                : `class="yellow">${artifact.IntegrationArtifact.Name} (currently viewing)`}
                </td>
                <td data-label="Integration Package" class="selectable"><a href="${packageLink}" target="_blank">${artifact.IntegrationArtifact.PackageName}</a></td>
                <td data-label="Status">${artifact.Status}</td>
                <td data-label="Start">${start.date} ${start.time}</td>
                <td data-label="End">${end.date} ${end.time}</td>
            </tr>`;
    });

    return popupContentPrefix + `</tbody></table>`;
}

pluginList.push(plugin);