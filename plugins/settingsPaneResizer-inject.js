function extendSettingsPane() {
  // only press button if pane not yet expanded
  var minButton = document.querySelector('[id$="iflowSplitter-bar0-min-btn-img"]');
  if (!minButton) {
    console.log("Settings Pane expanded by CPI Helper Plugin");
    const restoreBtn = document.querySelector('[id$="--iflowSplitter-bar0-restore-btn"]');
    if (restoreBtn) window.sap.ui.getCore().byId(restoreBtn.id).firePress();
    const splitter = document.querySelector('[id^="__xmlview"][id$="-iflowSplitter"]');
    if (!splitter) return;
    var s = window.sap.ui.getCore().byId(splitter.id);
    s.getContentAreas()[0].setLayoutData(
      new sap.ui.layout.SplitterLayoutData({
        size: "${(100-newHeightInPct) + " % "}",
      })
    );
    s.getContentAreas()[1].setLayoutData(
      new sap.ui.layout.SplitterLayoutData({
        size: "${newHeightInPct + " % "}",
      })
    );
    //s.invalidate();
  }
}

// add trigger of resizer when page content changes (to also catch page updates via 'ajax' instead of just full page reloads)
var bodyObserver = new MutationObserver(function (mutations) {
  mutations.forEach((mutation) => {
    //console.log(mutation)
    if (mutation.target.id.includes("iflowObjectPageLayout")) {
      extendSettingsPane();
    }
  });
});
var config = { childList: true, subtree: true };
bodyObserver.observe(document.body, config);

// execute function once without observer (this is triggered on first page load)
extendSettingsPane();
