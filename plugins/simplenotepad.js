var plugin = {
    metadataVersion: "1.0.0",
    id: "simplenotepad",
    name: "simple notepad plugin",
    version: "1.0.0",
    author: "Kangoolutions",
    email: "cpihelper@kangoolutions.com",
    website: "https://kangoolutions.com",
    description: "Adds an button to the message sidebar to open a simple notepad. The data you enter is only stored in your browser for you. You can use this to store data that you need during development like property names or naming conventions. It is just for your convenience. Other developers will not see what you have written.",

    settings: {
        "text1": { "text": "There are no additional settings.", "type": "label" }
    },

    messageSidebarContent: {
        "onRender": (pluginHelper, settings) => {
            var button = document.createElement("button");
            button.innerText = "Open Notepad";
            button.addEventListener("click", async () => {
                console.log("helper plugin clicked");
                


  var textElement = `
  <div>
        <div class="ui icon positive message">
        <i class="info icon"></i>
            <div class="content">
                <div class="header">
                    Privacy Hint.
                </div>
                <p>The entered data is only stored in your browser. Depending on your global synchronization settings, it might be synced to other browser instances with the same synchronization account (e.g. Google Account in Chrome Browser).</p>
            </div>
        </div>
        <div class="ui segment">
            <div class="ui top attached tabular menu">
                <a class="item active" data-tab="one">Current IFlow Notes</a>
                <a class="item" data-tab="two">Tenant Notes</a>
                <a class="item" data-tab="three">Global Notes</a>
            </div>
            <div class="ui bottom attached tab segment active" data-tab="one">
                <div class="ui form">
                    <button class="ui primary button" id="cpiHelper_local_textbox_save">save</button>
                    <button class="ui button" id="cpiHelper_local_textbox_refresh">refresh</button>
                    <div class="field" style="margin-top:1em;">
                    <label>Text</label>
                    <textarea rows="20" id="cpiHelper_local_textbox"></textarea>
                    </div>
                </div>
                </div>
                <div class="ui bottom attached tab segment" data-tab="two">
                    <div class="ui form">
                    <button class="ui primary button" id="cpiHelper_tenant_textbox_save">save</button>
                    <button class="ui button" id="cpiHelper_tenant_textbox_refresh">refresh</button>
                    <div class="field" style="margin-top:1em;">
                        <label>Text</label>
                        <textarea rows="20" id="cpiHelper_tenant_textbox"></textarea>
                    </div>
                    </div>
                </div>
                    <div class="ui bottom attached tab segment" data-tab="three">
                    <div class="ui form">
                    <button class="ui primary button" id="cpiHelper_global_textbox_save">save</button>
                    <button class="ui button" id="cpiHelper_global_textbox_refresh">refresh</button>
                    <div class="field" style="margin-top:1em;">
                            <label>Text</label>
                            <textarea rows="20" id="cpiHelper_global_textbox"></textarea>
                        </div>
                        </div>
                </div>
          
        
        </div>
        </div>
    `;



        x = createElementFromHTML(textElement)
            pluginHelper.functions.popup(x, "Notepad", { fullscreen: false, callback: async () => {
                $('.tabular.menu .item').tab();
               
                let value = await callChromeStoragePromise("cpiHelper_notepad_plugin_local_"+pluginHelper.tenant+"_"+pluginHelper.integrationFlowId)
                if(value) {
                    document.getElementById("cpiHelper_local_textbox").value = value
                }
                document.getElementById("cpiHelper_local_textbox_refresh").onclick = 
                    async (button) => {
                        let value = await callChromeStoragePromise("cpiHelper_notepad_plugin_local_"+pluginHelper.tenant+"_"+pluginHelper.integrationFlowId)
                        if(!value) {
                            value = ""
                        }
                        document.getElementById("cpiHelper_local_textbox").value = value
                    }
                
                document.getElementById("cpiHelper_local_textbox_save").onclick =
                    async (button) => {
                        await syncChromeStoragePromise("cpiHelper_notepad_plugin_local_"+pluginHelper.tenant+"_"+pluginHelper.integrationFlowId,document.getElementById("cpiHelper_local_textbox").value)
                    }
                    
                    value = await callChromeStoragePromise("cpiHelper_notepad_plugin_tenant_"+pluginHelper.tenant)
                    if(value) {
                        document.getElementById("cpiHelper_tenant_textbox").value = value
                    }
                    document.getElementById("cpiHelper_tenant_textbox_refresh").onclick = 
                        async (button) => {
                            let value = await callChromeStoragePromise("cpiHelper_notepad_plugin_tenant_"+pluginHelper.tenant)
                            if(!value) {
                                value = ""
                            }
                            document.getElementById("cpiHelper_tenant_textbox").value = value
                        }
                    
                    document.getElementById("cpiHelper_tenant_textbox_save").onclick =
                        async (button) => {
                            await syncChromeStoragePromise("cpiHelper_notepad_plugin_tenant_"+pluginHelper.tenant,document.getElementById("cpiHelper_tenant_textbox").value)
                        }

                        value = await callChromeStoragePromise("cpiHelper_notepad_plugin_global")
                        if(value) {
                            document.getElementById("cpiHelper_global_textbox").value = value
                        }
                        document.getElementById("cpiHelper_global_textbox_refresh").onclick = 
                            async (button) => {
                                let value = await callChromeStoragePromise("cpiHelper_notepad_plugin_global")
                                if(!value) {
                                    value = ""
                                }
                                document.getElementById("cpiHelper_global_textbox").value = value
                            }
                        
                        document.getElementById("cpiHelper_global_textbox_save").onclick =
                            async (button) => {
                                await syncChromeStoragePromise("cpiHelper_notepad_plugin_global",document.getElementById("cpiHelper_global_textbox").value)
                            }
            }});

})
            
            return button;
        }
    }

}

pluginList.push(plugin);