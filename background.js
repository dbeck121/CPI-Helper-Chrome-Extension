// Loads private plugins from plugins/custom/ without touching manifest.json.
// plugins/custom/plugins.json lists the files, e.g. ["myPlugin.js"]. The folder is gitignored and not part of the
// release zip, so store installs find no list and load nothing. The content scripts ask for the plugins once per page
// (end of scripts/plugins.js); they are injected into the same isolated world, so they see pluginList, cpiData, log etc.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "cpiHelperLoadCustomPlugins" || !sender.tab) return;
  loadCustomPlugins(sender.tab.id, sender.frameId).then(sendResponse);
  return true;
});

async function loadCustomPlugins(tabId, frameId) {
  let files;
  try {
    files = await (await fetch(chrome.runtime.getURL("plugins/custom/plugins.json"))).json();
  } catch (error) {
    return { available: false, loaded: [] }; // no list: nothing to load
  }
  // opt-in per browser, set in the plugins popup. checked here and not in the page, so page code cannot skip it
  const { "customPlugins---enabled": enabled } = await chrome.storage.local.get("customPlugins---enabled");
  if (enabled !== true) return { available: true, enabled: false, loaded: [] };
  const loaded = [];
  const failed = [];
  for (const file of Array.isArray(files) ? files : []) {
    // only plain file names inside plugins/custom
    if (typeof file !== "string" || !/^[\w.-]+\.js$/.test(file)) {
      failed.push({ file, error: "invalid file name" });
      continue;
    }
    try {
      await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ["plugins/custom/" + file] });
      loaded.push(file);
    } catch (error) {
      failed.push({ file, error: String(error?.message || error) });
    }
  }
  return { available: true, enabled: true, loaded, failed };
}
