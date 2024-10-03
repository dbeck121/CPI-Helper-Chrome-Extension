createContentNodeForLogs = async (runId, leftActive = true) => {
  const logs = await createLogsRightSide(runId, leftActive);
  const list = await createLogsLeftSide(leftActive);
  const page = document.createElement("div");
  page.classList = "cpiHelper_logs_page";
  page.id = "cpiHelper_logs_page";
  page.appendChild(list);
  page.appendChild(logs);
  return page;
};

var selectorIflowStatusEntry = "all";
var toggleCustomOrLastEntries = "last";
createLogsLeftSide = async (leftActive = false) => {
  var list = document.createElement("div");
  list.id = "logs-left-side_cpiHelper";
  list.classList.add("cpiHelper_logs_left");
  if (!leftActive) {
    list.classList.add("cpiHelper_hidden");
  }

  var artifactList = document.createElement("select");
  artifactList.style.width = "100%";
  artifactList.className = "cpi_padding_blockend";
  artifactList.onload = updateArtifactList;
  artifactList.id = "logs-left-side_cpiHelper_artifactList";

  list.appendChild(artifactList);
  list.appendChild(createElementFromHTML(`<br />`));
  let today = new Date().toISOString().substring(0, 10);
  let tomorrow = new Date(new Date().getTime() + 86400000).toISOString().substring(0, 10);

  var selectorIflowStatus = document.createElement("select");
  selectorIflowStatus.id = "cpiHelper_logs_iflow_status";
  selectorIflowStatus.classList = "cpi_padding_blockend";
  selectorIflowStatus.onchange = (element) => {
    log.log(element.target.value);
    selectorIflowStatusEntry = element.target.value;
  };
  selectorIflowStatus.innerHTML = `<option ${selectorIflowStatusEntry == "all" ? "selected" : ""} value="all">all</option><option ${toggleCustomOrLastEntries == "FAILED" ? "selected" : ""}>FAILED</option><option ${
    toggleCustomOrLastEntries == "COMPLETED" ? "selected" : ""
  }>COMPLETED</option>`;
  list.appendChild(createElementFromHTML("<label>Status: </label>"));
  list.appendChild(selectorIflowStatus);
  list.appendChild(createElementFromHTML(`<br />`));

  var selectorCustomTop = document.createElement("select");
  selectorCustomTop.id = "cpiHelper_logs_date_type";
  selectorCustomTop.onchange = (element) => {
    log.log(element.target.value);
    toggleCustomOrLastEntries = element.target.value;
    customSelection = document.getElementById("cpiHelper_logs_custom_selection");
    if (customSelection && element.target.value == "custom") {
      customSelection.classList.remove("cpiHelper_hidden");
    }
    if (customSelection && element.target.value == "last") {
      customSelection.classList.add("cpiHelper_hidden");
    }
  };
  selectorCustomTop.innerHTML = `<option ${toggleCustomOrLastEntries == "last" ? "selected" : ""} value="last">last 50</option><option ${toggleCustomOrLastEntries != "last" ? "selected" : ""}>custom</option>`;
  list.appendChild(createElementFromHTML("<label>Show: </label>"));
  list.appendChild(selectorCustomTop);
  list.appendChild(createElementFromHTML(`<br />`));

  var customSelectionElement = document.createElement("div");
  customSelectionElement.id = "cpiHelper_logs_custom_selection";
  if (toggleCustomOrLastEntries == "last") {
    customSelectionElement.classList.add("cpiHelper_hidden");
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

  var button = document.createElement("button");
  button.innerText = "update";
  button.onclick = updateLogList;
  button.style.margin = "10px";
  button.style.marginLeft = "0px";
  list.appendChild(button);
  list.appendChild(createElementFromHTML(`<div id="cpiHelper_log_list_for_entries" class="cpiHelper_logs_table_div"/>`));

  return list;
};

updateLogList = async () => {
  try {
    var iflowStatus = document.getElementById("cpiHelper_logs_iflow_status").value;
    var startDate = document.getElementById("cpiHelper_logs_start_date").value;
    var endDate = document.getElementById("cpiHelper_logs_end_date").value;
    var startTime = document.getElementById("cpiHelper_logs_start_time").value;
    var endTime = document.getElementById("cpiHelper_logs_end_time").value;
    var artifact = document.getElementById("logs-left-side_cpiHelper_artifactList").value;
    var dateType = document.getElementById("cpiHelper_logs_date_type").value;
    var listPlace = document.getElementById("cpiHelper_log_list_for_entries");
    var startDateTimeInUTC = new Date(startDate + "T" + startTime + ":00.000").toISOString().replace("Z", "");
    var endDateTimeInUTC = new Date(endDate + "T" + endTime + ":00.000").toISOString().replace("Z", "");
    listPlace.innerHTML = "";

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
      case "COMPLETED":
        statusfilter = "and Status eq 'COMPLETED' ";
        break;
      default:
        statusfilter = "";
    }

    if (dateType == "custom") {
      var response = JSON.parse(
        await makeCallPromise(
          "GET",
          "/" +
            cpiData.urlExtension +
            "odata/api/v1/MessageProcessingLogs?$filter=IntegrationFlowName eq '" +
            artifact +
            "' and Status ne 'DISCARDED' " +
            statusfilter +
            "and LogStart ge datetime'" +
            startDateTimeInUTC +
            "' and LogStart le datetime'" +
            endDateTimeInUTC +
            "'&$top=40&$format=json&$orderby=LogEnd desc",
          false
        )
      ).d.results;
    } else {
      var response = JSON.parse(
        await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogs?$filter=IntegrationFlowName eq '" + artifact + "' " + statusfilter + "and Status ne 'DISCARDED'&$top=35&$format=json&$orderby=LogEnd desc", false)
      ).d.results;
    }

    list = document.createElement("table");

    lastDay = "";

    if (response.length == 0) {
      let element = document.createElement("tr");
      element.innerHTML = '<td style="padding:0px;" colspan="2">No logs found</td>';
      list.appendChild(element);
    }

    if (response.length == 40) {
      let element = document.createElement("tr");
      element.innerHTML = '<td style="padding:0px;" colspan="2">last 40 logs in period</td>';
      list.appendChild(element);
    }

    for (let i = 0; i < response.length; i++) {
      let date = new Date(parseInt(response[i].LogEnd.match(/\d+/)[0]));
      //add offset to utc time. The offset is not correct anymore but isostring can be used to show local time
      date.setTime(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
      date = date.toISOString();

      if (date.substr(0, 10) != lastDay) {
        let day = document.createElement("tr");
        day.innerHTML = `<td style="padding:0px;" colspan="2">${date.substr(0, 10)}</td>`;
        list.appendChild(day);
        lastDay = date.substr(0, 10);
      }

      //statusicon
      let statusColor = getStatusColorCode(response[i].Status);
      let statusIcon = "xe05b";
      if (response[i].Status == "PROCESSING") {
        statusIcon = "xe047";
      }
      if (response[i].Status == "FAILED") {
        statusIcon = "xe03e";
      }
      statusicon = "<span data-sap-ui-icon-content='&#" + statusIcon + "' class='" + response[i].MessageGuid + " sapUiIcon sapUiIconMirrorInRTL' style='font-family: SAP-icons; font-size: 0.9rem; color:" + statusColor + ";'> </span>";
      //end statusicon
      let buttonWrap = document.createElement("td");
      buttonWrap.style.padding = "0px";
      let button = document.createElement("button");
      button.innerHTML = `${statusicon} ${date.substr(11, 8)}`;
      button.onclick = (event) => {
        if (document.getElementsByClassName("cpiHelper_logs_selected_button").length > 0) {
          document.getElementsByClassName("cpiHelper_logs_selected_button")[0].classList.remove("cpiHelper_logs_selected_button");
        }
        event.target.classList.add("cpiHelper_logs_selected_button");
        updateRightSide(response[i].MessageGuid);
      };
      buttonWrap.appendChild(button);
      let div = document.createElement("tr");
      div.appendChild(buttonWrap);

      list.appendChild(div);
    }

    listPlace.appendChild(list);

    log.log(response);
  } catch (error) {
    log.log(error);
    showToast("Check input data.", "Error while fetching logs", "error");
  }
};

updateArtifactList = async () => {
  var list = document.getElementById("logs-left-side_cpiHelper_artifactList");
  if (list) {
    var response = await makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.KnownArtifactsListCommand", false);
    log.log("response");
    responseList = new XmlToJson().parse(response)["com.sap.it.op.tmn.commands.dashboard.webui.KnownArtifactsListResponse"]["knownArtifacts"];
    list.innerHTML = "";
    for (var i = 0; i < responseList.length; i++) {
      var element = document.createElement("option");
      element.value = responseList[i].symbolicName;
      element.innerText = responseList[i].name;
      if (responseList[i].symbolicName == cpiData.integrationFlowId) {
        element.selected = true;
      }
      list.appendChild(element);
    }
  }
};

createLogsRightSide = async (runId, leftActive = false) => {
  var objects = null;
  var logs = null;
  if (runId) {
    objects = [
      {
        label: "Info",
        content: await createLogsInfo(runId),
        active: true,
      },
      {
        label: "RunLogs",
        content: await createRunLogsContent(runId),
        active: false,
      },
      {
        label: "Persist",
        content: await createPersistLogsContent(runId),
        active: false,
      },
    ];
    logs = await createTabHTML(objects, "logs-tab");
  } else {
    logs = document.createElement("div");
    logs.innerHTML = '<div class="cpiHelper_tabs">Please choose a message to show logs. You can also click the speech bubble icon in Messages Sidebar.</div>';
  }
  var right = document.createElement("div");
  right.id = "cpiHelper_logs-right-side";
  if (leftActive) {
    right.className = "cpiHelper_logs_right_small";
  } else {
    right.className = "cpiHelper_logs_right";
  }
  right.appendChild(logs);
  return right;
};

updateRightSide = async (runId) => {
  rightSide = document.getElementById("cpiHelper_logs-right-side");
  if (rightSide) {
    page = document.getElementById("cpiHelper_logs_page");
    page.children[1].innerHTML = '<div class="cpiHelper_tabs">Please wait... The request is being processed. This might take some time.</div>';
    var resp = await createLogsRightSide(runId, true);
    page.children[1].remove();
    page.appendChild(resp);
  }
};

createPersistLogsContent = async (messageId) => {
  var innerpersist = async (input) => {
    var persistTabs = [
      {
        label: "Log",
        content: async (input) => {
          return formatTrace(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageStoreEntries('" + input.item + "')/$value", false), "cpiHelper_persistLogsItem" + input.item);
        },
        item: input.item,
        active: true,
      },
      {
        label: "Properties",
        content: async (input) => {
          let elements = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageStoreEntries('" + input.item + "')/Properties?$format=json", true)).d.results;
          return formatHeadersAndPropertiesToTable(elements);
        },
        item: input.item,
        active: false,
      },
    ];
    return await createTabHTML(persistTabs, "cpiHelper_persistLogs_tabs" + input.count);
  };

  entriesList = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogs('" + messageId + "')/MessageStoreEntries?$format=json", false));
  log.log(entriesList);

  var tabs = [];
  active = true;
  var count = 0;
  for (item of entriesList.d.results.sort(function (a, b) {
    return a.MessageStoreId.toLowerCase() > b.MessageStoreId.toLowerCase() ? 1 : -1;
  })) {
    tabs.push({
      label: item.MessageStoreId,
      content: count == 0 ? await innerpersist({ item: item.Id, count: count }) : innerpersist,
      item: item.Id,
      active,
      count,
    });
    active = false;
    count++;
  }

  var content = document.createElement("div");
  content.id = "persist-logs-content";
  if (tabs.length > 0) {
    content.appendChild(await createTabHTML(tabs, "persist-logs-tab"));
  } else {
    content.innerHTML =
      "No persist logs found. To learn more about persist logs check <a href='https://help.sap.com/viewer/368c481cd6954bdfa5d0435479fd4eaf/Cloud/en-US/8c35f3fa3b9c42c5b810332eccbc5a2f.html' target='_blank'>Persist Messages</a> in the docs";
  }

  return content;
};

createLogsInfo = async (messageId) => {
  try {
    var input = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogs('" + messageId + "')?$format=json&$expand=CustomHeaderProperties", false, null, null, false, null, false)).d;
  } catch (error) {
    log.log(error);
    showToast("Check input data.", "Error while fetching logs. Message ID not found.", "error");
    throw Error("Message ID not found");
  }
  valueList = [];

  valueList.push({ Name: "MessageGuid", Value: input.MessageGuid });
  valueList.push({ Name: "CorrelationId", Value: input.CorrelationId });
  valueList.push({
    Name: "ApplicationMessageId",
    Value: input.ApplicationMessageId,
  });
  valueList.push({ Name: "Sender", Value: input.Sender });
  valueList.push({ Name: "Receiver", Value: input.Receiver });
  var logStart = new Date(parseInt(input.LogStart.substr(6, 13)));
  logStart.setTime(logStart.getTime() - logStart.getTimezoneOffset() * 60 * 1000);

  valueList.push({
    Name: "Start Time",
    Value: logStart.toISOString().substr(0, 23),
  });

  if (input.LogEnd) {
    var logEnd = new Date(parseInt(input.LogEnd.substr(6, 13)));
    logEnd.setTime(logEnd.getTime() - logEnd.getTimezoneOffset() * 60 * 1000);
    valueList.push({
      Name: "End Time",
      Value: logEnd.toISOString().substr(0, 23),
    });
    valueList.push({
      Name: "Duration in milliseconds",
      Value: logEnd - logStart,
    });
    valueList.push({
      Name: "Duration in seconds",
      Value: (logEnd - logStart) / 1000,
    });
    valueList.push({
      Name: "Duration in minutes",
      Value: (logEnd - logStart) / 1000 / 60,
    });
  }
  valueList.push({
    Name: "IntegrationFlowName",
    Value: input.IntegrationFlowName,
  });
  valueList.push({ Name: "Status", Value: input.Status });
  valueList.push({ Name: "LogLevel", Value: input.LogLevel });
  valueList.push({ Name: "Custom Headers", Value: "", Type: "header" });
  var customHeaderList = input.CustomHeaderProperties.results;

  if (customHeaderList.length > 0) {
    customHeaderList = customHeaderList.sort(function (a, b) {
      return a.Name.toLowerCase() > b.Name.toLowerCase() ? 1 : -1;
    });
    valueList = valueList.concat(customHeaderList);
  }

  // valueList.push({ Name: "", Value: "", Type: "" });//backup
  valueList.push({ Name: "Artifact Details", Value: "", Type: "header" });
  valueList.push({ Name: "Id", Value: input.IntegrationArtifact?.Id });
  valueList.push({ Name: "Name", Value: input.IntegrationArtifact?.Name });
  valueList.push({ Name: "Type", Value: input.IntegrationArtifact?.Type });
  valueList.push({
    Name: "PackageId",
    Value: input?.IntegrationArtifact?.PackageId,
  });
  valueList.push({
    Name: "PackageName",
    Value: input?.IntegrationArtifact?.PackageName,
  });
  valueList.push({
    Name: "Other Useful Information",
    Value: "",
    Type: "header",
  });
  valueList.push({ Name: "CustomStatus", Value: input.CustomStatus });
  valueList.push({ Name: "TransactionId", Value: input.TransactionId });
  valueList.push({
    Name: "PreviousComponentName",
    Value: input.PreviousComponentName,
  });
  valueList.push({
    Name: "LocalComponentName",
    Value: input.LocalComponentName,
  });
  valueList.push({
    Name: "OriginComponentName",
    Value: input.OriginComponentName,
  });

  result = `<div id="cpiHelper_logsInfo"><table class="ui basic striped selectable compact table">  <thead><tr class="blue"><th>Name</th><th>Value</th></tr></thead>
    <tbody>`;
  valueList.forEach((item) => {
    result += `<tr class="${item.Type == "header" ? "blue" : ""}"><td>${item.Name}</td><td style="word-break: break-all;">${htmlEscape(item.Value)}</td></tr>`;
  });
  result += "</tbody></table>";
  return result;
};

createRunLogsContent = async (messageId) => {
  entriesList = JSON.parse(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogs('" + messageId + "')/Attachments?$format=json", false));
  log.log(entriesList);

  var tabs = [];
  active = true;
  for (item of entriesList.d.results.sort(function (a, b) {
    return a.Name.toLowerCase() > b.Name.toLowerCase() ? 1 : -1;
  })) {
    tabs.push({
      label: item.Name,
      content: async (input) => {
        return formatTrace(await makeCallPromise("GET", "/" + cpiData.urlExtension + "odata/api/v1/MessageProcessingLogAttachments('" + input.item + "')/$value", false), "cpiHelper_runLogsItem" + input.item);
      },
      item: item.Id,
      active,
    });
    active = false;
  }

  var content = document.createElement("div");
  content.id = "run-logs-content";
  if (tabs.length > 0) {
    content.appendChild(await createTabHTML(tabs, "run-logs-tab"));
  } else {
    content.innerHTML =
      "No log attachements found. For more information see <a href='https://help.sap.com/viewer/368c481cd6954bdfa5d0435479fd4eaf/Cloud/en-US/17dba92e6ed4402f8cb0f05093a34269.html' target='_blank'>Create Log Attachments with Groovy</a> in the docs";
  }
  return content;
};
