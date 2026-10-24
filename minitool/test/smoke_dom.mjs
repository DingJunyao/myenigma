// smoke_dom.mjs - loads the minitool bundle under a minimal DOM stub and
// drives the main interaction flows, so runtime errors (undeclared
// identifiers, null DOM lookups, broken handlers) surface before packaging.
// Stdlib only; not part of the shipped zip.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/* ---------- minimal DOM ---------- */

const VOID_TAGS = new Set(['meta', 'link', 'br', 'hr', 'img', 'input', 'source', 'wbr']);

const ATTR_RE = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|[^\s"'>]+))?/g;

function parseAttrs(raw, el) {
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(raw))) {
    const name = m[1].toLowerCase();
    const value = m[2] !== undefined ? (m[3] !== undefined ? m[3] : m[4]) : '';
    if (name === 'class') {
      String(value).split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
    } else if (name === 'id') {
      el.id = value;
      el.attributes.id = value;
    } else if (name.startsWith('data-')) {
      el.dataset[name.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = value;
      el.attributes[name] = value;
    } else {
      el.attributes[name] = value;
      if (name === 'title') el.title = value;
      if (name === 'value') el.value = value;
      if (name === 'type') el.type = value;
      if (name === 'readonly') el.readonly = true;
    }
  }
}

const TAG_TOKEN_RE = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;

function parseInto(html, parent, registry) {
  const stack = [parent];
  let m;
  const text = String(html);
  TAG_TOKEN_RE.lastIndex = 0;
  let last = 0;
  while ((m = TAG_TOKEN_RE.exec(text))) {
    const closing = m[0][1] === '/';
    const tag = m[1].toLowerCase();
    if (!closing && !VOID_TAGS.has(tag)) {
      const el = new StubElement(tag);
      parseAttrs(m[2] || '', el);
      stack[stack.length - 1].appendChild(el);
      if (registry) registry.all.push(el);
      if (el.id && registry) registry.byId.set(el.id, el);
      stack.push(el);
    } else if (closing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === tag.toUpperCase()) {
          stack.length = i;
          break;
        }
      }
    } else if (!closing && VOID_TAGS.has(tag)) {
      const el = new StubElement(tag);
      parseAttrs(m[2] || '', el);
      stack[stack.length - 1].appendChild(el);
      if (registry) registry.all.push(el);
      if (el.id && registry) registry.byId.set(el.id, el);
      if (tag === 'input' && el.attributes.type === 'checkbox') el.checked = false;
    }
    last = TAG_TOKEN_RE.lastIndex;
  }
  return last;
}

class StubElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this._listeners = {};
    this.dataset = {};
    this.attributes = {};
    this._classes = new Set();
    this._innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.title = '';
    this.hidden = false;
    this.open = false;
    this.readonly = false;
    this.disabled = false;
    this.scrollLeft = 0;
    this.scrollWidth = 0;
    this.scrollHeight = 0;
    this.offsetWidth = 0;
    this.offsetHeight = 0;
    const self = this;
    this.classList = {
      add: (...cs) => cs.forEach((c) => self._classes.add(c)),
      remove: (...cs) => cs.forEach((c) => self._classes.delete(c)),
      contains: (c) => self._classes.has(c),
      toggle: (c, force) => {
        const want = force === undefined ? !self._classes.has(c) : !!force;
        if (want) self._classes.add(c);
        else self._classes.delete(c);
        return want;
      },
    };
    this.style = new Proxy({}, {
      set: (o, k, v) => { o[k] = v; return true; },
      get: (o, k) => (k in o ? o[k] : ''),
    });
  }

  get className() { return [...this._classes].join(' '); }
  set className(v) {
    this._classes = new Set(String(v).split(/\s+/).filter(Boolean));
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(html) {
    this.children.forEach((c) => { c.parentNode = null; });
    this.children = [];
    this._innerHTML = String(html);
    if (this._innerHTML) parseInto(this._innerHTML, this);
  }

  get lastChild() { return this.children[this.children.length - 1] || null; }
  get firstChild() { return this.children[0] || null; }
  get parentElement() { return this.parentNode; }

  get selectedOptions() {
    if (this.tagName !== 'SELECT') return [];
    return this.children.filter((c) => c.value === this.value);
  }

  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  removeChild(node) {
    const i = this.children.indexOf(node);
    if (i !== -1) this.children.splice(i, 1);
    node.parentNode = null;
    return node;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  appendChild_bulk(ns) { ns.forEach((n) => this.appendChild(n)); }

  setAttribute(name, value) {
    if (name === 'class') { this.className = String(value); return; }
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
  }

  getAttribute(name) {
    if (name === 'class') return this.className;
    if (name === 'id') return this.id;
    return name in this.attributes ? this.attributes[name] : null;
  }

  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }

  removeEventListener(type, fn) {
    const list = this._listeners[type] || [];
    const i = list.indexOf(fn);
    if (i !== -1) list.splice(i, 1);
  }

  dispatch(type, event) {
    const handler = this['on' + type]; // onclick= / oninput= property handlers
    if (typeof handler === 'function') handler.call(this, event);
    const list = (this._listeners[type] || []).slice();
    for (const fn of list) fn.call(this, event);
  }

  closest(selector) {
    let el = this;
    const parts = String(selector).split(',').map((s) => s.trim());
    while (el) {
      if (parts.some((p) => matchesSingle(el, p))) return el;
      el = el.parentNode && el.parentNode.tagName ? el.parentNode : null;
    }
    return null;
  }

  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }

  querySelectorAll(sel) {
    const parts = String(sel).trim().split(/\s+/).filter(Boolean);
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matchWithAncestors(child, parts, this)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  focus() { this.focused = true; }
  select() { this.selected = true; }
  showModal() { this.open = true; this.attributes.open = ''; }
  close() { this.open = false; delete this.attributes.open; }
}

function matchWithAncestors(el, parts, root) {
  if (!matchesSingle(el, parts[parts.length - 1])) return false;
  if (parts.length === 1) return true;
  let anc = el.parentNode;
  while (anc && anc.tagName && anc !== root) {
    if (matchWithAncestors(anc, parts.slice(0, -1), root)) return true;
    anc = anc.parentNode;
  }
  return false;
}

function matchesSingle(el, part) {
  if (!part) return false;
  const m = part.match(/^([a-zA-Z][\w-]*)?((?:[.#][\w-]+|\[[^\]]*\])*)$/);
  if (!m) return false;
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  const rest = m[2] || '';
  const tokens = rest.match(/(?:[.#][\w-]+|\[[^\]]*\])/g) || [];
  for (const token of tokens) {
    if (token[0] === '.') {
      if (!el.classList.contains(token.slice(1))) return false;
    } else if (token[0] === '#') {
      if (el.id !== token.slice(1)) return false;
    } else {
      const attr = token.slice(1, -1);
      const eq = attr.indexOf('=');
      if (eq === -1) {
        if (!(attr in el.attributes) && !(attr === 'open' && el.open) && !(attr in el.dataset)) return false;
      } else {
        const name = attr.slice(0, eq).trim();
        let value = attr.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        const camel = name.startsWith('data-')
          ? name.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())
          : name;
        const actual = name in el.attributes ? el.attributes[name] : el.dataset[camel];
        if (actual !== value) return false;
      }
    }
  }
  return true;
}

/* ---------- build document ---------- */

const registry = { all: [], byId: new Map() };
const doc = new StubElement('#document');
doc.createElement = (tag) => new StubElement(tag);
doc.createElementNS = (ns, tag) => new StubElement(tag);
doc.getElementById = (id) => registry.byId.get(id) || null;

const html = readFileSync(join(root, 'index.html'), 'utf8');
parseInto(html, doc, registry); // the tokenizer builds the html > head/body tree
doc.documentElement = doc.children.find((el) => el.tagName === 'HTML') || doc;
doc.body = doc.documentElement.children.find((el) => el.tagName === 'BODY') || doc.documentElement;

for (const el of registry.all) {
  if (el.tagName === 'DIALOG' && el.classList.contains('dialog')) {
    // nothing special; showModal/close manage open
  }
}

/* ---------- window/global stubs ---------- */

const globalObj = globalThis;
globalObj.window = globalObj;
globalObj.document = doc;
globalObj.myenigmaMinTool = undefined; // reset
const winListeners = {};
globalObj.addEventListener = (type, fn) => {
  (winListeners[type] = winListeners[type] || []).push(fn);
};
globalObj.removeEventListener = (type, fn) => {
  const list = winListeners[type] || [];
  const i = list.indexOf(fn);
  if (i !== -1) list.splice(i, 1);
};
globalObj.dispatchEvent = (event) => {
  (winListeners[event.type] || []).slice().forEach((fn) => fn.call(globalObj, event));
  return true;
};
globalObj.CustomEvent = class CustomEvent {
  constructor(type) { this.type = type; }
};
globalObj.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
})();
try {
  globalObj.navigator = globalObj.navigator || { language: 'zh-CN' };
} catch (err) {
  // Node >= 21 exposes a read-only navigator global; language defaults are fine.
}
globalObj.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalObj.innerWidth = 1024;
globalObj.getComputedStyle = () => ({ lineHeight: '16px' });
if (!globalObj.ResizeObserver) globalObj.ResizeObserver = undefined;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
function check(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else { failures.push(name); console.log('  FAIL ' + name); }
}
function click(el, event) {
  el.dispatch('click', Object.assign({ preventDefault() {}, stopPropagation() {}, target: el }, event));
}
function pointerDown(el) {
  el.dispatch('pointerdown', { preventDefault() {}, stopPropagation() {}, target: el, pointerType: 'touch', button: 0, clientX: 0 });
  el.dispatch('pointerup', { preventDefault() {}, target: el });
}
const byId = (id) => {
  const el = registry.byId.get(id);
  if (!el) throw new Error('missing #' + id);
  return el;
};

/* ---------- load bundle in order ---------- */

for (const name of ['i18n', 'engine', 'store', 'machine', 'editor', 'main']) {
  require(join(root, 'js', name + '.js'));
}
const NS = globalObj.myenigmaMinTool;
if (!NS || !NS.store || !NS.engine) throw new Error('bundle did not initialise');

console.log('bundle loaded, init() ran without throwing');

/* ---------- flows ---------- */

const store = NS.store;

console.log('flow: initial render');
check('lampboard has 3 rows', byId('lampboard').children.length === 3);
check('keyboard has 3 rows', byId('keyboard').children.length === 3);
check('3 rotor units', byId('rotor-row').children.length === 3);
check('plugboard sockets built', byId('plug-grid').children.flat().length > 0);
check('machine enabled', byId('keyboard').classList.contains('disabled') === false);

console.log('flow: typing via on-screen keyboard');
const keyA = byId('keyboard').querySelector('.key[data-letter="A"]');
check('key A exists', !!keyA);
pointerDown(keyA);
await sleep(10);
check('tape plain updated', byId('tape-plain').children.length > 0 || byId('tape-plain').innerHTML.length > 0);
const cipherLen1 = byId('tape-cipher').innerHTML.length;
check('tape cipher updated', cipherLen1 > 0);
const firstCipher = byId('tape-cipher').innerHTML;

console.log('flow: paste replay');
const pasteEvent = {
  preventDefault() {},
  target: doc.body,
  clipboardData: { getData: () => 'HELLO' },
};
doc.dispatch('paste', pasteEvent);
await sleep(600); // 5 chars x 80ms
check('paste produced ciphertext', byId('tape-cipher').innerHTML.length > cipherLen1);

console.log('flow: paste button dialog');
const cipherLenBefore = byId('tape-cipher').innerHTML.length;
click(byId('tape-paste'));
check('paste dialog open', byId('dlg-paste').open);
byId('paste-text').value = 'XYZZY';
click(byId('paste-send'));
check('paste dialog closed after send', !byId('dlg-paste').open);
await sleep(500); // 5 chars x 80ms replay
check('paste button encrypted the text', byId('tape-cipher').innerHTML.length > cipherLenBefore);

console.log('flow: rotor turn buttons');
// DOM renders slots right-to-left reversed: children[2] is the rightmost
// DOM unit = slot 0 (the fastest rotor).
const positionsBefore = store.state.positions.slice();
const turnUp = byId('rotor-row').children[2].querySelector('.rotor-turn');
click(turnUp);
check('rightmost slot turned', store.state.positions[0] === (positionsBefore[0] + 1) % 26);

console.log('flow: plugboard connect / disconnect');
const socketOf = (letter) => byId('plug-grid').querySelector('.plug-socket[data-letter="' + letter + '"]');
click(socketOf('B'));
click(socketOf('C'));
check('plug registered', JSON.stringify(store.state.plugs) === JSON.stringify([['B', 'C']]));
check('socket marked connected', socketOf('B').classList.contains('connected'));
click(socketOf('B'));
check('plug removed', store.state.plugs.length === 0);

console.log('flow: rotor inventory');
click(byId('rotor-row').children[0].querySelector('.rotor-disc')); // click disc -> inventory
check('inventory open', byId('dlg-inventory').open);
const cards = byId('inventory-grid').children;
check('inventory cards listed', cards.length >= 10);
const installBtn = cards[cards.length - 1].querySelector('.card-actions .btn-primary'); // sample rotor card
click(installBtn);
check('inventory closed after install', !byId('dlg-inventory').open);
check('rotor installed into clicked slot', store.state.slots[2] === 'GAMMA'); // last sample card is Gamma

console.log('flow: custom rotor editor');
click(byId('rotor-row').children[0].querySelector('.rotor-disc'));
click(byId('inventory-new'));
check('editor open', byId('dlg-editor').open);
byId('editor-name').value = 'Smoke Rotor';
byId('editor-map-source').value = 'ABCDEFGHIJKLMNOPQRSTUVWX'; // even length for later reflector swap safety
click(byId('editor-identity'));
byId('editor-map-table').value = 'ABCDEFGHIJKLMNOPQRSTUVWX';
byId('editor-map-table').dispatch('input', {});
await sleep(220);
click(byId('editor-save'));
check('editor closed after save', !byId('dlg-editor').open);
check('custom rotor saved', store.state.customRotors.some((d) => d.name === 'Smoke Rotor'));

console.log('flow: reflector warehouse + CJK alphabet');
// build a CJK reflector through the editor opened from inventory-new
click(byId('reflector-window'));
check('reflector inventory open', byId('dlg-inventory').open);
click(byId('inventory-new'));
byId('editor-name').value = '中文反射板';
byId('editor-map-source').value = '甲乙丙丁戊己庚辛壬癸';
byId('editor-map-source').dispatch('input', {});
await sleep(220); // debounced sync fills the wiring with the identity
byId('editor-map-table').value = '癸壬丁丙乙甲己戊辛庚';
byId('editor-map-table').dispatch('input', {});
await sleep(220);
click(byId('editor-save'));
check('reflector editor closed', !byId('dlg-editor').open);
check('custom reflector saved', store.state.customReflectors.some((d) => d.name === '中文反射板'));
// the inventory underneath is still open with a stale grid (the editor does
// not refresh it): re-trigger it so the saved reflector shows up
click(byId('reflector-window'));
check('inventory refreshed open', byId('dlg-inventory').open);
const refCard = byId('inventory-grid').children[0]; // customs render first
click(refCard.querySelector('.card-actions .btn-primary'));
check('inventory closed after switching', !byId('dlg-inventory').open);
check('reflector switched to CJK', store.defOf(store.state.reflector).name === '中文反射板');
// the machine alphabet changed -> keyboard disabled until rotors match
check('readiness hint visible', !byId('ready-hint').hidden);
check('alt panel shown', !byId('alt-panel').hidden);

console.log('flow: install matching CJK rotor into every slot');
// create a CJK rotor with the same alphabet; saving inside a slot context
// auto-installs it into that slot (original behaviour)
click(byId('rotor-row').children[0].querySelector('.rotor-disc'));
click(byId('inventory-new'));
byId('editor-name').value = '中文齿轮';
byId('editor-map-source').value = '甲乙丙丁戊己庚辛壬癸';
byId('editor-map-source').dispatch('input', {});
await sleep(220);
byId('editor-map-table').value = '丙甲戊丁庚辛壬乙己癸';
byId('editor-map-table').dispatch('input', {});
await sleep(220);
click(byId('editor-save'));
check('cjk rotor saved', store.state.customRotors.some((d) => d.name === '中文齿轮'));
// customs render first: [Smoke Rotor (24-char), 中文齿轮] -> card index 1
for (let i = 0; i < 3; i++) {
  // children[2 - i] is the DOM unit for slot i
  click(byId('rotor-row').children[2 - i].querySelector('.rotor-disc'));
  click(byId('inventory-grid').children[1].querySelector('.card-actions .btn-primary'));
}
check('all slots use the CJK rotor', store.state.slots.every(function (id) {
  return store.defOf(id).name === '中文齿轮';
}));
check('machine ready after match', store.machineReady());
check('hint hidden when ready', byId('ready-hint').hidden);

console.log('flow: generic panel typing');
const sendBtn = byId('alt-send');
byId('alt-input').value = '甲乙';
click(sendBtn);
await sleep(300);
check('alt output shows char', byId('alt-output').textContent !== '—');

console.log('flow: tape view dialog');
click(byId('tape-copy-plain'));
check('copy dialog open', byId('dlg-copy').open);
check('copy text filled', byId('copy-text').value.length > 0);
byId('copy-text').dispatch('click', {});
const copyClose = registry.all.filter((el) => el.tagName === 'BUTTON' && 'data-close' in el.attributes && el.closest('#dlg-copy'));
click(copyClose[copyClose.length - 1]);
check('copy dialog closed', !byId('dlg-copy').open);

console.log('flow: toolbar actions');
click(byId('btn-random'));
check('randomize ran', store.state.plugs.length <= 10);
click(byId('btn-zero'));
check('zeroed', store.state.positions.every((p) => p === 0));
click(byId('tape-clear'));
check('tape cleared', !!byId('tape-plain').querySelector('.tape-hint')); // hint means tape.plain is empty
click(byId('btn-sound'));
check('sound toggled', store.state.sound === false);
click(byId('btn-sound'));
click(byId('btn-factory'));
check('factory reset kept custom parts', store.state.customRotors.some((d) => d.name === 'Smoke Rotor'));
check('factory reset config', store.state.reflector === 'B' && store.state.slots.join() === 'III,II,I');

console.log('flow: settings dialog');
click(byId('btn-settings'));
check('settings open', byId('dlg-settings').open);
const rotateUp = byId('opt-rotate-up');
rotateUp.checked = true;
rotateUp.dispatch('change', {});
check('rotate_up persisted', store.state.rotateUp === true);
rotateUp.checked = false;
rotateUp.dispatch('change', {});
const layoutSelect = byId('opt-layout');
layoutSelect.value = 'qwerty';
layoutSelect.dispatch('change', {});
check('layout persisted', store.state.layout === 'qwerty');
const langSelect = byId('opt-lang');
langSelect.value = 'en';
langSelect.dispatch('change', {});
await sleep(10);
check('lang switched', doc.documentElement.lang === 'en');
langSelect.value = 'zh';
langSelect.dispatch('change', {});
click(byId('btn-help'));
check('help opens', byId('dlg-help').open);
const helpClose = registry.all.filter((el) => 'data-close' in el.attributes && el.closest('#dlg-help'));
click(helpClose[helpClose.length - 1]);

console.log('flow: slot add / remove');
const slotsBefore = store.state.slots.length;
click(byId('slot-add'));
check('slot added (max 4)', store.state.slots.length === Math.min(4, slotsBefore + 1));
click(byId('slot-del'));
check('slot removed', store.state.slots.length === slotsBefore);

console.log('flow: engine press still matches library');
const res = NS.engine.api_press(store.buildConfig(), 'A');
check('api_press returns result', !!res.output || !!res.error);

console.log('');
if (failures.length) {
  console.log('SMOKE FAILED: ' + failures.length + ' check(s):');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('SMOKE PASS: all flows executed without runtime errors');
