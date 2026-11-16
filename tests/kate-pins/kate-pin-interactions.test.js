const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('plugins/kate.js','utf8');
const code = source.slice(source.indexOf('  function enablePinActions('),source.indexOf('  function trashIcon()'));
class Element {
  listeners = new Map();
  captured = new Set();
  classList = { add(){}, remove(){}, toggle(){} };
  setAttribute() {}
  addEventListener(name, fn, capture = false) { const list=this.listeners.get(name)||[]; list.push({fn,capture}); this.listeners.set(name,list); }
  removeEventListener(name, fn) { this.listeners.set(name,(this.listeners.get(name)||[]).filter(item=>item.fn!==fn)); }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
  getBoundingClientRect() { return { left:100,top:100,right:130,bottom:130 }; }
  fire(type, values={}) {
    const e={ type,button:0,pointerId:1,clientX:0,clientY:0,preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;}, ...values };
    for(const item of [...(this.listeners.get(type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture))) { item.fn(e); if(e.stopped) break; }
    return e;
  }
}
function setup() {
  const calls=[];
  const context={cancelPinDrag:()=>{},pinDragging:false,request:(...args)=>calls.push(args),closePinMenu(){},openPinMenu:(...args)=>calls.push(['menu',...args]),setTimeout(){},render(){}};
  vm.createContext(context);
  vm.runInContext(code+'\nglobalThis.enable=enablePinActions;',context);
  const pin={url:'https://tenant.hana.ondemand.com/shell/home',title:'Home'};
  const select=new Element(),trash=new Element();
  select.addEventListener('click',()=>calls.push(['select',pin.url]));
  context.enable(select,pin,trash);
  return {select,calls,pin,context};
}
{
  const {select,calls,pin}=setup();
  select.fire('pointerdown');select.fire('pointerup');select.fire('click');
  assert.deepEqual(calls,[['select',pin.url]]);
}
{
  const {select,calls,pin,context}=setup();
  select.fire('pointerdown');select.fire('pointermove',{clientX:110,clientY:110});
  select.fire('pointerup',{clientX:110,clientY:110});select.fire('click');
  assert.deepEqual(calls,[['remove',pin.url]]);
  assert.equal(context.pinDragging,false);
}
for(const type of ['pointerup','pointercancel','lostpointercapture']) {
  const {select,calls}=setup();
  select.fire('pointerdown');select.fire('pointermove',{clientX:50,clientY:50});
  select.fire(type,{clientX:50,clientY:50});select.fire('click');
  assert.deepEqual(calls,[]);
}
{
  const {select,calls}=setup();
  assert.equal(select.fire('contextmenu',{clientX:10,clientY:20}).prevented,true);
  assert.equal(calls[0][0],'menu');assert.equal(calls.length,1);
  select.fire('keydown',{key:'F10',shiftKey:true});
  assert.equal(calls[1][0],'menu');
}
console.log('KaTe pin interactions: click selects; only drop on trash removes; cancelled drag never opens/removes; context menu supports keyboard');
{
  const nodes = [{ attrs: {} }, { attrs: {} }];
  nodes.forEach(node => {
    node.setAttribute = (key, value) => { node.attrs[key] = value; };
    node.getAttribute = key => node.attrs[key];
  });
  const context = { shelf: { querySelectorAll: () => nodes, replaceChildren() { throw Error('Selection must not rebuild the shelf'); } }, state: { active: 'a', pins: [{ url: 'a' }, { url: 'b' }] } };
  vm.createContext(context);
  const selectionCode = source.slice(source.indexOf('  function updatePinSelection()'), source.indexOf('  function render()'));
  vm.runInContext(selectionCode + '\nupdatePinSelection();', context);
  assert.equal(nodes[0].attrs['aria-pressed'], 'true');
  context.state.active = 'b';
  vm.runInContext('updatePinSelection();', context);
  assert.equal(nodes[0].attrs['aria-pressed'], 'false');
  assert.equal(nodes[1].attrs['aria-pressed'], 'true');
}

// No-op class writes still trigger Chrome MutationObservers and the host theme sync.
{
  const classes = new Set(['kate-role-pending']);
  const mutations = [];
  const context = { document: { documentElement: { classList: {
    contains: name => classes.has(name),
    toggle(name, enabled) { mutations.push([name, enabled]); if (enabled) classes.add(name); else classes.delete(name); },
  } } } };
  vm.createContext(context);
  const classCode = source.slice(source.indexOf('  function setRootClass('), source.indexOf('  function cleanup()'));
  vm.runInContext(classCode, context);
  for (let i = 0; i < 100; i++) vm.runInContext('setRootClass("kate-pin-tab", false); setRootClass("kate-role-pending", false);', context);
  assert.deepEqual(mutations, [['kate-role-pending', false]], 'repeated owner refreshes must not mutate HTML classes');
  vm.runInContext('setRootClass("kate-pin-tab", true); setRootClass("kate-pin-tab", true); setRootClass("kate-pin-tab", false);', context);
  assert.deepEqual(mutations.slice(1), [['kate-pin-tab', true], ['kate-pin-tab', false]], 'real role changes still update HTML classes');
}
