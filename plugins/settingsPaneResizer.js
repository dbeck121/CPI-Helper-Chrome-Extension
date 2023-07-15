var plugin = {
    metadataVersion: "1.0.0",
    id: "settingsPaneResizer",
    name: "Settings Pane Resizer",
    version: "1.1.1",
    author: "Philippe Addor, BMT Consulting AG, Bottighofen, Switzerland",
    email: "philippe.addor@bmtg.ch",
    website: "https://bmtg.ch",
    description: `Auto opens(*) the settings pane and keeps it at your chosen size or even dynamically adjust the height to the content! Improves your flow, reduces your pa(i)ne! ;-) <br>
                  (*) If you have configured the CPI Helper Extension to open on launch (recommended). <br>`,
    settings: {
            "text1": { "text": "Enter either settings for pane height in Pixel or percent (pixel takes precedence if both are defined; if both empty, use CPI default (50%))", "type": "label" },
            "paneHeight": { "text": "Pixel", "type": "text", scope: "browser" },
            "paneHeightPercent": { "text": "%", "type": "text", scope: "browser" },
			"dynamicResizing": { "text": "Automatic Dynamic Resizing (if pane content is lower than above configured values)", "type": "checkbox", scope: "browser" },
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
            pauseResizeButton.setAttribute("id", "pauseButton")
            
            // do a resize on each refresh to keep pane under control at all times
            doResize()
            
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

            
            // inject script to expand settings pane - only once at the first load of the page by checking if script element was already added
            if (! document.getElementById("settingsPaneResizerScript")) {
                console.log(`Loading "Settings Pane Resizer" by Philippe Addor`);
                
				// get configured height in pixel for initial resizing via UI5
				var newHeightInPct;
				if (configPaneHeightPx) {
					newHeightInPct = Math.floor((100 / view.innerHeight() * configPaneHeightPx));
				}
				else if (configPaneHeightPercent) {
					newHeightInPct =  configPaneHeightPercent;  
                }
                
                // create inline script to trigger the pane restore button in UI5
                const scriptElement = document.createElement('script');
                scriptElement.setAttribute("id", "settingsPaneResizerScript");

                scriptElement.innerHTML = `
                    function extendSettingsPane() {
                        // only press button if pane not yet expanded
                        var minButton = $('[id $="iflowSplitter-bar0-min-btn-img"]');
                        var pauseButton = $("#pauseButton");                       
                        if (minButton.length == 0 && !pauseButton.hasClass("cpiHelper_inlineInfo-active") ) {
                            //console.log("minButton not visible - expanding pane to " + "${newHeightInPct}" + "%");
                            console.log("Settings Pane expanded by CPI Helper Plugin")
                            window.sap.ui.getCore().byId( $('[id $="--iflowSplitter-bar0-restore-btn"]').eq(0).attr("id")).firePress();
                            var s = window.sap.ui.getCore().byId( $('[id^="__xmlview"][id$="-iflowSplitter"]').eq(0).attr("id"));
                            s.getContentAreas()[0].setLayoutData(new sap.ui.layout.SplitterLayoutData({ size: "${(100-newHeightInPct) + "%"}" }));
                            s.getContentAreas()[1].setLayoutData(new sap.ui.layout.SplitterLayoutData({ size: "${newHeightInPct + "%"}" }));
                            //s.invalidate();             
                        }            
                    }

                    // add trigger of resizer when page content changes (to also catch page updates via 'ajax' instead of just full page reloads)                   
                    var bodyObserver = new MutationObserver(function(mutations) {                                                                       
                        mutations.forEach(mutation => {                            
							//console.log(mutation)
                            if (mutation.target.id.includes("iflowObjectPageLayout")) {
                                extendSettingsPane();
                            }
                        });
                    });
                    var config = { childList: true, subtree: true };
                    bodyObserver.observe(document.body, config);
                    
                    // execute function once without observer (this is triggered on first page load)
                    extendSettingsPane();                    
                `;

                document.head.appendChild(scriptElement);  
        
            }

        
            // add listener to content of settings pane to immediately trigger resize when changing tab. (Doesn't work 100%, so we need to call doResize() above on each plugin refresh too)
            // use dummy html tag to save state of observer (to set it only once)
            const resizerobserver = document.getElementsByTagName("resizerobserver")[0];
            if (! resizerobserver) {
                const resizerobserver = document.createElement('resizerobserver');
                document.head.appendChild(resizerobserver);

                function callback(mutationList, obs) {                
                    mutationList.every(mutation => {                        
                        doResize();                                        
                        return false; // exit loop after first mutation
                    });
                }                      
                const observer = new MutationObserver(callback);
                const config = { childList: true, subtree: true, attributes: true, characterData: true };
                const contentDiv = document.querySelectorAll('[id $="--autoUIGenMainLayout"]')[0]; // section element with actual pane content                                      
                if (contentDiv) {
                    observer.observe(contentDiv, config);
                    //console.log("observer set")
                }
                else {
                    // settings pane wasn't loaded yet, retry on next refresh (of Messages box) by removing status HTML element again
                    document.head.removeChild(resizerobserver);
                    console.log("observer not yet set - retry")
                }                            
            }            


            //functions

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
                var newHeightInPx;
                
                // get height of view and content
                var viewHeight = view.innerHeight();
                var paneContentHeight = paneAllContent.innerHeight();	

				var minButton = $('[id $="iflowSplitter-bar0-min-btn-img"]'); // minimize button of the settings pane - only resize when this is visible (= pane expanded)

            
                // load both pause status first
                chrome.storage.local.get("paneDynResizePause", function(data) {
                    var dynPause = data.paneDynResizePause;
                    stylePauseButton(pauseDynButton, dynPause);
                    
                    chrome.storage.local.get("paneResizePause", function(data) {
                        var resizePause = data.paneResizePause;
                        stylePauseButton(pauseResizeButton, resizePause);        
                                                
                        // Reset size depending on settings and pause modes, and check if pane is expanded, otherwise don't resize
                        if (! resizePause && minButton.length == 1) {
                            workArea.stop(); // stop resize delay timer/animation if still active from previous click 

                            if (settingsPane != undefined) {
                                // configured height in pixel takes precedence
                                if (configPaneHeightPx) {
                                    newHeightInPx = configPaneHeightPx;
                                    configPaneHeightPercent = "";
                                }
                                else if (configPaneHeightPercent) {
                                    newHeightInPx =  viewHeight * configPaneHeightPercent / 100;                                    
                                }

                                // auto adjust if content is lower than configured height and pause is off
                                if ( (! dynPause) && dynamicResizing == true && (paneContentHeight + 120) <= newHeightInPx) {                    
                                    //console.log("doResize 1")
                                    newWorkAreaHeight = viewHeight - (paneContentHeight+120);
                                    newPaneHeight = (paneContentHeight + 120);
                                }

                                // height in pixel is configured
                                else if (configPaneHeightPx != "" && configPaneHeightPx != null) {			
                                    //console.log("doResize 2")
                                    newWorkAreaHeight = viewHeight - configPaneHeightPx;				                                    
                                    newPaneHeight = newHeightInPx;					                
                                }
                                // height in % is configured
                                else if (configPaneHeightPercent != "" && configPaneHeightPercent != null) {
                                    //console.log("doResize 3")
                                    newWorkAreaHeight = viewHeight * (100 - configPaneHeightPercent) / 100;
                                    newPaneHeight = newHeightInPx;
                                }
                                
                                // apply new heights     
                                applyHeights(workArea, settingsPane, paneContentVisible, newWorkAreaHeight, newPaneHeight, delaySetting);
                            }
                        }
                        // after "pause all resizing" was clicked, reset pane height to initial height to prevent ugly jumping on manual draging of the splitter
                        else if (resizePause && reset) {
                                //console.log("doResize Reset")                                
                                if (configPaneHeightPx != "" && configPaneHeightPx != null) {			
                                    newWorkAreaHeight = viewHeight - configPaneHeightPx;				                                    
                                    newPaneHeight = newHeightInPx;					                
                                }
                                else if (configPaneHeightPercent != "" && configPaneHeightPercent != null) {
                                    newWorkAreaHeight = viewHeight * (100 - configPaneHeightPercent) / 100;
                                    newPaneHeight = newHeightInPx;
                                }
                                                                
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