async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json(); // Annahme, dass die Antwort JSON ist
    console.log(data);
  } catch (error) {
    console.error("Fehler beim Abrufen der Daten:", error);
  }
}

var plugin = {
    metadataVersion: "1.0.0",
    id: "downloadMessageUsage",
    name: "Download Message Usage",
    version: "0.0.1",
    author: "MHP.com",
    email: "florian.kube@mhp.com",
    website: "https://github.com/dbeck121/CPI-Helper-Chrome-Extension",//"https://yourwebsite.com"
    description: "Download message usage as CSV file.",
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
        "title": "Example Title",
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
            var div = document.createElement("div");
            div.innerText = "Download Message Usage of last";
            var button = document.createElement("button")
            button.innerHTML = "Download"
            var popupContent = document.createElement("div");
            popupContent.innerHTML = "<h1>popup content</h1>";
            
            var radioGroup = document.createElement("div");
            radioGroup.classList.add("radio-group");

            var lastMonthRadio = document.createElement("input");
            lastMonthRadio.type = "radio";
            lastMonthRadio.name = "timePeriod";
            lastMonthRadio.value = "Month";
            lastMonthRadio.id = "lastMonthRadio";
            var lastMonthLabel = document.createElement("label");
            lastMonthLabel.htmlFor = "lastMonthRadio";
            lastMonthLabel.innerText = "Month";
            lastMonthLabel.style.marginLeft = "5px";
            //lastMonthLabel.style.display = "inline";


            var lastWeekRadio = document.createElement("input");
            lastWeekRadio.type = "radio";
            lastWeekRadio.name = "timePeriod";
            lastWeekRadio.value = "Week";
            lastWeekRadio.id = "lastWeekRadio";
            var lastWeekLabel = document.createElement("label");
            lastWeekLabel.htmlFor = "lastWeekRadio";
            lastWeekLabel.innerText = "Week";
            lastWeekLabel.style.marginLeft = "5px";

            var radioGroup = document.createElement("div");
            radioGroup.classList.add("radio-group");

            // Erstellen eines table Elements
            var table = document.createElement("table");
            var tbody = document.createElement("tbody");

            // Erste Zeile für den ersten Radiobutton und sein Label
            var tr1 = document.createElement("tr");

            var td1_1 = document.createElement("td");
            td1_1.appendChild(lastMonthRadio);

            var td1_2 = document.createElement("td");
            td1_2.appendChild(lastMonthLabel);
            td1_2.style.textAlign = "center"; // Zentrieren des Labels

            tr1.appendChild(td1_1);
            tr1.appendChild(td1_2);

            // Zweite Zeile für den zweiten Radiobutton und sein Label
            var tr2 = document.createElement("tr");

            var td2_1 = document.createElement("td");
            td2_1.appendChild(lastWeekRadio);

            var td2_2 = document.createElement("td");
            td2_2.appendChild(lastWeekLabel);
            td2_2.style.textAlign = "center"; // Zentrieren des Labels

            tr2.appendChild(td2_1);
            tr2.appendChild(td2_2);

            // Hinzufügen der Zeilen zum tbody und dann zum table
            tbody.appendChild(tr1);
            tbody.appendChild(tr2);
            table.appendChild(tbody);

            // Hinzufügen des table zum radioGroup Div
            radioGroup.appendChild(table);

            // Hinzufügen des radioGroup Div zum Hauptcontainer (angenommen, es ist 'div')
            div.appendChild(radioGroup);
            //button.onclick = (x) => pluginHelper.functions.popup(popupContent, "Header")
            //when i click the button i want to call an specific url
            button.onclick = () => {  
                //depending in the radio button i want to get the last week or the last monath
                var timePeriod = document.querySelector('input[name="timePeriod"]:checked').value;
                console.log(timePeriod);
                //if it is "Month" it should get the a startDate from the first of the last month and for endDate the last day of the last month
                //if it is "Week" it should get the a startDate from the first of the last week and for endDate the last day of the last week
                
                var today = new Date();
                var startDate, endDate;

                if (timePeriod === "Month") {
                    // First day of the last month
                    var firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    startDate = firstDayLastMonth;
                
                    // Last day of the last month
                    var lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                    endDate = lastDayLastMonth;
                } else if (timePeriod === "Week") {
                    // Clone today's date to avoid modifying the original
                    var tempDate = new Date(today);
                    
                    // Get the last Sunday
                    var lastSunday = new Date(tempDate);
                    lastSunday.setDate(tempDate.getDate() - tempDate.getDay());
                
                    // Get the first day of the previous week
                    startDate = new Date(lastSunday);
                    startDate.setDate(lastSunday.getDate() - 6);
                
                    // Set the end date to the last Sunday
                    endDate = lastSunday;
                }
                
                // Formatting dates for display
                function formatDate(date) {
                    var dd = String(date.getDate()).padStart(2, '0');
                    var mm = String(date.getMonth() + 1).padStart(2, '0'); // January is 0
                    var yyyy = date.getFullYear();
                    return yyyy + '-' + mm + '-' + dd;
                }
                
                console.log('Start Date:', formatDate(startDate));
                console.log('End Date:', formatDate(endDate));


                var url = `https://${pluginHelper.tenant}/rest/api/v1/metering/usage/date-range?startDate=2024-05-01&endDate=2024-06-30&runtimeLocationId=cloudintegration`;        
                //print the url to console
                console.log(url);
                
                var overviewData = fetchData(url);
                console.log(overviewData);



            
            
            }
            
            div.appendChild(button)
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