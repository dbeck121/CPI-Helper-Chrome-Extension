createContentNodeForLogs = async (runId, leftActive = true) => {

    const logs = await createLogsRightSide(runId, leftActive);
    const list = await createLogsLeftSide(leftActive)
    const page = document.createElement('div');
    page.classList = 'cpiHelper_logs_page';
    page.id = 'cpiHelper_logs_page';
    page.appendChild(list);
    page.appendChild(logs);
    return page;
}

var selectorIflowStatusEntry = "all"
var toggleCustomOrLastEntries = "last";
createLogsLeftSide = async (leftActive = false) => {

    var list = document.createElement('div');
    list.id = 'logs-left-side_cpiHelper';
    list.classList.add('cpiHelper_logs_left')
    if (!leftActive) {
        list.classList.add('cpiHelper_hidden');
    }


    var artifactList = document.createElement('select');
    artifactList.style.width = "100%";
    artifactList.onload = updateArtifactList;
    artifactList.id = 'logs-left-side_cpiHelper_artifactList';

    list.appendChild(artifactList);
    list.appendChild(createElementFromHTML(`<br />`));
    let today = new Date().toISOString().substring(0, 10);
    let tomorrow = new Date(new Date().getTime() + 86400000).toISOString().substring(0, 10)

    var selectorIflowStatus = document.createElement('select');
    selectorIflowStatus.id = 'cpiHelper_logs_iflow_status';
    selectorIflowStatus.onchange = (element) => {
        console.log(element.target.value)
        selectorIflowStatusEntry = element.target.value;
    };
    selectorIflowStatus.innerHTML = `<option ${selectorIflowStatusEntry == "all" ? "selected" : ""} value="all">all</option><option ${toggleCustomOrLastEntries == "FAILED" ? "selected" : ""}>FAILED</option><option ${toggleCustomOrLastEntries == "SUCCESS" ? "selected" : ""}>SUCCESS</option>`;
    list.appendChild(createElementFromHTML('<label>Status: </label>'));
    list.appendChild(selectorIflowStatus);
    list.appendChild(createElementFromHTML(`<br />`));

    var selectorCustomTop = document.createElement('select');
    selectorCustomTop.id = 'cpiHelper_logs_date_type';
    selectorCustomTop.onchange = (element) => {
        console.log(element.target.value)
        toggleCustomOrLastEntries = element.target.value;
        customSelection = document.getElementById('cpiHelper_logs_custom_selection');
        if (customSelection && element.target.value == "custom") {
            customSelection.classList.remove('cpiHelper_hidden');
        }
        if (customSelection && element.target.value == "last") {
            customSelection.classList.add('cpiHelper_hidden');
        }
    };
    selectorCustomTop.innerHTML = `<option ${toggleCustomOrLastEntries == "last" ? "selected" : ""} value="last">last 50</option><option ${toggleCustomOrLastEntries != "last" ? "selected" : ""}>custom</option>`;
    list.appendChild(createElementFromHTML('<label>Show: </label>'));
    list.appendChild(selectorCustomTop);
    list.appendChild(createElementFromHTML(`<br />`));


    var customSelectionElement = document.createElement('div');
    customSelectionElement.id = 'cpiHelper_logs_custom_selection';
    if (toggleCustomOrLastEntries == "last") {
        customSelectionElement.classList.add('cpiHelper_hidden');
    }

    customSelectionElement.appendChild(createElementFromHTML(`<span style="margin-top: 10px;">From:<br /></span>`));
    customSelectionElement.appendChild(createElementFromHTML(`<input type="date" id="cpiHelper_logs_start_date" name="cpiHelper_logs_start_date" value="${today}" />`));
    customSelectionElement.appendChild(createElementFromHTML(`<br />`));
    customSelectionElement.appendChild(createElementFromHTML(`<input type="time" id="cpiHelper_logs_start_time" name="cpiHelper_logs_end_time" value="00:00" />`));
    customSelectionElement.appendChild(createElementFromHTML(`<br />`));
    customSelectionElement.appendChild(createElementFromHTML(`<span style="margin-top: 10px;">To:<br /></span>`));

    customSelectionElement.appendChild(createElementFromHTML(`<input type="date" id="cpiHelper_logs_end_date" name="cpiHelper_logs_end_date" value="${tomorrow}" />`));
    customSelectionElement.appendChild(createElementFromHTML(`<br />`));
    customSelectionElement.appendChild(createElementFromHTML(`<input type="time" id="cpiHelper_logs_end_time" name="cpiHelper_logs_end_time" value="00:00" />`));

    list.appendChild(customSelectionElement);

    var button = document.createElement('button');
    button.innerText = "update"
    button.onclick = updateLogList;
    button.style.margin = "10px";
    button.style.marginLeft = "0px";
    list.appendChild(button);
    list.appendChild(createElementFromHTML(`<div id="cpiHelper_log_list_for_entries" />`));

    return list;

}

updateLogList = async () => {
    try {
        var iflowStatus = document.getElementById('cpiHelper_logs_iflow_status').value;
        var startDate = document.getElementById("cpiHelper_logs_start_date").value;
        var endDate = document.getElementById("cpiHelper_logs_end_date").value;
        var startTime = document.getElementById("cpiHelper_logs_start_time").value;
        var endTime = document.getElementById("cpiHelper_logs_end_time").value;
        var artifact = document.getElementById("logs-left-side_cpiHelper_artifactList").value;
        var dateType = document.getElementById("cpiHelper_logs_date_type").value;
        var list = document.getElementById("cpiHelper_log_list_for_entries");

        if (!artifact) {
            artifact = cpiData.integrationFlowId;
        }

        var statusfilter = null;
        switch (iflowStatus) {
            case "all":
                statusfilter = "";
                break;
            case "FAILED":
                statusfilter = "and Status eq 'FAILED' ";
                break;
            case "SUCCESS":
                statusfilter = "and Status eq 'SUCCESS' ";
                break;
            default:
                statusfilter = "";
        }

        if (dateType == "custom") {
            var response = JSON.parse(await makeCallPromise("GET", "/itspaces/odata/api/v1/MessageProcessingLogs?$filter=IntegrationFlowName eq '" + artifact + "' and Status ne 'DISCARDED' " + statusfilter + "and LogStart gt datetime'" + startDate + "T" + startTime + ":00.000' and LogStart lt datetime'" + endDate + "T" + endTime + ":00.000'&$top=60&$format=json&$orderby=LogStart desc", false)).d.results;
        } else {
            var response = JSON.parse(await makeCallPromise("GET", "/itspaces/odata/api/v1/MessageProcessingLogs?$filter=IntegrationFlowName eq '" + artifact + "' " + statusfilter + "and Status ne 'DISCARDED'&$top=50&$format=json&$orderby=LogStart desc", false)).d.results;

        }

        list.innerHTML = "";
        lastDay = "";

        if (response.length == 0) {
            list.innerHTML = "No logs found";
        }

        if (response.length == 60) {
            list.appendChild(createElementFromHTML(`<div>last 60 logs in period</div>`));
        }

        for (let i = 0; i < response.length; i++) {

            let date = new Date(parseInt(response[i].LogEnd.match(/\d+/)[0]));
            //add offset to utc time. The offset is not correct anymore but isostring can be used to show local time
            date.setTime(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
            date = date.toISOString();

            if (date.substr(0, 10) != lastDay) {
                let day = document.createElement('div');
                day.innerText = date.substr(0, 10);
                list.appendChild(day);
                lastDay = date.substr(0, 10);
            }

            //statusicon

            let statusColor = "#008000";
            let statusIcon = "";
            if (response[i].Status == "PROCESSING") {
                statusColor = "#FFC300";
                statusIcon = "";
            }
            if (response[i].Status == "FAILED") {
                statusColor = "#C70039";
                statusIcon = "";
            }

            let statusicon = createElementFromHTML("<span data-sap-ui-icon-content='" + statusIcon + "' class='" + response[i].MessageGuid + " sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem; color:" + statusColor + ";'> </span>");



            //end statusicon

            let button = document.createElement('button');
            button.innerText = date.substr(11, 8);
            button.onclick = () => {
                updateRightSide(response[i].MessageGuid)
            }

            let div = document.createElement('div');
            div.appendChild(statusicon);
            div.appendChild(button);


            list.appendChild(div);
        }

        console.log(response);
    } catch (error) {
        console.log(error);
        showSnackbar("Error while fetching logs. Check input data.");
    }



}

updateArtifactList = async () => {
    var list = document.getElementById('logs-left-side_cpiHelper_artifactList');
    if (list) {
        var response = await makeCallPromise("GET", "/itspaces/Operations/com.sap.it.op.tmn.commands.dashboard.webui.KnownArtifactsListCommand", false)
        console.log("response");
        responseList = new XmlToJson().parse(response)["com.sap.it.op.tmn.commands.dashboard.webui.KnownArtifactsListResponse"]["knownArtifacts"];
        list.innerHTML = "";
        for (var i = 0; i < responseList.length; i++) {
            var element = document.createElement('option')
            element.value = responseList[i].symbolicName;
            element.innerText = responseList[i].name;
            if (responseList[i].symbolicName == cpiData.integrationFlowId) {
                element.selected = true;
            }
            list.appendChild(element);
        }

    }


}
createLogsRightSide = async (runId, leftActive = false) => {

    var objects = null;
    var logs = null;
    if (runId) {

        objects = [
            {
                label: "RunLogs",
                content: await createRunLogsContent(runId),
                active: true
            }, {
                label: "Persist",
                content: await createPersistLogsContent(runId),
                active: false

            }
        ];

        logs = await createTabHTML(objects, 'logs-tab');

    } else {
        logs = document.createElement('div');
        logs.innerHTML = '<div class="cpiHelper_tabs">Please choose logs to show on left side!</div>';
    }

    var right = document.createElement('div');
    right.id = "cpiHelper_logs-right-side";
    if (leftActive) {
        right.className = "cpiHelper_logs_right_small";
    } else {
        right.className = "cpiHelper_logs_right";
    }
    right.appendChild(logs);
    return right;

}

updateRightSide = async (runId) => {
    rightSide = document.getElementById("cpiHelper_logs-right-side")
    if (rightSide) {
        page = document.getElementById("cpiHelper_logs_page")
        page.children[1].innerHTML = '<div class="cpiHelper_tabs">Please wait... The request is being processed. This might take some time.</div>';
        var resp = await createLogsRightSide(runId, true)
        page.children[1].remove()
        page.appendChild(resp);
    }
}



createPersistLogsContent = async (messageId) => {

    entriesList = JSON.parse(await makeCallPromise("GET", "/itspaces/odata/api/v1/MessageProcessingLogs('" + messageId + "')/MessageStoreEntries?$format=json", false));
    console.log(entriesList);

    var tabs = [];
    active = true;
    for (item of entriesList.d.results) {
        tabs.push({
            label: item.MessageStoreId,
            content: async (input) => {
                return formatTrace(await makeCallPromise("GET", "/itspaces/odata/api/v1/MessageStoreEntries('" + input.item + "')/$value", false), "cpiHelper_persistLogsItem" + input.item)
            },
            item: item.Id,
            active
        })
        active = false;
    }

    var content = document.createElement('div');
    content.id = 'persist-logs-content';
    if (tabs.length > 0) {
        content.appendChild(await createTabHTML(tabs, 'persist-logs-tab'));
    }
    else {
        content.innerHTML = "No persist logs found. To learn more about persist logs check <a href='https://help.sap.com/viewer/368c481cd6954bdfa5d0435479fd4eaf/Cloud/en-US/8c35f3fa3b9c42c5b810332eccbc5a2f.html' target='_blank'>Persist Messages</a> in the docs";
        content.style.padding = "15px";
    }

    return content;
}

createRunLogsContent = async (messageId) => {


    entriesList = JSON.parse(await makeCallPromise("GET", "/itspaces/odata/api/v1/MessageProcessingLogs('" + messageId + "')/Attachments?$format=json", false));
    console.log(entriesList);

    var tabs = [];
    active = true;
    for (item of entriesList.d.results) {
        tabs.push({
            label: item.Name,
            content: async (input) => {
                return formatTrace(await makeCallPromise("GET", "/itspaces/odata/api/v1/MessageProcessingLogAttachments('" + input.item + "')/$value", false), "cpiHelper_runLogsItem" + input.item)
            },
            item: item.Id,
            active
        })
        active = false;
    }

    var content = document.createElement('div');
    content.id = 'run-logs-content';
    if (tabs.length > 0) {
        content.appendChild(await createTabHTML(tabs, 'run-logs-tab'));
    }
    else {
        content.innerHTML = "No log attachements found. For more information see <a href='https://help.sap.com/viewer/368c481cd6954bdfa5d0435479fd4eaf/Cloud/en-US/17dba92e6ed4402f8cb0f05093a34269.html' target='_blank'>Create Log Attachments with Groovy</a> in the docs";
        content.style.padding = "15px";
    }
    return content;
}
