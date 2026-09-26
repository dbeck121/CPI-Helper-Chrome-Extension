// node tests/formatter.test.js
const assert = require("node:assert/strict");
const { cpihFormatXml, cpihFormatJson, cpihDetectPayloadType, cpihPrettifyPayload } = require("../common/formatter.js");

const cases = [];
const test = (name, fn) => cases.push([name, fn]);

test("xml: nested elements are indented, text stays inline", () => {
  assert.equal(cpihFormatXml("<a><b>1</b><c><d>x</d></c></a>"), "<a>\n  <b>1</b>\n  <c>\n    <d>x</d>\n  </c>\n</a>");
});

test("xml: declaration, comment, cdata, pi and entities survive unchanged", () => {
  const input = '<?xml version="1.0" encoding="UTF-8"?><root xmlns:a="urn:a"><!-- c --><a:item id="1">Text &amp; more</a:item><data><![CDATA[<inner>x</inner>]]></data><?pi x?><empty/></root>';
  const out = cpihFormatXml(input);
  assert.equal(
    out,
    '<?xml version="1.0" encoding="UTF-8"?>\n<root xmlns:a="urn:a">\n  <!-- c -->\n  <a:item id="1">Text &amp; more</a:item>\n  <data><![CDATA[<inner>x</inner>]]></data>\n  <?pi x?>\n  <empty/>\n</root>'
  );
  assert.equal(out.replace(/\n\s*/g, ""), input);
});

test("xml: attribute values with > and quotes", () => {
  assert.equal(cpihFormatXml(`<a x="1>2" y='"'><b/></a>`), `<a x="1>2" y='"'>\n  <b/>\n</a>`);
});

test("xml: fragment with several roots", () => {
  assert.equal(cpihFormatXml("<a>1</a><b>2</b>"), "<a>1</a>\n<b>2</b>");
});

test("xml: empty element pair stays together", () => {
  assert.equal(cpihFormatXml("<a><b></b></a>"), "<a>\n  <b></b>\n</a>");
});

test("xml: already formatted input is stable", () => {
  const once = cpihFormatXml("<a>\n    <b>1</b>\n\n  <c/></a>");
  assert.equal(cpihFormatXml(once), once);
});

test("xml: doctype with internal subset", () => {
  assert.equal(cpihFormatXml('<!DOCTYPE a [<!ENTITY e "v">]><a>&e;</a>'), '<!DOCTYPE a [<!ENTITY e "v">]>\n<a>&e;</a>');
});

test("xml: indent size", () => {
  assert.equal(cpihFormatXml("<a><b/></a>", 4), "<a>\n    <b/>\n</a>");
});

test("xml: broken markup does not throw", () => {
  assert.doesNotThrow(() => cpihFormatXml("<a><b></a></c><d"));
});

test("json: big numbers, notation and key order are kept", () => {
  const out = cpihFormatJson('{"id":12345678901234567890,"b":{"z":1.50,"a":[1,2,{"x":"y"}]},"10":"ten","e":1e5}');
  assert.equal(out, '{\n  "id": 12345678901234567890,\n  "b": {\n    "z": 1.50,\n    "a": [\n      1,\n      2,\n      {\n        "x": "y"\n      }\n    ]\n  },\n  "10": "ten",\n  "e": 1e5\n}');
});

test("json: strings with escapes, braces and whitespace", () => {
  assert.equal(cpihFormatJson('{"a":"x \\" { , : ] y","b":"  two  spaces"}'), '{\n  "a": "x \\" { , : ] y",\n  "b": "  two  spaces"\n}');
});

test("json: empty object and array stay compact", () => {
  assert.equal(cpihFormatJson('{"a":{},"b":[ ]}'), '{\n  "a": {},\n  "b": []\n}');
});

test("json: re-formatting is stable", () => {
  const once = cpihFormatJson('[{"a":1},{"b":[true,null]}]');
  assert.equal(cpihFormatJson(once), once);
  assert.deepEqual(JSON.parse(once), [{ a: 1 }, { b: [true, null] }]);
});

test("detect type", () => {
  assert.equal(cpihDetectPayloadType("  <a/>"), "xml");
  assert.equal(cpihDetectPayloadType('{"a":1}'), "json");
  assert.equal(cpihDetectPayloadType("SELECT a FROM b WHERE c = 1"), "sql");
  assert.equal(cpihDetectPayloadType("hello"), "text");
});

test("prettify leaves text alone", () => {
  assert.deepEqual(cpihPrettifyPayload("just text"), { text: "just text", type: "text", changed: false });
});

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log("ok   " + name);
  } catch (error) {
    failed++;
    console.log("FAIL " + name + "\n" + error.message);
  }
}
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
