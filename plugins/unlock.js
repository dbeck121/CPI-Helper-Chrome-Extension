var unlockPackageViewState = { packageId: null, lock: null, loading: false, nextFetchAt: 0 };
var unlockPackageSuppressClickUntil = 0;

function unlockPackageButtonAtEvent(event) {
  var target = event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement;
  var button = target?.closest(".cpiHelper_unlockPackage");
  if (!button) {
    button = [...document.querySelectorAll(".cpiHelper_unlockPackage")].find((candidate) => {
      var bounds = candidate.getBoundingClientRect();
      return event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    });
  }
  return button;
}

window.addEventListener(
  "pointerdown",
  (event) => {
    if (event.button !== 0 || event.isPrimary === false) {
      return;
    }
    var button = unlockPackageButtonAtEvent(event);
    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    unlockPackageSuppressClickUntil = Date.now() + 2000;
    button.unlockPackageAction?.();
  },
  true
);

window.addEventListener(
  "click",
  (event) => {
    if (event.detail > 0 && Date.now() <= unlockPackageSuppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      unlockPackageSuppressClickUntil = 0;
      return;
    }

    var button = unlockPackageButtonAtEvent(event);
    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    button.unlockPackageAction?.();
  },
  true
);

var plugin = {
  metadataVersion: "2.0.0",
  id: "unlock",
  name: "unlock plugin",
  version: "2.0.0",
  author: "Gregor Schütz",
  website: "",
  email: "gregor.b.schuetz@gmail.com",
  description: "Adds unlock buttons for artifacts in the message sidebar and locked packages in the package view.",
  settings: {},
  heartbeat: (pluginHelper) => {
    var packageId = pluginHelper.currentPackageId;
    var packageToolbar = unlockPackageToolbar();

    if (!packageId || !packageToolbar) {
      unlockPackageViewState.packageId = null;
      unlockPackageViewState.lock = null;
      unlockPackageViewState.nextFetchAt = 0;
      unlockRemovePackageButton();
      return;
    }

    if (unlockPackageViewState.packageId !== packageId) {
      unlockPackageViewState.packageId = packageId;
      unlockPackageViewState.lock = null;
      unlockPackageViewState.nextFetchAt = 0;
      unlockRemovePackageButton();
    }

    if (unlockPackageViewState.lock?.ResourceId) {
      unlockAddPackageButton(pluginHelper, packageId);
    } else {
      unlockRemovePackageButton();
    }

    if (!unlockPackageViewState.loading && Date.now() >= unlockPackageViewState.nextFetchAt) {
      unlockPackageViewState.loading = true;
      unlockPackageViewState.nextFetchAt = Date.now() + 60000;
      unlockLoadPackageLock(pluginHelper, packageId);
    }
  },
  messageSidebarContent: {
    onRender: (pluginHelper) => {
      //prepare button
      var button = document.createElement("button");
      button.innerHTML = "Unlock";

      //removes or rather deletes the lock on this artifact
      button.addEventListener("click", async () => {
        //prepare unlock
        const urlForResourceId = `/${pluginHelper.urlExtension + cpiData.runtimePathExtension}odata/api/v1/IntegrationDesigntimeLocks?$format=json`;
        var dataOfDesigntimeLocks = JSON.parse(await makeCallPromise("GET", urlForResourceId, false)).d.results;

        //get resourceid by matching the artifactid
        var lock = dataOfDesigntimeLocks.find(function (a) {
          return a.ArtifactId === pluginHelper.currentArtifactId;
        });

        //unlock artifact if locked
        if (lock?.ResourceId != undefined) {
          //undefined means it's not locked

          //calculate lock duration
          const match = lock.CreatedAt.match(/\/Date\((\d+)\)\//);
          const timeInMillis = parseInt(match[1], 10);
          const currentTime = Date.now();
          const diffInMillis = currentTime - timeInMillis;
          const diffInMinutes = diffInMillis / (1000 * 60);
          const diffInHours = diffInMinutes / 60;
          const diffInDays = Math.floor(diffInHours / 24);
          const remainingHours = Math.floor(diffInHours % 24);
          const remainingMinutes = Math.floor(diffInMinutes % 60);

          //prepare lock duration text
          var lockDurationText = "This artifact was locked ";
          if (diffInDays > 0) {
            lockDurationText += `${diffInDays}d ${remainingHours}h ${remainingMinutes}min ago.`;
          } else if (remainingHours > 0) {
            lockDurationText += `${remainingHours}h ${remainingMinutes}min ago.`;
          } else if (remainingMinutes > 0) {
            lockDurationText += `${remainingMinutes}min ago.`;
          } else {
            lockDurationText += `less than a minute ago.`;
          }

          //map status color
          var statusColor;
          if (diffInHours >= 12) {
            statusColor = "green";
          } else if (diffInHours >= 6) {
            statusColor = "yellow";
          } else if (diffInHours >= 3) {
            statusColor = "orange";
          } else if (diffInHours >= 0) {
            statusColor = "red";
          }

          var info = `
                    <div class="ui large list">
                        <div class="item">
                            <div class="content">
                                <a class="header">Integration Flow Name</a>
                                <div class="description">${lock.ArtifactName}</div>
                            </div>
                        </div>
                        <div class="item">
                            <div class="content">
                                <a class="header">Integration Package</a>
                                <div class="description">${lock.PackageName}</div>
                            </div>
                        </div>
                        <div class="item">
                            <div class="content">
                                <a class="header">Locked by</a>
                                <div class="description">${lock.CreatedBy}</div>
                            </div>
                        </div>
                        <div class="item">
                            <div class="content">
                                <a class="header">Locked since</a>
                                <div class="description">${formatDate(lock.CreatedAt)}</div>
                            </div>
                        </div>
                    </div>
                    <div class="ui grid">
                        <div class="one column centered row">
                            <div class="ui ${statusColor} tiny center aligned compact message">
                                <p><i class="info icon"></i> ${lockDurationText}</p>
                            </div>
                        </div>
                    </div>`;

          $.modal("confirm", "Lock Details", info, async function (choice) {
            try {
              dataOfDesigntimeLocks = JSON.parse(await makeCallPromise("GET", urlForResourceId, false)).d.results;

              //get resourceid by matching the artifactid
              var lock = dataOfDesigntimeLocks.find(function (a) {
                return a.ArtifactId === pluginHelper.currentArtifactId;
              });

              //unlock artifact if locked
              if (lock?.ResourceId != undefined && choice == true) {
                var urlForUnlock = `/${pluginHelper.urlExtension + cpiData.runtimePathExtension}odata/api/v1/IntegrationDesigntimeLocks(ResourceId='${lock?.ResourceId}')`;
                await makeCallPromise("DELETE", urlForUnlock, false, null, null, true);
                showToast("The artifact has been unlocked", "", "success");
                setTimeout(() => window.location.reload(), 1000);
              } else if (choice == true && lock?.ResourceId == undefined) {
                showToast("The artifact is not locked");
              }
            } catch (exception) {
              showToast("Could not unlock artifact", "", "error");
            }
          });
        } else {
          showToast("The artifact is not locked");
        }
      });

      return button;
    },
  },
};

async function unlockReadPackageLock(pluginHelper, packageId) {
  var url = `/${pluginHelper.urlExtension + cpiData.runtimePathExtension}odata/api/v1/IntegrationDesigntimeLocks?$format=json`;
  var locks = JSON.parse(await makeCallPromise("GET", url, false)).d.results;
  return locks.find((entry) => entry.ArtifactId === packageId);
}

async function unlockLoadPackageLock(pluginHelper, packageId) {
  try {
    var lock = await unlockReadPackageLock(pluginHelper, packageId);
    if (unlockPackageViewState.packageId === packageId) {
      unlockPackageViewState.lock = lock || null;
      if (lock?.ResourceId) {
        unlockAddPackageButton(pluginHelper, packageId);
      } else {
        unlockRemovePackageButton();
      }
    }
  } catch (error) {
    log.warn(`unlock: could not read the package lock for ${packageId}: ${error}`);
    if (unlockPackageViewState.packageId === packageId) {
      unlockPackageViewState.lock = null;
      unlockRemovePackageButton();
    }
  } finally {
    unlockPackageViewState.loading = false;
  }
}

function unlockRemovePackageButton() {
  document.querySelectorAll(".cpiHelper_unlockPackage").forEach((button) => {
    if (button.nextElementSibling?.matches('button[title="Edit"]')) {
      button.nextElementSibling.classList.add("sapMBarChildFirstChild");
    }
    button.remove();
  });
}

function unlockPackageToolbar() {
  return [...document.querySelectorAll('div[id$="--idObjectPageHeaderTitle-_actionsToolbar"], div[id$="--idObjectPageHeaderTitle-actionsToolbar"]')].find(
    (toolbar) => toolbar.offsetParent && [...toolbar.querySelectorAll('button[title="Edit"]')].some((button) => button.offsetParent)
  );
}

function unlockAddPackageButton(pluginHelper, packageId) {
  var toolbar = unlockPackageToolbar();
  var editButton = toolbar && [...toolbar.querySelectorAll('button[title="Edit"]')].find((element) => element.offsetParent);
  if (!toolbar || !editButton || toolbar.querySelector(".cpiHelper_unlockPackage")) {
    return;
  }

  var button = document.createElement("button");
  button.type = "button";
  button.className = `${editButton.className} cpiHelper_unlockPackage`;
  if (editButton.classList.contains("sapMBarChildFirstChild")) {
    editButton.classList.remove("sapMBarChildFirstChild");
    button.classList.add("sapMBarChildFirstChild");
  }
  button.title = "Unlock package (CPI Helper)";
  button.style.marginRight = "0.5rem";
  var innerClass = editButton.querySelector(".sapMBtnInner")?.className || "sapMBtnInner sapMBtnHoverable sapMFocusable sapMBtnText sapMBtnTransparent";
  button.innerHTML = `<span class="${innerClass}"><span class="sapMBtnContent"><bdi>Unlock</bdi></span></span>`;
  button.unlockPackageAction = () => unlockPackage(pluginHelper, packageId);
  toolbar.insertBefore(button, editButton);
}

function unlockPackage(pluginHelper, packageId) {
  var lock = unlockPackageViewState.packageId === packageId ? unlockPackageViewState.lock : null;
  if (!lock?.ResourceId) {
    unlockReadPackageLock(pluginHelper, packageId)
      .then((currentLock) => {
        if (unlockPackageViewState.packageId !== packageId) {
          return;
        }
        unlockPackageViewState.lock = currentLock || null;
        if (currentLock?.ResourceId) {
          unlockShowPackageLockDialog(pluginHelper, packageId, currentLock);
        } else {
          unlockRemovePackageButton();
          showToast("The package is not locked");
        }
      })
      .catch(() => showToast("Could not read the package lock", "", "error"));
    return;
  }

  unlockShowPackageLockDialog(pluginHelper, packageId, lock);
}

function unlockShowPackageLockDialog(pluginHelper, packageId, lock) {
  var lockTime = Number(lock.CreatedAt?.match(/\/Date\((\d+)\)\//)?.[1]);
  var diffInHours = lockTime ? (Date.now() - lockTime) / (1000 * 60 * 60) : 0;
  var diffInDays = Math.floor(diffInHours / 24);
  var remainingHours = Math.floor(diffInHours % 24);
  var remainingMinutes = Math.floor((diffInHours * 60) % 60);
  var duration =
    diffInDays > 0 ? `${diffInDays}d ${remainingHours}h ${remainingMinutes}min ago.` : remainingHours > 0 ? `${remainingHours}h ${remainingMinutes}min ago.` : remainingMinutes > 0 ? `${remainingMinutes}min ago.` : "less than a minute ago.";
  var statusColor = diffInHours >= 12 ? "green" : diffInHours >= 6 ? "yellow" : diffInHours >= 3 ? "orange" : "red";
  var info = `<div class="ui large list">
    <div class="item"><div class="content"><a class="header">Integration Package</a><div class="description">${unlockEscapeHtml(lock.PackageName || packageId)}</div></div></div>
    <div class="item"><div class="content"><a class="header">Locked by</a><div class="description">${unlockEscapeHtml(lock.CreatedBy || "-")}</div></div></div>
    <div class="item"><div class="content"><a class="header">Locked since</a><div class="description">${formatDate(lock.CreatedAt)}</div></div></div>
  </div>
  <div class="ui grid"><div class="one column centered row"><div class="ui ${statusColor} tiny center aligned compact message"><p><i class="info icon"></i> This package was locked ${duration}</p></div></div></div>`;

  $.modal("confirm", "Lock Details", info, async (choice) => {
    if (choice !== true) {
      return;
    }

    try {
      lock = await unlockReadPackageLock(pluginHelper, packageId);
      if (lock?.ResourceId) {
        var url = `/${pluginHelper.urlExtension + cpiData.runtimePathExtension}odata/api/v1/IntegrationDesigntimeLocks(ResourceId='${lock.ResourceId}')`;
        await makeCallPromise("DELETE", url, false, null, null, true);
        showToast("The package has been unlocked", "", "success");
        unlockPackageViewState.lock = null;
        unlockRemovePackageButton();
        setTimeout(() => window.location.reload(), 1000);
      } else {
        unlockPackageViewState.lock = null;
        unlockRemovePackageButton();
        showToast("The package is not locked");
      }
    } catch (error) {
      showToast("Could not unlock package", "", "error");
    }
  });
}

function unlockEscapeHtml(value) {
  var element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

//returns formatted date & time
function formatDate(timestamp) {
  const matches = timestamp.match(/\/Date\((\d+)\)\//);

  const date = new Date(parseInt(matches[1], 10));

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  const milliseconds = date.getMilliseconds().toString().padStart(3, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

pluginList.push(plugin);
