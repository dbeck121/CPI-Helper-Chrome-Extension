// Lossless pretty printer for the payload viewer. Only whitespace between tokens changes:
// XML keeps CDATA, comments, processing instructions, doctype, entities and namespace prefixes,
// JSON keeps big numbers, number notation and key order (no JSON.parse round trip).
// Pure functions, no DOM, so they run in node for the tests (tests/formatter.test.js).

function cpihDetectPayloadType(input) {
  const trimmed = String(input ?? "").trim();
  if (trimmed[0] == "<") {
    return "xml";
  }
  if (trimmed[0] == "{" || trimmed[0] == "[") {
    return "json";
  }
  const sqlOccurrence = trimmed
    .substring(0, 100)
    .toLowerCase()
    .match(/select|from|where|update|insert|upsert|create table|union|join|values|group by/gm)?.length;
  if ((sqlOccurrence && sqlOccurrence >= 2) || (trimmed.substring(0, 2) === "--" && sqlOccurrence >= 1) || trimmed.substring(0, 5) === "--sql") {
    return "sql";
  }
  return "text";
}

// splits xml into markup and text tokens without interpreting it
function cpihTokenizeXml(source) {
  const tokens = [];
  const length = source.length;
  let index = 0;
  const push = (type, value) => tokens.push({ type, value });
  const until = (terminator, from) => {
    const end = source.indexOf(terminator, from);
    return end === -1 ? length : end + terminator.length;
  };

  while (index < length) {
    if (source[index] !== "<") {
      const end = source.indexOf("<", index);
      const stop = end === -1 ? length : end;
      push("text", source.slice(index, stop));
      index = stop;
      continue;
    }
    let end;
    if (source.startsWith("<!--", index)) {
      end = until("-->", index + 4);
      push("comment", source.slice(index, end));
    } else if (source.startsWith("<![CDATA[", index)) {
      end = until("]]>", index + 9);
      push("cdata", source.slice(index, end));
    } else if (source.startsWith("<?", index)) {
      end = until("?>", index + 2);
      push("pi", source.slice(index, end));
    } else if (source.startsWith("<!", index)) {
      // doctype, can carry an internal subset in brackets
      let depth = 0;
      end = index + 2;
      while (end < length) {
        const character = source[end];
        if (character === "[") depth++;
        else if (character === "]") depth--;
        else if (character === ">" && depth <= 0) break;
        end++;
      }
      end = Math.min(end + 1, length);
      push("doctype", source.slice(index, end));
    } else {
      // tag, attribute values may contain ">"
      let quote = null;
      end = index + 1;
      while (end < length) {
        const character = source[end];
        if (quote) {
          if (character === quote) quote = null;
        } else if (character === '"' || character === "'") {
          quote = character;
        } else if (character === ">") {
          break;
        } else if (character === "<") {
          // broken markup, stop before the next tag instead of swallowing it
          end--;
          break;
        }
        end++;
      }
      end = Math.min(end + 1, length);
      const value = source.slice(index, end);
      if (value.startsWith("</")) push("close", value);
      else if (/\/\s*>$/.test(value)) push("selfclose", value);
      else push("open", value);
    }
    index = end;
  }
  return tokens;
}

function cpihFormatXml(source, indentSize = 2) {
  const tokens = cpihTokenizeXml(String(source ?? ""));
  const unit = " ".repeat(indentSize > 0 ? indentSize : 2);
  const lines = [];
  let level = 0;
  const indent = () => unit.repeat(Math.max(level, 0));
  const isBlank = (token) => token && token.type === "text" && token.value.trim() === "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case "text": {
        if (isBlank(token)) break;
        lines.push(indent() + token.value.trim());
        break;
      }
      case "open": {
        // <a>text</a> or <a><![CDATA[..]]></a> or <a></a> stay on one line
        let j = i + 1;
        let inline = "";
        while (j < tokens.length && (tokens[j].type === "text" || tokens[j].type === "cdata")) {
          inline += tokens[j].value;
          j++;
        }
        if (tokens[j] && tokens[j].type === "close" && (inline.trim() !== "" || j === i + 1 || inline === "")) {
          lines.push(indent() + token.value + (inline.trim() === "" && !inline.includes("<![CDATA[") ? "" : inline) + tokens[j].value);
          i = j;
          break;
        }
        lines.push(indent() + token.value);
        level++;
        break;
      }
      case "close": {
        level--;
        lines.push(indent() + token.value);
        break;
      }
      default: {
        // selfclose, comment, cdata, pi, doctype
        lines.push(indent() + token.value);
      }
    }
  }
  return lines.join("\n");
}

function cpihFormatJson(source, indentSize = 2) {
  const text = String(source ?? "");
  const unit = " ".repeat(indentSize > 0 ? indentSize : 2);
  let out = "";
  let level = 0;
  let inString = false;
  const newline = () => "\n" + unit.repeat(Math.max(level, 0));
  const nextSignificant = (from) => {
    for (let k = from; k < text.length; k++) {
      if (!/\s/.test(text[k])) return text[k];
    }
    return "";
  };

  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (inString) {
      out += character;
      if (character === "\\") {
        out += text[++i] ?? "";
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    switch (character) {
      case '"':
        inString = true;
        out += character;
        break;
      case "{":
      case "[": {
        const closing = character === "{" ? "}" : "]";
        if (nextSignificant(i + 1) === closing) {
          // keep empty objects and arrays compact
          out += character + closing;
          i = text.indexOf(closing, i + 1);
        } else {
          level++;
          out += character + newline();
        }
        break;
      }
      case "}":
      case "]":
        level--;
        out += newline() + character;
        break;
      case ",":
        out += "," + newline();
        break;
      case ":":
        out += ": ";
        break;
      default:
        if (!/\s/.test(character)) out += character;
    }
  }
  return out;
}

// returns { text, type, changed }. never throws, unknown content comes back unchanged
function cpihPrettifyPayload(input, indentSize = 2) {
  const source = String(input ?? "");
  const type = cpihDetectPayloadType(source);
  let text = source;
  try {
    if (type === "xml") text = cpihFormatXml(source.trim(), indentSize);
    else if (type === "json") text = cpihFormatJson(source.trim(), indentSize);
  } catch (error) {
    text = source;
  }
  return { text, type, changed: text !== source };
}

// the viewer opens formatted only when that is safe: known type, valid, not too big.
// text that only starts with { or [ (log lines, templates) stays as it is
function cpihShouldAutoFormat(input, type, limitBytes = 2 * 1024 * 1024) {
  if (type !== "xml" && type !== "json") return false;
  if (String(input ?? "").length > limitBytes) return false;
  return cpihValidatePayload(input, type) === null;
}

// best effort check for the hint below the editor, the formatter itself does not need valid input
function cpihValidatePayload(input, type) {
  const source = String(input ?? "").trim();
  try {
    if (type === "json") {
      JSON.parse(source);
    } else if (type === "xml" && typeof DOMParser !== "undefined") {
      const error = new DOMParser().parseFromString(source, "application/xml").querySelector("parsererror");
      if (error) {
        // fragments with several root elements are common in traces and not an error worth showing
        const wrapped = new DOMParser().parseFromString(`<cpih_root>${source.replace(/^<\?xml[^>]*\?>/, "")}</cpih_root>`, "application/xml").querySelector("parsererror");
        if (wrapped) return (error.textContent || "").split("\n").find((line) => line.trim()) || "XML is not well formed";
      }
    }
  } catch (error) {
    return error.message;
  }
  return null;
}

if (typeof module !== "undefined") {
  module.exports = { cpihDetectPayloadType, cpihTokenizeXml, cpihFormatXml, cpihFormatJson, cpihPrettifyPayload, cpihValidatePayload, cpihShouldAutoFormat };
}
