// node tests/snippet-clipboard.test.js
// pruning of the iFlow editor clipboard down to only the copied elements (see common/snippet-clipboard.js)
const assert = require("node:assert/strict");
const { cpihPruneSnippetClipboard } = require("../common/snippet-clipboard.js");

const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// a minimal clipboard shaped like a real one: one copied CallActivity, plus what the editor's own Copy pulls in
// on the side - a Start/End event, sequence flows and Sender/Receiver participants of the whole iFlow
function fixtureClipboard() {
  const diagram = {
    contents: {
      start: { classDefinition: "sap.bpm.modelling.StartEvent", name: "Start Timer 1" },
      startEventDefinition: { classDefinition: "sap.bpm.modelling.EventDefinition" },
      end: { classDefinition: "sap.bpm.modelling.EndEvent", name: "End" },
      flow1: { classDefinition: "sap.bpm.modelling.SequenceFlow" },
      flow2: { classDefinition: "sap.bpm.modelling.SequenceFlow" },
      step: { classDefinition: "sap.bpm.modelling.CallActivity", name: "Content Modifier 1", customData: { copyProperties: { propertyStoreElement: { name: "Content Modifier 1", activityType: "Enricher" } } } },
      receiver: { classDefinition: "sap.bpm.modelling.Participant", name: "Receiver", customData: { address: "https://receiver.example.com/secret", credentialName: "ReceiverCred" } },
      sender: { classDefinition: "sap.bpm.modelling.Participant", name: "Sender" },
      stepSymbol: { classDefinition: "sap.bpm.modelling.ui.ActivitySymbol" },
      flow3: { classDefinition: "sap.bpm.modelling.MessageFlow" },
      flow3Symbol: { classDefinition: "sap.bpm.modelling.ui.MessageFlowSymbol" },
      process: {
        classDefinition: "sap.bpm.modelling.Participant",
        name: "Integration Process",
        events: { start: { name: "Start Timer 1" }, end: { name: "End" } },
        sequenceFlows: { flow1: { name: "" }, flow2: { name: "" } },
        activities: { step: { name: "Content Modifier 1" } },
      },
      model: {
        classDefinition: "sap.bpm.modelling.Model",
        name: "Model",
        participants: { process: { name: "Integration Process" }, receiver: { name: "Receiver" }, sender: { name: "Sender" } },
        messageFlows: { flow3: { name: "AI" } },
      },
      diagram: {
        classDefinition: "sap.bpm.modelling.ui.Diagram",
        name: "Diagram",
        symbols: { stepSymbol: { name: "BPMNShape_CallActivity_5" }, flow3Symbol: { name: "BPMNEdge_MessageFlow_30" } },
      },
    },
  };
  return {
    copyObjectIds: ["step"],
    copySymbolIds: ["stepSymbol"],
    objectIdMap: { step: "step", stepSymbol: "stepSymbol", start: "start", end: "end", receiver: "receiver", sender: "sender", process: "process", model: "model", diagram: "diagram" },
    objectContainerMap: { step: "process", stepSymbol: "diagram", start: "process", end: "process", flow1: "process", flow2: "process", process: "model", receiver: "model", sender: "model", diagram: "model", startEventDefinition: "start" },
    diagramContent: JSON.stringify(diagram),
  };
}

test("drops steps, events and sequence flows not among the copied elements", () => {
  const pruned = cpihPruneSnippetClipboard(fixtureClipboard());
  const contents = JSON.parse(pruned.diagramContent).contents;
  assert.equal(contents.start, undefined);
  assert.equal(contents.end, undefined);
  assert.equal(contents.flow1, undefined);
  assert.equal(contents.flow2, undefined);
});

test("drops the sender and receiver participants and their configuration", () => {
  const pruned = cpihPruneSnippetClipboard(fixtureClipboard());
  const contents = JSON.parse(pruned.diagramContent).contents;
  assert.equal(contents.receiver, undefined);
  assert.equal(contents.sender, undefined);
  assert.ok(!JSON.stringify(pruned).includes("receiver.example.com"));
  assert.ok(!JSON.stringify(pruned).includes("ReceiverCred"));
});

test("keeps the copied element, its symbol and the container chain up to Model/Diagram", () => {
  const pruned = cpihPruneSnippetClipboard(fixtureClipboard());
  const contents = JSON.parse(pruned.diagramContent).contents;
  assert.equal(contents.step.name, "Content Modifier 1");
  assert.ok(contents.stepSymbol);
  assert.ok(contents.process);
  assert.ok(contents.model);
  assert.ok(contents.diagram);
});

test("strips the container maps down to only the copied element", () => {
  const pruned = cpihPruneSnippetClipboard(fixtureClipboard());
  const contents = JSON.parse(pruned.diagramContent).contents;
  assert.deepEqual(Object.keys(contents.process.activities), ["step"]);
  assert.deepEqual(contents.process.events, {});
  assert.deepEqual(contents.process.sequenceFlows, {});
  assert.deepEqual(Object.keys(contents.model.participants), ["process"]);
});

test("drops the whole iFlow's message flows and diagram symbols, keeping only the copied symbol", () => {
  const pruned = cpihPruneSnippetClipboard(fixtureClipboard());
  const contents = JSON.parse(pruned.diagramContent).contents;
  assert.deepEqual(contents.model.messageFlows, {});
  assert.deepEqual(Object.keys(contents.diagram.symbols), ["stepSymbol"]);
  assert.ok(!JSON.stringify(pruned).includes("BPMNEdge_MessageFlow_30"));
});

test("objectIdMap and objectContainerMap only reference kept ids", () => {
  const pruned = cpihPruneSnippetClipboard(fixtureClipboard());
  assert.deepEqual(Object.keys(pruned.objectIdMap).sort(), ["diagram", "model", "process", "step", "stepSymbol"]);
  for (const [key, value] of Object.entries(pruned.objectContainerMap)) {
    assert.ok(Object.keys(pruned.objectIdMap).includes(key) || key === "step" || key === "stepSymbol", `unexpected container map key ${key}`);
    assert.ok(pruned.objectIdMap[value] || value === "model", `unexpected container map value ${value}`);
  }
});

test("is safe to run twice (idempotent)", () => {
  const once = cpihPruneSnippetClipboard(fixtureClipboard());
  const twice = cpihPruneSnippetClipboard(once);
  assert.equal(twice.diagramContent, once.diagramContent);
});

test("keeps the child of a copied element, e.g. the EventDefinition of a copied Start event", () => {
  const clipboard = fixtureClipboard();
  clipboard.copyObjectIds = ["start"];
  clipboard.copySymbolIds = [];
  const pruned = cpihPruneSnippetClipboard(clipboard);
  const contents = JSON.parse(pruned.diagramContent).contents;
  assert.ok(contents.start);
  assert.ok(contents.startEventDefinition, "the EventDefinition child of the copied Start event was dropped");
  // still no unrelated siblings under the shared Process/Model container
  assert.equal(contents.end, undefined);
  assert.equal(contents.receiver, undefined);
});

test("falls back to the original content when it cannot be parsed", () => {
  const broken = { copyObjectIds: ["x"], diagramContent: "not json" };
  assert.deepEqual(cpihPruneSnippetClipboard(broken), broken);
});

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log("ok -", name);
  } catch (error) {
    failed++;
    console.error("FAIL -", name);
    console.error(error);
  }
}
if (failed) {
  console.error(`${failed}/${cases.length} snippet-clipboard tests failed`);
  process.exit(1);
}
console.log(`${cases.length}/${cases.length} snippet-clipboard tests passed`);
