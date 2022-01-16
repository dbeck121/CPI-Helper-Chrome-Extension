//GNU GPL v3
//Please visit our github page: https://github.com/dbeck121/CPI-Helper-Chrome-Extension

'use strict';

var host = "";

//List a history of visited iflows
function addLastVisitedIflows() {
    let name = 'visitedIflows_' + host.split("/")[2].split(".")[0];
    chrome.storage.sync.get([name], function (result) {
        var visitedIflows = result[name];
        if (!visitedIflows || visitedIflows.length == 0) {
            return;
        }


        var html = `
        <h3>Last Visited on Tenant ${name.split("_")[1]}</h3>
        <ul style="list-style-type:disc;"> `;

        for (var i = visitedIflows.length - 1; i > -1; i--) {
            html += `<li><a href="${visitedIflows[i].url}" target="_blank">${visitedIflows[i].name}</a></li>`;
        }
        html += `</ul>`;
        var lastVisitedIflows = document.getElementById("lastVisitedIflows");
        lastVisitedIflows.innerHTML = html;
    });
}

function addTenantUrls() {

    var tenantUrls = document.getElementById("tenantUrls");
    tenantUrls.innerHTML = `
        <h3>Tenant Settings</h3>
        <div>
            <label for="tenanName">Set custom name for tab:</label><br>
            <input type="text" name="tenantName" id="tenantName" class="input_fields"/>
            <div style="margin-bottom: 0.6em;">use $iflow.name to show current iflow name.</div>
        </div>
       
        <div>
            <label for="color">Select tenant color:</label><br>
            <input type="color" name="color"  class="input_fields" id="colorSelect"/>
        </div>
        <div>
            <label for="icon-select">Choose an icon:</label><br>
            <select name="pets" id="icon-select" class="input_fields">
                <option value="default">Default</option>
                <option value="1">Blue</option>
                <option value="2">Green</option>
                <option value="3">Red</option>
                <option value="4">Purple</option>
                <option value="5">Yellow</option>
                <option value="6">Orange</option>
            </select>
        </div>
        <h3>Tenant URLs</h3>
        <ul>
        <li><a href="${host + '/itspaces/shell/monitoring/Messages/'}" target="_blank">Processed Messages</a></li>
        <li><a href="${host + '/itspaces/shell/monitoring/Messages/%7B%22status%22%3A%22FAILED%22%2C%22time%22%3A%22PASTHOUR%22%2C%22type%22%3A%22INTEGRATION_FLOW%22%7D'}" target="_blank">Failed Messages</a></li>
        <li><a href="${host + '/itspaces/shell/monitoring/Artifacts/'}" target="_blank">Artifacts</a></li>
        <li><a href="${host + '/itspaces/shell/design'}" target="_blank">Design</a></li>   
        <li><a href="${host + '/itspaces/shell/monitoring/Overview'}" target="_blank">Monitoring</a>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/SecurityMaterials'}" target="_blank">Security Material</a></li></ul>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/Keystore'}" target="_blank">Keystore</a></li></ul>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/CertificateUserMappings'}" target="_blank">Certificate-to-User Mappings</a></li></ul>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/AccessPolicies'}" target="_blank">Access Policies</a></li></ul>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/JdbcMaterial'}" target="_blank">JDBC Material</a></li></ul>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/Connectivity'}" target="_blank">Connectivity Tests</a></li></ul>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/DataStores'}" target="_blank">Data Stores</a></li></ul>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/Variables'}" target="_blank">Variables</a></li></ul>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/MessageQueues'}" target="_blank">Message Queues</a></li></ul>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/NumberRangeObject'}" target="_blank">Number Ranges</a></li></ul>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/AuditLog'}" target="_blank">Audit Log</a></li></ul>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/SystemLogs'}" target="_blank">System Logs</a></li></ul>    
            <ul><li><a href="${host + '/itspaces/shell/monitoring/Locks'}" target="_blank">Message Locks</a></li></ul>
            <ul><li><a href="${host + '/itspaces/shell/monitoring/DesigntimeLocks'}" target="_blank">Designtime Artifact Locks</a></li></ul>       
        </li>
       </ul> `;

}

async function getHost() {
    return new Promise((resolve, reject) => {

        var query = { active: true, currentWindow: true };

        function callback(tabs) {
            var currentTab = tabs[0]; // there will be only one in this array
            console.log(currentTab); // also has properties like currentTab.id

            var url = currentTab.url;
            var tempHost = "https://" + url.split("/")[2];
            resolve(tempHost);
        };

        chrome.tabs.query(query, callback);

    });
}

var callCache = new Map();
function makeCallPromise(method, url, useCache, accept) {
    return new Promise(function (resolve, reject) {
        var cache;
        if (useCache) {
            cache = callCache.get(method + url);
        }
        if (cache) {
            resolve(cache);
        } else {

            var xhr = new XMLHttpRequest();
            xhr.withCredentials = false;
            xhr.open(method, url);
            if (accept) {
                //Example for accept: 'application/json' 
                xhr.setRequestHeader('Accept', accept);
            }
            xhr.onload = function () {
                if (this.status >= 200 && this.status < 300) {
                    if (useCache) {
                        callCache.set(method + url, xhr.responseText);
                    }
                    resolve(xhr.responseText);
                } else {
                    reject({
                        status: this.status,
                        statusText: xhr.statusText
                    });
                }
            };
            xhr.onerror = function () {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            };
            xhr.send();
        }
    }
    );

}

//has to be changed when plugin is in chrome store
function checkUpdate() {
    var manifestVersion = chrome.runtime.getManifest().version;
    var cpihelper_version = document.getElementById("cpihelper_version");
    var html = "<span>You are running version " + manifestVersion + "</span>";
    cpihelper_version.innerHTML = html;
}

// Handle tenantname changes
function tenantIdentityChanges() {
    let hostData = {}
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        let tenantName = document.querySelector('#tenantName')
        let tenantColor = document.querySelector('#colorSelect')
        let tenantIcon = document.querySelector('#icon-select')

        let timeoutId;
        let tab = tabs[0];

        // get the current document title - this runs evey time the popup is opened
        chrome.tabs.sendMessage(tab.id, 'get', response => {
            console.dir(response)
            tenantName.value = hostData.title = response.title;
            tenantColor.value = hostData.color = response.color;
            tenantIcon.value = hostData.icon = response.icon
        });

        // Autosave on change after 1s
        tenantName.addEventListener('input', () => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(() => {
                hostData.title = tenantName.value
                chrome.tabs.sendMessage(tab.id, { save: hostData }, (response) => {
                    console.dir(response);
                })
            }, 1000);
        })

        // Update color on change
        tenantColor.addEventListener('change', () => {
            hostData.color = tenantColor.value
            chrome.tabs.sendMessage(tab.id, { save: hostData }, (response) => {
                console.dir(response);
            })
        })

        // Update icon on input
        tenantIcon.addEventListener('input', () => {
            hostData.icon = tenantIcon.value
            chrome.tabs.sendMessage(tab.id, { save: hostData }, (response) => {
                console.dir(response);
            })
        })
    })
}

async function main() {
    checkUpdate();
    host = await getHost();
    addLastVisitedIflows();
    addTenantUrls();
    tenantIdentityChanges();
}

main().catch(e => console.error(e))