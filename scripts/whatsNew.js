async function whatsNewCheck() {

    var manifestVersion = chrome.runtime.getManifest().version;

    check = await storageGetPromise("whatsNewV" + manifestVersion);

    if (!check) {
        html = `<div id="cpiHelper_WhatsNew">Thank you for using the CPI Helper by Dominic Beckbauer. <p>You hace successfully updated to version ${manifestVersion}</p> 
      <h3>News</h3>
      <p>CPI-Helper has a very limited plugin engine now. Read more about whats new in <a href= "https://kangoolutions.com/2022/05/02/cpi-helper-2-1-x-some-improvements-and-early-version-of-plugin-interface/">this</a> blog article</p>
      <p>The plugin is now backed by Kangoolutions. A SAP Integration Consulting Company. We try to bring you more features and functionalities this year. <br>Check our <a href="https://kangoolutions.com/blog" target="_blank">website</a> to learn more about us. We are open for new SAP Cloud Integration projects.</p>
      <h3>Info!</h3>
      We have a new <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">GitHub Page</a>.
      <h3>Main Features</h3>
      <ul>
      <li>Message Sidebar with Logs and InlineTrace</li>
      <li>Log Viewer</li>
      <li>PowerTrace - Trace keeps running even after 15 minutes</li>
       </ul>
      <h3>Recent Innovations</h3>
      
      <li>Version 2.5.0: <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension/issues/29">Download option</a> for message step in trace mode. Special thanks to <a href="https://github.com/SAPNickYang">Nick Yang</a></li>
      <li>Version 2.4.1: Some bugfixes</li>
      <li>Version 2.4.0: More information in message sidebar like CustomHeaderProperties and duration on mouse hover.</li>
      <li>Version 2.3.0: Works now with "Rest API" and "SOAP API" IFlow type and "Last Visited" includes all types of artifacts now. Special thanks to <a href="https://github.com/SAPNickYang">Nick Yang</a></li>
      <li>Version 2.2.0: First third-party-plugins are shipped with CPI-Helper like the <a href="https://figaf.com/cpihelper/">figaf plugin</a></li>
      <li>Version 2.1.2: Some improvements in logs popup</li>
      <li>Version 2.1.0: A very basic plugin engine and some ui improvements. Visit our <a href="https://kangoolutions.com/2022/05/02/cpi-helper-2-1-x-some-improvements-and-early-version-of-plugin-interface/">blog</a> for more information</li>
      <li>Version 2.0.2: Killed some bugs and ui improvements</li>
      <li>Version 2.0.0: <ul>
      <li>You can now see XML in properties view of logs and InlineTrace</li>
      <li>Option to open Message Sidebar on start of the Integration Flow Designer</li>
      <li>Info tab in logs popup to see Custom Header Logs and more</li>
      <li>Info tab in InlineTrace popup with some step information</li>
      </ul>
      <li>Version 1.8.1: Killed some bugs</li>
      <li>Version 1.8.0: InlineTrace for Adapters in Beta Mode (Click the colored adapter text)</li>
      <li>Version 1.7.3: Adjusted InlineTrace Colors</li>
      <li>Version 1.7.2: Added properties to persist logs</li>
      <li>Version 1.7.0: New colors, new logo and a log viewer in beta mode</li>
      <li>Version 1.6.0: Some UI improvements, works in OData mode and some bugfixes</li>
      </ul>
       </ul>
    <p>Unfortunately SAP does not work with us together and does not inform us when the APIs changes. So be gentle if sth. does not work. we do this in our free time and sometimes it takes a while to adapt to SAP changes.
       <p>The CPI Helper is free and Open Source. If you want to contribute or you have found any bugs than have a look at our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">GitHub Page</a> and our <a href="https://kangoolutions.com" target="_blank">Homepage</a>. You can find the main developer Dominic Beckbauer on <a href="https://www.linkedin.com/in/dominic-beckbauer-515894188/">LinkedIn</a></p>
    
   
    </div>
    `;
        showBigPopup(html, "Your CPI Toolbox since 1963");
        var obj = {};
        obj["whatsNewV" + manifestVersion] = "show";
        chrome.storage.local.set(obj, function () {
            console.log("whats new displayed and saved");
        });
    }

    //persist so that the popup does not appear again
}