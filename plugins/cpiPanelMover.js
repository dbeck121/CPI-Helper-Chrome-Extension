/**
 * SAP CPI Helper Plugin - CPI Panel Mover (Prev/Next, Dock, Full values)
 * Author: Amit Shukla, Mindset Consulting.
 *
 * - Prev / Next through the filtered artifact list of a package (Alt+Shift+Left/Right).
 * - Dock the Integration Flow property panel left, bottom or right.
 * - Fit and Map for large iFlow diagrams (view only).
 * - Full values mode for long values in the Integration Flow panel (Externalized Parameters and the other tabs).
 *
 * The feature code talks to SAP UI5, so it has to run in the page world. Like
 * settingsPaneResizer.js, this content-script part injects
 * plugins/cpiPanelMover-inject.js (a web_accessible_resource) with a <script> tag, once per
 * page load. The heartbeat does the loading because the helper is also needed on the package
 * artifact list, where the CPI Helper toolbar has no plugin panel. On iFlow and API pages the
 * toolbar gets a button (messageSidebarContent) whose panel holds an empty
 * <div id="cpiPanelMover-dock">. The page script moves its bar into that element while it is
 * visible, so the bar sits in the panel by default.
 *
 * Known overlap with "Settings Pane Resizer": that plugin sizes the iflowSplitter areas by index
 * and by height, assuming the panel sits at the bottom. With the panel docked left or right, the
 * page script removes those foreign heights. See cpiPanelMover-inject.js.
 */
// Wrapped in an IIFE: content scripts share one global scope, so helper names must not leak.
(() => {
  const SCRIPT_ID = "cpiPanelMoverScript"; // also read by cpiPanelMover-inject.js
  const DOCK_VALUES = ["bottom", "left", "right", "top"];
  const FULL_VALUES = ["off", "wrap", "line"];
  const HOST_ID = "cpiPanelMover-dock"; // also read by cpiPanelMover-inject.js
  const HOST_CSS_ID = "cpiPanelMover-dock-css";

  var plugin = {
    metadataVersion: "1.0.0",
    id: "cpiPanelMover",
    name: "CPI Panel Mover",
    version: "1.7.3",
    author: "Amit Shukla, Mindset Consulting",
    website: "https://mindsetconsulting.com",
    description: `Adds a small bar to artifact editors: <b>Prev / Next</b> through the filtered artifact list you last saw in the package (Alt+Shift+Left/Right), <b>List</b> back to it,
                  <b>Fit</b> and <b>Map</b> for large iFlows, <b>Full</b> for long values in the Integration Flow panel (all tabs), and <b>Panel L T B R</b> to dock the Integration Flow panel.<br>
                  <b>Move</b> lets you drag boxes and steps in display mode for a screenshot (view only, <b>Reset</b> or reload restores SAP's layout). Shift+click several boxes, then drag one: they move together.<br>
                  The bar opens in a CPI Helper toolbar panel on iFlow pages and closes with it. <b>Popup</b> floats it on the page so it stays open (drag it by its <b>::</b> grip); <b>Popin</b>, a drop on the panel or a double-click on the grip puts it back.<br>
                  Never saves, deploys or unlocks. Asks before leaving an artifact that looks like it is in edit mode.<br>
                  Deactivating takes effect after a page reload.`,
    settings: {
      text1: {
        text: "Default panel position. Used until you click L, T, B or R in the helper bar. That choice is kept in this browser and wins over this setting.",
        type: "label",
      },
      defaultDock: {
        text: "Default panel position",
        type: "radio",
        scope: "browser",
        options: [
          { value: "bottom", label: "Bottom (SAP default)", default: true },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
          { value: "top", label: "Top" },
        ],
      },
      text2: {
        text: "Default Full mode for long values in the Integration Flow panel. Used until you click Full in the helper bar. That choice is kept in this browser and wins over this setting.",
        type: "label",
      },
      defaultFull: {
        text: "Default Full mode",
        type: "radio",
        scope: "browser",
        options: [
          { value: "off", label: "Off (SAP layout)", default: true },
          { value: "wrap", label: "Wrap (all text visible)" },
          { value: "line", label: "One line (horizontal scroll)" },
        ],
      },
    },
    // Host for the bar inside the CPI Helper toolbar panel. Not static, so the panel renders a new
    // host on every open. The event runs in the next animation frame: after CPI Helper has put the
    // host in the panel, before the browser paints, so the bar is already in place when it opens.
    // A hidden tab runs no animation frames, so a short timer sends it as well (docking twice is a no-op).
    messageSidebarContent: {
      static: false,
      onRender: () => {
        if (!document.getElementById(HOST_CSS_ID)) {
          const st = document.createElement("style");
          st.id = HOST_CSS_ID;
          st.textContent =
            // width 0 + min-width 100%: never widens the panel (it sizes to its content)
            `#${HOST_ID}{width:0;min-width:100%;box-sizing:border-box}` + `#${HOST_ID}:empty::before{content:attr(data-idle);color:#6a6d70;font-size:12px}` + `#${HOST_ID}[data-out]:empty::before{content:attr(data-hint)}`;
          document.head.appendChild(st);
        }
        const host = document.createElement("div");
        host.id = HOST_ID;
        host.dataset.hint = "The bar is popped out. Popin on the bar brings it back.";
        // shown while the page has no bar: anything but an artifact in Design or Discover
        host.dataset.idle = "Open an artifact in Design or Discover to use the bar.";
        const hostReady = () => document.dispatchEvent(new CustomEvent("cpiPanelMover:host"));
        requestAnimationFrame(hostReady);
        setTimeout(hostReady, 50);
        return host;
      },
    },
    heartbeat: async (pluginHelper, settings) => {
      const saved = settings["cpiPanelMover---defaultDock"];
      const dock = DOCK_VALUES.includes(saved) ? saved : "bottom";
      const savedFull = settings["cpiPanelMover---defaultFull"];
      const full = FULL_VALUES.includes(savedFull) ? savedFull : "off";

      // inject only once per page load, like settingsPaneResizer.js
      let script = document.getElementById(SCRIPT_ID);
      if (script) {
        // keep the page script's configuration current (it reads the data attribute on use)
        if (script.dataset.defaultDock !== dock) {
          script.dataset.defaultDock = dock;
        }
        if (script.dataset.defaultFull !== full) {
          script.dataset.defaultFull = full;
        }
        return;
      }
      log.log(`Loading "CPI Panel Mover" by Amit Shukla, Mindset Consulting`);
      script = document.createElement("script");
      script.setAttribute("id", SCRIPT_ID);
      script.dataset.defaultDock = dock;
      script.dataset.defaultFull = full;
      script.src = chrome.runtime.getURL("plugins/cpiPanelMover-inject.js");
      document.head.appendChild(script);
    },
  };

  pluginList.push(plugin);
})();
