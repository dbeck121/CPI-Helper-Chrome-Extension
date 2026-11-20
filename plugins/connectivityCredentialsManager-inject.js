// Page world helper of the Connectivity Profile Manager (plugins/connectivityCredentialsManager.js).
// A content script cannot reach the UI5 API of the page. Selects (Encryption, Proxy Type, ...) are only read and
// changed reliably through it: key presses move the selection but leave the hidden input and the change event behind.
// Requests { source: "cpih-conn", type, requestId, id, ... } are answered with { source: "cpih-conn-reply", requestId, ok, key }
//   setSelectKey { id, key }: selects the item with that key (or text) and fires change like a user's choice
//   getSelectKey { id }: the key of the selected item
(() => {
  if (window.__cpihConnBridge) return;
  window.__cpihConnBridge = true;

  function getControl(id) {
    const Element = window.sap?.ui?.require?.("sap/ui/core/Element");
    if (Element?.getElementById) return Element.getElementById(id);
    return window.sap?.ui?.getCore?.().byId(id);
  }

  const handlers = {
    setSelectKey({ id, key }) {
      const control = getControl(id);
      const items = control?.getItems?.() || [];
      const item = items.find((candidate) => candidate.getKey?.() === key) || items.find((candidate) => candidate.getText?.() === key);
      if (!item || !control.setSelectedItem) return { ok: false };
      if (control.getSelectedItem() !== item) {
        control.setSelectedItem(item);
        // what a user's choice fires, the page's controller shows / hides dependent fields on it
        control.fireChange({ selectedItem: item });
      }
      return { ok: true, key: control.getSelectedKey() };
    },
    getSelectKey({ id }) {
      const control = getControl(id);
      if (!control?.getSelectedKey) return { ok: false };
      return { ok: true, key: control.getSelectedKey() };
    },
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "cpih-conn" || !Object.hasOwn(handlers, event.data.type)) return;
    const reply = { source: "cpih-conn-reply", requestId: event.data.requestId, ok: false };
    try {
      Object.assign(reply, handlers[event.data.type](event.data));
    } catch (error) {
      reply.error = String(error);
    }
    window.postMessage(reply, window.location.origin);
  });
})();
