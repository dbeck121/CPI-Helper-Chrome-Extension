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
        "icon": { "type" : "icon" , "src" : "/images/plugin_logos/AGILITAAG_Logo.jpg" }
    },
    messageSidebarButton: {
        "text": "⏳",
        "title": "display timeline",
        "icon": "",
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
    console.log(data)
    // Table columns
    var popupContentPrefix = `
    <table class="timeline-Table">
        <tr class="timeline-TableRow" id="timeline-TableRowHeader">
            <th class="timeline-TableHeader" style="text-align:center;">Nr.</th>
            <th class="timeline-TableHeader">Integration Flow Name</th>
            <th class="timeline-TableHeader">Integration Package</th>
            <th class="timeline-TableHeader">Status</th>
            <th class="timeline-TableHeader">Start Date</th>
            <th class="timeline-TableHeader">Start Time</th>
        </tr>`;

    // Creating a table entry for every connected artifact
    var artifactCounter = 1;
    data.forEach(artifact => {
        var date = JSON.parse(formatTimestamp(artifact.LogStart)).date;
        var time = JSON.parse(formatTimestamp(artifact.LogStart)).time;
        var packageLink = `https://${pluginHelper.tenant}/${pluginHelper.urlExtension}shell/design/contentpackage/${artifact.IntegrationArtifact.PackageId}?section=ARTIFACTS`;
        // Displaying the currently viewed artifact differently than the connected artifacts
        if(artifact.IntegrationArtifact.Id != pluginHelper.integrationFlowId){
            var link = `https://${pluginHelper.tenant}/${pluginHelper.urlExtension}shell/design/contentpackage/${artifact.IntegrationArtifact.PackageId}/integrationflows/${artifact.IntegrationArtifact.Id}`;
            popupContentPrefix += `
            <tr class="timeline-TableRow">
                <td class="timeline-TableData" style="text-align:center;">${artifactCounter}.</td>
                <td class="timeline-TableData"><a href="${link}" target="_blank">${artifact.IntegrationArtifact.Name}</a></td>
                <td class="timeline-TableData"><a href="${packageLink}" target="_blank">${artifact.IntegrationArtifact.PackageName}</a></td>
                <td class="timeline-TableData">${artifact.Status}</td>
                <td class="timeline-TableData">${date}</td>
                <td class="timeline-TableData">${time}</td>
            </tr>`;
        }else{
            // No link for currently viewed artifact (because we are already viewing it)
            // Has different background coloring and indicating text
            popupContentPrefix += `
            <tr class="timeline-TableRow" id="timeline-activeTableRow">
                <td class="timeline-TableData" style="text-align:center;">${artifactCounter}.</td>
                <td class="timeline-TableData">${artifact.IntegrationArtifact.Name} (currently viewing)</td>
                <td class="timeline-TableData"><a href="${packageLink}" target="_blank">${artifact.IntegrationArtifact.PackageName}</a></td>
                <td class="timeline-TableData">${artifact.Status}</td>
                <td class="timeline-TableData">${date}</td>
                <td class="timeline-TableData">${time}</td>
            </tr>`;
        }
        artifactCounter++;
    });

    // Styling
    var style = `
    <style>
        .timeline-Table {
            font-family: arial, sans-serif;
            border-collapse: separate;
            width: 100%;
            border-spacing: 0;
            border: 1px solid #1B1C1D;
            border-radius: 8px;
            overflow: hidden;
        }

        .timeline-TableData, #timeline-activeTableRow, .timeline-TableHeader {
            border: 1px solid #1B1C1D;
            text-align: left;
            padding: 8px;
        }

        #timeline-activeTableRow {
            background-color: #FDFD96;
        }

        .timeline-TableRow:nth-child(even) {
            background-color: #dddddd;
        }

        .timeline-TableHeader {
            background-color: #1B1C1D;
            color: white;
            text-align: left;
            padding: 8px;
        }

        .timeline-TableHeader:first-child {
            border-top-left-radius: 8px;
        }

        .timeline-TableHeader:last-child {
            border-top-right-radius: 8px;
        }

        .timeline-TableRow:last-child .timeline-TableData:first-child {
            border-bottom-left-radius: 8px;
        }

        .timeline-TableRow:last-child .timeline-TableData:last-child {
            border-bottom-right-radius: 8px;
        }
    </style>`;

    return popupContentPrefix + `</table>` + style;
}

pluginList.push(plugin);