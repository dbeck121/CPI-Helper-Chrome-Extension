// Native tab and Split View APIs are unavailable to content scripts, so Pins
// needs this manifest-registered background handler. It runs on messages and tab
// events, with no polling or keep-alive. Missing split APIs leave Pins inactive.
// URLs and names persist per tenant locally; live tab IDs belong only to this browser session.
const kateWorkspaceKey = "kate-workspaces";
let kateQueue = Promise.resolve();
const kateSplit = (tab) => Number.isInteger(tab.splitViewId) && tab.splitViewId !== -1;
function kateIsSapPage(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /\.(hana\.ondemand\.com|platform\.sapcloud\.cn)$/.test(url.hostname);
  } catch (_) { return false; }
}
function katePinTitle(url, title) {
  const route = new URL(url).pathname.match(/\/shell\/[^/]+\/([^/]+)/)?.[1];
  // Monitoring routes can change before SAP replaces its heading and artifact context.
  if (!new URL(url).pathname.includes("/shell/monitoring/") && title && !["Integration Suite", "Cloud Integration", "Pinned SAP view"].includes(title)) return String(title).slice(0, 100);
  return route ? decodeURIComponent(route).replace(/([a-z])([A-Z])/g, "$1 $2") : "SAP view";
}
async function kateHandle(message, sender) {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) || !kateIsSapPage(sender.url)) throw new Error("Open KaTe from SAP Cloud Integration.");
  if ((await chrome.storage.sync.get("kate---isActive"))["kate---isActive"] !== true) return { role: "inactive", pins: [] };
  if (typeof chrome.tabs.createSplit !== "function" || typeof chrome.tabs.unsplit !== "function") return { role: "inactive", pins: [] };
  const tab = await chrome.tabs.get(sender.tab.id);
  // sender.url can retain the original document URL after SAP pushState navigation.
  const pinUrl = message.url || tab.url || sender.url;
  if (!kateIsSapPage(pinUrl) || new URL(pinUrl).origin !== new URL(sender.url).origin) throw new Error("Pin a view from the current SAP tenant.");
  let workspaces = (await chrome.storage.session.get(kateWorkspaceKey))[kateWorkspaceKey] || [];
  const previous = JSON.stringify(workspaces);
  const tenantOrigin = new URL(pinUrl).origin;
  const maxPins = 5;
  const catalogKey = `kate-pins---${new URL(pinUrl).hostname}`;
  const stored = (await chrome.storage.local.get(catalogKey))[catalogKey];
  const catalog = Array.isArray(stored) ? stored.filter((pin) => kateIsSapPage(pin?.url) && new URL(pin.url).origin === tenantOrigin).slice(0, 5) : null;
  // Prune closed tabs without ever closing a user's page ourselves.
  const liveTabs = new Map((await chrome.tabs.query({})).map((entry) => [entry.id, entry]));
  const live = new Set(liveTabs.keys());
  workspaces = workspaces.filter((entry) => {
    const ownerUrl = liveTabs.get(entry.owner)?.url;
    if (!kateIsSapPage(ownerUrl)) return false;
    const origin = new URL(ownerUrl).origin;
    // Old sessions had no origin field. Never let a navigated owner mix tenants.
    if (entry.origin && entry.origin !== origin) return false;
    entry.origin = origin;
    return true;
  });
  for (const entry of workspaces) {
    for (const pin of entry.pins) if (!live.has(pin.tabId)) pin.tabId = null;
    for (const pin of entry.pins) if (!pin.title) pin.title = katePinTitle(pin.url);
  }
  let workspace = workspaces.find((entry) => entry.origin === tenantOrigin && (entry.owner === tab.id || entry.rightTabId === tab.id || entry.pins.some((pin) => pin.tabId === tab.id)));
  if (!workspace) {
    workspace = { owner: tab.id, origin: tenantOrigin, pins: [], active: null };
    // Extension reloads clear session storage while native splits stay open.
    // Restore only a same-tenant pair whose right view is an existing saved pin.
    if (kateSplit(tab) && catalog?.length) {
      const pair = (await chrome.tabs.query({ windowId: tab.windowId, splitViewId: tab.splitViewId })).sort((a, b) => a.index - b.index);
      if (pair.length === 2 && pair.every(entry => kateIsSapPage(entry.url) && new URL(entry.url).origin === tenantOrigin) && catalog.some(pin => pin.url === pair[1].url)) {
        workspace.owner = pair[0].id;
        workspace.rightTabId = pair[1].id;
        workspace.pins = [{ url: pair[1].url, tabId: pair[1].id }];
        workspace.active = pair[1].url;
      }
    }
    workspaces.push(workspace);
  }
  // Migrate old session records, and reconcile saved bookmarks with live tabs.
  if (typeof workspace.active === "number") workspace.active = workspace.pins.find((pin) => pin.tabId === workspace.active)?.url || null;
  if (catalog) {
    workspace.pins = catalog.map((saved) => {
      const existing = workspace.pins.find((pin) => pin.url === saved.url);
      return { url: saved.url, title: typeof saved.title === "string" && saved.title.trim() ? saved.title.trim().slice(0, 100) : katePinTitle(saved.url), tabId: existing?.tabId ?? null };
    });
    if (!workspace.pins.some((pin) => pin.url === workspace.active)) workspace.active = null;
  }
  let owner = await chrome.tabs.get(workspace.owner);
  const action = message.action || "state";
  async function collapse() {
    owner = await chrome.tabs.get(workspace.owner);
    if (kateSplit(owner)) await chrome.tabs.unsplit(owner.splitViewId);
    await chrome.tabs.update(owner.id, { active: true });
  }
  function attachRight(pin, right) {
    // One dedicated right-hand tab keeps the native split (and its user-set width).
    for (const other of workspace.pins) if (other.tabId === right.id) other.tabId = null;
    pin.tabId = right.id;
    workspace.rightTabId = right.id;
    workspace.active = pin.url;
  }
  async function navigateRight(right, url) {
    if (right.url === url || right.pendingUrl === url) return;
    let result;
    try {
      result = await chrome.tabs.sendMessage(right.id, { type: "kate:navigate-pin", url, useHistory: true }, { frameId: 0 });
    } catch (_) {
      // An older content script or a page still loading may have no receiver.
      // Don't replace it blindly: that could discard unsaved SAP editor changes.
      throw new Error("Reload the pinned SAP page once to enable pin navigation.");
    }
    if (result?.ok) return;
    if (result?.reload) { await chrome.tabs.update(right.id, { url }); return; }
    throw new Error(result?.error || "The pinned view could not be opened.");
  }
  async function select(pin) {
    owner = await chrome.tabs.get(workspace.owner);
    if (kateSplit(owner)) {
      const pair = await chrome.tabs.query({ windowId: owner.windowId, splitViewId: owner.splitViewId });
      const right = pair.find((entry) => entry.id !== owner.id);
      if (!right || !(right.id === workspace.rightTabId || workspace.pins.some((entry) => entry.tabId === right.id))) throw new Error("This split view is not the KaTe pin workspace.");
      // Crucially, never unsplit, move tabs or create a new split while changing pins.
      await navigateRight(right, pin.url);
      attachRight(pin, right);
      return;
    }
    const rightId = live.has(workspace.rightTabId) ? workspace.rightTabId : pin.tabId;
    if (!rightId) {
      const created = await chrome.tabs.create({ url: pin.url, windowId: owner.windowId, index: owner.index + 1, pinned: owner.pinned, active: false, splitWithTabId: owner.id });
      attachRight(pin, created);
      return;
    }
    let target = await chrome.tabs.get(rightId);
    if (owner.windowId !== target.windowId) throw new Error("Move the pinned tab back to the workspace window first.");
    if (kateSplit(target)) throw new Error("The pinned tab is already in another split view.");
    if (target.pinned !== owner.pinned) await chrome.tabs.update(target.id, { pinned: owner.pinned });
    if (target.groupId !== owner.groupId) {
      if (owner.groupId === -1) await chrome.tabs.ungroup(target.id);
      else await chrome.tabs.group({ groupId: owner.groupId, tabIds: target.id });
    }
    const refreshed = await chrome.tabs.get(owner.id);
    const targetNow = await chrome.tabs.get(target.id);
    await chrome.tabs.move(target.id, { index: refreshed.index + (targetNow.index < refreshed.index ? 0 : 1) });
    await navigateRight(target, pin.url);
    await chrome.tabs.createSplit([owner.id, target.id]);
    attachRight(pin, target);
    await chrome.tabs.update(owner.id, { active: true });
  }
  if (action === "pin") {
    if (tab.id !== workspace.owner) throw new Error("Pin views from the left workspace.");
    const duplicate = workspace.pins.find((pin) => pin.url === pinUrl);
    if (duplicate) await select(duplicate);
    else {
      if (workspace.pins.length >= maxPins) throw new Error(`Remove a pin first (maximum ${maxPins}).`);
      const pin = { tabId: null, url: pinUrl, title: katePinTitle(pinUrl, message.title) };
      await select(pin);
      workspace.pins.push(pin);
    }
  } else if (action === "select") {
    const pin = workspace.pins.find((entry) => (entry.url === message.pinId || Number.isInteger(message.pinId) && entry.tabId === message.pinId));
    if (!pin) throw new Error("Pin is no longer available.");
    await select(pin);
  } else if (action === "collapse") await collapse();
  else if (action === "expand") {
    const pin = workspace.pins.find((entry) => entry.url === workspace.active) || workspace.pins[0];
    if (pin) await select(pin);
  } else if (action === "rename") {
    const pin = workspace.pins.find((entry) => entry.url === message.pinId);
    if (!pin) throw new Error("Pin is no longer available.");
    const name = typeof message.name === "string" ? message.name.trim() : "";
    if (!name || name.length > 100) throw new Error("Use a pin name between 1 and 100 characters.");
    pin.title = name;
  } else if (action === "remove") {
    const pin = workspace.pins.find((entry) => (entry.url === message.pinId || Number.isInteger(message.pinId) && entry.tabId === message.pinId));
    if (!pin) throw new Error("Pin is no longer available.");
    if (pin.url === workspace.active) { await collapse(); workspace.active = null; }
    workspace.pins = workspace.pins.filter((entry) => entry !== pin);
    // The removed pin remains a normal SAP tab; unsaved changes are preserved.
  } else if (action !== "state") throw new Error("Unknown pin action.");
  const savedPins = workspace.pins.map(({ url, title }) => ({ url, title }));
  if (action === "pin" || action === "remove" || action === "rename" || !catalog) {
    if (JSON.stringify(savedPins) !== JSON.stringify(stored)) await chrome.storage.local.set({ [catalogKey]: savedPins });
  }
  if (JSON.stringify(workspaces) !== previous) await chrome.storage.session.set({ [kateWorkspaceKey]: workspaces });
  owner = await chrome.tabs.get(workspace.owner);
  return { role: tab.id === workspace.owner ? "owner" : "pin", pins: workspace.pins, maxPins, active: workspace.active, open: kateSplit(owner) };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "kate:workspace") return;
  const task = kateQueue.then(() => kateHandle(message, sender));
  kateQueue = task.catch(() => {});
  task.then((state) => respond({ ok: true, ...state })).catch((error) => respond({ ok: false, error: error.message }));
  return true;
});

// Native split changes and closed tabs have no storage event of their own.
// Notify only the affected workspace, after any in-flight pin action finishes.
// There is no timer, keep-alive port or broadcast to unrelated SAP tabs.
function kateRefreshWorkspace(tabId) {
  const task = kateQueue.then(async () => {
    const workspaces = (await chrome.storage.session.get(kateWorkspaceKey))[kateWorkspaceKey] || [];
    const workspace = workspaces.find(entry => entry.owner === tabId || entry.rightTabId === tabId || entry.pins.some(pin => pin.tabId === tabId));
    if (!workspace) return;
    const ids = new Set([workspace.owner, workspace.rightTabId, ...workspace.pins.map(pin => pin.tabId)]);
    await Promise.all([...ids].filter(Number.isInteger).map(async id => {
      try {
        const tab = await chrome.tabs.get(id);
        if (tab.discarded || tab.frozen || !kateIsSapPage(tab.url)) return;
        await chrome.tabs.sendMessage(id, { type: "kate:refresh-state" }, { frameId: 0 });
      } catch (_) { /* Closed, loading or updated tabs may have no receiver. */ }
    }));
  });
  kateQueue = task.catch(() => {});
}
chrome.tabs.onUpdated.addListener((tabId, changes) => {
  if (changes.splitViewId !== undefined || changes.url !== undefined) kateRefreshWorkspace(tabId);
});
chrome.tabs.onRemoved.addListener(kateRefreshWorkspace);
