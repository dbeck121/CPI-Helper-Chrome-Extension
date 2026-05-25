// ============================================================================
// CPI Helper — content script · iflowInfo
// Extracted from scripts/contentScript.js lines 756-1248 during the
// 2026-05-26 contentScript decomposition refactor. Behaviour unchanged.
// ============================================================================

async function getIflowInfo(callback, silent = false, cache = true) {
  result = null;
  if (cpiData.cpiPlatform == "cf") {
    result = await getIflowInfoCf(callback, silent, cache);
  } else if (cpiData.cpiPlatform == "neo") {
    result = await getIflowInfoNeo(callback, silent, cache);
  }

  //update text and color of deployment status in message sidebar if element is there
  let deploymentText = document.getElementById("deploymentText");
  if (deploymentText) {
    let deployState = cpiData?.flowData?.artifactInformation?.deployState;
    if (!deployState || deployState == "") {
      deployState = "UNKNOWN";
    }

    let statusColor = getStatusColorCode(deployState);
    deploymentText.innerHTML = `<span style="color:${statusColor}">${deployState}</span>`;
  }
  return result;
}

async function getIflowInfoCf(callback, silent = false, cache = true) {
  let cacheValue = 3000;
  if (!cache) {
    cacheValue = false;
  }
  try {
    //Get Runtime Locations
    const runtimeLocResp = await makeCallPromiseV2("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.srv.web.cf.RuntimeLocationListCommand", cacheValue, null, null, null, null, silent);

    if (!runtimeLocResp.successful) {
      throw "Error fetching runtime locations: " + runtimeLocResp.message;
      return false;
    }

    const runtimeLocJson = new XmlToJson().parse(runtimeLocResp.responseText)["com.sap.it.op.srv.web.cf.RuntimeLocationListResponse"];

    //collect list of runtime locations
    if (runtimeLocJson.runtimeLocations?.length) {
      cpiData.runtimeLocations = runtimeLocJson.runtimeLocations.map((loc) => {
        return {
          id: loc.id,
          state: loc.state,
          type: loc.type,
          typeId: loc.typeId,
        };
      });
    } else {
      cpiData.runtimeLocations = [{ id: runtimeLocJson.runtimeLocations.id, state: runtimeLocJson.runtimeLocations.state, type: runtimeLocJson.runtimeLocations.type, typeId: runtimeLocJson.runtimeLocations.typeId }];
    }

    // filter for active runtime locations
    cpiData.runtimeLocations = cpiData.runtimeLocations.filter((loc) => loc.state.toUpperCase() == "ACTIVE");

    if (cpiData.runtimeLocations.length == 0) {
      throw "No active runtime locations found. Please check your environment.";
    }

    //iterate all runtime locations to find the ones that have active iflows
    cacheValue = 500; // default cache value for the next calls
    if (!cpiData.runtimeLocationWithActiveIFlow || cpiData.runtimeLocationWithActiveIFlow.length == 0) {
      cacheValue = 120;
    } else {
      cpiData.runtimeLocationWithActiveIFlow = [];
    }

    //overwrite cache value if no cache
    if (!cache) {
      cacheValue = false;
    }

    runtimeLocationWithActiveIFlow = [];
    for (const loc of cpiData.runtimeLocations) {
      try {
        const symbolicName = cpiData.integrationFlowId;
        const resp = await makeCallPromiseV2("GET", `/api/v1/IntegrationRuntimeArtifacts('${symbolicName}')?$format=json`, cacheValue, "application/json", null, null, null, !silent);

        if (!resp.successful) {
          // 404 means IFlow not deployed on this runtime location (expected)
          if (resp.status === 404) {
            log.debug(`IFlow ${symbolicName} not found on runtime location ${loc.id}`);
            continue;
          }
          // Other errors (500, network issues, etc.)
          log.warn(`Error fetching artifact for runtime location ${loc.id}: ${resp.statusText}`);
          continue;
        }

        const respJson = JSON.parse(resp.responseText);
        const artifact = respJson.d; // OData v4 wraps data in 'd' property

        // Map OData field names to plugin's expected structure
        if (artifact) {
          artifact.symbolicName = symbolicName;
          artifact.id = artifact.Id;
          artifact.version = artifact.Version;
          artifact.deployState = artifact.Status;
          artifact.deployedOn = artifact.DeployedOn;
          artifact.deployedBy = artifact.DeployedBy;
          artifact.name = artifact.Name || symbolicName; // Fallback to symbolicName if Name not present
        }

        if (artifact) {
          // collect information about current tenant and artifact if runtime location matches the selected one. this is needed to avoid another call to get the artifact information later, because we already have it here
          if (cpiData.runtimeLocationId && loc.id == cpiData.runtimeLocationId) {
            cpiData.flowData.artifactInformation.lastUpdate = new Date().toISOString();
            cpiData.flowData.artifactInformation.artifactId = artifact.id || null;
            cpiData.flowData.artifactInformation.version = artifact.version || null;
            cpiData.flowData.artifactInformation.deployState = artifact.deployState || null;
            cpiData.flowData.artifactInformation.deployedOn = artifact.deployedOn || null;
            cpiData.flowData.artifactInformation.name = artifact.name || null;
            cpiData.flowData.artifactInformation.symbolicName = artifact.symbolicName || null;
            cpiData.flowData.artifactInformation.id = artifact.id || null;
            cpiData.flowData.artifactInformation.semanticState = artifact.semanticState || null;
            cpiData.flowData.artifactInformation.deployedBy = artifact.deployedBy || null;
            cpiData.flowData.manualSetUndeployed = false;
          }

          runtimeLocationWithActiveIFlow.push({
            id: loc.id,
            state: loc.state,
            type: loc.type,
            typeId: loc.typeId,
            artifact: artifact,
          });
        }
      } catch (locError) {
        log.warn("Error fetching runtime location " + loc.id + ": ", locError);
        continue;
      }
    }

    if (cpiData.runtimeLocationId && !runtimeLocationWithActiveIFlow.find((loc) => loc.id == cpiData.runtimeLocationId)) {
      log.warn("No active IFlow found for location " + cpiData.runtimeLocationId);
      cpiData.flowData.artifactInformation.deployState = "UNDEPLOYED";
      cpiData.flowData.artifactInformation.deployedOn = null;
      cpiData.flowData.artifactInformation.deployedBy = null;
    }

    //check that there are no dublicates in runtimeLocationWithActiveIFlow, if yes, log it and remove duplicates
    const uniqueIds = new Set();
    runtimeLocationWithActiveIFlow = runtimeLocationWithActiveIFlow.filter((loc) => {
      if (uniqueIds.has(loc.id)) {
        log.warn("Duplicate runtime location found: " + loc.id + ". This should not happen, please check the environment.");
        return false;
      } else {
        uniqueIds.add(loc.id);
        return true;
      }
    });

    /*
    runtimeLocationWithActiveIFlowTemp = [];
    for (const loc of runtimeLocationWithActiveIFlow) {
      try {
        // 4. Detaildaten holen
        const detailResp = await makeCallPromiseV2(
          "GET",
          "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentDetailCommand?artifactId=" + loc.artifact.id + "&runtimeLocationId=" + loc.id,
          90,
          "application/json",
          null,
          null,
          null,
          silent
        );

        if (!detailResp.successful) {
          log.warn("Error fetching detail for location " + loc.id + ": " + detailResp.message);
          continue;
        }

        const detail = JSON.parse(detailResp.responseText);

        runtimeLocationWithActiveIFlowTemp.push({
          detail: detail,
          artifact: detail.artifactInformation,
          artifactId: detail.artifactInformation?.id,
          tenantId: detail.artifactInformation?.tenantId,
          version: detail.artifactInformation?.version,
          id: loc.id,
          state: loc.state,
          type: loc.type,
          typeId: loc.typeId,
        });
      } catch (detailError) {
        log.warn("Error fetching detail for location " + loc.id + ": ", detailError);
        continue;
      }
    }

    cpiData.runtimeLocationWithActiveIFlow = runtimeLocationWithActiveIFlowTemp;

    //default
    if (!cpiData.runtimeLocationId) {
      if (cpiData.runtimeLocationWithActiveIFlow.length == 0) {
        log.warn("No runtime location with active IFlow found. Set default to cloudintegration.");
        setRuntimeLocation({ id: "cloudintegration" });
      } else {
        setRuntimeLocation(cpiData.runtimeLocationWithActiveIFlow.find((loc) => loc.id == "cloudintegration") || cpiData.runtimeLocationWithActiveIFlow[0]);
      }
    }

    setRuntimeLocation(
      cpiData.runtimeLocationWithActiveIFlow.find((loc) => loc.id === cpiData.runtimeLocationId),
      true
    );

    */

    /*   if (cpiData.runtimeLocationId) {
      if (cpiData.runtimeLocationWithActiveIFlow.length == 0) {
        log.warn("Previously selected runtime location " + cpiData.runtimeLocationId + " is not available anymore and no runtime location with active IFlow found. Please deploy the IFlow or check your environment.");
        setRuntimeLocation({ id: "cloudintegration" });
      } else if (!cpiData.runtimeLocationWithActiveIFlow.find((loc) => loc.id === cpiData.runtimeLocationId)) {
        if (cpiData.runtimeLocationWithActiveIFlow.length > 0) {
          showToast("The previously selected runtime location " + cpiData.runtimeLocationId + " is not available anymore. Runtime location switched to " + cpiData.runtimeLocationWithActiveIFlow[0].id, "Runtime location switched", "warning");
          setRuntimeLocation(cpiData.runtimeLocationWithActiveIFlow[0], true);
        } else {
          log.warn("Previously selected runtime location " + cpiData.runtimeLocationId + " is not available anymore and no other runtime location with active IFlow found. Please deploy the IFlow or check your environment.");
          setRuntimeLocation({ id: "cloudintegration" });
        }
      } else {
        //update
        setRuntimeLocation(
          cpiData.runtimeLocationWithActiveIFlow.find((loc) => loc.id === cpiData.runtimeLocationId),
          true
        );
      }
    }
      */

    if (callback) callback();
  } catch (error) {
    log.error("Error getting Iflow Info: ", error);
    if (!silent) showToast("Error: " + JSON.stringify(error));
  }
}

async function setRuntimeLocation(location, silent = false) {
  change = false;
  //check if this is a change of runtime location
  if (cpiData.runtimeLocationId && cpiData.runtimeLocationId !== location.id) {
    change = true;
    log.debug(`Runtime location switched to: ${location.id}`);
    lastCompletedLogStart = getLastCompletedLogStart();
    cpiData.messageSidebar.lastMessageHashList = [];
    lastMessageResponses = [];
    //reset all entries in message sidebar to avoid issues with different runtime locations
    let messageList = document.getElementById("messageList");
    if (messageList) {
      messageList.innerHTML = "";
    }
  }

  cpiData.runtimeLocationId = location.id;
  if (location.id != "cloudintegration") {
    cpiData.runtimePathExtension = `location/${location.id}/`;
  } else {
    cpiData.runtimePathExtension = "";
  }

  log.debug(`Runtime location set to: ${cpiData.runtimeLocationId}`);

  if (!change) {
    //do not update if runtime location is the same, to avoid unnecessary refreshes
    return;
  }

  // update sidebar runtime info if sidebar is active
  try {
    const updatedTextElem = document.getElementById("cpiHelper_sidebar_refresh_text");
    if (updatedTextElem) {
      if (cpiData.runtimeLocationId && cpiData.runtimeLocations && cpiData.runtimeLocations.length > 1) {
        updatedTextElem.innerHTML = "Runtime: " + cpiData.runtimeLocationId + "<br>Update: Wait for refresh";
      } else {
        updatedTextElem.innerHTML = "Update: Wait for refresh";
      }
      if (change) {
        await getIflowInfo(null, true, false);

        await renderMessageSidebar(false);
      }
    }
  } catch (e) {
    // ignore if DOM not available
    log.debug("sidebar runtime text update failed", e);
  }

  if (!silent) {
    showToast(`Runtime location set to: ${cpiData.runtimeLocationId}`, "info");
  }
}

async function getIflowInfoExtended(silent = true) {
  id = null;
  if (cpiData.cpiPlatform == "neo") {
    cpiData.flowData.artifactInformation?.id;
  }

  if (cpiData.cpiPlatform == "cf") {
    //we do this to get tenant and artifact uuid

    runtimeLocationWithActiveIFlowTemp = [];

    try {
      //Get Runtime Locations
      const runtimeLocResp = await makeCallPromiseV2("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.srv.web.cf.RuntimeLocationListCommand", null, null, null, null, null, silent);

      if (!runtimeLocResp.successful) {
        throw "Error fetching runtime locations: " + runtimeLocResp.message;
        return false;
      }

      const runtimeLocJson = new XmlToJson().parse(runtimeLocResp.responseText)["com.sap.it.op.srv.web.cf.RuntimeLocationListResponse"];

      //collect list of runtime locations
      if (runtimeLocJson.runtimeLocations?.length) {
        cpiData.runtimeLocations = runtimeLocJson.runtimeLocations.map((loc) => {
          return {
            id: loc.id,
            state: loc.state,
            type: loc.type,
            typeId: loc.typeId,
          };
        });
      } else {
        cpiData.runtimeLocations = [{ id: runtimeLocJson.runtimeLocations.id, state: runtimeLocJson.runtimeLocations.state, type: runtimeLocJson.runtimeLocations.type, typeId: runtimeLocJson.runtimeLocations.typeId }];
      }

      // filter for active runtime locations
      cpiData.runtimeLocations = cpiData.runtimeLocations.filter((loc) => loc.state.toUpperCase() == "ACTIVE");

      if (cpiData.runtimeLocations.length == 0) {
        throw "No active runtime locations found. Please check your environment.";
      }

      //iterate all runtime locations to find the ones that have active iflows
      if (!cpiData.runtimeLocationWithActiveIFlow || cpiData.runtimeLocationWithActiveIFlow.length == 0) {
      } else {
        cpiData.runtimeLocationWithActiveIFlow = [];
      }

      runtimeLocationWithActiveIFlow = [];
      for (const loc of cpiData.runtimeLocations) {
        try {
          const locIdParam = "?runtimeLocationId=" + loc.id;
          const resp = await makeCallPromiseV2("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListCommand" + locIdParam, null, null, null, null, null, silent);

          if (!resp.successful) {
            log.warn("Error fetching integration components for runtime location " + loc.id + ": " + resp.message);
            continue;
          }

          const respJson = new XmlToJson().parse(resp.responseText)["com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListResponse"];
          const artifact = Array.isArray(respJson.artifactInformations)
            ? respJson.artifactInformations.find((e) => e.symbolicName == cpiData.integrationFlowId)
            : respJson.artifactInformations?.symbolicName == cpiData.integrationFlowId
              ? respJson.artifactInformations
              : null;
          if (artifact) {
            // collect information about current tenant and artifact if runtime location matches the selected one. this is needed to avoid another call to get the artifact information later, because we already have it here
            if (cpiData.runtimeLocationId && loc.id == cpiData.runtimeLocationId) {
              cpiData.tenantId = artifact.tenantId || null;
              id = artifact.id || null;
            }

            runtimeLocationWithActiveIFlow.push({
              id: loc.id,
              state: loc.state,
              type: loc.type,
              typeId: loc.typeId,
              artifact: artifact,
            });
          }
        } catch (locError) {
          log.warn("Error fetching runtime location " + loc.id + ": ", locError);
          continue;
        }
      }
    } catch (error) {
      log.error("Error getting Iflow Info: ", error);
      if (!silent) showToast("Error: " + JSON.stringify(error));
    }
  }

  cpiData.artifactUuid = id;

  for (const loc of cpiData.runtimeLocations) {
    try {
      // 4. Detaildaten holen
      const detailResp = await makeCallPromiseV2(
        "GET",
        "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentDetailCommand?artifactId=" + id + "&runtimeLocationId=" + loc.id,
        null,
        "application/json",
        null,
        null,
        null,
        !silent
      );

      if (!detailResp.successful) {
        log.warn("Error fetching detail for location " + loc.id + ": " + detailResp.message);
        continue;
      }

      const detail = JSON.parse(detailResp.responseText);

      runtimeLocationWithActiveIFlowTemp.push({
        detail: detail,
        artifact: detail.artifactInformation,
        artifactId: detail.artifactInformation?.id,
        tenantId: detail.artifactInformation?.tenantId,
        version: detail.artifactInformation?.version,
        id: loc.id,
        state: loc.state,
        type: loc.type,
        typeId: loc.typeId,
      });

      if (loc.id === cpiData.runtimeLocationId) {
        cpiData.flowData.endpointInformation = detail.endpointInformation || null;
        cpiData.flowData.logConfiguration = detail.logConfiguration || null;
      }
    } catch (detailError) {
      log.warn("Error fetching detail for location " + loc.id + ": ", detailError);
      continue;
    }
  }

  cpiData.runtimeLocationWithActiveIFlow = runtimeLocationWithActiveIFlowTemp;
}

async function getIflowInfoNeo(callback, silent = false, cache = true) {
  let cacheValue = 500;
  if (cache) {
    cacheValue = false;
  }
  return makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListCommand", cacheValue, null, null, null, null, !silent)
    .then((response) => {
      // load all non-Edge iflows and search the currently opened Iflow
      response = new XmlToJson().parse(response)["com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentsListResponse"];
      var resp = response.artifactInformations;

      if (resp.length) {
        resp = resp.find((element) => {
          return element.symbolicName == cpiData.integrationFlowId;
        });
      } else {
        if (resp.symbolicName != cpiData.integrationFlowId) {
          resp = null;
        }
      }

      // If no valid response was found (because the flow is not deployed...), throw an error
      if (!resp) {
        throw "Integration Flow was not found. Probably it is not deployed.";
      }

      return resp;
    })
    .then((response) => {
      if (response) {
        return makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.IntegrationComponentDetailCommand?artifactId=" + response.id, 60, "application/json", null, null, null, !silent);
      }
    })
    .then((response) => {
      var resp = JSON.parse(response);
      cpiData.flowData = resp;
      cpiData.flowData.lastUpdate = new Date().toISOString();
      cpiData.tenantId = cpiData?.flowData?.artifactInformation?.tenantId;
      cpiData.artifactId = cpiData?.flowData?.artifactInformation?.id;
      cpiData.version = cpiData?.flowData?.artifactInformation?.version;

      // Update runtime location dropdown if it exists
      if (cpiData.functions.updateRuntimeLocationDropdown) {
        cpiData.functions.updateRuntimeLocationDropdown();
      }

      if (callback) {
        callback();
      }
      return;
    })
    .catch((error) => {
      if (!silent) {
        showToast("Error: " + JSON.stringify(error));
      }
    });
}
