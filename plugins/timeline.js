var plugin = {
    metadataVersion: "1.0.0",
    id: "timeline",
    name: "Timeline",
    version: "1.0.0",
    author: "Gregor Schütz, AGILITA AG",
    website: "https://www.agilita.ch/",
    email: "gregor.schuetz@agilita.ch",
    description: "Displays the timeline of a message.",
    settings: {
        "icon": { "type": "icon", "src": "/images/plugin_logos/AGILITAAG_Logo.jpg" }
    },
    messageSidebarButton: {
        "icon": { "type": "icon", "text": "xe088" }, //⏳
        "title": "display timeline",
        "onClick": async (pluginHelper, settings, runInfo) => {
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
    <table class="ui celled center aligned table" id='timelinetable'>
        <thead>
            <tr class="black">
                <th class="ui center aligned">Nr.</th>
                <th>Integration Flow Name</th>
                <th>Integration Package</th>
                <th>Status</th>
                <th>Start Date</th>
                <th>Start Time</th>
            </tr>
        </thead>
        </tbody>`;

    // Creating a table entry for every connected artifact
    data.forEach(function (artifact, index) {
        // Status coloring for status field
        var statusColor = artifact.Status;
        if (statusColor == "PROCESSING") {
            statusColor = "yellow";
        }
        else if (statusColor == "FAILED") {
            statusColor = "red";
        }
        else if (statusColor == "COMPLETED") {
            statusColor = "green";
        }
        else if (statusColor.match(/^(ESCALATED|RETRY)$/)) {
            statusColor = "orange";
        }
        else if (statusColor.match(/^(CANCELLED)$/)) {
            statusColor = "grey";
        }
        else {
            statusColor = "blue";
        }

        var date = JSON.parse(formatTimestamp(artifact.LogStart)).date;
        var time = JSON.parse(formatTimestamp(artifact.LogStart)).time;
        var packageLink = `https://${pluginHelper.tenant}/${pluginHelper.urlExtension}shell/design/contentpackage/${artifact.IntegrationArtifact.PackageId}?section=ARTIFACTS`;
        // Displaying the currently viewed artifact differently than the connected artifacts
        // No link for currently viewed artifact (because we are already viewing it)
        // Has different background coloring and indicating text
        var link = `https://${pluginHelper.tenant}/${pluginHelper.urlExtension}shell/design/contentpackage/${artifact.IntegrationArtifact.PackageId}/integrationflows/${artifact.IntegrationArtifact.Id}`;
        popupContentPrefix += `
            <tr class="${statusColor}">
                <td data-label="Nr." class="ui center aligned">${index + 1}.</td>
                <td data-label="Integration Flow Name"class="selectable">${artifact.IntegrationArtifact.Id != pluginHelper.integrationFlowId
                ? `<a class='ui basic fluid button' href="${link}" target="_blank"><b>${artifact.IntegrationArtifact.Name}</b></a>`
                : `<a class='ui fluid button'target="_blank">${artifact.IntegrationArtifact.Name} (currently viewing)</a>`}
                </td>
                <td data-label="Integration Package" class="selectable"><a href="${packageLink}" class='ui basic fluid button' target="_blank"><b>${artifact.IntegrationArtifact.PackageName}</b></a></td>
                <td data-label="Status">${artifact.Status}</td>
                <td data-label="Start Date">${date}</td>
                <td data-label="Start Time">${time}</td>
            </tr>`;
    });

    return popupContentPrefix + `</tbody></table>`;
}

pluginList.push(plugin);