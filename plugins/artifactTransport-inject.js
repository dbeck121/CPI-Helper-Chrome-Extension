// Runs in the page world (injected by plugins/artifactTransport.js), where UI5 and the package view live.
// Selects one artifact in the artifact list of the package and presses the Transport entry of the Actions menu, so SAP
// opens its own Transport dialog for it. The content script sends the technical name of the artifact (the id in the
// editor url) and gets one of these answers back: opened, loading (no list yet), more (next page of the list requested),
// not-found, no-transport, error
(function () {
  if (window.__cpiHelperArtifactTransport) return;
  window.__cpiHelperArtifactTransport = true;

  const TRANSPORT_ICON = "sap-icon://bus-public-transport";

  function findTable(Element) {
    const element = document.querySelector('[data-sap-ui$="--artifactTable"]');
    return element ? Element.registry.get(element.getAttribute("data-sap-ui")) : null;
  }

  // the controller fills the Actions menu on every selection change. its Transport entry is found by the icon, the
  // text depends on the language. the newest one is taken in case an older menu is still around
  function findTransportButton(Element) {
    const buttons = Element.registry.filter((control) => control.isA("sap.m.Button") && control.getIcon() === TRANSPORT_ICON && control.getParent()?.isA("sap.m.ActionSheet") && control.getVisible() && control.getEnabled());
    return buttons[buttons.length - 1] || null;
  }

  function openTransport(artifactName) {
    const Element = window.sap?.ui?.require?.("sap/ui/core/Element");
    const table = Element && findTable(Element);
    if (!table || table.getItems().length === 0) return "loading";

    const item = table.getItems().find((entry) => entry.getBindingContext()?.getObject()?.Name === artifactName);
    if (!item) {
      // the list shows 100 artifacts at a time, the trigger below it loads the next ones
      const trigger = Element.registry.get(table.getId() + "-trigger");
      if (trigger && table.getItems().length < (table.getBinding("items")?.getLength() || 0)) {
        trigger.firePress();
        return "more";
      }
      return "not-found";
    }

    // only this artifact, with events, so the controller updates the Actions menu like after a click on the checkbox
    table.removeSelections(true, true);
    table.setSelectedItem(item, true, true);
    const button = findTransportButton(Element);
    if (!button) return "no-transport";
    button.firePress();
    return "opened";
  }

  document.addEventListener("cpiHelper_artifactTransport_open", function (event) {
    let status;
    try {
      status = openTransport(String(event.detail));
    } catch (error) {
      console.error("CPI Helper: the Transport dialog could not be opened", error);
      status = "error";
    }
    document.dispatchEvent(new CustomEvent("cpiHelper_artifactTransport_result", { detail: status }));
  });
  document.documentElement.setAttribute("data-cpih-artifact-transport", "ready");
})();
