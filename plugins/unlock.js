var plugin = {
    metadataVersion: "1.0.0",
    id: "unlock",
    name: "unlock plugin",
    version: "1.0.0",
    author: "Gregor Schütz, AGILITA AG",
    website: "https://www.agilita.ch/",
    email: "gregor.schuetz@agilita.ch",
    description: "Adds an unlock button to the message sidebar.",
    settings: {
        "icon": { "type": "icon", "src": "/images/plugin_logos/AGILITAAG_Logo.jpg" }
    },
    messageSidebarContent: {
        "onRender": (pluginHelper) => {
            //prepare button
            var button = document.createElement("button");
            button.innerHTML = "Unlock";

            //removes or rather deletes the lock on this artifact
            button.addEventListener("click", async () => {
                //prepare unlock
                const urlForResourceId = `/${pluginHelper.urlExtension}odata/api/v1/IntegrationDesigntimeLocks?$format=json`;
                var dataOfDesigntimeLocks = JSON.parse(await makeCallPromise("GET", urlForResourceId, false)).d.results;

                //get resourceid by matching the artifactid
                var lock = dataOfDesigntimeLocks.find(function (a){
                    return a.ArtifactId === pluginHelper.currentArtifactId
                });
                
                //unlock artifact if locked
                if(lock?.ResourceId != undefined){ //undefined means it's not locked

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
                    if(diffInDays > 0){
                        lockDurationText += `${diffInDays}d ${remainingHours}h ${remainingMinutes}min ago.`;
                    } else if(remainingHours > 0){
                        lockDurationText += `${remainingHours}h ${remainingMinutes}min ago.`;
                    } else if(remainingMinutes > 0){
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

                    $.modal('confirm', 'Lock Details', info, async function(choice){
                        try{
                            dataOfDesigntimeLocks = JSON.parse(await makeCallPromise("GET", urlForResourceId, false)).d.results;

                            //get resourceid by matching the artifactid
                            var lock = dataOfDesigntimeLocks.find(function (a){
                                return a.ArtifactId === pluginHelper.currentArtifactId
                            });

                            //unlock artifact if locked
                            if(lock?.ResourceId != undefined && choice == true){
                                var urlForUnlock = `/${pluginHelper.urlExtension}odata/api/v1/IntegrationDesigntimeLocks(ResourceId='${lock?.ResourceId}')`;
                                await makeCallPromise("DELETE", urlForUnlock, false, null, null, true);
                                showToast("The artifact has been unlocked", "", "success");
                            }else if(choice == true && lock?.ResourceId == undefined){
                                showToast("The artifact is not locked");
                            }
                        }catch(exception){
                            showToast("Could not unlock artifact", "", "error");
                        }
                    });
                } else {
                    showToast("The artifact is not locked");
                }
            });

            return button;
        }
    }
};

//returns formatted date & time
function formatDate(timestamp) {
    const matches = timestamp.match(/\/Date\((\d+)\)\//);

    const date = new Date(parseInt(matches[1], 10));

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

pluginList.push(plugin);