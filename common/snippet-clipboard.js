// Shrinks an iFlow editor clipboard (localStorage["GalileiClipboard"]) down to only the copied elements.
// The editor's own Copy serializes the whole diagram the steps came from: unrelated steps, start/end events,
// sequence flows and the sender/receiver participants come along even when a single step is copied. That is a
// privacy problem once a snippet leaves the tenant it was copied from (export, sharing), so a snippet keeps only
// the copied objects/symbols and the container chain (Process/Model/Diagram) that Paste needs to place them.
function cpihPruneSnippetClipboard(content) {
  if (!content) return content;
  try {
    const diagram = typeof content.diagramContent === "string" ? JSON.parse(content.diagramContent) : content.diagramContent;
    const containerMap = content.objectContainerMap || {};
    const roots = [...(content.copyObjectIds || []), ...(content.copySymbolIds || [])];
    const keep = new Set(roots);

    // down: children of the copied elements themselves, e.g. the EventDefinition of a copied Start/Timer event.
    // this only starts from the roots, never from an ancestor added below, or every sibling under Model/a
    // Process would come back in (their container is the same ancestor)
    const childrenOf = {};
    for (const [child, parent] of Object.entries(containerMap)) (childrenOf[parent] ||= []).push(child);
    let frontier = roots;
    while (frontier.length) {
      const next = [];
      for (const id of frontier) for (const child of childrenOf[id] || []) if (!keep.has(child)) { keep.add(child); next.push(child); }
      frontier = next;
    }

    // up: the container chain (Process/Model/Diagram) that Paste needs to place the copied elements
    let added = true;
    while (added) {
      added = false;
      for (const id of [...keep]) {
        const parent = containerMap[id];
        if (parent && !keep.has(parent)) {
          keep.add(parent);
          added = true;
        }
      }
    }

    // a plain object whose every key is itself an id of the diagram is one of the editor's reference maps (e.g.
    // Model.participants, Model.messageFlows, Diagram.symbols, Participant.events/sequenceFlows/activities): it
    // lists every such element of the whole iFlow by name, not only the copied ones, and has to be cut down to
    // the ones that are actually kept. Detecting this structurally (instead of a fixed list of map names) covers
    // maps not seen yet, and does so at any nesting depth
    const isIdMap = (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const keys = Object.keys(value);
      return keys.length > 0 && keys.every((key) => Object.prototype.hasOwnProperty.call(diagram?.contents || {}, key));
    };
    const pruneIdMaps = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(pruneIdMaps);
      for (const key of Object.keys(node)) {
        if (isIdMap(node[key])) {
          for (const childId of Object.keys(node[key])) if (!keep.has(childId)) delete node[key][childId];
        } else {
          pruneIdMaps(node[key]);
        }
      }
    };

    const prunedContents = {};
    for (const id of keep) {
      const object = diagram?.contents?.[id];
      if (!object) continue;
      const clone = structuredClone(object);
      pruneIdMaps(clone);
      prunedContents[id] = clone;
    }

    const objectIdMap = {};
    for (const [key, value] of Object.entries(content.objectIdMap || {})) if (keep.has(value)) objectIdMap[key] = value;
    const objectContainerMap = {};
    for (const [key, value] of Object.entries(containerMap)) if (keep.has(key) && keep.has(value)) objectContainerMap[key] = value;

    return { ...content, objectIdMap, objectContainerMap, diagramContent: JSON.stringify({ contents: prunedContents }) };
  } catch (error) {
    return content;
  }
}

if (typeof module !== "undefined") {
  module.exports = { cpihPruneSnippetClipboard };
}
