// ============================================================================
// CPI Helper — content script · state
// Extracted from scripts/contentScript.js lines 1-69 during the
// 2026-05-26 contentScript decomposition refactor. Behaviour unchanged.
// ============================================================================

//GNU GPL v3
//Please visit our github page: https://github.com/dbeck121/CPI-Helper-Chrome-Extension

//cpiData stores data for this extension and is provided as context element for plugins
var cpiData = {};

//initialize used elements
cpiData.messageSidebar = {};
cpiData.messageSidebar.lastMessageHashList = [];
cpiData.integrationFlowId = "";
cpiData.tenant = document.location.host;
cpiData.urlExtension = "";
cpiData.runtimePathExtension = "";
cpiData.classicUrl = false;
cpiData.tenantId = null;

cpiData.flowData = {};
cpiData.flowData.artifactInformation = {};
cpiData.flowData.artifactInformation.lastUpdate = null;
cpiData.flowData.artifactInformation.artifactId = null;
cpiData.flowData.artifactInformation.version = null;
cpiData.flowData.artifactInformation.deployState = null;
cpiData.flowData.artifactInformation.deployedOn = null;
cpiData.flowData.artifactInformation.name = null;
cpiData.flowData.artifactInformation.symbolicName = null;
cpiData.flowData.artifactInformation.id = null;

cpiData.flowData.logConfiguration = {};
cpiData.flowData.logConfiguration.traceActive = null;

cpiData.flowData.endpointInformation = [];

//cpiData.isEdge = false;
cpiData.runtimeLocationId = "cloudintegration";
cpiData.runtimeLocations = [];
cpiData.runtimeLocationWithActiveIFlow = [];

cpiData.functions = {};
cpiData.functions["popup"] = showBigPopup;

let regexGetPlatform = /cfapps/;
let regexMatch = regexGetPlatform.exec(document.location.host);
cpiData.cpiPlatform = regexMatch !== null ? "cf" : "neo";

cpiArtifactURIRegexp = [
  //Artifacts
  [/\/integrationflows\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "IFlow"],
  [/\/odataservices\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "ODATA API"],
  [/\/restapis\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "REST API"],
  [/\/soapapis\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "SOAP API"],
  [/\/valuemappings\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "Value Mapping"],
  [/\/scriptcollections\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "Script Collection"],
  [/\/messagemappings\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "Message Mapping"],
  //resources
  [/\/resources\/mapping\/(?<artifactId>[0-9a-zA-Z_\-.]+\.mmap?)/, "M_Mapping"],
  [/\/resources\/mapping\/(?<artifactId>[0-9a-zA-Z_\-.]+\.opmap?)/, "Operation Mapping"],
  [/\/resources\/script\/(?<artifactId>[0-9a-zA-Z_\-.]+)/, "Script"],
  [/\/resources\/mapping\/(?<artifactId>[0-9a-zA-Z_\-.]+\.xslt?)/, "XSLT"],
  //packages
  [/\/contentpackage\/(?<artifactId>[0-9a-zA-Z_\-.]+)\/?(\?.*)?$/, "Package"],
];

var cpiTypeRegexp = /^[^\/]*\.integrationsuite(-trial)?.*/;

var cpiCollectionURIRegexp = /\/contentpackage\/(?<artifactId>[0-9a-zA-Z_\-.]+)/;
var cpiIflowUriRegexp = /\/integrationflows\/(?<artifactId>[0-9a-zA-Z_\-.]+)/;

cpiData.functions.openTrace = openTrace;
