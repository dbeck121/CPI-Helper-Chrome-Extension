var plugin = {
  metadataVersion: "0.9.0",
  id: "OpenAI",
  name: "My AI Coding Buddy",
  version: "1.0.0",
  author: "CPI Helper Plugin developed by Nick Yang, APIs powered by OpenAI.",
  website: "https://github.com/SAPNickYang/CPI-Helper-Chrome-Extension/wiki/CPI-Helper-Plugin---My-AI-Coding-Buddy",
  description:
    "This CPI Helper plugin is designed to help developers utilize <a href='https://beta.openai.com/docs/introduction' target='_blank'>OpenAI APIs</a> with their <a href='https://beta.openai.com/docs/api-reference/authentication' target='_blank'>OpenAI API key</a>. <br>While it can assist in generating code snippets, inserting code, explaining code, or fixing errors in the code, <br>users are reminded that all risks associated with the use of the APIs are solely assumed by the user.<br>Read more about this plugin please open this <a href='https://github.com/SAPNickYang/CPI-Helper-Chrome-Extension/wiki/CPI-Helper-Plugin---My-AI-Coding-Buddy' target='_blank'>link</a>.",
  settings: {},
  messageSidebarButton: {
    icon: { text: "My AI Coding Buddy", type: "text" },
    title: "Powered by OpenAI",
    onClick: (pluginHelper, settings, runInfo, active) => {},
    condition: (pluginHelper, settings, runInfo) => {
      return false;
    },
  },
  messageSidebarContent: {
    static: true,
    onRender: (pluginHelper, settings) => {
      var strToUnit8ArrayFunction = function stringToUint8Array(s, length) {
        var arr = new Uint8Array(length);
        for (var i = 0, j = s.length; i < j; ++i) arr[i] = s.charCodeAt(i);
        return arr;
      };
      var enc = new TextEncoder("utf-8"),
        dec = new TextDecoder("utf-8");
      var div = document.createElement("div");
      div.innerHTML = `
            <style>
                textarea {
                    font-family: monospace;
                    font-size: 12px;
                    white-space: pre;
                    line-height: 1.5;
                    padding: 10px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    background-color: #f5f5f5;
                    resize: vertical;
                    overflow: auto;
                }
            </style>
            <table id="main">
                <tr>
                    <td colspan="2"> 
                        <label for="apiKey">API Key</label>
                        <input style="display:none;"size="10" type="text" id="apiKey" placeholder="Enter API Key" value=""> 
                        <button type="button" id="set" title="Set your OpenAI API key. The key is store locally and protected by AES encryption using your password.">Set Key</button>&nbsp;&nbsp;
                        <button type="button" id="load" title="Load your OpenAI API key from storage. It requires your password to decrypt the ciphertext.">Load Key</button>
                    </td>
                    <td colspan="2"> 
                        <label for="mode">Mode</label>
                        <select id="mode">
                            <option default value="complete" title="Given a request, the model will return one predicted completion.">Complete</option>
                            <option value="insert" title="Use [insert] to indicate where the model should insert text.">Insert</option>
                            <option value="edit" title="Given a request and an instruction, the model will return an edited version of the prompt.">Edit</option>
                        </select>
                    </td>
                    <td colspan="2"> 
                        <label for="model">AI Model</label>
                        <select id="model">
                            <option default value="code-davinci-002">Code Davinci 002</option>
                            <option value="text-davinci-002">Text Davinci 002</option>
                            <option value="text-davinci-003">Text Davinci 003</option>
                        </select>
                    </td>
                    <td colspan="2"> 
                        <label for="maxToken">Max Return Tokens</label>
                        <input size="5" type="number" id="maxToken" value="128" min="0" max="4000" placeholder="Enter Max Tokens" title="The maximum number of tokens to return in the response.">
                    </td>
                    <td colspan="2"> 
                        <label for="stopToken">Stop sequence</label>
                        <input size="5" type="text" id="stopToken" value="###" placeholder="Stop sequence." title="The API will stop generating further tokens if this appears."> </td>
                </tr>
                <tr>
                    <td colspan="5" style="text-align: center;"> <b><label for="request">Request</label></b> &nbsp;&nbsp; <button type="button" id="submit" title="Submit request to OpenAI.">Submit</button> </td>
                    <td colspan="5" style="text-align: center;"> <b><label for="response">Response</label></b> &nbsp;&nbsp; <button type="button" id="copy" title="Copy response to clipboard.">Copy</button>  &nbsp;&nbsp; <button type="button" id="clear" title="Clear response textarea.">Clear</button> </td>
                </tr>
                <tr>
                    <td colspan="5">
                        <textarea id="request" rows="10" cols="100" style="width:95%" placeholder="Codex model can be used for generating code based on description in request."></textarea>
                    </td>
                    <td colspan="5">
                        <textarea id="response" rows="10" cols="100" style="width:95%"></textarea>
                    </td>
                </tr>             
                <tr id="instructionRow" hidden>
                    <td style="width:10%"> <label for="instructions">Instructions</label> </td>
                    <td colspan="9">
                        <textarea id="instructions" rows="2" style="width:95%" placeholder="Give your instruction here to tell the model how to edit content in the request. Please be as specific with the instruction as possible."></textarea>
                    </td>
                </tr>                
                <tr>
                    <td colspan="3"> <label for="token">Request equals to </label> <text id="token"></text></td>
                    <td colspan="7"> <text id="status"> </td>
                </tr>
            </table>
            `;
      var models_list = {
        "code-davinci-002": {
          desc: "Codex model can be used for generating code based on description in request.",
          maxRequestTokens: 4000,
        },
        "text-davinci-002": {
          desc: "Davinci 002 model can be used for generating code or text.",
          maxRequestTokens: 2048,
        },
        "text-davinci-003": {
          desc: "Davinci 003 model is the most capable model and can be used for generating code or text. Max request 4000 tokens.",
          maxRequestTokens: 4000,
        },
        "code-davinci-edit-001": {
          desc: "A specialized model in the Codex series that can be used to edit code. Provide some code and an instruction, and the model will attempt to modify it accordingly.",
          maxRequestTokens: 8000,
        },
        "text-davinci-edit-001": {
          desc: "A specialized model in the GPT-3 series that can be used to edit text. Provide some text and an instruction, and the model will attempt to modify it accordingly.",
          maxRequestTokens: 2048,
        },
      };
      div.querySelector("#mode").addEventListener("click", () => {
        var mode = div.querySelector("#mode").value;

        if (mode == "edit") {
          div.querySelector("#instructionRow").removeAttribute("hidden");
        } else {
          div.querySelector("#instructionRow").setAttribute("hidden", "hidden");
        }

        var model = div.querySelector("#model");
        model.options.length = 0;
        if (mode == "complete") {
          model.options[model.options.length] = new Option("Code Davinci 002", "code-davinci-002", true, true);
          model.options[model.options.length] = new Option("Text Davinci 002", "text-davinci-002");
          model.options[model.options.length] = new Option("Text Davinci 003", "text-davinci-003");
        } else if (mode == "insert") {
          model.options[model.options.length] = new Option("Code Davinci 002", "code-davinci-002", true, true);
          model.options[model.options.length] = new Option("Text Davinci 002", "text-davinci-002");
          model.options[model.options.length] = new Option("Text Davinci 003", "text-davinci-003");
        } else if (mode == "edit") {
          model.options[model.options.length] = new Option("Code Davinci Edit 001", "code-davinci-edit-001", true, true);
          model.options[model.options.length] = new Option("Text Davinci Edit 001 (Alpha)", "text-davinci-edit-001");
        }

        for (var i = 0; i < model.options.length; i++) {
          var option = model.options[i];
          for (var key in models_list) {
            if (option.value == key) {
              option.title = models_list[key].desc;
            }
          }
        }
      });
      div.querySelector("#submit").addEventListener("click", () => {
        let apiKey = div.querySelector("#apiKey").value;
        let mode = div.querySelector("#mode").value;
        let request = div.querySelector("#request").value;
        let url = "https://api.openai.com/v1/completions";
        let data,
          streaming = false;
        let model = div.querySelector("#model").value;
        let stopToken = div.querySelector("#stopToken").value;
        let usedToken = Math.ceil(request.split(" ").length * 1.3333);
        let maxToken = div.querySelector("#maxToken").max * 1;
        let maxReturnToken = div.querySelector("#maxToken").value * 1;
        let instructions = div.querySelector("#instructions").value;
        let baseData = {
          model: model,
          temperature: 0,
          top_p: 1,
        };
        let insertCompleteData = {
          ...baseData,
          max_tokens: maxReturnToken,
          frequency_penalty: 0,
          presence_penalty: 0,
          stream: streaming,
          stop: [stopToken],
        };

        if (!apiKey) {
          alert("API key is empty. Pleaes load the key first.");
          return;
        }
        if (mode == "insert" && request.indexOf("[insert]") == -1) {
          alert("Use [insert] to indicate where the text or code should added.");
          return;
        }

        if (usedToken > maxToken) {
          alert("Request is too long. Please limit to " + maxToken + " tokens.");
          return;
        }

        if (mode == "edit") {
          url = "https://api.openai.com/v1/edits";
          data = JSON.stringify({
            ...baseData,
            input: request,
            instruction: instructions,
          });
        } else if (mode == "complete") {
          data = JSON.stringify({
            ...insertCompleteData,
            prompt: request,
          });
        } else if (mode == "insert") {
          var insertIndex = request.indexOf("[insert]");
          var prefix = request.substring(0, insertIndex);
          var suffix = request.substring(insertIndex + 8);
          data = JSON.stringify({
            ...insertCompleteData,
            prompt: prefix,
            suffix: suffix,
          });
        }

        var i = 0;
        var status = div.querySelector("#status");
        status.innerHTML = "Processing.";
        var xhr = new XMLHttpRequest();
        var interval;
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("Authorization", "Bearer " + apiKey);
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && xhr.status === 200) {
            var json = JSON.parse(xhr.responseText);
            if (mode == "insert") {
              div.querySelector("#response").value = request.replace("[insert]", json.choices[0].text);
            } else {
              div.querySelector("#response").value = json.choices[0].text;
            }
          } else {
            div.querySelector("#response").value = xhr.responseText + " (" + xhr.status + ")";
          }
          clearInterval(interval);
          status.innerHTML = "";
        };
        xhr.send(data);
        xhr.onerror = function () {
          div.querySelector("#response").value = "Error: " + xhr.responseText;
          clearInterval(interval);
          status.innerHTML = "";
        };
        interval = setInterval(() => {
          i++;
          if (i < 5) {
            status.innerHTML = status.innerHTML + ".";
          } else {
            i = 0;
            status.innerHTML = "Processing.";
          }
        }, 1000);
      });
      div.querySelector("#copy").addEventListener("click", () => {
        copyText(div.querySelector("#response").value);
      });
      div.querySelector("#clear").addEventListener("click", () => {
        div.querySelector("#response").value = "";
      });
      div.querySelector("#model").addEventListener("click", () => {
        let selectedMode = document.querySelector("#mode").value;
        let selectedModel = document.querySelector("#model").value;
        if (selectedModel) {
          let desc = models_list[selectedModel].desc;
          let maxRequestTokens = models_list[selectedModel].maxRequestTokens;
          if (selectedMode == "insert") {
            desc += "\n" + "Use [insert] to indicate where the text or code you want model to add.";
          }
          document.querySelector("#request").placeholder = desc;
          document.querySelector("#maxToken").max = maxRequestTokens;
        }
      });
      div.querySelector("#request").addEventListener("input", () => {
        try {
          var request = div.querySelector("#request").value;
          var token = Math.ceil(request.split(" ").length * 1.3333);
          div.querySelector("#token").innerHTML = token + " tokens approximately.";
        } catch (exp) {
          alert(exp);
        }
      });
      div.querySelector("#set").addEventListener("click", async () => {
        let apiKey = prompt("Please enter your OpenAI API key.");
        if (apiKey != null) {
          let keyPass = prompt("Please enter a password to encrypt your key.");
          if (keyPass != null) {
            try {
              let keyMaterial = await window.crypto.subtle.importKey("raw", enc.encode(keyPass), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
              let secretKey = await window.crypto.subtle.deriveKey(
                {
                  name: "PBKDF2",
                  salt: strToUnit8ArrayFunction(keyPass, 16),
                  iterations: 100000,
                  hash: "SHA-256",
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
              );
              let encodedAPIKey = enc.encode(apiKey);
              let myIv = strToUnit8ArrayFunction(keyPass, 12);
              let encryptedAPIKey = await window.crypto.subtle.encrypt(
                {
                  name: "AES-GCM",
                  iv: myIv,
                },
                secretKey,
                encodedAPIKey
              );

              await syncChromeStoragePromise(getStoragePath("OpenAI", "APIKey"), btoa(new Uint8Array(encryptedAPIKey)));

              showToast("API key encrypted and save successfully!");
              div.querySelector("#apiKey").value = apiKey;
            } catch (ex) {
              alert("Failed to save. Exception:" + ex);
            }
          }
        }
      });
      div.querySelector("#load").addEventListener("click", async () => {
        let keyPass = prompt("Please enter password to retrieve your key.");
        if (keyPass != null) {
          try {
            let encryptedKey = await getStorageValue("OpenAI", "APIKey");

            if (encryptedKey != "") {
              let keyMaterial = await window.crypto.subtle.importKey("raw", enc.encode(keyPass), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
              let secretKey = await window.crypto.subtle.deriveKey(
                {
                  name: "PBKDF2",
                  salt: strToUnit8ArrayFunction(keyPass, 16),
                  iterations: 100000,
                  hash: "SHA-256",
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
              );
              let myIv = strToUnit8ArrayFunction(keyPass, 12);
              let decryptedKey = await window.crypto.subtle.decrypt(
                {
                  name: "AES-GCM",
                  iv: myIv,
                },
                secretKey,
                Uint8Array.from(atob(encryptedKey).split(","), (c) => c)
              );
              div.querySelector("#apiKey").value = dec.decode(decryptedKey);
              showToast("API key loaded successfully!");
            } else {
              alert("Key doesn't exist or decrypt failed.");
            }
          } catch (ex) {
            alert("Failed to load. Exception:" + ex);
          }
        }
      });

      var actionButton = document.createElement("button");
      actionButton.innerHTML = "Open";
      actionButton.onclick = (x) => pluginHelper.functions.popup(div, "My AI Coding Buddy");
      var divMain = document.createElement("div");
      divMain.appendChild(actionButton);

      return divMain;
    },
  },
};

pluginList.push(plugin);
