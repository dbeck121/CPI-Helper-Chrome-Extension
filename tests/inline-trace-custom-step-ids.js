/*
 * Regression test: inline trace on an iFlow with custom step ids.
 *
 * Reproduces an iFlow whose BPMN elements do NOT use the ids SAP generates
 * automatically (CallActivity_5, ExclusiveGateway_2, ...) but custom ones
 * (CA_DSGet, GW_Ready, MF_SG). Deriving the node type with regexes over the
 * step id matched none of them, so no node was highlighted at all even though
 * every element was present in the DOM.
 *
 * There is no test runner in this repo, so this is a standalone script:
 *
 *   node tests/inline-trace-custom-step-ids.js
 *
 * Exits 0 on success, 1 on failure.
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const file = process.env.INLINE_TRACE_FILE || path.join(__dirname, "..", "scripts", "inline-trace.js");
const code = fs.readFileSync(file, "utf8");

function createClassList() {
  const set = new Set();
  return {
    add(...n) {
      n.forEach((x) => set.add(x));
    },
    remove(...n) {
      n.forEach((x) => set.delete(x));
    },
    contains(x) {
      return set.has(x);
    },
  };
}

function el(localName, cls) {
  const node = { localName, children: [], classList: createClassList(), setAttribute() {}, onclick: null };
  if (cls) node.classList.add(cls);
  return node;
}

/** A BPMN shape as SAP renders it: <g>[<title>?]<g><rect class="activity">... */
function makeShape(id, withTitle) {
  const rect = el("rect", "activity");
  const inner = el("g");
  inner.children = [rect];
  const node = el("g", "sapGalileiSymbolNode");
  node.id = id;
  node.children = withTitle ? [el("title"), inner] : [inner];
  node.__paint = rect;
  return node;
}

/** A message flow: the text label is what gets coloured. */
function makeEdge(id) {
  const label = el("text", "shapeText");
  const node = el("g", "sapGalileiSymbolNode");
  node.id = id;
  node.children = [label];
  node.__paint = label;
  return node;
}

const nodes = {
  BPMNShape_CA_DSGet: makeShape("BPMNShape_CA_DSGet", false), // no <title>
  BPMNShape_CA_Key: makeShape("BPMNShape_CA_Key", true), // with <title>
  BPMNShape_GW_Ready: makeShape("BPMNShape_GW_Ready", true),
  BPMNShape_CM_Payload: makeShape("BPMNShape_CM_Payload", true),
  BPMNShape_StartEvent_1: makeShape("BPMNShape_StartEvent_1", true),
  BPMNEdge_MF_SG: makeEdge("BPMNEdge_MF_SG"),
};

// Steps as returned by the trace of such an iFlow
const runs = [
  { StepId: "CA_DSGet", ModelStepId: "CA_DSGet" },
  { StepId: "CA_Key", ModelStepId: "CA_Key" },
  { StepId: "GW_Ready", ModelStepId: "GW_Ready" },
  { StepId: "CM_Payload", ModelStepId: "CM_Payload" },
  { StepId: "MF_SG#1787289935763", ModelStepId: "MF_SG" }, // instance suffix
  { StepId: null, ModelStepId: "StartEvent_1" }, // null StepId
].map((r, i) => Object.assign({ ChildCount: i, StepStop: "/Date(2000)/", StepStart: "/Date(1000)/", RunId: "R" + i, BranchId: "B", Error: null }, r));

const context = {
  console,
  document: {
    getElementById: (id) => nodes[id] || null,
    querySelectorAll: () => [],
    querySelector: () => null,
  },
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  getStorageValue: async () => false,
  getMessageProcessingLogRuns: async () => runs,
  log: { log() {}, error() {}, debug() {}, warn() {} },
  onClicKElements: [],
  showToast() {},
  showBigPopup() {},
  showWaitingPopup() {},
  createTabHTML: async () => "<div></div>",
  formatHeadersAndPropertiesToTable: () => "<table></table>",
  $: () => ({ removeAttr() {}, toast() {} }),
};
context.window = context;
vm.createContext(context);
vm.runInContext(code, context);

const fail = (msg) => {
  console.error("FAILED: " + msg);
  process.exit(1);
};

(async () => {
  const result = await context.showInlineTrace("MSG1", false);
  if (result !== true) fail("showInlineTrace returned " + result + ", expected true");

  const notHighlighted = Object.keys(nodes).filter((id) => !nodes[id].__paint.classList.contains("cpiHelper_inlineInfo"));
  if (notHighlighted.length) {
    fail("these nodes were not highlighted although they exist in the DOM: " + notHighlighted.join(", "));
  }

  // the start event is highlighted but must not be clickable
  if (nodes.BPMNShape_StartEvent_1.classList.contains("cpiHelper_onclick")) {
    fail("the start event should not be clickable");
  }
  if (!nodes.BPMNShape_CA_DSGet.classList.contains("cpiHelper_onclick")) {
    fail("CA_DSGet should be clickable");
  }
  if (context.onClicKElements.length !== 5) {
    fail("expected 5 clickable elements, got " + context.onClicKElements.length);
  }

  console.log("OK: all 6 steps with custom ids are resolved and highlighted (5 clickable + start event).");
})().catch((e) => {
  console.error("FAILED with exception:", e);
  process.exit(1);
});
