// Generates an XSD from a sample XML, for the source and target schemas of the CPI message mapping.
// All instances of an element at the same place are merged: repeated elements get maxOccurs="unbounded",
// elements or attributes missing in some instances become optional, value types are inferred from all values.
// Pure functions, no DOM, so they run in node for the tests (tests/xml-to-xsd.test.js).
//
// Supported namespace layouts (the ones that fit into one schema file):
//   - no namespace at all
//   - every element in the namespace of the root element (elementFormDefault="qualified")
//   - only the root element in a namespace, the children without (elementFormDefault="unqualified", typical for SAP messages)
// Anything else throws, a generated schema would be wrong.

const CPIH_XSD_NS = "http://www.w3.org/2001/XMLSchema";
const CPIH_XSD_XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";
const CPIH_XSD_DESIGNS = ["russian-doll", "venetian-blind"];
const CPIH_XSD_KEY_SEPARATOR = "\u0001";
const CPIH_XSD_RUN_SEPARATOR = "\u0002";

// ---------------------------------------------------------------- parsing

function cpihXsdDecodeEntities(text) {
  if (!text.includes("&")) return text;
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (match, entity) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" }[entity];
  });
}

// builds a small element tree with resolved namespaces. Throws on markup that is not well formed.
function cpihXsdParseXml(source) {
  const tokenize = typeof cpihTokenizeXml === "function" ? cpihTokenizeXml : require("./formatter.js").cpihTokenizeXml;
  const rootScope = Object.create(null);
  rootScope.xml = "http://www.w3.org/XML/1998/namespace";
  const document = { children: [] };
  const stack = [{ element: document, scope: rootScope }];

  for (const token of tokenize(String(source ?? ""))) {
    const top = stack[stack.length - 1];
    switch (token.type) {
      case "text": {
        if (top.element === document) {
          if (token.value.trim()) throw new Error("Text outside of the root element");
        } else {
          top.element.text += cpihXsdDecodeEntities(token.value);
        }
        break;
      }
      case "cdata": {
        if (top.element !== document) top.element.text += token.value.slice(9, token.value.endsWith("]]>") ? -3 : undefined);
        break;
      }
      case "open":
      case "selfclose": {
        if (top.element === document && document.children.length) throw new Error("The XML has more than one root element");
        const body = token.value.replace(/^</, "").replace(/\s*\/?\s*>$/, "");
        const qname = body.match(/^[^\s/>]+/)?.[0];
        if (!qname) throw new Error("Element without a name");
        const scope = Object.create(top.scope);
        const rawAttributes = [];
        const attributePattern = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        let match;
        while ((match = attributePattern.exec(body.slice(qname.length)))) {
          const name = match[1];
          const value = cpihXsdDecodeEntities(match[2] ?? match[3] ?? "");
          if (name === "xmlns") scope[""] = value;
          else if (name.startsWith("xmlns:")) scope[name.slice(6)] = value;
          else rawAttributes.push({ name, value });
        }
        const resolve = (name, isAttribute) => {
          const colon = name.indexOf(":");
          const prefix = colon === -1 ? "" : name.slice(0, colon);
          const local = colon === -1 ? name : name.slice(colon + 1);
          if (!prefix) return { prefix, local, ns: isAttribute ? "" : scope[""] || "" };
          if (!(prefix in scope)) throw new Error(`Namespace prefix "${prefix}" is not declared (${name})`);
          return { prefix, local, ns: scope[prefix] };
        };
        const element = { ...resolve(qname, false), qname, attributes: rawAttributes.map((a) => ({ ...resolve(a.name, true), value: a.value })), children: [], text: "" };
        top.element.children.push(element);
        if (token.type === "open") stack.push({ element, scope });
        break;
      }
      case "close": {
        const name = token.value.slice(2, -1).trim();
        if (top.element === document) throw new Error(`Closing tag </${name}> without an opening tag`);
        if (top.element.qname !== name) throw new Error(`Closing tag </${name}> does not match <${top.element.qname}>`);
        stack.pop();
        break;
      }
    }
  }
  if (stack.length > 1) throw new Error(`Missing closing tag </${stack[stack.length - 1].element.qname}>`);
  if (!document.children.length) throw new Error("No root element found");
  return document.children[0];
}

// ---------------------------------------------------------------- type inference

const CPIH_XSD_NUMBER_RANK = { int: 1, long: 2, integer: 3, decimal: 4, double: 5 };
const CPIH_XSD_TIMEZONE = "(?:Z|[+-](?:0\\d|1[0-3]):[0-5]\\d|[+-]14:00)?";
const CPIH_XSD_DATE = "\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])";
const CPIH_XSD_TIME = "(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?";

function cpihXsdClassify(value) {
  if (value === "true" || value === "false") return "boolean";
  // numbers with a leading zero (ids, zip codes, phone numbers) are text, a number type would lose the zero
  if (/^-?(?:0|[1-9]\d*)$/.test(value)) {
    const number = BigInt(value);
    if (number >= -2147483648n && number <= 2147483647n) return "int";
    if (number >= -9223372036854775808n && number <= 9223372036854775807n) return "long";
    return "integer";
  }
  if (/^-?(?:(?:0|[1-9]\d*)\.\d+|\.\d+)$/.test(value)) return "decimal";
  if (/^-?(?:(?:0|[1-9]\d*)(?:\.\d+)?|\.\d+)[eE][+-]?\d+$/.test(value)) return "double";
  if (new RegExp(`^${CPIH_XSD_DATE}${CPIH_XSD_TIMEZONE}$`).test(value)) return "date";
  if (new RegExp(`^${CPIH_XSD_DATE}T${CPIH_XSD_TIME}${CPIH_XSD_TIMEZONE}$`).test(value)) return "dateTime";
  if (new RegExp(`^${CPIH_XSD_TIME}${CPIH_XSD_TIMEZONE}$`).test(value)) return "time";
  return "string";
}

function cpihXsdUnify(a, b) {
  if (a === null) return b;
  if (a === b) return a;
  if (CPIH_XSD_NUMBER_RANK[a] && CPIH_XSD_NUMBER_RANK[b]) return CPIH_XSD_NUMBER_RANK[a] > CPIH_XSD_NUMBER_RANK[b] ? a : b;
  return "string";
}

function cpihXsdNewValueState() {
  return { type: null, empty: false, nonEmpty: false };
}

function cpihXsdAddValue(state, rawValue) {
  const value = rawValue.trim();
  if (!value) {
    state.empty = true;
    return;
  }
  state.nonEmpty = true;
  state.type = cpihXsdUnify(state.type, cpihXsdClassify(value));
}

function cpihXsdValueType(state, inferTypes) {
  // an empty value is not valid for any type but string
  if (!inferTypes || !state.nonEmpty || state.empty) return "xs:string";
  return "xs:" + state.type;
}

// ---------------------------------------------------------------- merged model

function cpihXsdNewModel(element) {
  return {
    name: element.local,
    ns: element.ns,
    prefix: element.prefix,
    instances: 0,
    attributes: new Map(), // name -> { count, value state }
    children: new Map(), // key -> model
    order: [], // child keys in schema order
    counts: new Map(), // child key -> { min, max } per parent instance
    runs: new Set(), // child key sequence of each distinct instance, to verify the order
    interleaved: false, // a child key came back after another one (a b a)
    text: cpihXsdNewValueState(),
    hasText: false, // text next to child elements
    nillable: false,
  };
}

function cpihXsdCollect(model, element, context) {
  model.instances++;
  let isNil = false;
  for (const attribute of element.attributes) {
    if (attribute.ns === CPIH_XSD_XSI_NS) {
      if (attribute.local === "nil") isNil = ["true", "1"].includes(attribute.value.trim());
      else if (attribute.local === "type") context.warnings.add(`xsi:type on <${element.local}> is ignored, the schema describes the declared structure only.`);
    } else if (attribute.prefix) {
      context.warnings.add(`The attribute ${attribute.prefix}:${attribute.local} is skipped, attributes with a namespace are not supported.`);
    } else {
      let entry = model.attributes.get(attribute.local);
      if (!entry) model.attributes.set(attribute.local, (entry = { count: 0, state: cpihXsdNewValueState() }));
      entry.count++;
      cpihXsdAddValue(entry.state, attribute.value);
    }
  }
  if (isNil) model.nillable = true;

  const counts = new Map();
  const runs = [];
  let previousKey = null;
  for (const child of element.children) {
    const key = child.ns + CPIH_XSD_KEY_SEPARATOR + child.local;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (key !== previousKey) {
      if (counts.get(key) > 1) model.interleaved = true;
      runs.push(key);
      previousKey = key;
    }
    let childModel = model.children.get(key);
    if (!childModel) model.children.set(key, (childModel = cpihXsdNewModel(child)));
    cpihXsdCollect(childModel, child, context);
  }

  // new keys go behind the key before them in this instance, a conflicting order is caught in cpihXsdSequenceFits
  let lastIndex = -1;
  for (const key of runs) {
    let index = model.order.indexOf(key);
    if (index === -1) {
      index = lastIndex + 1;
      model.order.splice(index, 0, key);
    }
    lastIndex = index;
  }
  for (const [key, count] of counts) {
    const entry = model.counts.get(key);
    if (!entry) model.counts.set(key, { min: model.instances > 1 ? 0 : count, max: count });
    else {
      entry.min = Math.min(entry.min, count);
      entry.max = Math.max(entry.max, count);
    }
  }
  for (const [key, entry] of model.counts) if (!counts.has(key)) entry.min = 0;
  if (runs.length) model.runs.add(runs.join(CPIH_XSD_RUN_SEPARATOR));

  const text = element.text.trim();
  if (element.children.length) {
    if (text) model.hasText = true;
  } else if (!isNil) {
    cpihXsdAddValue(model.text, text);
  }
}

// false when instances list the children in different orders, then only a repeatable choice describes all of them
function cpihXsdSequenceFits(model) {
  if (model.interleaved) return false;
  const position = new Map(model.order.map((key, index) => [key, index]));
  for (const run of model.runs) {
    const keys = run.split(CPIH_XSD_RUN_SEPARATOR);
    for (let i = 1; i < keys.length; i++) if (position.get(keys[i]) <= position.get(keys[i - 1])) return false;
  }
  return true;
}

function cpihXsdDescendants(model, found = []) {
  for (const child of model.children.values()) {
    found.push(child);
    cpihXsdDescendants(child, found);
  }
  return found;
}

// target namespace, element form and prefix of the schema, throws when the layout needs several schemas
function cpihXsdNamespaceLayout(root) {
  const childNamespaces = new Set(cpihXsdDescendants(root).map((model) => model.ns));
  const targetNamespace = root.ns;
  let elementFormDefault = "qualified";
  if (childNamespaces.size === 1 && childNamespaces.has("") && targetNamespace) {
    elementFormDefault = "unqualified";
  } else if ([...childNamespaces].some((ns) => ns !== targetNamespace)) {
    const all = [...new Set([targetNamespace, ...childNamespaces])].map((ns) => ns || "(no namespace)");
    throw new Error(
      `The elements use several namespaces (${all.join(", ")}). A single schema can only describe one namespace, ` +
        "generate the schemas from the parts of the XML separately."
    );
  }
  const validPrefix = root.prefix && root.prefix !== "xs" && !/^xml/i.test(root.prefix);
  return { targetNamespace, elementFormDefault, prefix: targetNamespace ? (validPrefix ? root.prefix : "tns") : "" };
}

// ---------------------------------------------------------------- writing the xsd

const cpihXsdEscape = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function cpihXsdOccurrence(entry, allOptional) {
  return (allOptional || entry.min === 0 ? ' minOccurs="0"' : "") + (entry.max > 1 ? ' maxOccurs="unbounded"' : "");
}

function cpihXsdWriteSchema(root, layout, options) {
  const lines = [];
  const indentation = (level) => "  ".repeat(level);
  const write = (level, text) => lines.push(indentation(level) + text);
  const blind = options.design === "venetian-blind";
  const typeNames = new Map();
  const usedTypeNames = new Set();
  const pendingTypes = [];

  // what an element looks like: a plain simple type, text with attributes, or a complex type
  const kindOf = (model) => {
    if (!model.children.size && !model.attributes.size) return "simple";
    if (!model.children.size && model.text.nonEmpty) return "simpleContent";
    return "complex";
  };

  const writeAttributes = (model, level) => {
    for (const [name, entry] of model.attributes) {
      const required = entry.count === model.instances && !options.allOptional ? ' use="required"' : "";
      write(level, `<xs:attribute name="${cpihXsdEscape(name)}" type="${cpihXsdValueType(entry.state, options.inferTypes)}"${required}/>`);
    }
  };

  // the content of a complex type, without the xs:complexType tags
  const writeTypeContent = (model, level) => {
    if (kindOf(model) === "simpleContent") {
      write(level, "<xs:simpleContent>");
      write(level + 1, `<xs:extension base="${cpihXsdValueType(model.text, options.inferTypes)}">`);
      writeAttributes(model, level + 2);
      write(level + 1, "</xs:extension>");
      write(level, "</xs:simpleContent>");
      return;
    }
    if (model.children.size) {
      const sequence = cpihXsdSequenceFits(model);
      write(level, sequence ? "<xs:sequence>" : '<xs:choice minOccurs="0" maxOccurs="unbounded">');
      for (const key of model.order) writeElement(model.children.get(key), level + 1, sequence ? model.counts.get(key) : null);
      write(level, sequence ? "</xs:sequence>" : "</xs:choice>");
    }
    writeAttributes(model, level);
  };

  const mixedAttribute = (model) => (model.children.size && (model.hasText || model.text.nonEmpty) ? ' mixed="true"' : "");

  const typeNameFor = (model) => {
    let name = typeNames.get(model);
    if (!name) {
      const base = model.name + "Type";
      name = base;
      for (let counter = 2; usedTypeNames.has(name); counter++) name = base + counter;
      usedTypeNames.add(name);
      typeNames.set(model, name);
      pendingTypes.push(model);
    }
    return name;
  };

  // entry: { min, max } for a local element, null for the global root and elements in a choice
  function writeElement(model, level, entry) {
    const head = `<xs:element name="${cpihXsdEscape(model.name)}"${entry ? cpihXsdOccurrence(entry, options.allOptional) : ""}${model.nillable ? ' nillable="true"' : ""}`;
    const kind = kindOf(model);
    if (kind === "simple") {
      write(level, `${head} type="${cpihXsdValueType(model.text, options.inferTypes)}"/>`);
    } else if (blind) {
      write(level, `${head} type="${layout.prefix ? layout.prefix + ":" : ""}${typeNameFor(model)}"/>`);
    } else {
      write(level, head + ">");
      write(level + 1, `<xs:complexType${mixedAttribute(model)}>`);
      writeTypeContent(model, level + 2);
      write(level + 1, "</xs:complexType>");
      write(level, "</xs:element>");
    }
  }

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  const namespaces = layout.targetNamespace ? ` xmlns:${layout.prefix}="${cpihXsdEscape(layout.targetNamespace)}" targetNamespace="${cpihXsdEscape(layout.targetNamespace)}"` : "";
  lines.push(`<xs:schema xmlns:xs="${CPIH_XSD_NS}"${namespaces} elementFormDefault="${layout.elementFormDefault}">`);
  writeElement(root, 1, null);
  for (let i = 0; i < pendingTypes.length; i++) {
    const model = pendingTypes[i];
    write(1, `<xs:complexType name="${typeNames.get(model)}"${mixedAttribute(model)}>`);
    writeTypeContent(model, 2);
    write(1, "</xs:complexType>");
  }
  lines.push("</xs:schema>");
  return lines.join("\n") + "\n";
}

/**
 * @param {string} xml sample XML with one root element
 * @param {{ design?: "russian-doll" | "venetian-blind", inferTypes?: boolean, allOptional?: boolean }} options
 *   design: russian-doll nests everything below one global root element, venetian-blind gives every complex element a named type.
 *   inferTypes: false types every value as xs:string.
 *   allOptional (default true): every element gets minOccurs="0" and no attribute is required. A sample cannot show what is mandatory.
 *   false marks what is present in every instance of the sample as required.
 * @returns {{ xsd: string, rootName: string, warnings: string[] }}
 */
function cpihXmlToXsd(xml, options = {}) {
  const settings = { design: "russian-doll", inferTypes: true, allOptional: true, ...options };
  if (!CPIH_XSD_DESIGNS.includes(settings.design)) throw new Error(`Unknown design "${settings.design}"`);
  const rootElement = cpihXsdParseXml(xml);
  const context = { warnings: new Set() };
  const root = cpihXsdNewModel(rootElement);
  cpihXsdCollect(root, rootElement, context);
  const layout = cpihXsdNamespaceLayout(root);
  return { xsd: cpihXsdWriteSchema(root, layout, settings), rootName: root.name, warnings: [...context.warnings] };
}

if (typeof module !== "undefined") {
  module.exports = { cpihXmlToXsd, cpihXsdClassify, cpihXsdParseXml };
}
