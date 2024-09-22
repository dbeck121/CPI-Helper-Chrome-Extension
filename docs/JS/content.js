const baseUrl = window.location.hostname.match(/^\d/g) == null ? window.location.origin + window.location.pathname : "/docs/";
const features = [
    { "desc": "Track message processing.", "title": "Processed Messages Sidebar" },
    { "desc": "Visualize message routes.", "title": "InlineTrace Activation" },
    { "desc": "View and format trace messages.", "title": "Trace Display Enhancement" },
    { "desc": "Toggle and navigate trace messages easily.", "title": "Trace Controls" },
    { "desc": "Directly access logs and attachments.", "title": " Message Management" },
    { "desc": "Instant error notification on click", "title": " Error Message Pop-up" }]
const plugin_data = [
    {
        "description": "This plugin adds a button to the message sidebar, which opens a notepad for storing data in the browser. The data is only visible to you and can be used to store information like custom property names or external URLs. It is not visible to other developers and is just for your convenience. If you tick the checkbox 'Encrypt when saving data', the entered data will be encrypted, providing an extra layer of protection.",
        "logo_src": "/images/logo.png",
        "name": "Simple Notepad (Beta)",
        "devSite": "https://kangoolutions.com/"
    },
    {
        "description": "Adds an button to the message sidebar to open a reference guide.",
        "logo_src": "/images/logo.png",
        "name": "Simple Reference (Beta)",
        "devSite": "https://kangoolutions.com/"
    },
    {
        "description": "Adds an undeploy button to the message sidebar.",
        "logo_src": "/images/logo.png",
        "name": "undeploy plugin",
        "devSite": "https://kangoolutions.com/"
    },
    {
        "description": "[BETA] Open Transport System (cpi-transporter.com)",
        "logo_src": "",
        "name": "CPI Transporter",
        "devSite": "https://cpi-transporter.com/"
    },
    {
        "description": "Simplify your SAP Cloud Integration work with Figaf. Learn more at figaf.com",
        "logo_src": "",
        "name": "Figaf",
        "devSite": "https://figaf.com/"
    },
    {
        "description": "This CPI Helper plugin is designed to help developers utilize OpenAI APIs with their OpenAI API key. While it can assist in generating code snippets, inserting code, explaining code, or fixing errors in the code, users are reminded that all risks associated with the use of the APIs are solely assumed by the user.Read more about this plugin please open this devSite.",
        "logo_src": "",
        "name": "My AI Coding Buddy",
        "devSite": "https://github.com/SAPNickYang/CPI-Helper-Chrome-Extension/wiki/CPI-Helper-Plugin---My-AI-Coding-Buddy"
    },
    {
        "description": "Navigate directly to your Technical Interface Documentation in Microsoft SharePoint. See integration-excellence.com for more details.",
        "logo_src": "",
        "name": "WHINT® Interface Documentation",
        "devSite": "https://whitepaper-id.com/"
    },
    {
        "description": "Auto opens(*) the settings pane and keeps it at your chosen size or even dynamically adjust the height to the content! Improves your flow, reduces your pa(i)ne! ;-) \n                  (*) If you have configured the CPI Helper Extension to open on launch (recommended). ",
        "logo_src": "",
        "name": "Settings Pane Resizer",
        "devSite": "https://bmtg.ch/"
    },
    {
        "description": "The CPI Helper plugin lets developers use trace step modifiers in integration flows.\n     But be careful: the plugin changes the global variable you set for each flow. it will use global instead if input is blank. Read More\n     New Feature: Performance Statatics checkbox to enable inline trace.",
        "logo_src": "",
        "name": "Trace Step Modifier (Beta)",
        "devSite": "https://incpi.github.io/"
    },
    {
        "description": "Only for plugin developers",
        "logo_src": "",
        "name": "example for developers",
        "devSite": "https://github.com/dbeck121/CPI-Helper-Chrome-Extension"
    }
]
const readme_configs = [
    { "divider": "##", "id": "readmeDiv", "path": "readme/README.md" },
    { "divider": "##", "id": "PluginDiv", "path": "readme/PluginREADME.md" },
    { "divider": "##", "id": "cocDiv", "path": "readme/code_of_conduct.md" },
    { "divider": "##", "id": "contributionDiv", "path": "readme/contributing.md" }]
const prev_feature = [
    { "caption": "Sidebar with Processed Messages", "description": "Conveniently view processed messages alongside your integration flow design.", "image": "chrome1.png" },
    { "caption": "Activate InlineTrace", "description": "Enable InlineTrace to visualize the message route directly within the integration flow designer.", "image": "chrome_inlinetrace_small.png" },
    { "caption": "Direct Trace Message Viewing", "description": "Instantly access and review trace messages within the integration flow designer interface.", "image": "chrome_trace_properties_small.png" },
    { "caption": "Pretty Print for Trace Messages", "description": "Enhance readability with formatted trace messages directly in the integration flow designer.", "image": "chrome_after_beautify_small.png" },
    { "caption": "Trace Switch Button", "description": "Seamlessly toggle trace functionality on and off with a dedicated switch button.", "image": "chrome_inlinetrace_small2.png" },
    { "caption": "Direct Access to Message Traces", "description": "Quickly navigate to specific message traces without leaving the integration flow designer.", "image": "messages.png" },
    { "caption": "Logs and Attachments Access", "description": "Easily access logs and attachments associated with specific messages right from the integration flow designer.", "image": "" },
    { "caption": "Error Message Pop-up", "description": "Get instant error message pop-ups when hovering over messages in the sidebar, aiding in quick issue identification.", "image": "chrome4.png" },
    { "caption": "Deployment Info Pop-up", "description": "Stay informed with deployment information through convenient pop-ups.", "image": "chrome2.png" },
    { "caption": "Useful Links in Browser Bar Popup", "description": "Access relevant links directly from the browser bar popup for enhanced navigation and productivity.", "image": "chrome3.png" },
    { "caption": "Last Visited iFlows", "description": "Keep track of your last visited integration flows for quick reference and easy access.", "image": "" }]
const stats_cards = [
    { "color": "bg-primary", "count": 24572, "icon": "fa fa-download", "rating": 4.7, "label": "Total weekly Users", "link": "javascript:void(0);" },
    { "color": "bg-danger", "count": 19642, "icon": "fab fa-chrome", "rating": 4.97, "label": "Chrome Users", "link": "https://chrome.google.com/webstore/detail/sap-cpi-helper/epoggeaemnkacpinjfgccbjakglngkpb" },
    { "color": "bg-warning", "count": 4700, "icon": "fab fa-edge", "rating": 5, "label": "Edge Users", "link": "https://microsoftedge.microsoft.com/addons/detail/sap-cpi-helper/chnohkopccdfgpglplooonoaigfgfkda" },
    { "color": "bg-info", "count": 230, "icon": "fab fa-firefox", "rating": 5, "label": "FireFox Users", "link": "https://addons.mozilla.org/de/firefox/addon/cpi-helper/" }]
const contributors = [
    { "name": "Dominic Beckbauer", "username": "dbeck121" },
    { "name": "Omkar Patel", "username": "Incpi" },
    { "name": "Gregor Schütz", "username": "DevGregor" },
    { "name": "Tobias Hennekes", "username": "thennekes" },
    { "name": "Philippe Addor", "username": "fippu82" },
    { "name": "Robert Fels", "username": "robertfels" },
    { "name": "Julie Mailänder", "username": "jmailaender" },
    { "name": "JensWallgrenImplema", "username": "JensWallgrenImplema" },
    { "name": "Mr Figure Skating", "username": "MrFigureSkating" }]

export { contributors, stats_cards, prev_feature, readme_configs as readme, plugin_data, features, baseUrl }