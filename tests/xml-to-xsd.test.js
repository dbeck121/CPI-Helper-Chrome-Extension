// node tests/xml-to-xsd.test.js
const assert = require("node:assert/strict");
const { cpihXmlToXsd, cpihXsdClassify } = require("../common/xml-to-xsd.js");

// the tests below check what the sample shows, so they switch the all-optional default off
const gen = (xml, options) => cpihXmlToXsd(xml, { allOptional: false, ...options });

const cases = [];
const test = (name, fn) => cases.push([name, fn]);
const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';
const SCHEMA = '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified">\n';

test("russian doll: nested elements, inferred types, repeated and optional elements", () => {
  const { xsd, warnings } = gen(
    '<Order id="7"><Customer>Ann</Customer><Item><Qty>2</Qty><Price>9.50</Price></Item><Item><Qty>10</Qty><Price>1</Price><Note>x</Note></Item></Order>'
  );
  assert.deepEqual(warnings, []);
  assert.equal(
    xsd,
    HEAD +
      SCHEMA +
      `  <xs:element name="Order">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Customer" type="xs:string"/>
        <xs:element name="Item" maxOccurs="unbounded">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="Qty" type="xs:int"/>
              <xs:element name="Price" type="xs:decimal"/>
              <xs:element name="Note" minOccurs="0" type="xs:string"/>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
      <xs:attribute name="id" type="xs:int" use="required"/>
    </xs:complexType>
  </xs:element>
</xs:schema>
`
  );
});

test("single value elements are simple types, the root too", () => {
  assert.equal(gen("<a>true</a>").xsd, HEAD + SCHEMA + '  <xs:element name="a" type="xs:boolean"/>\n</xs:schema>\n');
});

test("type inference: widest type of all values wins, anything mixed falls back to string", () => {
  const types = (...values) => {
    const xsd = gen(`<r>${values.map((v) => `<v>${v}</v>`).join("")}</r>`).xsd;
    return xsd.match(/name="v"[^>]*type="xs:(\w+)"/)[1];
  };
  assert.equal(types("1", "2"), "int");
  assert.equal(types("1", "3000000000"), "long");
  assert.equal(types("1", "99999999999999999999"), "integer");
  assert.equal(types("1", "2.5"), "decimal");
  assert.equal(types("2.5", "1e3"), "double");
  assert.equal(types("true", "false"), "boolean");
  assert.equal(types("true", "1"), "string");
  assert.equal(types("1", "abc"), "string");
  assert.equal(types("1", ""), "string");
  assert.equal(types("2024-01-31", "2024-02-01Z"), "date");
  assert.equal(types("2024-01-31T10:00:00", "2024-01-31T10:00:00.5+01:00"), "dateTime");
  assert.equal(types("10:00:00"), "time");
  assert.equal(types("2024-01-31", "2024-01-31T10:00:00"), "string");
});

test("classify: leading zeros and invalid dates stay text", () => {
  for (const value of ["007", "01234", "+5", "2024-13-01", "2024-02-32", "25:00:00", "1,5", "5.", "0x10"]) assert.equal(cpihXsdClassify(value), "string", value);
  for (const [value, type] of [["0", "int"], ["-12", "int"], ["0.5", "decimal"], [".5", "decimal"], ["-2147483648", "int"], ["2147483648", "long"]]) assert.equal(cpihXsdClassify(value), type, value);
});

test("inferTypes off: everything is a string", () => {
  const { xsd } = gen('<r a="1"><v>1</v></r>', { inferTypes: false });
  assert.ok(!/xs:(int|decimal|boolean)/.test(xsd));
  assert.ok(xsd.includes('<xs:attribute name="a" type="xs:string" use="required"/>'));
});

test("attributes: optional when missing in an instance, text with attributes is simpleContent", () => {
  const { xsd } = gen('<r><p cur="EUR" n="1">5</p><p cur="USD">6</p></r>');
  assert.ok(xsd.includes('<xs:extension base="xs:int">'));
  assert.ok(xsd.includes('<xs:attribute name="cur" type="xs:string" use="required"/>'));
  assert.ok(xsd.includes('<xs:attribute name="n" type="xs:int"/>'));
});

test("empty element with attributes has no content", () => {
  const { xsd } = gen('<r><p id="1"/></r>');
  assert.ok(!xsd.includes("simpleContent"));
  assert.ok(xsd.includes('<xs:attribute name="id" type="xs:int" use="required"/>'));
});

test("an element that is missing in one of the parents is optional, also when it comes first", () => {
  const { xsd } = gen("<r><g><a>1</a></g><g/></r>");
  assert.ok(xsd.includes('<xs:element name="a" minOccurs="0" type="xs:int"/>'));
});

test("children in different orders become a repeatable choice", () => {
  const { xsd } = gen("<w><r><a>1</a><b>2</b></r><r><b>3</b><a>4</a></r></w>");
  assert.ok(xsd.includes('<xs:choice minOccurs="0" maxOccurs="unbounded">'));
  assert.equal((xsd.match(/<xs:sequence>/g) || []).length, 1); // only <w> has a sequence
});

test("a child that comes back after another one is a repeatable choice", () => {
  const { xsd } = gen("<r><a>1</a><b>2</b><a>3</a></r>");
  assert.ok(xsd.includes("<xs:choice"));
});

test("text next to child elements is mixed content", () => {
  const { xsd } = gen("<p>Hello <b>world</b></p>");
  assert.ok(xsd.includes('<xs:complexType mixed="true">'));
});

test("xsi:nil makes the element nillable and its empty value does not count", () => {
  const { xsd } = gen('<r xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><n>1</n><n xsi:nil="true"/></r>');
  assert.ok(xsd.includes('<xs:element name="n" maxOccurs="unbounded" nillable="true" type="xs:int"/>'));
});

test("namespace on every element: target namespace, qualified", () => {
  const { xsd } = gen('<ns0:Order xmlns:ns0="urn:shop"><ns0:Id>1</ns0:Id></ns0:Order>');
  assert.ok(xsd.includes('xmlns:ns0="urn:shop" targetNamespace="urn:shop" elementFormDefault="qualified"'));
});

test("default namespace is the target namespace and gets the prefix tns", () => {
  const { xsd } = gen('<Order xmlns="urn:shop"><Id>1</Id></Order>');
  assert.ok(xsd.includes('xmlns:tns="urn:shop" targetNamespace="urn:shop" elementFormDefault="qualified"'));
});

test("namespace only on the root: unqualified children", () => {
  const { xsd } = gen('<ns0:Order xmlns:ns0="urn:shop"><Id>1</Id></ns0:Order>');
  assert.ok(xsd.includes('targetNamespace="urn:shop" elementFormDefault="unqualified"'));
});

test("several namespaces are rejected with the namespaces named", () => {
  assert.throws(() => gen('<a:r xmlns:a="urn:a" xmlns:b="urn:b"><b:x/></a:r>'), /several namespaces.*urn:a.*urn:b/);
  assert.throws(() => gen('<r xmlns:b="urn:b"><b:x/></r>'), /several namespaces/);
});

test("attributes with a namespace are skipped with a warning", () => {
  const { xsd, warnings } = gen('<r xmlns:q="urn:q" q:a="1" b="2"/>');
  assert.ok(!xsd.includes('name="a"'));
  assert.ok(xsd.includes('name="b"'));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /q:a/);
});

test("venetian blind: named types, unique names for equal element names", () => {
  const { xsd } = gen("<r><a><x><y>1</y></x></a><b><x><z>1</z></x></b></r>", { design: "venetian-blind" });
  assert.ok(xsd.includes('<xs:element name="r" type="rType"/>'));
  assert.ok(xsd.includes('<xs:complexType name="xType">'));
  assert.ok(xsd.includes('<xs:complexType name="xType2">'));
  assert.ok(xsd.includes('type="xType2"'));
});

test("venetian blind with a namespace uses the prefix in type references", () => {
  const { xsd } = gen('<ns0:r xmlns:ns0="urn:s"><ns0:a><ns0:b>1</ns0:b></ns0:a></ns0:r>', { design: "venetian-blind" });
  assert.ok(xsd.includes('<xs:element name="r" type="ns0:rType"/>'));
  assert.ok(xsd.includes('type="ns0:aType"'));
});

test("names and namespaces are escaped", () => {
  const { xsd } = gen('<r xmlns="urn:a&amp;b?x=&quot;1&quot;"/>');
  assert.ok(xsd.includes('targetNamespace="urn:a&amp;b?x=&quot;1&quot;"'));
});

test("cdata and entities count as text", () => {
  const { xsd } = gen("<r><a><![CDATA[12]]></a><b>&#49;&#50;</b><c>a &amp; b</c></r>");
  assert.ok(xsd.includes('name="a" type="xs:int"'));
  assert.ok(xsd.includes('name="b" type="xs:int"'));
  assert.ok(xsd.includes('name="c" type="xs:string"'));
});

test("comments, processing instructions and the xml declaration are ignored", () => {
  const { xsd } = gen('<?xml version="1.0"?><!-- c --><r><?pi x?><a>1</a></r>');
  assert.ok(xsd.includes('name="a" type="xs:int"'));
});

test("broken xml is rejected with a reason", () => {
  assert.throws(() => gen("<a><b></a>"), /does not match <b>/);
  assert.throws(() => gen("<a><b>"), /Missing closing tag <\/b>/);
  assert.throws(() => gen("<a/><b/>"), /more than one root/);
  assert.throws(() => gen("</a>"), /without an opening tag/);
  assert.throws(() => gen("hello"), /outside of the root/);
  assert.throws(() => gen(""), /No root element/);
  assert.throws(() => gen("<p:a/>"), /prefix "p" is not declared/);
  assert.throws(() => gen("<a/>", { design: "salami" }), /Unknown design/);
});

test("self closing tags with a space and single quoted attributes", () => {
  const { xsd } = gen("<r><a id='1' /></r>");
  assert.ok(xsd.includes('name="id" type="xs:int" use="required"'));
});

test("default: every element is optional and no attribute is required", () => {
  const { xsd } = cpihXmlToXsd('<r id="1"><a>1</a><g><b>2</b></g><g><b>3</b></g></r>');
  assert.ok(xsd.includes('<xs:element name="a" minOccurs="0" type="xs:int"/>'));
  assert.ok(xsd.includes('<xs:element name="g" minOccurs="0" maxOccurs="unbounded">'));
  assert.ok(xsd.includes('<xs:element name="b" minOccurs="0" type="xs:int"/>'));
  assert.ok(xsd.includes('<xs:attribute name="id" type="xs:int"/>'));
  assert.ok(!xsd.includes("required"));
});

test("default: the global root element has no minOccurs, venetian blind too", () => {
  for (const design of ["russian-doll", "venetian-blind"]) {
    const { xsd } = cpihXmlToXsd("<r><a>1</a></r>", { design });
    assert.ok(/<xs:element name="r"[^>]*>/.exec(xsd)[0].indexOf("minOccurs") === -1, design);
    assert.ok(xsd.includes('name="a" minOccurs="0"'), design);
  }
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
