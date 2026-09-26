// Snippets: building blocks of the iFlow editor. The editor copies into localStorage["GalileiClipboard"] (same
// origin, readable from here). CPI Helper saves that content as named snippets in chrome.storage.local, lets the
// user rename, edit, duplicate, export and import them, and writes a snippet back so the editor's Paste inserts it.

const SNIPPETS_STORAGE_KEY = "cpiHelper_snippets";
const GALILEI_CLIPBOARD_KEY = "GalileiClipboard";
const SNIPPET_EXPORT_FORMAT = "cpiHelperSnippet";
// Snippets are off until the user switches them on in the settings (browser popup, danger zone)
const SNIPPETS_SETTING_KEY = "cpiHelper_experimental_snippets";
const SNIPPETS_PRIVACY_TEXT =
  "A snippet contains the whole iFlow the steps were copied from (all steps with their configuration, addresses and names), not only the copied steps. Share it only with people who may see that iFlow.";

async function snippetsEnabled() {
  try {
    return (await chrome.storage.sync.get(SNIPPETS_SETTING_KEY))[SNIPPETS_SETTING_KEY] === true;
  } catch (error) {
    return false;
  }
}

// toolbar button after Messages, only while the feature is switched on
function addSnippetsToolbarButton(toolbar) {
  if (!toolbar || toolbar.querySelector("#__buttonsnippets")) return;
  const button = addFloatingToolbarButton(toolbar, {
    id: "__buttonsnippets",
    icon: "snippets",
    title: "Snippets",
    onClick: () => {
      statistic("headerbar_btn_snippets_click");
      openSnippetsPopup();
    },
  });
  const messages = toolbar.querySelector("#__buttonxy");
  if (messages) messages.after(button);
}

try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes[SNIPPETS_SETTING_KEY]) return;
    const toolbar = getFloatingToolbar();
    if (changes[SNIPPETS_SETTING_KEY].newValue === true) addSnippetsToolbarButton(toolbar);
    else toolbar?.querySelector("#__buttonsnippets")?.remove();
  });
} catch (error) {
  log.debug("snippets setting listener not available", error);
}

async function loadSnippets() {
  try {
    const stored = await chrome.storage.local.get(SNIPPETS_STORAGE_KEY);
    return Array.isArray(stored[SNIPPETS_STORAGE_KEY]) ? stored[SNIPPETS_STORAGE_KEY] : [];
  } catch (error) {
    log.warn("snippets could not be loaded", error);
    return [];
  }
}

// a snippet of one step is about 30 to 60 KB, the local storage of the extension holds a few hundred
async function saveSnippets(snippets) {
  try {
    await chrome.storage.local.set({ [SNIPPETS_STORAGE_KEY]: snippets });
  } catch (error) {
    showToast("Delete snippets you no longer need and try again.", "The snippets could not be saved: " + error.message, "error");
    throw error;
  }
}

function newSnippetId() {
  return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
}

// parsed clipboard content of the editor, null when it is empty or not an editor clipboard
function readCpiClipboard() {
  try {
    const raw = localStorage.getItem(GALILEI_CLIPBOARD_KEY);
    if (!raw) return null;
    const content = JSON.parse(raw);
    return content && content.diagramContent && Array.isArray(content.copyObjectIds) ? content : null;
  } catch (error) {
    return null;
  }
}

// the copied elements with name and type, taken from the diagram content of the clipboard
function snippetSteps(content) {
  try {
    const diagram = typeof content.diagramContent === "string" ? JSON.parse(content.diagramContent) : content.diagramContent;
    return (content.copyObjectIds || [])
      .map((id) => {
        const object = diagram?.contents?.[id];
        if (!object) return null;
        const store = object.customData?.copyProperties?.propertyStoreElement;
        const className = String(object.classDefinition || "").split(".").pop();
        const type = store?.activityType || className;
        // timer and start message cannot go into a local integration process
        const isStart = /StartEvent/i.test(className) || /^Start/i.test(String(store?.activityType || ""));
        return { id, name: object.name || object.displayName || object.id, type, isStart };
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

// rename one copied element: name and display name of the model object and of its property store
function renameSnippetStep(content, objectId, name) {
  const diagram = JSON.parse(content.diagramContent);
  const object = diagram?.contents?.[objectId];
  if (!object) return content;
  object.name = name;
  object.displayName = name;
  const store = object.customData?.copyProperties?.propertyStoreElement;
  if (store) {
    store.name = name;
    store.displayName = name;
  }
  return { ...content, diagramContent: JSON.stringify(diagram) };
}

// the page world script that resets the editor cache, injected once
function ensureGalileiBridge() {
  if (document.documentElement.getAttribute("data-cpih-galilei") === "ready") return Promise.resolve(true);
  return new Promise((resolve) => {
    if (!document.getElementById("cpiHelper_galilei_bridge")) {
      const script = document.createElement("script");
      script.id = "cpiHelper_galilei_bridge";
      script.src = chrome.runtime.getURL("scripts/snippets-inject.js");
      (document.head || document.documentElement).appendChild(script);
    }
    const started = Date.now();
    const check = () => {
      if (document.documentElement.getAttribute("data-cpih-galilei") === "ready") return resolve(true);
      if (Date.now() - started > 3000) return resolve(false);
      setTimeout(check, 50);
    };
    check();
  });
}

// writes a snippet into the editor clipboard, Paste in the editor inserts it afterwards
async function putSnippetIntoCpiClipboard(snippet) {
  localStorage.setItem(GALILEI_CLIPBOARD_KEY, typeof snippet.content === "string" ? snippet.content : JSON.stringify(snippet.content));
  const bridge = await ensureGalileiBridge();
  document.documentElement.removeAttribute("data-cpih-galilei-reset");
  document.dispatchEvent(new Event("cpiHelper_galilei_reset"));
  return bridge;
}

function snippetExportText(snippet) {
  return JSON.stringify({ format: SNIPPET_EXPORT_FORMAT, version: 1, name: snippet.name, description: snippet.description || "", content: snippet.content }, null, 2);
}

// accepts an exported snippet or a raw editor clipboard, returns a snippet or throws with a readable message
function parseSnippetImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("This is not JSON. Paste a snippet that was copied with 'Copy as text'.");
  }
  const content = data?.format === SNIPPET_EXPORT_FORMAT ? data.content : data;
  if (!content?.diagramContent || !Array.isArray(content.copyObjectIds)) throw new Error("This JSON is no CPI Helper snippet and no iFlow editor clipboard.");
  const steps = snippetSteps(content);
  return createSnippet(content, data?.format === SNIPPET_EXPORT_FORMAT ? data.name : steps.map((step) => step.name).join(", ") || "Imported snippet", data?.description || "");
}

function createSnippet(content, name, description = "") {
  const now = new Date().toISOString();
  return {
    id: newSnippetId(),
    name: name || "Snippet",
    description,
    created: now,
    updated: now,
    source: { artifact: cpiData?.integrationFlowId || null, host: location.host.split(".")[0] },
    content,
  };
}

/* ------------------------------------------------------------------ UI */

async function openSnippetsPopup() {
  const container = document.createElement("div");
  container.className = "cpiHelper_snippets";
  await showBigPopup(container, "Snippets", { fullscreen: false, large: true });
  await renderSnippetList(container);
}

function snippetStepsText(content) {
  const steps = snippetSteps(content);
  if (!steps.length) return "no steps";
  const names = steps.slice(0, 4).map((step) => `${step.name}${step.type ? ` (${step.type})` : ""}`);
  const start = steps.some((step) => step.isStart) ? " · contains a start element: Integration Process only" : "";
  return `${steps.length} ${steps.length === 1 ? "element" : "elements"}: ${names.join(", ")}${steps.length > 4 ? ", ..." : ""}${start}`;
}

async function renderSnippetList(container, filter = "") {
  const snippets = await loadSnippets();
  const clipboard = readCpiClipboard();
  const alreadySaved = clipboard && snippets.some((snippet) => snippet.content?.diagramContent === clipboard.diagramContent);

  container.innerHTML = `
    <div class="ui negative icon message cpiHelper_snippets_danger">
      <i class="exclamation triangle icon"></i>
      <div class="content">
        <div class="header">Extremely experimental: danger zone</div>
        <p>Snippets use internals of the SAP iFlow editor. A lot will not work, and SAP can change the editor at any time. Check the iFlow carefully before you save, and if anything looks wrong, cancel the edit without saving.</p>
        <ul class="list">
          <li>Paste only works in edit mode into a selected <b>Integration Process</b> or <b>Local Integration Process</b>.</li>
          <li>Snippets with start elements (e.g. <b>Timer</b> or <b>Start Message</b>) can only go into an Integration Process, not into a Local Integration Process.</li>
          <li>The editor copies no connections and no senders or receivers.</li>
          <li><b>Privacy, especially when sharing:</b> ${SNIPPETS_PRIVACY_TEXT}</li>
        </ul>
      </div>
    </div>
    <div class="ui segment cpiHelper_snippets_clipboard">
      <div class="cpiHelper_snippets_clipboardHead">
        <h4 class="ui header"><i class="copy outline icon"></i><div class="content">CPI clipboard <span class="cpiHelper_experimental" title="Uses internals of the SAP iFlow editor, feedback welcome">experimental</span><div class="sub header"></div></div></h4>
        <div class="cpiHelper_snippets_save">
          <input type="text" class="cpiHelper_snippets_name" placeholder="Name of the snippet" aria-label="Name of the snippet">
          <button type="button" class="ui primary small button" data-action="capture"><i class="save icon"></i>Save as snippet</button>
        </div>
      </div>
      <p class="cpiHelper_snippets_hint">Copy steps in the iFlow editor (select, Shift+click for more, then Copy) and save them here. <b>Use</b> puts a snippet back into the CPI clipboard: select the Integration Process or Local Integration Process in edit mode and press Paste.</p>
    </div>
    <div class="cpiHelper_snippets_bar">
      <div class="ui icon input small"><input type="text" class="cpiHelper_snippets_filter" placeholder="Search snippets" aria-label="Search snippets"><i class="search icon"></i></div>
      <button type="button" class="ui small button" data-action="import"><i class="download icon"></i>Import</button>
      <span class="cpiHelper_snippets_count"></span>
    </div>
    <div class="cpiHelper_snippets_list"></div>`;

  const sub = container.querySelector(".cpiHelper_snippets_clipboard .sub.header");
  const nameInput = container.querySelector(".cpiHelper_snippets_name");
  const captureButton = container.querySelector('[data-action="capture"]');
  if (clipboard) {
    sub.textContent = snippetStepsText(clipboard) + (alreadySaved ? " · already saved" : "");
    nameInput.value = snippetSteps(clipboard)
      .map((step) => step.name)
      .join(", ")
      .slice(0, 80);
  } else {
    sub.textContent = "empty - copy something in the iFlow editor first";
    nameInput.disabled = true;
    captureButton.classList.add("disabled");
  }

  const filterInput = container.querySelector(".cpiHelper_snippets_filter");
  filterInput.value = filter;
  const needle = filter.trim().toLowerCase();
  const visible = snippets.filter((snippet) => !needle || [snippet.name, snippet.description, snippetStepsText(snippet.content)].join(" ").toLowerCase().includes(needle));
  container.querySelector(".cpiHelper_snippets_count").textContent = `${visible.length} of ${snippets.length} snippets`;

  const list = container.querySelector(".cpiHelper_snippets_list");
  if (!snippets.length) {
    list.innerHTML = '<div class="ui info message">No snippets yet. Copy elements in the iFlow editor and save them above, or import a snippet someone shared.</div>';
  }
  visible
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
    .forEach((snippet) => {
      const item = document.createElement("div");
      item.className = "cpiHelper_snippets_item";
      item.dataset.id = snippet.id;
      item.innerHTML = `
        <div class="cpiHelper_snippets_main">
          <div class="cpiHelper_snippets_title"></div>
          <div class="cpiHelper_snippets_meta"></div>
          <div class="cpiHelper_snippets_description"></div>
        </div>
        <div class="cpiHelper_snippets_actions">
          <button type="button" class="ui primary small button" data-action="use" title="Put into the CPI clipboard, then press Paste in the editor"><i class="copy icon"></i>Use</button>
          <button type="button" class="ui small tertiary button" data-action="export" title="Copy as text to share it"><i class="external alternate icon"></i>Copy as text</button>
          <button type="button" class="ui small tertiary button" data-action="edit"><i class="settings icon"></i>Edit</button>
          <button type="button" class="ui small tertiary button" data-action="duplicate"><i class="file outline icon"></i>Duplicate</button>
          <button type="button" class="ui small tertiary button" data-action="delete" title="Delete"><i class="trash icon"></i></button>
        </div>`;
      item.querySelector(".cpiHelper_snippets_title").textContent = snippet.name;
      item.querySelector(".cpiHelper_snippets_meta").textContent = `${snippetStepsText(snippet.content)} · ${new Date(snippet.updated).toLocaleString()}${snippet.source?.artifact ? ` · from ${snippet.source.artifact}` : ""}`;
      item.querySelector(".cpiHelper_snippets_description").textContent = snippet.description || "";
      list.appendChild(item);
    });

  filterInput.addEventListener("input", () => {
    const position = filterInput.selectionStart;
    renderSnippetList(container, filterInput.value).then(() => {
      const input = container.querySelector(".cpiHelper_snippets_filter");
      input.focus();
      input.setSelectionRange(position, position);
    });
  });
  nameInput.addEventListener("keydown", (event) => event.key === "Enter" && captureButton.click());

  container.onclick = async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || button.classList.contains("disabled")) return;
    const snippetId = button.closest(".cpiHelper_snippets_item")?.dataset.id;
    const all = await loadSnippets();
    const snippet = all.find((entry) => entry.id === snippetId);
    switch (button.dataset.action) {
      case "capture": {
        const content = readCpiClipboard();
        if (!content) return showToast("The CPI clipboard is empty.", "", "warning");
        all.push(createSnippet(content, nameInput.value.trim() || "Snippet"));
        await saveSnippets(all);
        showToast("Snippet saved.", "", "success");
        return renderSnippetList(container, filterInput.value);
      }
      case "use": {
        const bridge = await putSnippetIntoCpiClipboard(snippet);
        const hasStart = snippetSteps(snippet.content).some((step) => step.isStart);
        const target = hasStart ? "the Integration Process (not a Local Integration Process, the snippet contains a start element)" : "the Integration Process or Local Integration Process";
        showToast(
          bridge ? `Select ${target} in edit mode and press Paste. Experimental: check the iFlow before you save.` : "Written to the CPI clipboard. If Paste inserts something else, reload the editor.",
          `"${snippet.name}" is in the CPI clipboard`,
          hasStart ? "warning" : "success"
        );
        return renderSnippetList(container, filterInput.value);
      }
      case "export":
        if (!(await cpihConfirm({ title: "Share this snippet?", content: `<p>${SNIPPETS_PRIVACY_TEXT}</p>`, approveText: "Copy as text", denyText: "Cancel" }))) return;
        await navigator.clipboard.writeText(snippetExportText(snippet));
        return showToast("Paste it anywhere to share it. Others add it with Import.", "Snippet copied as text", "success");
      case "duplicate": {
        all.push({ ...structuredClone(snippet), id: newSnippetId(), name: snippet.name + " (copy)", created: new Date().toISOString(), updated: new Date().toISOString() });
        await saveSnippets(all);
        return renderSnippetList(container, filterInput.value);
      }
      case "delete":
        if (!(await cpihConfirm({ title: `Delete "${snippet.name}"?`, approveText: "Delete", denyText: "Cancel" }))) return;
        await saveSnippets(all.filter((entry) => entry.id !== snippetId));
        return renderSnippetList(container, filterInput.value);
      case "edit":
        return renderSnippetEditor(container, snippet);
      case "import":
        return renderSnippetImport(container);
    }
  };
}

function renderSnippetImport(container) {
  container.innerHTML = `
    <h4 class="ui header">Import a snippet</h4>
    <div class="ui form">
      <div class="field">
        <label for="cpiHelper_snippets_import">Paste the text of a snippet (Copy as text) or the content of an iFlow editor clipboard</label>
        <textarea id="cpiHelper_snippets_import" rows="12" spellcheck="false"></textarea>
      </div>
    </div>
    <div class="cpiHelper_snippets_editorActions">
      <button type="button" class="ui button" data-action="cancel">Cancel</button>
      <button type="button" class="ui primary button" data-action="save"><i class="save icon"></i>Import</button>
    </div>`;
  const textarea = container.querySelector("textarea");
  textarea.focus();
  container.onclick = async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "cancel") return renderSnippetList(container);
    try {
      const snippet = parseSnippetImport(textarea.value);
      const all = await loadSnippets();
      all.push(snippet);
      await saveSnippets(all);
      showToast(`"${snippet.name}" imported.`, "", "success");
      renderSnippetList(container);
    } catch (error) {
      showToast(error.message, "Import not possible", "error");
    }
  };
}

function renderSnippetEditor(container, snippet) {
  let content = structuredClone(snippet.content);
  const steps = snippetSteps(content);
  container.innerHTML = `
    <h4 class="ui header">Edit snippet</h4>
    <div class="ui form">
      <div class="field"><label for="cpiHelper_snippet_name">Name</label><input type="text" id="cpiHelper_snippet_name"></div>
      <div class="field"><label for="cpiHelper_snippet_description">Description</label><textarea id="cpiHelper_snippet_description" rows="2"></textarea></div>
      <div class="field cpiHelper_snippets_steps"><label>Names of the elements</label></div>
      <div class="field">
        <label>Content (JSON of the iFlow editor clipboard, for experts)</label>
        <div class="cpiHelper_snippets_json"></div>
      </div>
    </div>
    <div class="cpiHelper_snippets_editorActions">
      <button type="button" class="ui button" data-action="cancel">Cancel</button>
      <button type="button" class="ui primary button" data-action="save"><i class="save icon"></i>Save</button>
    </div>`;
  container.querySelector("#cpiHelper_snippet_name").value = snippet.name;
  container.querySelector("#cpiHelper_snippet_description").value = snippet.description || "";
  const stepsField = container.querySelector(".cpiHelper_snippets_steps");
  steps.forEach((step) => {
    const row = document.createElement("div");
    row.className = "ui fluid input cpiHelper_snippets_stepRow";
    row.innerHTML = '<div class="ui basic label"></div><input type="text">';
    row.querySelector(".label").textContent = step.type || "element";
    row.querySelector("input").value = step.name;
    row.querySelector("input").dataset.objectId = step.id;
    row.querySelector("input").dataset.originalName = step.name;
    stepsField.appendChild(row);
  });
  if (!steps.length) stepsField.remove();

  // the whole clipboard as JSON, the nested diagram content unfolded so it can be read
  const jsonElement = container.querySelector(".cpiHelper_snippets_json");
  const readable = () => JSON.stringify({ ...content, diagramContent: JSON.parse(content.diagramContent) }, null, 2);
  let editor = null;
  const observer = new ResizeObserver(() => {
    if (!jsonElement.offsetWidth || !jsonElement.offsetHeight) return;
    observer.disconnect();
    editor = new EditorManager(jsonElement, "json", cpihIsDark() ? "github_dark" : "textmate", 2, false, 12, "markbegin", false);
    editor.setContent(readable());
    editor.foldAll();
  });
  observer.observe(jsonElement);

  container.onclick = async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "cancel") return renderSnippetList(container);
    try {
      if (editor) {
        const parsed = JSON.parse(editor.getContent());
        content = { ...parsed, diagramContent: typeof parsed.diagramContent === "string" ? parsed.diagramContent : JSON.stringify(parsed.diagramContent) };
      }
      container.querySelectorAll(".cpiHelper_snippets_stepRow input").forEach((input) => {
        content = renameSnippetStep(content, input.dataset.objectId, input.value.trim() || input.dataset.originalName);
      });
      if (!content.diagramContent || !Array.isArray(content.copyObjectIds)) throw new Error("diagramContent and copyObjectIds are required");
      const all = await loadSnippets();
      const index = all.findIndex((entry) => entry.id === snippet.id);
      all[index] = { ...snippet, name: container.querySelector("#cpiHelper_snippet_name").value.trim() || snippet.name, description: container.querySelector("#cpiHelper_snippet_description").value.trim(), content, updated: new Date().toISOString() };
      await saveSnippets(all);
      showToast("Snippet saved.", "", "success");
      renderSnippetList(container);
    } catch (error) {
      showToast(error.message, "Snippet not saved", "error");
    }
  };
}
