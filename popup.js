//GNU GPL v3
//Please visit our github page: https://github.com/dbeck121/CPI-Helper-Chrome-Extension

'use strict';

var host = "";

//List a history of visited iflows
function addLastVisitedIflows() {
    let name = 'visitedIflows_' + host.split("/")[2].split(".")[0];
    var elements = {}

    chrome.storage.sync.get([name], function (result) {
        var visitedIflows = result[name];
        console.log(visitedIflows)
        if (!visitedIflows || visitedIflows.length == 0) {
            return;
        }
        var compact = document.querySelector('#cpisetting>.active').getAttribute('data') !== "true";
        var artifactTypes = ["Package", "IFlow", "Message Mapping", "Script Collection", "Value Mapping", "SOAP API", "REST API", "ODATA API"]
        var html = `<div class="ui horizontal divider header">Last Visited on Tenant ${name.split("_")[1]}</div>`;
        if (compact) {

            for (var i = visitedIflows.length - 1; i > -1; i--) {
                if (visitedIflows[i].type) {
                    if (elements[visitedIflows[i].type]) {
                        elements[visitedIflows[i].type].push(visitedIflows[i])
                    } else {
                        elements[visitedIflows[i].type] = [visitedIflows[i]]
                    }
                } else {
                    if (elements["noheader"]) {
                        elements["noheader"].push(visitedIflows[i])
                    } else {
                        elements["noheader"] = [visitedIflows[i]]
                    }
                }
            }

            artifactTypes.map((artifact) => {
                var subject = artifact
                if (elements[subject]) {
                    html += `<div class="ui menu"><a class="ui item"><strong>${subject}</strong></a><div class="ui wrapped wrapping buttons fluid">`
                    elements[subject].map((item) => {
                        html += `<a class="ui button" href="${item.url}" target="_blank">${item.name}</a>`
                    })
                    html += `</div></div>`
                }
            })

            var subject = "noheader"
            if (elements[subject]) {
                html += `
            <div class="ui horizontal divider header">CPI Helper old version items</div>
            <div class="ui menu"><div class="ui wrapped wrapping buttons fluid">`
                elements[subject].map((item) => {
                    html += `<a class="ui button" href="${item.url}" target="_blank">${item.name}</a>`
                })
                html += `</div></div>`
            }
        } else {

            for (var i = visitedIflows.length - 1; i > -1; i--) {
                if (visitedIflows[i].type) {
                    if (elements[visitedIflows[i].type]) {
                        elements[visitedIflows[i].type].push(visitedIflows[i])
                    } else {
                        elements[visitedIflows[i].type] = [visitedIflows[i]]
                    }
                } else {
                    if (elements["noheader"]) {
                        elements["noheader"].push(visitedIflows[i])
                    } else {
                        elements["noheader"] = [visitedIflows[i]]
                    }
                }
            }

            artifactTypes.map((artifact) => {
                var subject = artifact
                if (elements[subject]) {
                    html += `<div class="ui menu"><a class="ui item"><strong>${subject}</strong></a><div class="ui wrapped wrapping buttons fluid">`
                    elements[subject].map((item, index) => { html += `<div class="ui fluid buttons"><a href="${item.url}" target="_blank" class="ui button">${item.name}</a></div>` })
                    html += `</div></div>`
                }
            })

            var subject = "noheader"
            if (elements[subject]) {
                html += `<div class="ui horizontal divider header">CPI Helper old version items</div>
                        <div class="ui menu"><div class="ui wrapped wrapping buttons fluid">`
                elements[subject].map((item, index) => { html += `<div class="ui fluid buttons"><a target="_blank" href="${item.url}" class="ui button">${item.name}</a></div>` })
                html += `</div></div>`
            }
        }
        var lastVisitedIflows = document.getElementById("lastVisitedIflows");
        lastVisitedIflows.innerHTML = html;
    });
}

function getSideBarAlwaysVisible() {

    chrome.storage.sync.get(["openMessageSidebarOnStartup"], function (result) {
        document.querySelectorAll('#openMessageSidebarOnStartup>.button')[result["openMessageSidebarOnStartup"] ? 0 : 1].classList.add('active')
        document.querySelector('#openMessageSidebarOnStartup').addEventListener('click', () => {
            document.querySelectorAll('#openMessageSidebarOnStartup>.button').forEach(e => e.classList.toggle('active'))
            let ctnx = document.querySelector('#openMessageSidebarOnStartup>.active').getAttribute('data') === 'true';
            console.log(ctnx)
            chrome.storage.sync.set({ "openMessageSidebarOnStartup": ctnx });
        });
    });
}

function addTenantSettings() {
    const compactinit = localStorage.getItem('modecpisetting')==='true'
    const tableinit = localStorage.getItem('tablenotetoggle')==='true'
    var tenantSettings = document.getElementById("tenantSettings");
    tenantSettings.innerHTML = `
    <h3 class="ui horizontal divider header">Tenant Settings</h3>
    <div>
        <div class="ui labeled input">
            <div class="ui label"> Name for tab </div>
            <input type="text" name="tenantName" id="tenantName"/>
        </div>
        <div class="ui buttons">
            <button class="ui blue basic button">Current Iflow</button>
            <button class="ui blue basic button">Reset Name</button>    
        </div>  
    </div>
    <div>
        <div class="ui labeled input">
            <div class="ui label"> No. of Last execution </div>
            <input type="number" min="1" max="20" name="setCount" id="setCount"/>
        </div>
    </div>    
    <div>
        <div class="ui labeled input">
            <div class="ui label">Tenant color</div>
            <input type="color" name="color" id="colorSelect"/>
        </div>
        <button class="ui blue basic button">Reset Color</button> 
    </div>  
    <div>
        <div class="ui labeled input">
            <div class="ui label">Choose an icon</div>
            <select name="icon" id="icon-select" class="ui selection dropdown">
                <option value="default">Default</option>
                <option value="1">Blue</option>
                <option value="2">Green</option>
                <option value="3">Red</option>
                <option value="4">Purple</option>
                <option value="5">Yellow</option>
                <option value="6">Orange</option>
            </select>
        </div>
    </div>
    <h3 class="ui horizontal divider header">CPI Helper Settings</h3>
    <div>
        <div  id="openMessageSidebarOnStartup" class="ui label buttons">
            <div class="ui label">Open Message Sidebar on start?</div>
            <div data=true class="ui toggle basic button">Yes</div>
            <div data=false class="ui toggle basic button">No</div>
        </div>
        <div id="cpisetting" class="ui label buttons">
            <div class="ui label">Mode of Last visited</div>
            <div data=true class="ui toggle basic ${compactinit ? 'active' : ''} button">Cozy</div>
            <div data=false class="ui toggle basic ${!compactinit ? 'active' : ''} button">Compact</div>
        </div>
        <div id="tablenote" class="ui label buttons">
            <div class="ui label">Need more help/details?</div>
            <div data=true class="ui toggle basic ${tableinit ? 'active' : ''} button">Expand</div>
            <div data=false class="ui toggle basic ${!(tableinit) ? 'active' : ''} button">Compress</div>
        </div>
        <div class='ui segment ${tableinit ? '' : 'hidden'}'>
			<div class="ui segment">
				<div class="ui medium header" style="color:var(--cpi-dark-green)">General Settings</div>
				<section>
					<b class="ui big red text">I-flow page shotcuts</b><br />
                    Press Chrome/Edge <kbd class="ui label">Alt</kbd> and Firefox <kbd class="ui label">Alt</kbd> + <kbd class="ui label">Shift</kbd> along with below key.
                    <div style="padding-block:.5em "></div>
					<span class="ui basic label">Logs <kbd class="ui label">1</kbd></span> 
					<span class="ui basic label">Trace <kbd class="ui label">2</kbd></span> 
					<span class="ui basic label">Messages <kbd class="ui label">3</kbd></span> 
					<span class="ui basic label">Info <kbd class="ui label">4</kbd></span> 
					<span class="ui basic label">Plugins <kbd class="ui label">5</kbd></span> 
					<span class="ui basic label">Search <kbd class="ui label">S</kbd></span> 
				</section>
			</div>
			<div class="ui segment">
				<div class="ui medium header" style="color:var(--cpi-dark-green)">Tenant Settings</div>
				<section>
                <p><b>Name for Tab:</b> Set custom tab name or click reset or same as iflow. <br />i.e. <span class="ui red text">CH_$iflow.name</span> => <span class="ui red text">CH_</span> prefix will be added.<div class="ui fitted divider"></div>
                </p><p><b>No. of Last execution:</b> Set number from <span class="ui red text">1 to 20</span> of message in sidebar <div class="ui fitted divider"></div>  
                </p><p><b>Tenant color:</b> set header color <div class="ui fitted divider"></div>
                </p><p><b>Choose icon:</b> set icon at tab.</p>
            </section>
        </div>
        <div class="ui segment">
            <div class="ui medium header" style="color:var(--cpi-dark-green)">CPI Helper Settings</div>
            <p><b>Open Message Sidebar on start?</b>: yes / No(default)<div class="ui fitted divider"></div></p>
            <table>
                <tr><th>Mode</th> <th>Height</th> <th>layout</th></tr>
                <tr><td>Cozy (default)</td> <td>More</td> <td>Fix-layout</td></tr>
                <tr><td>Compact</td> <td>Less</td> <td>Auto-layout</td></tr>
            </table>
        </div>
    </div>
    `;
    document.querySelector('#one > i').classList.add(compactinit ? 'expand' : 'compress');
    document.querySelector('#tenantSettings > div > .buttons > button:nth-child(1)').addEventListener('click', () => inputReset('iflow'));
    document.querySelector('#tenantSettings > div > .buttons > button:nth-child(2)').addEventListener('click', () => inputReset('reset'));
    // Help section btn
    document.querySelector('#tablenote').addEventListener('click', () => {
        document.querySelectorAll('#tablenote>.button').forEach(e => e.classList.toggle('active'))
        localStorage.setItem('tablenotetoggle', document.querySelector('#tablenote>.active').getAttribute('data') === "true");
        document.querySelector('#tenantSettings > div:nth-child(7) > div.ui.segment').classList.toggle("hidden")//#tenantSettings>div>div:has(table)
    });
    //reset color btn
    document.querySelector('#tenantSettings > div > button').addEventListener('click', () => {
        const tenantColor = document.querySelector('#colorSelect');
        tenantColor.value = '#21436a';
        tenantColor.dispatchEvent(new Event("change"));
    })
    //cozy-compact mode btn
    document.querySelector('#cpisetting').addEventListener('click', () => {
        localStorage.setItem('modecpisetting', document.querySelector('#cpisetting>.active').getAttribute('data') === "true");
        document.querySelectorAll('#cpisetting>.button').forEach(e => e.classList.toggle('active'))
        const icon = document.querySelector('#one > i');
        icon.classList.toggle('compress');
        icon.classList.toggle('expand');
        addLastVisitedIflows();
    });
}

function addTenantUrls() {

    var tenantUrls = document.getElementById("tenantUrls");
    tenantUrls.innerHTML = `<div class="ui horizontal divider header">Main Links</div>
                <div class="ui wrapping buttons fluid">
                    <a class="ui l-green button" target="_blank" href="${host + '/shell/monitoring/Messages/'}">Processed Messages</a>
                    <a class="ui l-red button" target="_blank" href="${host + '/shell/monitoring/Messages/%7B%22status%22%3A%22FAILED%22%2C%22time%22%3A%22PASTHOUR%22%2C%22type%22%3A%22INTEGRATION_FLOW%22%7D'}">Failed Messages</a>
                    <a class="ui l-black button" target="_blank" href="${host + '/shell/monitoring/Artifacts/'}">Integration Content</a>
                    <a class="ui l-blue button" target="_blank" href="${host + '/shell/design'}">Design</a> 
                </div>
                <div class="ui horizontal divider header">Tenant Links</div>
                <div class='ui menu'>
                    <a class="ui item" href="${host + '/shell/monitoring/Overview'}" target="_blank">
                    <Strong>Monitoring</Strong></a>
                    <div class="ui wrapped wrapping buttons fluid" style="display: flex;flex-direction: column;">
                        <div class="three ui buttons">
                            <a class="ui button" href="${host + '/shell/monitoring/SecurityMaterials'}" target="_blank">Security Material</a>
                            <a class="ui button" href="${host + '/shell/monitoring/Keystore'}" target="_blank">Keystore</a>
                            <a class="ui button" href="${host + '/shell/monitoring/CertificateUserMappings'}" target="_blank">Certificate-to-User Mappings</a>
                        </div>
                        <div class="three ui buttons">
                            <a class="ui button" href="${host + '/shell/monitoring/AccessPolicies'}" target="_blank">Access Policies</a>
                            <a class="ui button" href="${host + '/shell/monitoring/JdbcMaterial'}" target="_blank">JDBC Material</a>
                            <a class="ui button" href="${host + '/shell/monitoring/Connectivity'}" target="_blank">Connectivity Tests</a>
                        </div>
                        <div class="ui fitted divider"></div>
                        <div class="three ui buttons">
                            <a class="ui button" href="${host + '/shell/monitoring/DataStores'}" target="_blank">Data Stores</a>
                            <a class="ui button" href="${host + '/shell/monitoring/Variables'}" target="_blank">Variables</a>
                            <a class="ui button" href="${host + '/shell/monitoring/MessageQueues'}" target="_blank">Message Queues</a>
                        </div>
                        <a class="fluid ui button" href="${host + '/shell/monitoring/NumberRangeObject'}" target="_blank">Number Ranges</a>
                        <div class="ui fitted divider"></div>
                        <div class="three ui buttons">
                            <a class="ui button" href="${host + '/shell/monitoring/AuditLog'}" target="_blank">Audit Log</a>
                            <a class="ui button" href="${host + '/shell/monitoring/Locks'}" target="_blank">Message Locks</a>
                            <a class="ui button" href="${host + '/shell/monitoring/DesigntimeLocks'}" target="_blank">Designtime Artifact Locks</a>
                        </div>
                    </div>
                </div>
                <div class='ui menu'>
                    <a class="ui item" href="${host + '/shell/settings'}" target="_blank"><strong>API Management</strong></a>
                    <div class="ui wrapped wrapping buttons fluid">
                        <a class="ui button" href="${host + '/shell/configure'}" target="_blank">Configure API</a>
                        <a class="ui button" href="${host + '/shell/develop'}" target="_blank">Design API</a>
                        <a class="ui button" href="${host + '/shell/testconsole'}" target="_blank">Test API</a>
                        <a class="ui button" href="${host + '/shell/analytics'}" target="_blank">Analyze API</a> 
                    </div>
                </div>
                <div class='ui menu'>
                    <a class="ui item " href="${host + '/shell/tpm/companyProfile'}" target="_blank"><strong>Trading Partner Management</strong></a>
                    <div class="ui wrapped wrapping buttons">
                        <a class="ui button" href="${host + '/shell/b2bmonitor/landing'}" target="_blank">B2B Monitor</a>
                        <a class="ui button" href="${host + '/shell/tpm/agreements'}" target="_blank">Agreements</a>
                        <a class="ui button" href="${host + '/shell/tpm/tradingPartners'}" target="_blank">Trading Partners</a>
                        <a class="ui button" href="${host + '/shell/tpm/agreementTemplates'}" target="_blank">Agreement Templates</a>
                        <a class="ui button" href="${host + '/shell/tpm/pdContent'}" target="_blank">Partner Directory Data</a>
                    </div>
                </div>
                <div class='ui menu'>
                    <a class="ui item " href="${host + '/shell/tpm/companyProfile'}" target="_blank"><strong>Integration Advisor</strong></a>
                    <div class="ui wrapped wrapping buttons">
                        <a class="ui button" href="${host + '/shell/migs'}" target="_blank">MIGs (Message Implementation Guidelines)</a>
                        <a class="ui button" href="${host + '/shell/mags'}" target="_blank">MAGs (Mapping Guidelines)</a>
                        <a class="ui button" href="${host + '/shell/customtypesystems'}" target="_blank">Custom Type Systems</a>
                    </div>
                </div>`;
}

async function getHost() {
    return new Promise((resolve, reject) => {

        var query = { active: true, currentWindow: true };

        function callback(tabs) {
            var currentTab = tabs[0]; // there will be only one in this array
            console.log(currentTab); // also has properties like currentTab.id

            var url = currentTab.url;
            var tempHost = "https://" + url.split("/")[2];

            if (!url.match(/.*\.integrationsuite(-trial){0,1}\..*/)) {
                tempHost += "/itspaces"
            }
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
    var cpihelper_version = document.querySelectorAll(".cpihelper_version");
    var html = "CPI Helper : v " + manifestVersion;
    cpihelper_version.forEach(e => e.innerHTML = html);
}

function inputReset(title) {
    const tenantName = document.querySelector('#tenantName');
    tenantName.value = title !== 'iflow' ? 'Cloud Integration' : '$iflow.name';
    tenantName.dispatchEvent(new Event("input"))
}

// Handle tenantname changes
function tenantIdentityChanges() {
    let hostData = {}
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        let tenantName = document.querySelector('#tenantName')
        let tenantColor = document.querySelector('#colorSelect')
        let tenantIcon = document.querySelector('#icon-select')
        let tenantCount = document.querySelector('#setCount')
        let popupcolor = document.querySelector('#cpiHelper_contentheader')
        let timeoutId;
        let tab = tabs[0];

        // get the current document title - this runs evey time the popup is opened
        chrome.tabs.sendMessage(tab.id, 'get', response => {
            console.dir(response)
            if (response) {
                tenantName.value = hostData.title = response.title;
                tenantColor.value = hostData.color = response.color;
                tenantIcon.value = hostData.icon = response.icon
                tenantCount.value = hostData.count = response.count
                popupcolor.style.backgroundColor = hostData.color = response.color;
            }
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

        // Autosave on change after 1s
        tenantCount.addEventListener('input', () => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(() => {
                hostData.count = tenantCount.value
                chrome.tabs.sendMessage(tab.id, { save: hostData }, (response) => {
                    console.dir(response);
                })
            }, 1000);
        })

        // Update color on change
        tenantColor.addEventListener('change', () => {
            hostData.color = tenantColor.value;
            // set popup.html header
            popupcolor.style.backgroundColor = tenantColor.value;
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

async function storageGetPromise(name) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([name], function (result) {
            resolve(result[name]);
        });
    })
}

async function statistic(event, value = null, value2 = null) {
    return null;
    try {
        var sessionId = await storageGetPromise("sessionId")
        var installtype = await storageGetPromise("installtype")
        var img = document.createElement("img");
        img.src = `https://mmjs2inijoe3rpwsdmqbgtyvdu0ldvfj.lambda-url.eu-central-1.on.aws/?version=${chrome.runtime.getManifest().version}&event=${event}&session=${sessionId}&value=${value}&value2=${value2}&installtype=${installtype}&nonse=${Date.now()}`;
    } catch (e) {
        console.log(e)
    }
}

async function main() {
    checkUpdate();
    host = await getHost();
    getSideBarAlwaysVisible();
    addTenantUrls();
    addTenantSettings();
    tenantIdentityChanges();
    addLastVisitedIflows();
    statistic("popup_open")
}

main().catch(e => console.error(e))

// Activate tab on hover
$('.top .item').on('mouseenter', function () {
    $(this).tab('change tab', $(this).attr('id'));
});

// Initialize tabs
$('.top .menu .item').tab();
$('.ui.dropdown').dropdown('show');