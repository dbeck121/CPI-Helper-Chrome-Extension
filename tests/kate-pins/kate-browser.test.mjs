// Real DOM checks with the extension's UI code and mocked Chrome messages.
// This does not replace the native split/SAP tenant checklist in katePins.md.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'test-results', 'kate-pins');
fs.mkdirSync(output, { recursive: true });
const logo = `data:image/png;base64,${fs.readFileSync(path.join(root, 'images/plugin_logos/kate.png')).toString('base64')}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('https://tenant.hana.ondemand.com/**', route => route.fulfill({
  contentType: 'text/html',
  body: '<!doctype html><html><head><title>Pin UI test fixture</title></head><body><h1>Pin UI test fixture</h1></body></html>',
}));
try {
  await page.goto('https://tenant.hana.ondemand.com/shell/home');
  await page.clock.install();
  await page.evaluate(logo => {
    window.pluginList = [];
    window.log = { error() {}, debug() {} };
    window.showToast = () => {};
    window.fixture = {
      messages: [], writes: 0, rootMutations: 0, shelfMutations: 0,
      state: { ok: true, role: 'pin', pins: [
        { url: `${location.origin}/shell/monitoring/Messages`, title: 'Messages' },
        { url: `${location.origin}/shell/monitoring/SecurityMaterials`, title: 'Security Materials' },
      ], maxPins: 5, active: `${location.origin}/shell/monitoring/Messages`, open: true },
    };
    window.chrome = {
      runtime: {
        id: 'test', getURL: () => logo,
        onMessage: { addListener(fn) { fixture.messageListener = fn; } },
        sendMessage: async message => {
          fixture.messages.push(message.action);
          if (fixture.holdNext) {
            fixture.holdNext = false;
            return new Promise(resolve => { fixture.release = () => resolve(structuredClone(fixture.state)); });
          }
          if (message.action === 'select') fixture.state.active = message.pinId;
          return structuredClone(fixture.state);
        },
      },
      storage: {
        local: { get: async () => ({}), set: async () => { fixture.writes++; } },
        sync: { set: async () => { fixture.writes++; } },
        onChanged: { addListener(fn) { fixture.storageListener = fn; } },
      },
    };
  }, logo);
  // Include the actual HTML theme observer: repeated root-class writes used to
  // trigger this observer and chrome.storage.sync.set on every refresh.
  await page.addScriptTag({ path: path.join(root, 'scripts/init.js') });
  await page.evaluate(() => body());
  await page.addScriptTag({ path: path.join(root, 'common/ui-kit.js') });
  await page.addScriptTag({ path: path.join(root, 'scripts/commandPalette.js') });
  await page.evaluate(() => {
    // Keep the real palette shortcut, renderer and close behavior; replace only
    // tenant data and helper dependencies absent from this isolated SAP fixture.
    window.statistic = () => {};
    window.floatingToolbarIcon = () => '';
    window.cpihIsMac = () => false;
    window.cpihHistoryStorageKey = () => 'fixture-history';
    cpihReadPaletteIndex = async () => ({ time: Date.now(), artifacts: [], packages: [] });
    cpihReadPaletteUsage = async () => ({});
    cpihBuildPaletteItems = () => [];
    window.cpihPaletteSearch = () => [];
    chrome.storage.sync.get = async () => ({});
  });
  await page.addScriptTag({ path: path.join(root, 'plugins/kate.js') });
  await page.waitForFunction(() => document.querySelector('#kate-pin-shelf')?.style.visibility === '');
  await page.clock.runFor(100);
  assert.equal(await page.evaluate(() => 'heartbeat' in pluginList[0]), false);

  const beginObservation = () => page.evaluate(() => {
    fixture.rootMutations = fixture.shelfMutations = 0;
    new MutationObserver(records => { fixture.rootMutations += records.length; })
      .observe(document.documentElement, { attributes: true });
    new MutationObserver(records => { fixture.shelfMutations += records.length; })
      .observe(document.querySelector('#kate-pin-shelf'), { attributes: true, childList: true, subtree: true });
    return { requests: fixture.messages.length, writes: fixture.writes };
  });
  const baseline = await beginObservation();
  await page.clock.fastForward(60 * 60 * 1000);
  let idle = await page.evaluate(() => ({ requests: fixture.messages.length, writes: fixture.writes, root: fixture.rootMutations, shelf: fixture.shelfMutations }));
  assert.deepEqual(idle, { ...baseline, root: 0, shelf: 0 }, 'one simulated idle hour creates no pin requests, storage writes or DOM mutations');

  await page.evaluate(async () => {
    for (let i = 0; i < 1200; i++) {
      fixture.messageListener({ type: 'kate:refresh-state' }, { id: 'test' }, () => {});
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });
  idle = await page.evaluate(() => ({ writes: fixture.writes, root: fixture.rootMutations, shelf: fixture.shelfMutations }));
  assert.deepEqual(idle, { writes: baseline.writes, root: 0, shelf: 0 }, '1200 unchanged refreshes must not restart theme sync or rewrite the shelf');

  await page.getByRole('button', { name: 'Security Materials', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Security Materials', exact: true }).getAttribute('aria-pressed'), 'true');
  const second = page.getByRole('button', { name: 'Security Materials', exact: true });
  await second.focus();
  await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).waitFor();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Remove pin');
  await page.keyboard.press('Escape');
  assert.equal(await second.evaluate(node => node === document.activeElement), true);

  assert.deepEqual(await page.evaluate(async () => {
    const modal = document.createElement('div'); modal.id = 'guard-test'; document.body.append(modal);
    const result = cpihModal.show(modal);
    return { modal: result, confirm: await cpihConfirm() };
  }), { modal: null, confirm: false }, 'pin tabs suppress CPI Helper dialogs');

  await page.evaluate(() => {
    const input = document.createElement('input'); input.id = 'sap-shortcut-test';
    const ace = document.createElement('div'); ace.className = 'ace_editor';
    const editor = document.createElement('input'); editor.id = 'ace-shortcut-test'; ace.append(editor);
    fixture.editorKeys = [];
    editor.addEventListener('keydown', event => { if (event.key.toLowerCase() === 'k') fixture.editorKeys.push(event.key); });
    document.body.append(input, ace);
  });
  await page.locator('#sap-shortcut-test').focus();
  for (const key of ['Control+k', 'Meta+k']) {
    await page.keyboard.press(key);
    assert.equal(await page.locator('#cpiHelper_palette').count(), 0, `${key} must not create a hidden palette in the right pin tab`);
  }
  await page.locator('#ace-shortcut-test').focus();
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Meta+k');
  assert.equal(await page.evaluate(() => fixture.editorKeys.length), 2, 'Ace retains both editor shortcuts');
  assert.equal(await page.locator('#cpiHelper_palette').count(), 0);

  await page.evaluate(() => {
    fixture.state.role = 'owner';
    fixture.messageListener({ type: 'kate:refresh-state' }, { id: 'test' }, () => {});
  });
  await page.waitForFunction(() => !document.documentElement.classList.contains('kate-pin-tab'));
  for (const key of ['Control+k', 'Meta+k']) {
    await page.locator('#sap-shortcut-test').focus();
    await page.keyboard.press(key);
    await page.waitForFunction(() => document.activeElement === document.querySelector('.cpiHelper_palette_input'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#cpiHelper_palette').count(), 0, 'left view opens and closes the unchanged core palette');
  }
  await page.evaluate(() => {
    fixture.state.role = 'pin';
    fixture.messageListener({ type: 'kate:refresh-state' }, { id: 'test' }, () => {});
  });
  await page.waitForFunction(() => document.documentElement.classList.contains('kate-pin-tab'));

  await page.evaluate(() => {
    fixture.notice = cpihToast({ message: 'Save or cancel your changes in the pinned view first.', type: 'error', displayTime: 0 });
  });
  assert.equal(await page.getByRole('alert').isVisible(), true, 'navigation guard errors remain visible in the right pin tab');
  await page.evaluate(() => fixture.notice.element.remove());

  await page.locator('#kate-pin-shelf').screenshot({ path: path.join(output, 'pin-shelf-light.png') });
  await page.evaluate(() => document.querySelector('#cpihelperglobal').className = 'ch_dark');
  await page.locator('#kate-pin-shelf').screenshot({ path: path.join(output, 'pin-shelf-dark.png') });
  await page.setViewportSize({ width: 390, height: 640 });
  await page.waitForFunction(() => {
    const rect = document.querySelector('#kate-pin-shelf').getBoundingClientRect();
    return rect.x >= 0 && rect.right <= innerWidth + 1;
  });
  await page.locator('#kate-pin-shelf').screenshot({ path: path.join(output, 'pin-shelf-narrow.png') });

  await page.evaluate(() => {
    fixture.holdNext = true;
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForFunction(() => typeof fixture.release === 'function');
  await page.evaluate(() => {
    fixture.storageListener({ 'kate---isActive': { newValue: false } }, 'sync');
    fixture.release();
  });
  assert.equal(await page.locator('#kate-pin-shelf').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.cpihUi), undefined);
  await page.locator('#sap-shortcut-test').focus();
  await page.keyboard.press('Control+k');
  await page.waitForFunction(() => document.activeElement === document.querySelector('.cpiHelper_palette_input'));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#cpiHelper_palette').count(), 0, 'deactivation releases the palette shortcut');
  await page.evaluate(() => fixture.storageListener({ 'kate---isActive': { newValue: true } }, 'sync'));
  await page.locator('#kate-pin-shelf').waitFor();
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'browser-result.json'), JSON.stringify({
    browser: browser.version(), idleHoursSimulated: 1, unchangedRefreshes: 1200,
    assertions: 'passed', nativeSplitAndSap: 'not covered by this fixture', screenshots: 'real pin UI with synthetic pin names',
  }, null, 2) + '\n');
  console.log('KaTe browser: simulated idle hour, 1200 refreshes, theme sync, keyboard menu, UI guards, narrow layout and activation passed');
} finally {
  await browser.close();
}

// Load the complete manifest in an isolated browser profile as well. This
// catches background registration errors that mocked runtime messages cannot.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kate-pins-extension-'));
let extensionContext;
try {
  extensionContext = await chromium.launchPersistentContext(profile, {
    headless: true, channel: 'chromium',
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
  });
  const worker = extensionContext.serviceWorkers()[0] || await extensionContext.waitForEvent('serviceworker', { timeout: 15000 });
  const extension = await worker.evaluate(async () => {
    const manifest = chrome.runtime.getManifest();
    await chrome.storage.sync.set({ 'kate---isActive': true });
    const supported = typeof chrome.tabs.createSplit === 'function' && typeof chrome.tabs.unsplit === 'function';
    const tabCount = (await chrome.tabs.query({})).length;
    let unsupportedState = null;
    if (!supported) unsupportedState = await kateHandle({ action: 'state' }, {
      id: chrome.runtime.id, frameId: 0, tab: { id: 1 }, url: 'https://tenant.hana.ondemand.com/shell/home',
    });
    return { worker: manifest.background.service_worker, supported, tabCount, unsupportedState,
      after: (await chrome.tabs.query({})).length, stored: await chrome.storage.local.get(null) };
  });
  assert.equal(extension.worker, 'plugins/kate-background.js');
  assert.equal(extension.after, extension.tabCount, 'loading or unsupported activation must not open tabs');
  assert.deepEqual(extension.stored, {});
  if (!extension.supported) assert.deepEqual(extension.unsupportedState, { role: 'inactive', pins: [] });
  const resultPath = path.join(output, 'browser-result.json');
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  result.extensionLoader = { passed: true, nativeSplitApisAvailable: extension.supported };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n');
  console.log('KaTe extension: full manifest and real background registration passed; unsupported activation creates no tabs or saved pins');
} finally {
  await extensionContext?.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
