// Wrapped in an IIFE: content scripts share one global scope, so helper names must not leak.
(() => {
  const plugin = {
    metadataVersion: "1.0.0",
    id: "xmlToXsd",
    name: "XML to XSD",
    version: "1.0.0",
    author: "Jorge",
    website: "https://github.com/19jmrs",
    email: "jorgesa.developer@gmail.com",
    description:
      "Generates an XSD from a sample XML, for the source and target schema of a message mapping. Paste or load the XML, choose the schema design and copy or download the XSD. Repeated elements become unbounded, elements and attributes missing in some instances become optional, value types are inferred from the sample. Nothing leaves your browser.",
    settings: {},
    toolbarButton: {
      title: "XML to XSD",
      icon: { text: "XSD", type: "text" },
      onClick: (pluginHelper) => openXmlToXsd(pluginHelper),
    },
  };

  const MARKUP = `
    <div class="ui form cpihXsd">
      <div class="fields">
        <div class="field">
          <label>Schema design</label>
          <select class="ui dropdown cpihXsd_design">
            <option value="russian-doll">Russian doll: nested, one global element</option>
            <option value="venetian-blind">Venetian blind: named complex types</option>
          </select>
        </div>
        <div class="field">
          <label>Value types</label>
          <div class="ui checkbox"><input type="checkbox" class="cpihXsd_infer" id="cpihXsd_infer" checked /><label for="cpihXsd_infer">Infer from the values (int, decimal, date, ...), otherwise everything is xs:string</label></div>
        </div>
      </div>
      <div class="field">
        <div class="ui checkbox"><input type="checkbox" class="cpihXsd_optional" id="cpihXsd_optional" checked /><label for="cpihXsd_optional">All optional: minOccurs="0" on every element, no required attributes (one sample cannot show what is mandatory)</label></div>
      </div>
      <div class="cpihXsd_messages"></div>
      <div class="fields">
        <div class="field">
          <label>XML</label>
          <textarea class="cpihXsd_xml" spellcheck="false" placeholder="Paste a sample XML here"></textarea>
        </div>
        <div class="field">
          <label>XSD</label>
          <textarea class="cpihXsd_xsd" spellcheck="false" readonly></textarea>
        </div>
      </div>
      <div>
        <button type="button" class="ui button cpihXsd_load">Load XML file</button>
        <button type="button" class="ui button cpihXsd_copy" disabled>Copy XSD</button>
        <button type="button" class="ui button cpihXsd_download" disabled>Download XSD</button>
        <input type="file" class="cpihXsd_file" accept=".xml,text/xml,application/xml" hidden />
      </div>
    </div>`;

  function openXmlToXsd(pluginHelper) {
    const root = document.createElement("div");
    root.innerHTML = MARKUP;
    const $ = (selector) => root.querySelector(selector);
    const xmlField = $(".cpihXsd_xml");
    const xsdField = $(".cpihXsd_xsd");
    const messages = $(".cpihXsd_messages");
    const copyButton = $(".cpihXsd_copy");
    const downloadButton = $(".cpihXsd_download");
    let fileName = "schema.xsd";

    for (const field of [xmlField, xsdField]) {
      field.style.cssText = "height: 55vh; font-family: Consolas, 'Courier New', monospace; font-size: 0.8125rem; white-space: pre; resize: none;";
    }

    const showMessage = (type, lines) => {
      messages.replaceChildren(
        ...lines.map((line) => {
          const message = document.createElement("div");
          message.className = `ui ${type} message`;
          message.textContent = line;
          return message;
        })
      );
    };

    const generate = () => {
      messages.replaceChildren();
      const setResult = (xsd) => {
        xsdField.value = xsd;
        copyButton.disabled = downloadButton.disabled = !xsd;
      };
      if (!xmlField.value.trim()) return setResult("");
      try {
        const result = cpihXmlToXsd(xmlField.value, { design: $(".cpihXsd_design").value, inferTypes: $(".cpihXsd_infer").checked, allOptional: $(".cpihXsd_optional").checked });
        setResult(result.xsd);
        fileName = `${result.rootName}.xsd`;
        if (result.warnings.length) showMessage("warning", result.warnings);
      } catch (error) {
        setResult("");
        showMessage("negative", [error.message]);
      }
    };

    let timer;
    xmlField.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(generate, 250);
    });
    $(".cpihXsd_design").addEventListener("change", generate);
    $(".cpihXsd_infer").addEventListener("change", generate);
    $(".cpihXsd_optional").addEventListener("change", generate);

    const fileInput = $(".cpihXsd_file");
    $(".cpihXsd_load").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      xmlField.value = await file.text();
      generate();
    });

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(xsdField.value);
        showToast("XSD copied to the clipboard", "XML to XSD", "success");
      } catch (error) {
        xsdField.select();
        showToast("Could not access the clipboard, the XSD is selected, press Ctrl+C", "XML to XSD", "warning");
      }
    });

    downloadButton.addEventListener("click", () => {
      const url = URL.createObjectURL(new Blob([xsdField.value], { type: "application/xml" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    });

    pluginHelper.functions.popup(root, "XML to XSD", { large: true, fullscreen: false });
  }

  pluginList.push(plugin);
})();
