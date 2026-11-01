// Runs in the page world (injected by scripts/snippets.js), where the iFlow editor lives.
// The editor keeps its clipboard in localStorage["GalileiClipboard"] but caches the parsed value in
// CopyPasteManager._clipboardContent. After CPI Helper wrote a snippet into localStorage the cache has to go,
// otherwise Paste inserts what was copied before.
(function () {
  if (window.__cpiHelperGalileiBridge) return;
  window.__cpiHelperGalileiBridge = true;
  const manager = () => window.sap && window.sap.galilei && window.sap.galilei.ui && window.sap.galilei.ui.editor && window.sap.galilei.ui.editor.util && window.sap.galilei.ui.editor.util.copyPaste && window.sap.galilei.ui.editor.util.copyPaste.CopyPasteManager;
  document.addEventListener("cpiHelper_galilei_reset", function () {
    const copyPasteManager = manager();
    if (copyPasteManager) copyPasteManager._clipboardContent = undefined;
    document.documentElement.setAttribute("data-cpih-galilei-reset", copyPasteManager ? "ok" : "no-editor");
  });
  document.documentElement.setAttribute("data-cpih-galilei", "ready");
})();
