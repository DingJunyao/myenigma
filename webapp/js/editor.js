// editor.js - inventory picker, rotor/reflector editor, help dialog and toasts.

import { state, SAMPLE_ROTORS, SAMPLE_REFLECTORS, defOf, newCustomId, currentAlphabet, AZ } from './store.js';

const callbacks = {
  onInstallRotor: null,
  onInstallReflector: null,
  onSaveRotor: null,
  onSaveReflector: null,
  onDeleteRotor: null,
  api: { validateRotor: () => ({ ok: true }), validateReflector: () => ({ ok: true }) },
};

export function configureEditor(options) {
  Object.assign(callbacks, options);
}

/* ---------- toast ---------- */

export function toast(message, isError = false) {
  const area = document.getElementById('toast-area');
  const node = document.createElement('div');
  node.className = 'toast' + (isError ? ' toast-error' : '');
  node.textContent = message;
  area.appendChild(node);
  setTimeout(() => node.classList.add('show'), 10);
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 300);
  }, isError ? 4200 : 2600);
}

/* ---------- helpers ---------- */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomRotorWiring(alphabet) {
  const letters = Array.from(alphabet);
  let arr;
  let guard = 0;
  do {
    arr = shuffle(letters.slice());
    guard++;
  } while (arr.some((c, i) => c === letters[i]) && guard < 50);
  return arr.join('');
}

function randomReflectorWiring(alphabet) {
  const letters = Array.from(alphabet);
  if (letters.length % 2) return null;
  const arr = shuffle(letters.slice());
  const map = {};
  for (let i = 0; i < arr.length; i += 2) {
    map[arr[i]] = arr[i + 1];
    map[arr[i + 1]] = arr[i];
  }
  return letters.map((c) => map[c]).join('');
}

function wiringError(mapTable, mapSource) {
  const src = Array.from(mapSource);
  const tbl = Array.from(mapTable);
  if (!mapSource || new Set(src).size !== src.length) return '字母表必须由互不相同的字符组成';
  if (tbl.length !== src.length) return `接线长度必须为 ${src.length}`;
  if (new Set(tbl).size !== tbl.length) return '接线字符不能重复';
  for (const c of tbl) {
    if (!src.includes(c)) return `接线中出现了字母表之外的字符 "${c}"`;
  }
  return null;
}

/* ---------- inventory ---------- */

function plateCard(def, type, context) {
  const card = document.createElement('div');
  card.className = 'plate-card';
  const turnoverHtml = type === 'rotor'
    ? `<div class="card-row small">转换点：${def.turnover && def.turnover.length ? def.turnover.join(' / ') : '默认（最后一个字符）'}</div>`
    : '';
  const alphaBadge = def.mapSource !== AZ
    ? `<span class="alpha-badge">字母表 ${def.mapSource}</span>`
    : '';
  card.innerHTML = `
    <div class="card-head"><b>${def.name}</b>${alphaBadge}</div>
    <div class="card-wiring">${def.mapTable}</div>
    ${turnoverHtml}
    <div class="card-actions"></div>`;
  const actions = card.querySelector('.card-actions');
  if (type === 'rotor') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = context && context.slot !== undefined ? `装入第 ${context.slot + 1} 槽` : '装入';
    btn.addEventListener('click', () => callbacks.onInstallRotor(def, context));
    actions.appendChild(btn);
  } else {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '使用此反射板';
    btn.addEventListener('click', () => callbacks.onInstallReflector(def));
    actions.appendChild(btn);
  }
  if (def.id && String(def.id).startsWith('c')) {
    const edit = document.createElement('button');
    edit.className = 'btn';
    edit.textContent = '编辑';
    edit.addEventListener('click', () => openEditor(type, def, context));
    const del = document.createElement('button');
    del.className = 'btn btn-danger';
    del.textContent = '删除';
    del.addEventListener('click', () => {
      if (type === 'rotor' && state.slots.includes(def.id)) {
        toast('该齿轮正在机器上使用，请先更换下来', true);
        return;
      }
      if (type === 'reflector' && state.reflector === def.id) {
        toast('该反射板正在使用中，无法删除', true);
        return;
      }
      if (type === 'rotor') {
        state.customRotors = state.customRotors.filter((d) => d.id !== def.id);
      } else {
        state.customReflectors = state.customReflectors.filter((d) => d.id !== def.id);
      }
      callbacks.onPersist();
      toast(`已删除 ${def.name}`);
      openInventory(type, context); // refresh list
    });
    actions.append(edit, del);
  }
  return card;
}

export function openInventory(type, context = {}) {
  const dlg = document.getElementById('dlg-inventory');
  const title = document.getElementById('inventory-title');
  const grid = document.getElementById('inventory-grid');
  const newBtn = document.getElementById('inventory-new');
  const isRotor = type === 'rotor';

  title.textContent = isRotor
    ? (context.slot !== undefined ? `更换第 ${context.slot + 1} 槽齿轮` : '齿轮仓库')
    : '反射板仓库';
  grid.innerHTML = '';
  const samples = isRotor ? SAMPLE_ROTORS : SAMPLE_REFLECTORS;
  const customs = isRotor ? state.customRotors : state.customReflectors;
  for (const def of customs) grid.appendChild(plateCard(def, type, context));
  for (const def of samples) grid.appendChild(plateCard(def, type, context));

  newBtn.textContent = isRotor ? '＋ 新建齿轮' : '＋ 新建反射板';
  newBtn.onclick = () => openEditor(type, null, context);
  dlg.showModal();
}

/* ---------- editor ---------- */

function chipRow(container, alphabet, selected) {
  container.innerHTML = '';
  for (const ch of Array.from(alphabet)) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (selected.has(ch) ? ' chip-on' : '');
    chip.textContent = ch;
    chip.addEventListener('click', () => {
      if (selected.has(ch)) selected.delete(ch);
      else selected.add(ch);
      chip.classList.toggle('chip-on');
    });
    container.appendChild(chip);
  }
}

export function openEditor(type, def = null, context = {}) {
  const dlg = document.getElementById('dlg-editor');
  const isRotor = type === 'rotor';
  document.getElementById('editor-title').textContent = isRotor
    ? (def ? '编辑齿轮' : '新建齿轮')
    : (def ? '编辑反射板' : '新建反射板');
  const defaultAlphabet = isRotor && context.slot !== undefined
    ? defOf(state.slots[context.slot]).mapSource
    : currentAlphabet();

  const nameInput = document.getElementById('editor-name');
  const sourceInput = document.getElementById('editor-map-source');
  const tableInput = document.getElementById('editor-map-table');
  const turnoverWrap = document.getElementById('editor-turnover-wrap');
  const turnoverRow = document.getElementById('editor-turnover-chips');
  const message = document.getElementById('editor-message');

  const selectedTurnover = new Set(def && def.turnover ? def.turnover : []);
  nameInput.value = def ? def.name
    : isRotor ? `Custom Rotor ${state.customRotors.length + 1}` : `Custom Reflector ${state.customReflectors.length + 1}`;
  sourceInput.value = def ? def.mapSource : defaultAlphabet;
  tableInput.value = def ? def.mapTable : Array.from(sourceInput.value).join('');
  message.textContent = '';

  let lastChipAlphabet = null;
  let lastSyncedSource = sourceInput.value.trim();
  const refreshChips = (force = false) => {
    const src = sourceInput.value.trim();
    if (!force && src === lastChipAlphabet) return;
    lastChipAlphabet = src;
    chipRow(turnoverRow, src, selectedTurnover);
  };
  turnoverWrap.hidden = !isRotor;
  if (isRotor) refreshChips(true);
  else turnoverRow.innerHTML = ''; // reflectors have no turnover

  const refreshWiringHint = () => {
    const err = wiringError(tableInput.value, sourceInput.value.trim());
    message.textContent = err || '✓ 接线有效';
    message.classList.toggle('ok', !err);
  };
  refreshWiringHint();

  // Rebuilding all turnover chips and re-validating on every keystroke made
  // typing feel laggy; debounce, and only rebuild chips on real changes.
  let sourceTimer = null;
  const syncFromSource = () => {
    const src = sourceInput.value.trim();
    tableInput.value = Array.from(src).join('');
    lastSyncedSource = src;
    if (isRotor) {
      for (const ch of Array.from(selectedTurnover)) {
        if (!Array.from(src).includes(ch)) selectedTurnover.delete(ch);
      }
      refreshChips();
    }
    refreshWiringHint();
  };
  sourceInput.oninput = () => {
    clearTimeout(sourceTimer);
    sourceTimer = setTimeout(syncFromSource, 180);
  };
  let tableTimer = null;
  tableInput.oninput = () => {
    clearTimeout(tableTimer);
    tableTimer = setTimeout(refreshWiringHint, 180);
  };

  document.getElementById('editor-identity').onclick = () => {
    tableInput.value = Array.from(sourceInput.value.trim()).join('');
    refreshWiringHint();
  };
  document.getElementById('editor-random').onclick = () => {
    const src = sourceInput.value.trim();
    const wiring = isRotor ? randomRotorWiring(src) : randomReflectorWiring(src);
    if (wiring === null) {
      toast('随机反射板需要偶数个字符的字母表', true);
      return;
    }
    tableInput.value = wiring;
    refreshWiringHint();
  };

  document.getElementById('editor-save').onclick = async () => {
    // A pending debounce might still hold an older wiring for the typed
    // alphabet; normalise before validating.
    if (sourceInput.value.trim() !== lastSyncedSource) syncFromSource();
    const name = nameInput.value.trim() || 'Unnamed';
    const mapSource = sourceInput.value.trim();
    const mapTable = tableInput.value.replace(/\s+/g, '');
    const err = wiringError(mapTable, mapSource);
    if (err) {
      message.textContent = err;
      message.classList.remove('ok');
      return;
    }
    const candidate = {
      id: def ? def.id : newCustomId(),
      name,
      mapTable,
      turnover: isRotor ? Array.from(selectedTurnover) : undefined,
      mapSource,
      custom: true,
    };
    // The Python validators speak the same snake_case schema as buildConfig().
    const payload = {
      name,
      map_table: mapTable,
      map_source: mapSource,
      turnover: isRotor ? Array.from(selectedTurnover) : [],
    };
    const validator = isRotor ? callbacks.api.validateRotor : callbacks.api.validateReflector;
    const result = validator(JSON.stringify(payload));
    if (result.error) {
      message.textContent = result.error;
      message.classList.remove('ok');
      return;
    }
    const saved = isRotor ? callbacks.onSaveRotor(candidate, context) : callbacks.onSaveReflector(candidate);
    if (saved === true) dlg.close();
  };

  dlg.showModal();
}

export function closeEditor() {
  document.getElementById('dlg-editor').close();
}
