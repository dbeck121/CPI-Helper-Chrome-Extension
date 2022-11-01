# CPI-Helper Chrome-Extension
This Browser Plugin extends the SAP Cloud Platform Integration with some useful features.

For news about CPI-Helper please follow our [LinkedIn Page](https://www.linkedin.com/company/kangoolutions) 

I recommend reading the readme first but if you know what you are doing, you can add it to your Chrome or Edge Browser directly:
[Chrome Web Store](https://chrome.google.com/webstore/detail/sap-cpi-helper/epoggeaemnkacpinjfgccbjakglngkpb)
[Edge Browser](https://microsoftedge.microsoft.com/addons/detail/sap-cpi-helper/chnohkopccdfgpglplooonoaigfgfkda)

## Features
### Integration Flow Designer Improvements
- Sidebar with processed messages
- Activate InlineTrace to see message route in integration flow designer
- Directly see trace messages in integration flow designer
- Pretty print for trace messages in integration flow designer
- Button to switch trace
- Directly go to traces of specific message
- Directly go to logs and attachments of specific message
- Pop-up with error-message when hovering message in sidebar
- Pop-up with deployment info
- View and delete variables in info pop-up

### General CPI Improvements
- Useful links in browser-bar-popup
- Last visited iflows in browser-bar-popup

## Changelog
### 2.6.3
- [Bugfix] Trial account of Integration Suite is working again
### 2.6.2
- [Bugfix] Some bugfixes
### 2.6.1
- [Bugfix] Some bugfixes
### 2.6.0
- [Feature] Support for new SAP Integration Suite version.
- [Feature] Support for Chinese CI tenant
- [Bugfix] Some bugfixes
### 2.5.0
- [Feature] Download option for message step in trace mode. [See Issue #29](https://github.com/dbeck121/CPI-Helper-Chrome-Extension/issues/29). Thanks to [Nick Yang](https://github.com/SAPNickYang)
- [Bugfix] Longer Timeouts for API calls to CI-Tenant
### 2.4.1
- [Bugfix] MessageList is now ordered by LogEnd not LogStart. 
### 2.4.0
- [Feature] More information in message sidebar like CustomHeaderProperties and duration on mouse hover.
### 2.3.0
- [Feature] "Last Visited" now includes all types of Artifacts. Thanks to [Nick Yang](https://github.com/SAPNickYang)
- [Feature] Works now with "Rest API" and "SOAP API" IFlow Type. Thanks to [Nick Yang](https://github.com/SAPNickYang)
### 2.2.0
- [Feature] First third-party plugins are shipped with CPI-Helper like the [figaf plugin](https://figaf.com/cpihelper/)
### 2.1.2
- [Improvement] Enhanced logs popup. Thanks to [Nick Yang](https://github.com/SAPNickYang)
- [Bugfix] Fixed timezone in logs popup. Thanks to [Nick Yang](https://github.com/SAPNickYang)
### 2.1.1
- [Improvement] More features for plugins
- [Bugfix] Some bugs fixed in plugin engine

### 2.1.0
- [Feature] There is a very limited plugin engine that you can use to add features to CPI-Helper. (see [plugin readme](plugins/README.md))
- [Feature] Syntax highlighting for SQL in Payloads
- [Improvement] Shows size of payload in inline trace body viewer
- [Improvement] Info tab has more info in inline trace

### 2.0.2
- [Improvement] Some UI improvements. Thx to [Robert Fels](https://github.com/robertfels)
- [Bugfix] Recently visited IFlows are back again
### 2.0.1
- [Improvement] Some UI improvements
### 2.0.0
- [Feature] One can now view XML in properties view of logs and InlineTrace
- [Feature] Option to open Message Sidebar at start of the Integration Flow Designer
- [Feature] Info tab in logs popup to see Custom Header Logs and more
- [Feature] Info tab in InlineTrace popup with some step information
### 1.8.1
- [Bugfix] Button bar sometimes needed a refresh
### 1.8.0
- [Feature] InlineTrace for Adapters in Beta Mode (Click the colored adapter text)
### 1.7.3
- [Feature] Better InlineTrace colors
### 1.7.2
- [Feature] Added exchange properties to persist log
### 1.7.0
- [Feature] New logo, new colors
- [Feature] Logs viewer in beta mode
### 1.6.0
- [Feature] More links in regards to monitoring in pop-up. Thanks to [Nick Yang](https://github.com/SAPNickYang)
- [Feature] Showing "DeployedVersion" in Info menu. Thanks to [Nick Yang](https://github.com/SAPNickYang)
- [Feature] Loading indicator.
- [Feature] Some design improvements.
- [Bugfix] cpiHelper now works in OData mode. Thanks to [Nick Yang](https://github.com/SAPNickYang)
- [Bugfix] Minor bugfixes
### 1.5.0
- [Feature] Improved design of the message window. New InlineTrace Button.
- [Bugfix] Minor bugfixes
### 1.4.0
- [Bugfix] Now you can show the current integration flow in tab name with $iflow.name in custom name for tab
- [Bugfix] Minor bugfixes with powertrace
### 1.3.1
- [Bugfix] Fixed a bug that prevented the plugin to run under Ubuntu and other Linux systems
- [Bugfix] Minor bugfixes
### 1.3.0
- [Feature] Tracebutton will retrigger trace until pressed again
- [Feature] Deployment state is shown in message sidebar
### 1.2.3
- [Feature] Discarded Runs will not be shown in message sidebar
- [Bugfix] Minor bugfixes
### 1.2.2
- [Bugfix] CPIHelper did not load after tenant update v2
### 1.2.1
- [Bugfix] CPIHelper did not load after tenant update
### 1.2.0
- [Feature] Select tab icon, text and tenant color for your tenants
- [Bugfix] Improved compatibility with Cloud Foundry
### 1.1.1
- [Bugfix] Fixed some css issues
### 1.1.0
- [Feature] View and delete variables in info pop-up
- [Feature] What's new screen when updating
### 1.0.3
- [Improvement] Improved speed beautifier with big xml structures
### 1.0.2
- [Bugfix] Fixed icon in Chrome Store
### 1.0.1
- [Bugfix] Fixed issue with error pop-up
### 1.0.0
- [Feature] Pop up to see trace messages directly in designer
- [Feature] Added beautifier to trace in designer
- [Feature] Content logs in trace pop-up
- [Feature] Show error in InlineTrace PopUp
- [Improvement] Smaller message sidebar
- [Improvement] New icon
### 0.8.0
- [Improvement] Many design improvements
### 0.7.0
- [Feature] Added inline-trace feature in designer
### 0.5.6
- [Improvement] Improved xcsrf token exchange
### 0.5.5
- [Bugfix] Fixed not working trace in some cases
### 0.5.3
- [Bugfix] Info-popup deployed on time is now in locale time zone
- [Bugfix] Fixed bug in info-popup
### 0.5.0
- [Improvement] Improved design of plugin-popup in browser-bar
- [Feature] Added last visited iflows in browser-bar-popup
- [Feature] Added useful links in browser-bar-popup
- [Feature] Added undeploy button in info-popup
### 0.4.0
- [Feature] Added popup with deployment info
### 0.3.1
- [Bug] Fixed timezone offset in message sidebar
### 0.3.0
- [Improvement] A few design changes
- [Feature] Processed message error message on hovering over the message date (if exists)
### 0.2.2
- [Improvement] A few design changes
### 0.2.1
- [Improvement] Word-wrap when Integration-Flow name is very long
- [Improvement] Smaller Message-Sidebar
### 0.2
First public version.
- [Feature] Message Sidebar
- [Feature] Trace button 

## Installation
You need Google Chrome to install this plugin. I tested it with version 100. I assume that older versions will work too.
There are two options to install this plugin:
### Install directly from Chrome Web Store or Microsoft Store (recommended)
Just add the plugin in the [Chrome Web Store](https://chrome.google.com/webstore/detail/sap-cpi-helper/epoggeaemnkacpinjfgccbjakglngkpb) or [Microsoft Store](https://microsoftedge.microsoft.com/addons/detail/sap-cpi-helper/chnohkopccdfgpglplooonoaigfgfkda).
This is probably the easiest way. Updates will be installed automatically.
[![Chrome Web Store](https://storage.googleapis.com/web-dev-uploads/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/YT2Grfi9vEBa2wAPzhWa.png)](https://chrome.google.com/webstore/detail/sap-cpi-helper/epoggeaemnkacpinjfgccbjakglngkpb)

### Install in Developer Mode from Sources
If you know what you are doing, you can install the plugin directly from sources.
Clone the repo and add the folder directly to Google Chrome
>- Download or clone the repo from github. Unpack if necessary.
>- In Google Chrome, Navigate to Settings – > Extensions
>- Enable Developer Mode (slider on the top-right)
>- Click: "Load Unpacked Extension" and select the folder with the plugin data

## Update
Attention: If you installed the plugin from Chrome Store before 21 March 2020, please uninstall and install it again with the link on the top.
Chrome updates extensions that are installed from the Chrome Web Store automatically. 
If you installed the plugin from sources:
Please replace the folder with the new version on your disk. After that, you must delete and add the plugin to Chrome Browser.
If you have cloned the repository, pull new data. Then delete and add the plugin in Chrome. Restart Chrome.

## Usage
### New Buttons
If you open an Integration Flow, the plugin will automatically add a "Messages", a "Trace" and an "Info" button in the Integration-Flow-Designer. 
#### Message Button
The "Message" button opens a small draggable sidebar with the last processed messages. You can jump directly to infos and traces of the message run. If you hover over the status icon of message, you will see a pop-up with the error message directly. If you click on the time button, InlineTrace is activated (Only when trace was activated for message). If you click on a color coded integration flow item and trace is available, a pop-up opens with the trace of the message at this point.
![Screenshot](https://raw.githubusercontent.com/dbeck121/CPI-Helper-Chrome-Extension/master/images/screenshots/chrome1.png)

![Screenshot](https://raw.githubusercontent.com/dbeck121/CPI-Helper-Chrome-Extension/master/images/screenshots/chrome4.png)
#### Trace Button
The "Trace" button sets the loglevel of the current Iflow to trace.
#### Info Button
The "Info" button lets you see detailed information of the deployment state of your Integration Flow.
![Screenshot](https://raw.githubusercontent.com/dbeck121/CPI-Helper-Chrome-Extension/master/images/screenshots/chrome2.png)
### Toolbar Popup
The button of the plugin in the toolbar gives you a list of useful links of your current tenant. It includes last visited Integration Flows.
![Screenshot](https://raw.githubusercontent.com/dbeck121/CPI-Helper-Chrome-Extension/master/images/screenshots/chrome3.png)
See also the [SAP Community Blog](https://blogs.sap.com/2020/03/05/cpi-chrome-plugin-to-enhance-sap-cloud-platform-integration-usability/#)
### Inline Trace
On the message sidebar, press the time button next to the status icon of a processed message. If run steps exist, the elements of the Integration Flow will change colors accordingly. This will give you a quick overview of the run.
>- Blue elements are successfully processed steps
>- Red elements are elements with errors.
SAP does not provide good information about errors. So when an error at a Splitter-Element occurs, this does not have to mean that the error occurred here. It can also be a catched error from elements after the Splitter.

Run steps exist for processed messages with trace and for a short time in processed messages with errors.
![Screenshot](https://raw.githubusercontent.com/dbeck121/CPI-Helper-Chrome-Extension/master/images/screenshots/chrome_inlinetrace.png)
### Inline Trace - Show Headers, Properties, Trace, Error and Logs
If you activated the Inline Trace feature, you can get more details. Traces only exist for processed messages with loglevel trace and will be deleted after around about 1 hour by SAP.
![Screenshot](https://raw.githubusercontent.com/dbeck121/CPI-Helper-Chrome-Extension/master/images/screenshots/chrome_trace_properties.png)
![Screenshot](https://raw.githubusercontent.com/dbeck121/CPI-Helper-Chrome-Extension/master/images/screenshots/chrome_after_beautify.png)
## FAQ
### How can I activate InlineTrace?
Run a message with trace activated. You see the message in the message sidebar. Click on the button with the time for the specific message. If trace is available, items that processed the message change color. You can click on integration flow elements to see the trace message before this step.
### How long is the trace available?
SAP deletes trace messages after a while. Trace messages normally do not live longer than 1 hour.
## Contributing
See [Contribution guidelines for this project](docs/CONTRIBUTING.md) if you want to take part in this project. As I am a beginner myself, beginners are welcome.

If you have any ideas, please write a message or comment at the [SAP Community](https://blogs.sap.com/2020/03/05/cpi-chrome-plugin-to-enhance-sap-cloud-platform-integration-usability/#)

### Contributors
>- [Dominic Beckbauer](https://github.com/dbeck121): Main work
>- [Nick Yang](https://github.com/SAPNickYang): Bug fixes and UI improvements
>- [Raffael Herrmann](https://github.com/codebude): Speed up handling of large XML structures in beautifier.
>- [Ivo Vermeer](https://github.com/IvoVermeer): Change icon, text and tenant color
>- [bdais](https://github.com/bdbais/): filter discarded entries
>- [Robert Fels](https://github.com/robertfels)
## License
[GNU GPLv3](https://choosealicense.com/licenses/gpl-3.0/)
