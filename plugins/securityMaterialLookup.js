var plugin = {
  metadataVersion: "1.0.0",
  id: "securityMaterialLookup",
  name: "Security Material Lookup",
  version: "1.0.0",
  author: "CPI Helper",
  description: "Search security materials and inspect available ownership and credential metadata.",
  settings: {},
  toolbarButton: {
    title: "Security Material Lookup",
    condition: () => /security.?material/i.test(window.location.href),
    onClick: async (pluginHelper) => {
      const url = `/${pluginHelper.urlExtension}Operations/com.sap.it.km.api.commands.SecurityMaterialsListCommand`;
      let materials;
      try {
        const response = JSON.parse(await makeCallPromise("GET", url, false, "application/json"));
        materials = response.artifactInformations || [];
      } catch (error) {
        log.error("Security Material Lookup: unable to load materials", error);
        alert("Could not load security materials. Check your access and try again.");
        return;
      }

      document.getElementById("cpiHelper-security-material-lookup")?.remove();
      const overlay = document.createElement("div");
      overlay.id = "cpiHelper-security-material-lookup";
      Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "100000", background: "rgba(0,0,0,.38)", display: "grid", placeItems: "center" });
      const panel = document.createElement("section");
      Object.assign(panel.style, { width: "min(760px, 92vw)", maxHeight: "82vh", overflow: "auto", background: "var(--sapBackgroundColor, white)", color: "var(--sapTextColor, #222)", padding: "20px", borderRadius: "8px", boxShadow: "0 8px 30px #0005", font: "14px Arial,sans-serif" });
      const heading = document.createElement("h2"); heading.textContent = "Security Material Lookup";
      const search = document.createElement("input"); search.type = "search"; search.placeholder = "Search by name, type, or creator";
      Object.assign(search.style, { width: "100%", boxSizing: "border-box", padding: "10px", margin: "8px 0 14px" });
      const results = document.createElement("div");
      const note = document.createElement("p"); note.textContent = "Stored passwords, tokens, and private keys are not returned by the list service. This view shows metadata available to your account.";
      note.style.color = "#666";
      const close = document.createElement("button"); close.textContent = "Close"; close.onclick = () => overlay.remove();
      panel.append(heading, search, note, results, close); overlay.appendChild(panel);
      overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
      document.addEventListener("keydown", function onEscape(event) { if (event.key === "Escape" && overlay.isConnected) { overlay.remove(); document.removeEventListener("keydown", onEscape); } });
      document.body.appendChild(overlay);

      const fields = ["type", "deployState", "deployedBy", "deployedOn", "createdBy", "createdOn", "modifiedBy", "modifiedOn", "user", "username"];
      function render() {
        results.replaceChildren();
        const term = search.value.trim().toLowerCase();
        const matching = materials.filter((item) => JSON.stringify(item).toLowerCase().includes(term));
        if (!matching.length) { const empty = document.createElement("p"); empty.textContent = "No matching security materials."; results.appendChild(empty); return; }
        matching.forEach((item) => {
          const card = document.createElement("article");
          Object.assign(card.style, { borderTop: "1px solid #ddd", padding: "12px 2px" });
          const name = document.createElement("strong"); name.textContent = String(item.name || "Unnamed material"); card.appendChild(name);
          const detail = document.createElement("div");
          const pairs = fields.filter((key) => item[key] !== undefined && item[key] !== null && item[key] !== "").map((key) => `${key}: ${item[key]}`);
          detail.textContent = pairs.length ? pairs.join(" · ") : "No creator or credential metadata provided by this tenant's list response.";
          detail.style.marginTop = "6px"; card.appendChild(detail); results.appendChild(card);
        });
      }
      search.addEventListener("input", render); render(); search.focus();
    },
  },
};

pluginList.push(plugin);
