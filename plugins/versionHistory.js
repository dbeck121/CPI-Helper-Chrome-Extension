// Confirm the target version and allow its editable fields to be reviewed.
function showRevertConfirmation(tenant, workspace, artifact, version, currentVersion) {
  const currentVersionIsDraft = currentVersion.state === "workingcopy";
  const modal = document.createElement("div");
  modal.className = "ui small modal version-revert-modal";
  modal.innerHTML = `
    <i class="close icon"></i>
    <div class="header">Revert Version</div>
    <div class="content">
      ${currentVersionIsDraft ? '<div class="ui negative message"><strong>Info: The current version is a draft. Reverting it will cause the draft to be lost.</strong><div class="ui checkbox"><input id="version-revert-draft-acknowledgement" type="checkbox"><label for="version-revert-draft-acknowledgement">I acknowledge that the draft will be lost.</label></div></div>' : ""}
      <div class="ui form">
        <div class="field">
          <label for="version-revert-semantic">Semantic Version</label>
          <input id="version-revert-semantic" type="text">
        </div>
        <div class="field">
          <label for="version-revert-comment">Comment</label>
          <textarea id="version-revert-comment" rows="3"></textarea>
        </div>
      </div>
    </div>
    <div class="actions">
      <button class="ui button" data-revert-cancel>Cancel</button>
      <button class="ui primary button" data-revert-confirm ${currentVersionIsDraft ? "disabled" : ""}>OK</button>
    </div>`;

  const semanticVersionInput = modal.querySelector("#version-revert-semantic");
  semanticVersionInput.value = version.semanticVersion ?? "";
  const commentInput = modal.querySelector("#version-revert-comment");
  commentInput.value = version.comment ?? "";
  const draftAcknowledgement = modal.querySelector("#version-revert-draft-acknowledgement");
  const confirmButton = modal.querySelector("[data-revert-confirm]");
  draftAcknowledgement?.addEventListener("change", () => {
    confirmButton.disabled = !draftAcknowledgement.checked;
  });

  const modalContainer = document.querySelector("#cpihelperglobal") || document.body;
  modalContainer.appendChild(modal);
  const $modal = $(modal);
  let returnToVersionHistory = false;
  $modal.modal({
    detachable: false,
    blurring: true,
    closable: true,
    onHidden: () => {
      modal.remove();
      if (returnToVersionHistory) {
        $("#cpiHelper_semanticui_modal").modal("show");
      }
    },
  });
  modal.querySelector("[data-revert-cancel]").addEventListener("click", () => {
    returnToVersionHistory = true;
    $modal.modal("hide");
  });
  modal.querySelector("[data-revert-confirm]").addEventListener("click", async (event) => {
    const confirmButton = event.currentTarget;
    confirmButton.classList.add("loading", "disabled");
    await revertVersion(tenant, workspace, artifact, { ...version, semanticVersion: semanticVersionInput.value, comment: commentInput.value });
    $modal.modal("hide");
  });
  $modal.modal("show");
}

async function revertVersion(tenant, workspace, artifact, version) {
  console.log(`Reverting version: ${version.semanticVersion} (${version.technicalVersion})`);
  // Keep the payload limited to the values supported by the version API.
  const versionData = JSON.stringify({
    comment: version.comment,
    semanticVersion: version.semanticVersion,
    technicalVersion: version.technicalVersion,
  });

  const urlForRevertVersion = `https://${tenant}/api/1.0/workspace/${workspace}/artifacts/${artifact}?webdav=UPDATE`;
  // Update the artifact with the selected version data.
  var responseOfRevertVersion = await makeCallPromiseV2("PUT", urlForRevertVersion, false, null, versionData, true, "application/json");
  if (responseOfRevertVersion.successful && responseOfRevertVersion.status >= 200 && responseOfRevertVersion.status < 300) {
    showToast(`The artifact version was reverted successfully (${version.semanticVersion}).`, "Version History", "success");
    setTimeout(() => window.location.reload(), 1000);
  } else {
    showToast(`Failed to revert the artifact version (HTTP ${responseOfRevertVersion.status ?? "unknown"}).`, "Version History", "error");
  }
}

var plugin = {
  metadataVersion: "1.0.0",
  id: "versionHistory",
  name: "Version History",
  version: "1.0.0",
  author: "Gregor Schütz",
  email: "gregor.b.schuetz@gmail.com",
  website: "",
  description: "Manage and view the version history of iFlows within the editor.",
  settings: {},
  messageSidebarContent: {
    static: true,
    onRender: (pluginHelper) => {
      var div = document.createElement("div");
      var button = document.createElement("button");
      button.innerHTML = "View & Manage";

      button.onclick = async (x) => {
        const urlForWorkspace = `https://${pluginHelper.tenant}/api/1.0/workspace`;
        // Find the workspace that contains the current package.
        var dataOfWorkspaces = JSON.parse(await makeCallPromise("GET", urlForWorkspace, false));
        const workspace = dataOfWorkspaces.find((entry) => entry.technicalName === pluginHelper.currentPackageId).id;

        const urlForArtifactsInWorkspace = `https://${pluginHelper.tenant}/api/1.0/workspace/${workspace}/artifacts`;
        // Find the current iFlow artifact in that workspace.
        var dataOfArtifactsInWorkspace = JSON.parse(await makeCallPromise("GET", urlForArtifactsInWorkspace, false));
        const artifact = dataOfArtifactsInWorkspace.find((entry) => entry.name === pluginHelper.currentIflowId).id;

        const urlForVersionHistory = `https://${pluginHelper.tenant}/api/1.0/workspace/${workspace}/artifacts/${artifact}?versionhistory=true&webdav=REPORT`;
        // Load the artifact's version history.
        var dataOfVersionHistory = JSON.parse(await makeCallPromise("PUT", urlForVersionHistory, false, null, null, true));

        const popupContent = document.createElement("div");
        if (!dataOfVersionHistory || dataOfVersionHistory.length === 0) {
          popupContent.innerHTML = "<p>No version history found.</p>";
        } else {
          // The highest technical version is the currently active version.
          const currentVersion = dataOfVersionHistory.reduce((highestVersion, version) => {
            return Number(version.technicalVersion) > Number(highestVersion.technicalVersion) ? version : highestVersion;
          });
          let tableHtml = `<table class="ui celled table"> 
                              <thead> 
                                <tr class="blue"> 
                                  <th>Comment</th> 
                                  <th>Semantic Version</th> 
                                  <th>Technical Version</th> 
                                  <th>Created Date</th> 
                                  <th>Created By</th> 
                                  <th>State</th> 
                                  <th>Revert</th> 
                                </tr> 
                              </thead><tbody> `;
          dataOfVersionHistory.forEach((version, index) => {
            const createdDate = new Date(Number(version.createdDate)).toLocaleString();
            const isCurrentVersion = version === currentVersion;
            tableHtml += `<tr ${isCurrentVersion && version.state == "workingcopy" ? 'class="red"' : 'class="yellow"'}> 
                            <td data-label="Comment">${version.comment ?? ""}</td> 
                            <td data-label="Semantic Version">${version.semanticVersion ?? ""}</td> 
                            <td data-label="Technical Version">${version.technicalVersion ?? ""}</td> 
                            <td data-label="Created Date">${createdDate}</td> 
                            <td data-label="Created By">${version.createdBy ?? ""}</td> 
                            <td data-label="State">${version.state ?? ""}</td> 
                            <td data-label="Revert">
                              ${isCurrentVersion ? "Current Version" : `<button class="ui button" data-version-index="${index}">Revert</button>`}
                            </td> 
                          </tr>`;
          });
          tableHtml += `</tbody> </table>`;
          popupContent.innerHTML = tableHtml;
          popupContent.querySelectorAll("[data-version-index]").forEach((revertButton) => {
            const version = dataOfVersionHistory[Number(revertButton.dataset.versionIndex)];
            revertButton.addEventListener("click", () => showRevertConfirmation(pluginHelper.tenant, workspace, artifact, version, currentVersion));
          });
        }
        pluginHelper.functions.popup(popupContent, "Version History");
      };

      div.appendChild(button);

      return div;
    },
  },
};

pluginList.push(plugin);
