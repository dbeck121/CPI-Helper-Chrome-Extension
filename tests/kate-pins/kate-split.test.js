const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const url = 'https://tenant.hana.ondemand.com/shell/design/Flow';
let listener, saved = {}, local = {}, active = true, next = 2;
const preferences = {};
const layoutCalls = [];
const navigations = [];
const focusChanges = [];
const tabs = new Map([[1, { id: 1, url, index: 0, pinned: false, windowId: 1, groupId: -1, splitViewId: -1 }]]);
const chrome = {
  runtime: { id: 'test', onMessage: { addListener(fn) { listener = fn; } } },
  storage: {
    sync: { get: async () => ({ 'kate---isActive': active, ...preferences }), set: async value => Object.assign(preferences,value) },
    local: { get: async (key) => ({ [key]: structuredClone(local[key]) }), set: async (value) => Object.assign(local, structuredClone(value)) },
    session: { get: async () => structuredClone(saved), set: async (value) => { saved = structuredClone(value); } },
  },
  tabs: {
    onUpdated: { addListener() {} }, onRemoved: { addListener() {} },
    sendMessage: async (id,message) => { navigations.push([id,message.url]); Object.assign(tabs.get(id),{url:message.url}); return {ok:true}; },
    get: async (id) => { if (!tabs.has(id)) throw new Error('No tab'); return { ...tabs.get(id) }; },
    query: async (q) => [...tabs.values()].filter(t => (q.splitViewId === undefined || t.splitViewId === q.splitViewId) && (q.windowId === undefined || t.windowId === q.windowId)).map(t => ({...t})),
    create: async (args) => {
      layoutCalls.push("create");
      const id = next++;
      tabs.set(id, { ...args, id, groupId: -1, splitViewId: args.splitWithTabId ? id + 100 : -1 });
      if(args.splitWithTabId) tabs.get(args.splitWithTabId).splitViewId = id + 100;
      return { ...tabs.get(id) };
    },
    unsplit: async (id) => { layoutCalls.push("unsplit"); for (const t of tabs.values()) if (t.splitViewId === id) t.splitViewId = -1; },
    update: async (id, changes) => { if(changes.active) focusChanges.push(id); if(changes.url) navigations.push([id,changes.url]); return Object.assign(tabs.get(id), changes); },
    move: async (id, changes) => { layoutCalls.push("move"); return Object.assign(tabs.get(id), changes); },
    group: async () => {}, ungroup: async () => {},
    createSplit: async ([left, right]) => { layoutCalls.push("createSplit"); tabs.get(left).splitViewId = tabs.get(right).splitViewId = right + 100; },
  },
};
vm.runInNewContext(fs.readFileSync('plugins/kate-background.js', 'utf8'), { chrome, URL });
const send = (action, tabId = 1, extra = {}) => new Promise(resolve => listener({ type:'kate:workspace', action, ...extra }, { id:'test', frameId:0, tab:{id:tabId}, url:extra.senderUrl || tabs.get(tabId).url }, resolve));
(async () => {
  let s = await send('pin', 1, {title:'Flow'});
  assert.equal(s.ok, true); assert.equal(s.pins.length, 1); assert.equal(s.open, true);
  const pin = s.pins[0].tabId;
  assert.equal((await send('state', pin)).role, 'pin');
  assert.equal((await send('pin', pin)).ok, false);
  await send('collapse'); assert.equal(tabs.size, 2); assert.equal(tabs.get(1).splitViewId, -1);
  await send('expand'); assert.equal(tabs.size, 2); assert.equal(tabs.get(1).splitViewId, tabs.get(pin).splitViewId);
  await send('pin'); assert.equal(tabs.size, 2); // URL duplicates reuse the live tab.
  for (let i=2;i<=5;i++) { tabs.get(1).url = url+i; s = await send('pin',1,{title:'Flow '+i}); assert.equal(s.ok,true); }
  assert.equal(s.pins.length,5);
  const layoutBeforeSelection = [...layoutCalls];
  const splitBeforeSelection = tabs.get(1).splitViewId;
  const beforeSelection = structuredClone(local['kate-pins---tenant.hana.ondemand.com']);
  for (const bookmark of beforeSelection) {
    for (let click=0;click<2;click++) {
      const selected = await send('select',1,{pinId:bookmark.url});
      assert.equal(selected.ok,true);
      assert.equal(selected.pins.length,5);
      assert.equal(selected.open,true);
      assert.equal(tabs.get(1).splitViewId,splitBeforeSelection);
      assert.deepEqual(layoutCalls,layoutBeforeSelection);
      if(click===1) assert.equal(navigations.length,navigationCount);
      var navigationCount=navigations.length;
      assert.deepEqual(local['kate-pins---tenant.hana.ondemand.com'],beforeSelection);
    }
  }
  assert.equal((await send('remove',1,{pinId:null})).ok,false);
  assert.deepEqual(local['kate-pins---tenant.hana.ondemand.com'],beforeSelection);

  tabs.get(1).url = url+6; assert.equal((await send('pin')).ok,false); assert.equal(tabs.size,2);
  s = await send('remove',1,{pinId:url}); assert.equal(s.pins.length,4); assert.equal(tabs.size,2);
  assert.equal((await send('state',pin)).role,'pin');
  const spaUrl = url + '/Messages?status=COMPLETED';
  assert.equal((await send('pin',1,{url:'https://other.hana.ondemand.com/shell',senderUrl:url})).ok,false);
  s = await send('pin',1,{url:spaUrl,senderUrl:url,title:'Messages'});
  assert.equal(s.ok,true);
  assert.equal(s.pins.at(-1).url,spaUrl);
  assert.equal(tabs.get(s.pins.at(-1).tabId).url,spaUrl);
  await testClickDuringRefresh();
  await testRestoredQueue();
  active=false; assert.equal((await send('state')).role,'inactive');
  await testPersistentPins();
  await testSharedTab();
  console.log('KaTe: live pins, SPA routes, queued clicks, persistent restore, lazy reopening and tenant isolation passed');
})().catch(error => { console.error(error); process.exitCode=1; });

async function testClickDuringRefresh() {
  const source = fs.readFileSync('plugins/kate.js','utf8');
  const requestCode = source.slice(source.indexOf('  function request('),source.indexOf('  // Keep the native split intact.'));
  const messages = [];
  let release;
  const context = {
    // Plugins load before contentScript.js creates cpiData.
    location: { href: url },
    document: { title:'SAP', querySelectorAll:()=>[] },
    chrome: { runtime: { sendMessage: (message) => {
      messages.push(message);
      if(message.action==='state') return new Promise(resolve=>{release=resolve;});
      return Promise.resolve({ok:true});
    } } }, showToast:()=>{},
  };
  vm.createContext(context);
  vm.runInContext('let requestQueue=Promise.resolve(),refreshPending=false,state,requestGeneration=0; function render() {}\n'+requestCode+'\nglobalThis.request=request;',context);
  const refreshing=context.request();
  await Promise.resolve();
  context.location.href=url+'/new';
  const clicking=context.request('pin');
  context.location.href=url+'/later';
  release({ok:true});
  await refreshing; await clicking;
  assert.equal(messages.length,2);
  assert.equal(messages[1].action,'pin');
  assert.equal(messages[1].url,url+'/new');
}

async function testRestoredQueue() {
  const source = fs.readFileSync('plugins/kate.js','utf8');
  const queueCode = source.slice(source.indexOf('  let requestQueue ='),source.indexOf('  let shelfCollapsed'));
  const requestCode = source.slice(source.indexOf('  function request('),source.indexOf('  // Keep the native split intact.'));
  let restored, release;
  const calls=[];
  const context={
    window:{addEventListener(name,fn){if(name==='pageshow')restored=fn;}},
    location:{href:url},document:{title:'SAP',querySelectorAll:()=>[]},
    chrome:{runtime:{sendMessage(message){calls.push(message.action);return calls.length===1?new Promise(resolve=>{release=resolve;}):Promise.resolve({ok:true,marker:'fresh'});}}},
    showToast(){},
  };
  vm.createContext(context);
  vm.runInContext('let state; function render() {}\n'+queueCode+requestCode+'\nglobalThis.request=request;globalThis.readState=()=>state;',context);
  const old=context.request();
  await Promise.resolve();
  restored({persisted:true});
  await context.request('select','pin');
  assert.deepEqual(calls,['state','state','select'],'Restoration frees clicks from a suspended request');
  release({ok:true,marker:'stale'});
  await old;
  assert.equal(context.readState().marker,'fresh','Late frozen-document response cannot overwrite current state');
}

async function testPersistentPins() {
  active = true;
  const catalogKey = 'kate-pins---tenant.hana.ondemand.com';
  const bookmarks = structuredClone(local[catalogKey]);
  assert.equal(bookmarks.length, 5);
  assert(bookmarks.every(pin => Object.keys(pin).sort().join(',') === 'title,url'));
  // Browser restart: session and old tabs gone, local bookmarks remain.
  saved = {};
  tabs.clear();
  tabs.set(1, { id:1, url, index:0, pinned:false, windowId:1, groupId:-1, splitViewId:-1 });
  let result = await send('state');
  assert.equal(result.ok, true);
  assert.equal(result.pins.length, 5);
  assert.equal(result.open, false);
  assert(result.pins.every(pin => pin.tabId === null));
  assert.equal(tabs.size, 1); // Restoring the list creates no SAP tabs.
  result = await send('select', 1, {pinId:bookmarks[0].url});
  assert.equal(result.ok, true);
  assert.equal(tabs.size, 2);
  const reopened = result.pins.find(pin => pin.url === bookmarks[0].url);
  tabs.delete(reopened.tabId);
  result = await send('state');
  assert.equal(result.pins.length, 5); // Closing a live tab doesn't delete a bookmark.
  assert.equal(result.pins.find(pin => pin.url === bookmarks[0].url).tabId, null);
  result = await send('remove',1,{pinId:bookmarks[0].url});
  assert.equal(local[catalogKey].length,4);
  tabs.set(100,{id:100,url:'https://other.hana.ondemand.com/shell',index:1,pinned:false,windowId:1,groupId:-1,splitViewId:-1});
  result = await send('state',100);
  assert.equal(result.pins.length,0);
  assert.equal(local[catalogKey].length,4);
  const monitoring = 'https://other.hana.ondemand.com/shell/monitoring/Messages';
  result = await send('pin',100,{url:monitoring,title:'Messages'});
  const countBeforeRename=tabs.size;
  result = await send('rename',100,{pinId:monitoring,name:'  My message monitor  '});
  assert.equal(result.ok,true);
  assert.equal(result.pins[0].title,'My message monitor');
  assert.equal(tabs.size,countBeforeRename);
  assert.equal((await send('state',100)).pins[0].title,'My message monitor');
  for (const name of ['', '   ', 'x'.repeat(101)]) assert.equal((await send('rename',100,{pinId:monitoring,name})).ok,false);
  assert.equal((await send('rename',100,{pinId:url,name:'Wrong tenant'})).ok,false);
  saved={};
  tabs.clear();
  tabs.set(100,{id:100,url:monitoring,index:0,pinned:false,windowId:1,groupId:-1,splitViewId:-1});
  result=await send('state',100);
  assert.equal(result.pins[0].title,'My message monitor');
  assert.equal(result.pins[0].url,monitoring);
  assert.equal(result.pins[0].tabId,null);

}

// Exercise the content-script navigation boundary without a SAP document.
{
  const source = fs.readFileSync('plugins/kate.js','utf8');
  const listenerCode = source.slice(source.indexOf('  chrome.runtime.onMessage.addListener'), source.indexOf('  function render()'));
  let listener, editing = false, navigated;
  const context = {
    URL, location: { origin: 'https://tenant.hana.ondemand.com', pathname: '/shell/monitoring/Overview' },
    chrome: { runtime: { id: 'kate-test', onMessage: { addListener(fn) { listener = fn; } } } },
    cpihShellArea: pathname => pathname.split('/')[2],
    cpihEditorInEditMode: () => editing,
    cpihNavigate: url => { navigated = url; return true; },
  };
  vm.runInNewContext(listenerCode, context);
  const navigate = (url, useHistory = false) => {
    let response;
    listener({ type: 'kate:navigate-pin', url, useHistory }, { id: 'kate-test' }, value => { response = value; });
    return response;
  };
  assert.equal(navigate('https://tenant.hana.ondemand.com/shell/monitoring/SecurityMaterials').ok, true);
  assert(navigated.endsWith('/SecurityMaterials'));
  assert.equal(navigate('https://tenant.hana.ondemand.com/shell/design').reload, true);
  editing = true;
  assert.equal(navigate('https://tenant.hana.ondemand.com/shell/design').ok, false);
  assert.equal(navigate('https://other.hana.ondemand.com/shell/monitoring').ok, false);
  editing = false;
  const design = 'https://tenant.hana.ondemand.com/shell/design';
  let traversed;
  let entries = [{url:design,key:'design-entry',index:1}];
  context.navigation = {
    currentEntry:{index:0}, entries:()=>entries,
    traverseTo:key=>{traversed=key;return {finished:Promise.resolve()};},
  };
  assert.equal(navigate(design,true).history,true);
  assert.equal(traversed,'design-entry');
  traversed = null;
  assert.equal(navigate(design,false).reload,true);
  assert.equal(traversed,null,'Loaded mode does not traverse the shared-tab history');
  editing = true;
  assert.equal(navigate(design,true).ok,false);
  assert.equal(traversed,null,'History must not discard editor changes');
  editing = false;
  entries = [];
  assert.equal(navigate(design,true).reload,true,'Disposed forward entry falls back to normal navigation');
}

async function testSharedTab() {
  const key = 'kate---splitMode---other.hana.ondemand.com';
  const first = 'https://other.hana.ondemand.com/shell/monitoring/Messages';
  const second = 'https://other.hana.ondemand.com/shell/monitoring/Overview';
  // A retired preference must not reactivate the removed tab-per-pin mode.
  preferences[key] = 'loaded';
  let result = await send('select',100,{pinId:first});
  assert.equal(result.ok,true);
  const rightId = result.pins.find(pin=>pin.url===first).tabId;
  const split = tabs.get(100).splitViewId;
  const layout = layoutCalls.length;
  const count = tabs.size;
  result = await send('pin',100,{url:second,title:'Overview'});
  assert.equal(result.ok,true);
  for (const pinId of [first,second,first]) {
    result = await send('select',100,{pinId});
    assert.equal(result.ok,true);
    assert.equal(result.pins.find(pin=>pin.url===pinId).tabId,rightId);
    assert.equal(tabs.get(rightId).url,pinId);
  }
  assert.equal(tabs.size,count);
  assert.equal(tabs.get(100).splitViewId,split);
  assert.equal(layoutCalls.length,layout,'switching pins must not reconstruct the split');
  const metadataContext=vm.createContext({pluginList:[],location:{hostname:'other.hana.ondemand.com'}});
  const pluginSource=fs.readFileSync('plugins/kate.js','utf8');
  vm.runInContext(pluginSource.slice(pluginSource.lastIndexOf('var plugin =')),metadataContext);
  assert.equal(Object.keys(metadataContext.pluginList[0].settings).some(key=>key.startsWith('splitMode')),false);
  assert.equal(Object.keys(metadataContext.pluginList[0].settings).some(key=>key.startsWith('maxPins')),false);
  preferences['kate---maxPins---other.hana.ondemand.com'] = '1';
  const preservedPins = structuredClone(local['kate-pins---other.hana.ondemand.com']);
  result = await send('state',100);
  assert.equal(result.maxPins,5);
  assert.deepEqual(local['kate-pins---other.hana.ondemand.com'],preservedPins,'retired pin limit must preserve existing pins');
  result = await send('pin',100,{url:'https://other.hana.ondemand.com/shell/design/extra',title:'Extra'});
  assert.equal(result.ok,true,'retired pin limit must not prevent adding pins');
  console.log('KaTe shared tab: retired preferences ignored; one right tab; split preserved on pin changes; no mode or pin limit selector');
}
