async function whatsNewCheck() {

    var manifestVersion = chrome.runtime.getManifest().version;

    check = await storageGetPromise("whatsNewV" + manifestVersion);

    if (!check) {
        html = `<div id="cpiHelper_WhatsNew">Thank you for using the CPI Helper by Dominic Beckbauer. <p>You hace successfully updated to version ${manifestVersion}</p> 
      <h3>News</h3>
      The plugin is now backed by Kangoolutions. A SAP Integration Consulting Company. We try to bring you more features and functionalities this year. <br>Check our <a href="https://kangoolutions.com/blog" target="_blank">website</a> to learn more about us. We are open for new projects, feedback and new topics.<br />
      <h3>We reached 5000 users!</h3>
      5050 active installations during the last two weeks to be precise. We are looking forward to break 6000 users barrier. 
      <h3>Info!</h3>
      We have a new <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">GitHub Page</a>.
      <h3>Main Features</h3>
      <ul>
      <li>Message Sidebar with Logs and InlineTrace</li>
      <li>Log Viewer</li>
      <li>PowerTrace - Trace keeps running even after 15 minutes</li>
       </ul>
      <h3>Recent Innovations</h3>
      <li>Version 2.0.2: Killed some bugs and ui improvements</li>
      <ul>
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
    <p>Unfortunately SAP does not work with me together and does not inform me when the APIs changes. So be gentle if sth. does not work. I do this in my free time and sometimes it takes a while to adapt to SAP changes.
       <p>The CPI Helper is free and Open Source. If you want to contribute or you have found any bugs than have a look at our <a href="https://github.com/dbeck121/CPI-Helper-Chrome-Extension" target="_blank">GitHub Page</a>. You can also find me on <a href="https://www.linkedin.com/in/dominic-beckbauer-515894188/">LinkedIn</a></p>
   
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