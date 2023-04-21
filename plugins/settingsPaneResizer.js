var plugin = {
    metadataVersion: "1.0.0",
    id: "settingsPaneResizer",
    name: "Settings Pane Resizer",
    version: "1.0.0",
    author: "Philippe Addor, BMT Consulting AG, Bottighofen, Switzerland",
    email: "philippe.addor@bmtg.ch",
    website: "https://bmtg.ch",
    description: `Settings Pane Resizer - Auto opens(*) the settings pane and keeps it at your chosen size or even dynamically adjust the height to the content! Improves your flow, reduces your pa(i)ne! ;-) <br>
                  (*) If you have configured the CPI Helper Extension to open on launch (recommended). <br>`,
    settings: {
            "text1": { "text": "Enter either settings for pane height in Pixel or percent (pixel takes precedence if both are defined; if both empty, use CPI default (50%))", "type": "label" },
            "paneHeight": { "text": "Pixel", "type": "text", scope: "browser" },
            "paneHeightPercent": { "text": "%", "type": "text", scope: "browser" },
			"dynamicResizing": { "text": "Automatic Dynamic Resizing", "type": "checkbox", scope: "browser" },
            "delay": { "text": "Dynamic Resizing Delay in ms (0 = no delay, empty = default 500) (refresh page to take effect)", "type": "text", scope: "browser" }
        },        
    messageSidebarContent: {
        "static": false,
        "onRender": (pluginHelper, settings) => {

            var reset = false;

            // load settings
            var configPaneHeightPx = settings["settingsPaneResizer---paneHeight"];
            var configPaneHeightPercent = settings["settingsPaneResizer---paneHeightPercent"];
            var delaySetting = settings["settingsPaneResizer---delay"];
            delaySetting = (delaySetting == "" || delaySetting == undefined ? 500 : settings["settingsPaneResizer---delay"]);
            var dynamicResizing = (settings["settingsPaneResizer---dynamicResizing"] ? true : false);        

            // get element references (by partial selector due to sometimes changing ID prefixes)
            const view = $('[id $="iflowObjectPageLayout-scroll"]'); // upper and lower split areas together
            const workArea = $('[id $="iflowSplitter-content-0"]'); // upper split area, work area
            const settingsPane = $('[id $="iflowSplitter-content-1"]'); // lower split area (settings pane) incl. tabs/title bars (has height attr.)
            const paneAllContent = $('[id $="iflowPropertySheetView--iflowPropLayout"]'); // actual settings data container (also invisible part), no height attr.            
            const paneContentVisible = $('[id $="iflowPropertySheetView--propertySheetPageContainer"]'); // div with visible part of data sheet (has height attr.)

            // create button/text in messages window
            var div = document.createElement("div");        	
            var pauseDynButton = document.createElement("button");               
            var pauseResizeButton = document.createElement("button");   

            if (dynamicResizing == true) {
                var text = document.createElement('div');
                text.innerHTML = "<div>Dyn Resizing:</div>";
                pauseDynButton.innerHTML = "Pause";
                div.appendChild(text);
                div.appendChild(pauseDynButton);
            }
            else {
                var text = document.createElement('div');
                text.innerHTML = "<div>Dyn Resizing deactivated</div>";
                div.appendChild(text);
            }
            var text = document.createElement('div');
            text.innerHTML = "<div>All Resizing:</div>";
            pauseResizeButton.innerHTML = "Pause";
            div.appendChild(text);
            div.appendChild(pauseResizeButton);
        
            // bind pause toggle logic to buttons
            pauseDynButton.addEventListener("click", async () => { 
                // read current pause state
                await chrome.storage.local.get("paneDynResizePause", function(data) {                
                    // invert status and save back to storage
                    let pause = !data.paneDynResizePause;                
                    chrome.storage.local.set({ "paneDynResizePause": pause });
                    doResize();
                });
            });
            pauseResizeButton.addEventListener("click", async () => { 
                // read current pause state
                await chrome.storage.local.get("paneResizePause", function(data) {                
                    // invert status and save back to storage
                    let pause = !data.paneResizePause;                
                    chrome.storage.local.set({ "paneResizePause": pause });
                    reset = true;
                    doResize();
                });
            });

            
            // expand setting pane, only once at the first load of the page (by checking if script element was already added)
            if (! document.getElementById("settingsPaneResizerScript")) {
                console.log(`Loading "Settings Pane Resizer" by Philippe Addor`);
                
                // create inline script to trigger the pane restore button in UI5
                const scriptElement = document.createElement('script');
                scriptElement.setAttribute("id", "settingsPaneResizerScript");
                    
                scriptElement.innerHTML = `
                    $( document ).ready( window.sap.ui.getCore().byId( $('[id $="--iflowSplitter-bar0-restore-btn"]').eq(0).attr("id")).firePress() );
                    `;
                                
                document.head.appendChild(scriptElement);
                            
                // add listener (once) to tabs of the settings pane to immediately trigger resize when changing tab. 
                const contentDiv = document.querySelectorAll('[id $="iflowPropertySheetView--propertySheetPageContainer-cont"]')[0]; // section element with actual pane content
            
                const observer = new MutationObserver(function(mutations) {                        
                    doResize();
                });
                const config = { childList: true, characterData: true, subtree: true };
                observer.observe(contentDiv, config);    
            }

            doResize(); // trigger a resize to keep pane under control at all times
        
            
            function stylePauseButton(button, pause) {
                if (pause) {                            
                    button.classList.add("cpiHelper_inlineInfo-active");                            
                }
                else {
                    button.classList.remove("cpiHelper_inlineInfo-active");                            
                } 
            }

            function applyHeights(workArea, settingsPane, paneContentVisible, workAreaHeight, paneHeight, delay) {
                workArea.stop().delay(delay).animate({height: workAreaHeight + 'px'});                                                      
                settingsPane.css("height", paneHeight + 'px');
                paneContentVisible.css("height", (paneHeight - 90) + 'px'); 
            }

            // Resizing function
            function doResize() {                        
                var newWorkAreaHeight;
                var newPaneHeight;
                
                // get height of view and content
                var viewHeight = view.innerHeight();
                var paneContentHeight = paneAllContent.innerHeight();	

                // load both pause status first
                chrome.storage.local.get("paneDynResizePause", function(data) {
                    var dynPause = data.paneDynResizePause;
                    stylePauseButton(pauseDynButton, dynPause);
                    
                    chrome.storage.local.get("paneResizePause", function(data) {
                        var resizePause = data.paneResizePause;
                        stylePauseButton(pauseResizeButton, resizePause);        
                        
                        // Reset size depending on settings and pause modes
                        if (! resizePause) {
                            workArea.stop(); // stop resize delay timer/animation if still active from previous click 

                            if (settingsPane != undefined) {

                                // auto adjust if content is lower than configured height in Px and pause is off
                                if ( (! dynPause) && dynamicResizing == true && configPaneHeightPx != "" && (paneContentHeight + 120) <= configPaneHeightPx) {                    
                                    newWorkAreaHeight = viewHeight - (paneContentHeight+120);
                                    newPaneHeight = (paneContentHeight + 120);
                                }
                                // height in pixel is configured
                                else if (configPaneHeightPx != "" && configPaneHeightPx != null) {			
                                    newWorkAreaHeight = viewHeight - configPaneHeightPx;				
                                    newPaneHeight = configPaneHeightPx;					                     
                                }
                                // height in % is configured
                                else if (configPaneHeightPercent != "" && configPaneHeightPercent != null) {
                                    newWorkAreaHeight = viewHeight * (100 - configPaneHeightPercent) / 100;
                                    newPaneHeight = viewHeight * configPaneHeightPercent / 100;
                                } 
                                
                                // apply new heights     
                                applyHeights(workArea, settingsPane, paneContentVisible, newWorkAreaHeight, newPaneHeight, delaySetting);
                            }
                        }
                        // after "pause all resizing" was clicked, reset pane height to default (50%) to prevent ugly jumping on manual draging of the splitter
                        else if (resizePause && reset) {
                            newWorkAreaHeight = viewHeight / 2;
                            newPaneHeight = viewHeight / 2;
                            applyHeights(workArea, settingsPane, paneContentVisible, newWorkAreaHeight, newPaneHeight, delaySetting);
                            reset = false;  // reset only once on pause              
                        }
                    });
                });
            }	
            
        // return div for CPI Helper side bar
        return div;
        
        }
    }

};

pluginList.push(plugin);