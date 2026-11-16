const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('plugins/kate-background.js', 'utf8');
const origin = 'https://tenant.hana.ondemand.com';

function setup({ supported = true, initialSplit = -1 } = {}) {
  let listener, updated, removed, next = 2, session = {}, local = {}, writes = 0;
  const calls = [], notices = [];
  const tabs = new Map([[1, { id: 1, url: `${origin}/shell/home`, windowId: 1, index: 0, pinned: false, groupId: -1, splitViewId: initialSplit }]]);
  const chrome = {
    runtime: { id: 'test', onMessage: { addListener(fn) { listener = fn; } } },
    storage: {
      sync: { get: async () => ({ 'kate---isActive': true }) },
      local: { get: async key => ({ [key]: structuredClone(local[key]) }), set: async value => { writes++; Object.assign(local, structuredClone(value)); } },
      session: { get: async () => structuredClone(session), set: async value => { writes++; Object.assign(session, structuredClone(value)); } },
    },
    tabs: {
      onUpdated: { addListener(fn) { updated = fn; } },
      onRemoved: { addListener(fn) { removed = fn; } },
      get: async id => { if (!tabs.has(id)) throw Error('Closed tab'); return { ...tabs.get(id) }; },
      query: async filter => [...tabs.values()].filter(tab => filter.splitViewId === undefined || tab.splitViewId === filter.splitViewId).map(tab => ({ ...tab })),
      sendMessage: async (id, message, options) => {
        assert.equal(options.frameId, 0, 'only the current main frame receives messages');
        if (message.type === 'kate:refresh-state') notices.push(id);
        else {
          calls.push('navigate');
          if (tabs.get(id).noReceiver) throw Error('No receiver');
          tabs.get(id).url = message.url;
        }
        return { ok: true };
      },
      create: async options => {
        calls.push('create');
        const tab = { ...tabs.get(1), ...options, id: next++, splitViewId: 42 };
        tabs.set(tab.id, tab); tabs.get(options.splitWithTabId).splitViewId = 42;
        return { ...tab };
      },
      update: async (id, options) => Object.assign(tabs.get(id), options),
      unsplit: supported ? async () => { calls.push('unsplit'); for (const tab of tabs.values()) tab.splitViewId = -1; } : undefined,
      createSplit: supported ? async () => { calls.push('split'); } : undefined,
      move: async () => { calls.push('move'); }, group: async () => {}, ungroup: async () => {},
    },
  };
  vm.runInNewContext(source, { chrome, URL });
  const send = (action = 'state', id = 1, extra = {}, sender = {}) => new Promise(resolve => listener(
    { type: 'kate:workspace', action, url: tabs.get(id).url, ...extra },
    { id: 'test', frameId: 0, tab: { id }, url: tabs.get(id).url, ...sender }, resolve,
  ));
  return { send, tabs, calls, notices, updated: (...args) => updated(...args), removed: id => removed(id), writes: () => writes, resetSession: () => { session = {}; }, local: () => local };
}

(async () => {
  const unsupported = setup({ supported: false });
  assert.equal((await unsupported.send()).role, 'inactive');
  assert.equal(unsupported.writes(), 0);
  assert.deepEqual(unsupported.calls, []);

  const h = setup();
  const pinned = await h.send('pin');
  const right = pinned.pins[0].tabId;
  const removed = await h.send('remove', 1, { pinId: pinned.pins[0].url });
  assert.equal(removed.pins.length, 0);
  assert.equal((await h.send('state', right)).role, 'pin', 'removing the active pin retains the dedicated right-tab role');
  assert.equal(h.tabs.size, 2, 'removing a pin never closes its SAP tab');
  const settledWrites = h.writes();
  for (let i = 0; i < 1200; i++) await h.send();
  assert.equal(h.writes(), settledWrites, 'one hour worth of old heartbeat requests must not write unchanged state');

  h.updated(right, { title: 'SAP title changes are irrelevant' });
  await h.send();
  assert.deepEqual(h.notices, []);
  h.updated(right, { splitViewId: -1 });
  await h.send(); // the serialized request also waits for the notification
  assert.deepEqual(h.notices.sort(), [1, right].sort());
  h.notices.length = 0;
  h.updated(999, { splitViewId: -1 });
  await h.send();
  assert.deepEqual(h.notices, [], 'unrelated tabs must not trigger a broadcast');

  h.tabs.delete(right); h.removed(right);
  await h.send();
  assert.deepEqual(h.notices, [1], 'closing the right tab updates the remaining owner');
  assert.equal((await h.send('pin', 1, {}, { frameId: 2 })).ok, false);
  assert.equal((await h.send('pin', 1, {}, { id: 'other-extension' })).ok, false);

  const foreignSplit = setup({ initialSplit: 88 });
  foreignSplit.tabs.set(2, { ...foreignSplit.tabs.get(1), id: 2, index: 1 });
  const rejected = await foreignSplit.send('pin');
  assert.equal(rejected.ok, false, 'an arbitrary pre-existing split is never adopted');
  assert.deepEqual(foreignSplit.calls, []);

  const reload = setup();
  const beforeReload = await reload.send('pin');
  const restoredRight = beforeReload.pins[0].tabId;
  reload.resetSession();
  assert.equal((await reload.send('state', restoredRight)).role, 'pin', 'extension reload restores a known saved-pin split even when the right tab asks first');
  assert.equal((await reload.send()).role, 'owner');
  assert.equal(reload.tabs.size, 2);
  assert.deepEqual(reload.calls, ['create'], 'restoration must not recreate the native split');

  const tenant = setup();
  const first = await tenant.send('pin');
  const tenantRight = first.pins[0].tabId;
  tenant.tabs.get(1).url = 'https://other.hana.ondemand.com/shell/home';
  assert.equal((await tenant.send()).pins.length, 0);
  const oldTenant = await tenant.send('state', tenantRight);
  assert.equal(oldTenant.role, 'owner', 'a tab whose owner left its tenant becomes independent');
  assert.equal(oldTenant.pins[0].url, `${origin}/shell/home`);
  assert.equal((await tenant.send()).pins.length, 0);

  const unavailable = setup();
  const existing = await unavailable.send('pin');
  unavailable.tabs.get(existing.pins[0].tabId).noReceiver = true;
  unavailable.tabs.get(1).url = `${origin}/shell/monitoring/Messages`;
  assert.equal((await unavailable.send('pin')).ok, false);
  assert.equal(unavailable.tabs.get(existing.pins[0].tabId).url, `${origin}/shell/home`, 'missing receiver cannot force navigation over unsaved edits');
  console.log('KaTe background: stable idle state, native tab events, active-pin removal, unsupported browsers, split ownership and tenant changes passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
