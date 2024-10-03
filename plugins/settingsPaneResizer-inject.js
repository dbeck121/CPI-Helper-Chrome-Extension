function extendSettingsPane() {
  // only press button if pane not yet expanded
  var minButton = $('[id $="iflowSplitter-bar0-min-btn-img"]');
  if (minButton.length == 0) {
    //console.log("minButton not visible - expanding pane to " + "${newHeightInPct}" + "%");
    console.log("Settings Pane expanded by CPI Helper Plugin");
    window.sap.ui.getCore().byId($('[id $="--iflowSplitter-bar0-restore-btn"]').eq(0).attr("id")).firePress();
    var s = window.sap.ui.getCore().byId($('[id^="__xmlview"][id$="-iflowSplitter"]').eq(0).attr("id"));
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
