/**
 * Fetches data from the specified URL.
 * @param {string} url - The URL to fetch the data from.
 * @returns {Promise<any>} - A promise that resolves to the fetched data.
 */
async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json(); // Annahme, dass die Antwort JSON ist
    return data;
  } catch (error) {
    console.error("Fehler beim Abrufen der Daten:", error);
    return null;
  }
}

/**
 * Creates a radio group element with the provided options.
 *
 * @param {Array} options - An array of objects representing the radio options.
 * Each object should have the following properties:
 *   - value: The value of the radio option.
 *   - id: The id of the radio option.
 *   - label: The label text of the radio option.
 *
 * @returns {HTMLElement} The created radio group element.
 */
function createRadioGroup(options) {
    const radioGroup = document.createElement("div");
    radioGroup.classList.add("radio-group");
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");

    options.forEach(option => {
        const tr = document.createElement("tr");

        const radioTd = document.createElement("td");
        const labelTd = document.createElement("td");

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "timePeriod";
        radio.value = option.value;
        radio.id = option.id;

        const label = document.createElement("label");
        label.htmlFor = option.id;
        label.innerText = option.label;
        label.style.marginLeft = "5px";
        label.style.textAlign = "center";

        radioTd.appendChild(radio);
        labelTd.appendChild(label);

        tr.appendChild(radioTd);
        tr.appendChild(labelTd);

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    radioGroup.appendChild(table);

    return radioGroup;
}

/**
 * Handles the download click event.
 * Retrieves usage data for a specified time period, processes it, and downloads it as a CSV file.
 *
 * @param {Object} pluginHelper - The plugin helper object.
 * @returns {Promise<void>} - A promise that resolves when the download is complete.
 * @throws {Error} - If an error occurs while handling the download click.
 */
async function handleDownloadClick(pluginHelper) {
    try {
        const timePeriod = document.querySelector('input[name="timePeriod"]:checked').value;
        const { startDate, endDate } = getStartAndEndDates(timePeriod);

        console.log('Start Date:', formatDate(startDate));
        console.log('End Date:', formatDate(endDate));

        const url = `https://${pluginHelper.tenant}/rest/api/v1/metering/usage/date-range?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}&runtimeLocationId=cloudintegration`;
        console.log(url);

        const overviewData = await fetchData(url);
        console.log(overviewData);

        const entriesMap = await processOverviewData(overviewData, pluginHelper);

        console.log(`Total Messages: ${Object.keys(entriesMap).length}`);
        console.log(entriesMap);

        const csvData = convertObjectToCSV(entriesMap);
        console.log(csvData);
        //tenant name unitl first .
        const tenantName = pluginHelper.tenant.split('.')[0];
        const csvFilename = `${formatDate(startDate)}_${formatDate(endDate)}_${tenantName}_usage_message.csv`;

        downloadCSV(csvData, csvFilename);
    } catch (error) {
        console.error('Error handling download click:', error);
    }
}

/**
 * Calculates the start and end dates based on the given time period.
 * @param {string} timePeriod - The time period ("Month" or "Week").
 * @returns {Object} An object containing the start and end dates.
 */
function getStartAndEndDates(timePeriod) {
    const today = new Date();
    let startDate, endDate;

    if (timePeriod === "Month") {
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (timePeriod === "Week") {
        const lastSunday = new Date(today);
        lastSunday.setDate(today.getDate() - today.getDay());

        startDate = new Date(lastSunday);
        startDate.setDate(lastSunday.getDate() - 6);

        endDate = lastSunday;
    }

    return { startDate, endDate };
}

/**
 * Formats a given date into the format 'YYYY-MM-DD'.
 *
 * @param {Date} date - The date to be formatted.
 * @returns {string} The formatted date string.
 */
function formatDate(date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Processes the overview data and returns a map of entries.
 *
 * @param {Object} overviewData - The overview data to process.
 * @param {Object} pluginHelper - The plugin helper object.
 * @returns {Object} - A map of entries.
 */
async function processOverviewData(overviewData, pluginHelper) {
    const entriesMap = {};

    const tenantName = pluginHelper.tenant.split('.')[0];

    for (const entry of overviewData.dateRangeDetails) {
        const url = `https://${pluginHelper.tenant}/rest/api/v1/metering/usage/specific-date?date=${entry.source_dt}&download=false&runtimeLocationId=cloudintegration`;
        const dayDetails = await fetchData(url);
        console.log(dayDetails);

        dayDetails[0].message_details.artifactDetails.forEach(message => {
            const uniqueKey = `${entry.source_dt}-${message.iFlowId}`;
            if (!entriesMap[uniqueKey]) {
                entriesMap[uniqueKey] = { ...message, source_dt: entry.source_dt, tenant : tenantName};
                delete entriesMap[uniqueKey].receivers;
                delete entriesMap[uniqueKey].artifactId;
            } else {
                entriesMap[uniqueKey].mplCount += message.mplCount;
                entriesMap[uniqueKey].totalMsg += message.totalMsg;
                entriesMap[uniqueKey].sap2sapMsg += message.sap2sapMsg;
                entriesMap[uniqueKey].recordCount += message.recordCount;
                entriesMap[uniqueKey].chargeableMsg += message.chargeableMsg;
            }
        });
    }

    return entriesMap;
}

/**
 * Converts an object to a CSV string.
 *
 * @param {Object[]} data - The array of objects to convert to CSV.
 * @returns {string} The CSV string representation of the input data.
 */
function convertObjectToCSV(data) {
    const csvRows = [];
    const headers = ['tenant','source_dt', 'iFlowId', 'chargeableMsg', 'totalMsg', 'mplCount', 'sap2sapMsg', 'recordCount']; // Set the desired order of fields
    const restOfHeaders = Object.keys(data[Object.keys(data)[0]]).filter(h => !headers.includes(h));
    const allHeaders = headers.concat(restOfHeaders);
    csvRows.push(allHeaders.join(','));

    Object.values(data).forEach(entry => {
        const values = allHeaders.map(header => entry[header]);
        csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
}

/**
 * Downloads a CSV file with the provided data.
 *
 * @param {string} csvData - The CSV data to be downloaded.
 * @param {string} filename - The name of the file to be downloaded.
 */
function downloadCSV(csvData, filename) {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Fetches data from the specified URL.
 * @param {string} url - The URL to fetch data from.
 * @returns {Promise<Object>} - A promise that resolves to the fetched data as a JSON object.
 * @throws {Error} - If there is an error fetching the data.
 */
async function fetchData(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error fetching data: ${response.statusText}`);
    return response.json();
}

var plugin = {
    metadataVersion: "1.0.0",
    id: "downloadMessageUsage",
    name: "Download Message Usage",
    version: "0.0.1",
    author: "MHP.com",
    email: "florian.kube@mhp.com",
    website: "https://github.com/dbeck121/CPI-Helper-Chrome-Extension",//"https://yourwebsite.com"
    description: "The plugin downloads message usage information into a CSV file. Users can choose to download data for either the last complete month or the last week.",
    settings: {
       /* 
        "text1": { "text": "This is a plugin", "type": "label" },
        "textField1": { "text": "Tenant URL", "type": "textinput", scope: "tenant" },
        "textField2": { "text": "Iflow xy", "type": "textinput", scope: "iflow" },
        "textField3": { "text": "general", "type": "textinput", scope: "browser" },
        "icon": { "type": "icon", "src": "/images/plugin_logos/example.png" }
        */
    },
    messageSidebarButton: {
        "icon": { "text": "E", "type": "text" },
        "title": "messageSidebarButton Ich bin ein ",
        "onClick": (pluginHelper, settings, runInfo, active) => {
            log.log("clicked");
            log.log(pluginHelper);
            log.log(settings);
            log.log(runInfo);
            log.log(active);
        },
        "condition": (pluginHelper, settings, runInfo) => {
            //eg runInfo.logLevel === "trace"
            return runInfo.logLevel === "trace";
        }
    },
    messageSidebarContent: {
        "static": true,
        "onRender": (pluginHelper, settings) => {
            log.log("pluginHelper for Download Message Usage");
            console.log("pluginHelper for Download Message Usage");
            console.log(pluginHelper.tenant);
            
            log.log(pluginHelper);
            log.log(settings);
            
            const div = document.createElement("div");
            div.innerText = "Download Message Usage of last";
            const button = document.createElement("button");
            button.innerHTML = "Download";
            const popupContent = document.createElement("div");
            popupContent.innerHTML = "<h1>popup content</h1>";
            
            const radioGroup = createRadioGroup([
                { id: "lastMonthRadio", value: "Month", label: "Month" },
                { id: "lastWeekRadio", value: "Week", label: "Week" }
            ]);
            
            div.appendChild(radioGroup);
            div.appendChild(button);
            
            button.onclick = () => handleDownloadClick(pluginHelper);
            
            return div;
        }
    },
    scriptCollectionButton: {
        "icon": { "text": "E", "type": "text" },
        "title": "Example Title",
        "onClick": (pluginHelper, settings) => {
            log.log("clicked");
            log.log(pluginHelper);
            log.log(settings);
            log.log(pluginHelper.currentArtifactId)
            log.log(pluginHelper.currentArtifactType)
            log.log(pluginHelper.currentPackageId)
            // not good: log.log(document.getElementById("__xmlview0--ceFileLabel-bdi").textContent)
            //better:
            log.log(document.querySelector('bdi[id$="--ceFileLabel-bdi"]').textContent)
        },
        condition: (pluginHelper, settings) => {
            //condition can be null or a function that returns true or false
            return true
        }
    },
    scriptButton: {
        "icon": { "text": "E", "type": "text" },
        "title": "Example Title",
        "onClick": (pluginHelper, settings) => {
            log.log("clicked");
            log.log(pluginHelper);
            log.log(settings);
            log.log(pluginHelper.currentArtifactId)
            log.log(pluginHelper.currentArtifactType)
            log.log(pluginHelper.currentIflowId)
            log.log(pluginHelper.currentPackageId)
            log.log(pluginHelper.lastVisitedIflowId)
        },
        condition: (pluginHelper, settings) => {
            return true
        }
    },
    messageMappingButton: {
        "icon": { "text": "MM", "type": "text" },
        "title": "Example Title MM",
        "onClick": (pluginHelper, settings) => {
            console.log("clicked");
            console.log(pluginHelper);
            console.log(settings);
            console.log(pluginHelper.currentArtifactId)
            console.log(pluginHelper.currentArtifactType)
            console.log(pluginHelper.currentIflowId)
            console.log(pluginHelper.currentPackageId)
            console.log(pluginHelper.lastVisitedIflowId)
        },
        condition: (pluginHelper, settings) => {
            return true
        }
    },
    xsltButton: {
        "icon": { "text": "XSLT", "type": "text" },
        "title": "Example Title",
        "onClick": (pluginHelper, settings) => {
            log.log("clicked");
            log.log(pluginHelper);
            log.log(settings);
            log.log(pluginHelper.currentArtifactId)
            log.log(pluginHelper.currentArtifactType)
            log.log(pluginHelper.currentIflowId)
            log.log(pluginHelper.currentPackageId)
            log.log(pluginHelper.lastVisitedIflowId)
        },
        condition: (pluginHelper, settings) => {
            return true
        }
    },

};

pluginList.push(plugin);