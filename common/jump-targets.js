// Navigation targets of the tenant, shared by the browser popup and the floating toolbar. Paths are relative to the
// tenant base: "" on Integration Suite hosts, "/itspaces" on classic Neo tenants. icon is the name in the popup icon font,
// the toolbar has inline svgs under the same names. toolbar: true entries also show in the toolbar "Jump to" menu.
// area names the part of the CPI a target belongs to, the command palette shows it in front of the label.

const CPIH_FAILED_MESSAGES_PATH = "/shell/monitoring/Messages/" + encodeURIComponent(JSON.stringify({ status: "FAILED", time: "PASTHOUR", type: "INTEGRATION_FLOW" }));

const CPIH_JUMP_TARGETS = [
  { group: "main", area: "Monitor", path: "/shell/monitoring/Messages/", label: "All Messages", icon: "envelope", accent: "green", toolbar: true },
  { group: "main", area: "Monitor", path: CPIH_FAILED_MESSAGES_PATH, label: "Failed Messages", icon: "alert", accent: "red", toolbar: true },
  { group: "main", area: "Monitor", path: "/shell/monitoring/MessageStatusOverview", label: "Status Overview", icon: "donut", accent: "yellow", toolbar: true },
  { group: "main", area: "Monitor", path: "/shell/monitoring/Artifacts/", label: "Integration Content", icon: "layers", accent: "grey", toolbar: true },
  { group: "main", area: "Design", path: "/shell/design", label: "Packages", icon: "package", accent: "blue", toolbar: true },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/SecurityMaterials", label: "Security Material", icon: "shield", toolbar: true },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/Keystore", label: "Keystore", icon: "key", toolbar: true },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/AccessPolicies", label: "Access Policies", icon: "shieldCheck" },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/JdbcMaterial", label: "JDBC Material", icon: "database" },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/Connectivity", label: "Connectivity Tests", icon: "plug", toolbar: true },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/DataStores", label: "Data Stores", icon: "archive", toolbar: true },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/Variables", label: "Variables", icon: "variable", toolbar: true },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/MessageQueues", label: "Message Queues", icon: "queue", toolbar: true },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/NumberRangeObject", label: "Number Ranges", icon: "hash" },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/PartnerDirectory", label: "Partner Directory", icon: "addressBook" },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/UserRoles", label: "User Roles", icon: "userCheck" },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/MessageUsage", label: "Message Usage", icon: "barChart" },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/SystemLogs", label: "System Logs", icon: "fileText" },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/Locks", label: "Message Locks", icon: "lock", toolbar: true },
  { group: "monitoring", area: "Monitor", path: "/shell/monitoring/DesigntimeLocks", label: "Designtime Artifact Locks", icon: "fileLock" },
];

// artifact types (cpiArtifactURIRegexp names) that write message processing logs
const CPIH_MESSAGE_TYPES = ["IFlow", "ODATA API", "REST API", "SOAP API", "API"];
// artifact types that show up in Manage Integration Content once deployed
const CPIH_DEPLOYABLE_TYPES = [...CPIH_MESSAGE_TYPES, "MCP Server", "Value Mapping", "Script Collection", "Message Mapping"];

// the monitor pages put the runtime location first, like the CPI itself does
function cpihMonitorFilter(runtimeLocationId, filter) {
  return encodeURIComponent(JSON.stringify(runtimeLocationId ? { edge: { runtimeLocationId }, ...filter } : filter));
}

// context entries for the artifact that is open: its messages, its deployment and its package
function cpihArtifactJumpTargets({ artifactId, artifactType, packageId, runtimeLocationId }) {
  const targets = [];
  if (artifactId && CPIH_MESSAGE_TYPES.includes(artifactType)) {
    const filter = { status: "ALL", packageId: "ALL", artifactIds: [artifactId], type: "ALL", time: "PASTHOUR" };
    targets.push({ path: "/shell/monitoring/Messages/" + cpihMonitorFilter(runtimeLocationId, filter), label: "Messages of this artifact", area: "Monitor", icon: "envelope" });
  }
  if (artifactId && CPIH_DEPLOYABLE_TYPES.includes(artifactType)) {
    targets.push({ path: "/shell/monitoring/Artifacts/" + cpihMonitorFilter(runtimeLocationId, { artifact: artifactId }), label: "Deployment status", area: "Monitor", icon: "layers" });
  }
  if (packageId) {
    targets.push({ path: cpihPackagePath(packageId), label: "Open package", area: "Design", icon: "package" });
  }
  return targets;
}

// messages of every artifact of a package
function cpihPackageMessagesPath(packageId, runtimeLocationId) {
  return "/shell/monitoring/Messages/" + cpihMonitorFilter(runtimeLocationId, { status: "ALL", packageId, type: "ALL", time: "PASTHOUR" });
}

function cpihPackagePath(packageId) {
  return `/shell/design/contentpackage/${encodeURIComponent(packageId)}?section=ARTIFACTS`;
}

// artifact types of the design time workspace api (/api/1.0/workspace/<id>/artifacts) mapped to the
// type names of cpiArtifactURIRegexp and the path segment of their editor page
const CPIH_WORKSPACE_TYPES = {
  IFlow: { type: "IFlow", segment: "integrationflows" },
  ScriptCollection: { type: "Script Collection", segment: "scriptcollections" },
  MessageMapping: { type: "Message Mapping", segment: "messagemappings" },
  ValueMapping: { type: "Value Mapping", segment: "valuemappings" },
  RESTAPIProvider: { type: "REST API", segment: "restapis" },
  SOAPAPIProvider: { type: "SOAP API", segment: "soapapis" },
  "OData Service": { type: "ODATA API", segment: "odataservices" },
  API: { type: "API", segment: "apis" },
  MCPSERVER: { type: "MCP Server", segment: "mcpservers" },
};

// null for types without an editor page of their own, e.g. integration adapters
function cpihArtifactPath(packageId, workspaceType, artifactId) {
  const known = CPIH_WORKSPACE_TYPES[workspaceType];
  if (!known || !packageId || !artifactId) return null;
  return `/shell/design/contentpackage/${encodeURIComponent(packageId)}/${known.segment}/${encodeURIComponent(artifactId)}`;
}

if (typeof module !== "undefined") {
  module.exports = { CPIH_JUMP_TARGETS, CPIH_FAILED_MESSAGES_PATH, CPIH_WORKSPACE_TYPES, cpihArtifactJumpTargets, cpihArtifactPath, cpihPackagePath, cpihPackageMessagesPath };
}
