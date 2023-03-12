var plugin = {
    metadataVersion: "1.1.0",
    id: "simplenotepad",
    name: "Simple Notepad (Beta)",
    version: "1.1.0",
    author: "Kangoolutions",
    email: "cpihelper@kangoolutions.com",
    website: "https://kangoolutions.com",
    description: "This plugin adds a button to the message sidebar, which opens a notepad for storing data in the browser. The data is only visible to you and can be used to store information like custom property names or external URLs. It is not visible to other developers and is just for your convenience. If you tick the checkbox 'Encrypt when saving data', the entered data will be encrypted, providing an extra layer of protection.",

    settings: {
        "chkBox1": { "text": "Encrypt when saving data.", "type": "checkbox", scope: "browser" }
    },

    messageSidebarContent: {
        onRender: (pluginHelper, settings) => {
            var button = document.createElement("button");
            button.innerText = "Open Notepad";
            button.addEventListener("click", async () => {
                console.log("helper plugin clicked");
                const textElement = `
            <div>
                <div class="ui icon positive message">
                <i class="info icon"></i>
                <div class="content">
                    <div class="header">Privacy Hint.</div>
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
                var keyPass = null;
                const enc = new TextEncoder("utf-8");
                const dec = new TextDecoder("utf-8");
                const element = createElementFromHTML(textElement);

                const strToUnit8ArrayFunction = function stringToUint8Array(s, length) {
                    var arr = new Uint8Array(length);
                    for (var i = 0, j = s.length; i < j; ++i)
                        arr[i] = s.charCodeAt(i);
                    return arr;
                };

                const handleEncryptContent = async (keyPass, rawContent) => {
                    try {
                        let keyMaterial = await window.crypto.subtle.importKey(
                            "raw",
                            enc.encode(keyPass),
                            { name: "PBKDF2" },
                            false,
                            ["deriveBits", "deriveKey"]
                        );
                        let secretKey = await window.crypto.subtle.deriveKey(
                            {
                                "name": "PBKDF2",
                                "salt": strToUnit8ArrayFunction(keyPass, 16),
                                "iterations": 100000,
                                "hash": "SHA-256"
                            },
                            keyMaterial,
                            { "name": "AES-GCM", "length": 256 },
                            true,
                            ["encrypt", "decrypt"]
                        );
                        let encodedContent = enc.encode(rawContent);
                        let myIv = strToUnit8ArrayFunction(keyPass, 12);
                        let encryptedContent = await window.crypto.subtle.encrypt(
                            {
                                name: "AES-GCM",
                                iv: myIv
                            },
                            secretKey,
                            encodedContent
                        );

                        return btoa(new Uint8Array(encryptedContent));
                    } catch (ex) {
                        showToast("Encrypt content failed!");
                    }
                };

                const handleDecryptContent = async (keyPass, encryptedContent) => {
                    try {
                        let keyMaterial = await window.crypto.subtle.importKey(
                            "raw",
                            enc.encode(keyPass),
                            { name: "PBKDF2" },
                            false,
                            ["deriveBits", "deriveKey"]
                        );
                        let secretKey = await window.crypto.subtle.deriveKey(
                            {
                                "name": "PBKDF2",
                                "salt": strToUnit8ArrayFunction(keyPass, 16),
                                "iterations": 100000,
                                "hash": "SHA-256"
                            },
                            keyMaterial,
                            { "name": "AES-GCM", "length": 256 },
                            true,
                            ["encrypt", "decrypt"]
                        );
                        let myIv = strToUnit8ArrayFunction(keyPass, 12);
                        let decryptedContent = await window.crypto.subtle.decrypt(
                            {
                                name: "AES-GCM",
                                iv: myIv
                            },
                            secretKey,
                            Uint8Array.from(atob(encryptedContent).split(","), c => c)
                        );
                        return dec.decode(decryptedContent);
                    } catch (ex) {
                        showToast("Decrypt content failed!");
                    }
                };

                const handleTextboxRefresh = async (storageKey, textboxId) => {
                    let content = await callChromeStoragePromise(storageKey);
                    if (!content) {
                        content = "";
                    }

                    if (settings["simplenotepad---chkBox1"] == true && content != "") {
                        keyPass = !keyPass ? prompt("Please enter password to decrypt your content.") : keyPass;
                        if (keyPass != null) {
                            let decryptedContent = await handleDecryptContent(keyPass, content);
                            content = decryptedContent ? decryptedContent : content;
                        }
                    }

                    document.getElementById(textboxId).value = content;
                };

                const handleTextboxSave = async (storageKey, textboxId) => {
                    let content = document.getElementById(textboxId).value;
                    if (settings["simplenotepad---chkBox1"] == true && content) {
                        let keyPass = prompt("Please enter password to encrypt your content.");
                        if (keyPass != null) {
                            content = await handleEncryptContent(keyPass, content);
                        }
                    }

                    await syncChromeStoragePromise(storageKey, content);
                    showToast("Save successfully!");
                };

                pluginHelper.functions.popup(element, "Notepad", {
                    fullscreen: false,
                    callback: async () => {
                        $('.tabular.menu .item').tab();

                        await handleTextboxRefresh(`cpiHelper_notepad_plugin_local_${pluginHelper.tenant}_${pluginHelper.integrationFlowId}`, "cpiHelper_local_textbox");
                        document.getElementById("cpiHelper_local_textbox_refresh").onclick = async () => await handleTextboxRefresh(`cpiHelper_notepad_plugin_local_${pluginHelper.tenant}_${pluginHelper.integrationFlowId}`, "cpiHelper_local_textbox");
                        document.getElementById("cpiHelper_local_textbox_save").onclick = async () => await handleTextboxSave(`cpiHelper_notepad_plugin_local_${pluginHelper.tenant}_${pluginHelper.integrationFlowId}`, "cpiHelper_local_textbox");

                        await handleTextboxRefresh(`cpiHelper_notepad_plugin_tenant_${pluginHelper.tenant}`, "cpiHelper_tenant_textbox");
                        document.getElementById("cpiHelper_tenant_textbox_refresh").onclick = async () => await handleTextboxRefresh(`cpiHelper_notepad_plugin_tenant_${pluginHelper.tenant}`, "cpiHelper_tenant_textbox");
                        document.getElementById("cpiHelper_tenant_textbox_save").onclick = async () => await handleTextboxSave(`cpiHelper_notepad_plugin_tenant_${pluginHelper.tenant}`, "cpiHelper_tenant_textbox");

                        await handleTextboxRefresh("cpiHelper_notepad_plugin_global", "cpiHelper_global_textbox");
                        document.getElementById("cpiHelper_global_textbox_refresh").onclick = async () => await handleTextboxRefresh("cpiHelper_notepad_plugin_global", "cpiHelper_global_textbox");
                        document.getElementById("cpiHelper_global_textbox_save").onclick = async () => await handleTextboxSave("cpiHelper_notepad_plugin_global", "cpiHelper_global_textbox");
                    },
                });
            });
            return button;
        }
    }
}
pluginList.push(plugin);