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
                var resourceId = dataOfDesigntimeLocks.find(function (a){
                    return a.ArtifactId === pluginHelper.currentArtifactId
                })?.ResourceId;
                
                //unlock artifact if locked
                if(resourceId != undefined){ //undefined means it's not locked
                    try{
                        var urlForUnlock = `/${pluginHelper.urlExtension}odata/api/v1/IntegrationDesigntimeLocks(ResourceId='${resourceId}')`;
                        await makeCallPromise("DELETE", urlForUnlock, false, null, null, true);
                        showToast("The artifact has been unlocked", "", "success");
                    }catch(exception){
                        showToast("Could not unlock artifact", "", "error");
                        console.log(exception);
                    }
                }else{
                    showToast("The artifact is not locked");
                }
            });

            return button;
        }
    }
};

pluginList.push(plugin);
