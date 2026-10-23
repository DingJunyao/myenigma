// main.js - application glue: boot sequence, keypress flow, machine handlers.

import { bootBridge } from './bridge.js';
import {
  state, loadState, persistState, resetConfig, defOf, currentAlphabet, buildConfig,
  SAMPLE_REFLECTORS, machineReady, sameCharSet, normalizePartOrder,
  rotorsForCharSet, reflectorsForCharSet,
} from './store.js';
import { MachineUI, sfx } from './machine.js';
import { openInventory, openEditor, configureEditor, toast } from './editor.js';

let api = null;
let engineReady = false; // Pyodide + bridge loaded

const TYPE_INTERVAL = 80; // ms per character when replaying pasted text
let typing = false;
const typeQueue = [];

const ui = new MachineUI({
  onKey: handleKey,
  onTurn: turnRotor,
  onRotorClick: (slot) => openInventory('rotor', { slot }),
  onReflectorClick: () => openInventory('reflector'),
  onPlug: plugPair,
  onUnplug: unplugLetter,
  onAddSlot: addSlot,
  onRemoveSlot: removeSlot,
});

/* ---------- readiness ---------- */

// The machine only works once reflector and every rotor share one alphabet.
function syncReadiness() {
  const ok = engineReady && machineReady();
  ui.setEnabled(ok);
  const hint = document.getElementById('ready-hint');
  if (!engineReady) {
    hint.hidden = true;
    return;
  }
  hint.hidden = ok;
  if (!ok) {
    const refAlpha = currentAlphabet();
    const mismatched = state.slots
      .map((id) => defOf(id))
      .filter((d) => d.mapSource !== refAlpha)
      .map((d) => d.name);
    hint.textContent = `⚠ 字母表未统一：反射板为「${refAlpha}」，齿轮 [${mismatched.join('、')}] 与之不符。`
      + '请在齿轮仓库中安装同字母表的齿轮，安装齐全后键盘/灯盘/插线板会自动启用。';
  }
}

/* ---------- core flows ---------- */

function handleKey(letter) {
  if (typing) return; // let the paste replay finish in order
  pressKey(letter);
}

function pressKey(letter) {
  if (!engineReady || !machineReady()) return;
  let res;
  try {
    res = api.api_press(JSON.stringify(buildConfig()), letter);
  } catch (err) {
    toast('引擎错误：' + err.message, true);
    return;
  }
  if (res.error) {
    toast(res.error, true);
    return;
  }
  ui.showPress(res.output, res.positions, res.moved);
  tapeAppend(letter, res.output);
  persistState();
}

/* ---------- pasted text replay ---------- */

function feedText(text) {
  if (!engineReady || !machineReady()) {
    toast('字母表未统一，暂不能输入', true);
    return;
  }
  const alphabet = currentAlphabet();
  const chars = Array.from(String(text).toUpperCase()).filter((c) => alphabet.includes(c));
  if (!chars.length) {
    toast('粘贴的文本不包含当前字母表中的字符', true);
    return;
  }
  for (const ch of chars) typeQueue.push(ch); // no length limit
  if (!typing) pumpTyping();
}

function pumpTyping() {
  if (!typeQueue.length) {
    typing = false;
    return;
  }
  typing = true;
  const ch = typeQueue.shift();
  ui.flashKey(ch);
  sfx.clack(true);
  pressKey(ch);
  setTimeout(pumpTyping, TYPE_INTERVAL);
}

function cancelTyping() {
  typeQueue.length = 0;
  typing = false;
}

function turnRotor(slot, delta) {
  const len = defOf(state.slots[slot]).mapSource.length;
  const from = state.positions[slot];
  state.positions[slot] = ((from + delta) % len + len) % len;
  ui.showTurn(slot, from, state.positions[slot]);
  sfx.tick();
  persistState();
}

function plugPair(a, b) {
  if (state.plugs.length >= 10) {
    toast('插线板最多同时使用 10 根连线', true);
    ui.renderPlugs();
    return;
  }
  state.plugs.push([a, b]);
  sfx.tick();
  ui.renderPlugs();
  persistState();
}

function unplugLetter(letter) {
  state.plugs = state.plugs.filter((p) => p[0] !== letter && p[1] !== letter);
  ui.renderPlugs();
  persistState();
}

/* ---------- rotor / reflector management ---------- */

function compatibleRotors() {
  const alpha = currentAlphabet();
  return rotorsForCharSet(alpha).map((d) => normalizePartOrder(d, alpha));
}

// Parts can be swapped freely; the machine only runs once reflector and
// every rotor share one alphabet (see syncReadiness).
function installRotor(def, context) {
  const slot = context && context.slot !== undefined ? context.slot : 0;
  state.slots[slot] = def.id;
  state.positions[slot] = 0;
  persistState();
  ui.renderState();
  syncReadiness();
  document.getElementById('dlg-inventory').close();
  toast(machineReady()
    ? `已将 "${def.name}" 装入第 ${slot + 1} 槽`
    : `已装入 "${def.name}"；字母表统一后启用键盘`);
  return true;
}

function installReflector(def) {
  const previous = currentAlphabet();
  state.reflector = def.id;
  if (def.mapSource !== previous) {
    cancelTyping();
    const letters = Array.from(def.mapSource);
    state.plugs = state.plugs.filter((p) => letters.includes(p[0]) && letters.includes(p[1]));
    state.positions = state.slots.map(() => 0);
    ui.setAlphabet(def.mapSource);
  }
  persistState();
  ui.renderState();
  syncReadiness();
  document.getElementById('dlg-inventory').close();
  toast(machineReady()
    ? `已换用 ${def.name}`
    : `已换用 ${def.name}；安装同字母表齿轮后启用键盘`);
  return true;
}

function saveRotor(def, context) {
  // Keep warehouse parts aligned with the machine's alphabet order when the
  // character set matches (order-only differences are the same alphabet).
  if (sameCharSet(def.mapSource, currentAlphabet())) {
    def = normalizePartOrder(def, currentAlphabet());
  }
  putCustomPart(state.customRotors, def);
  persistState();
  const installedAt = state.slots.indexOf(def.id);
  if (installedAt >= 0) {
    state.positions[installedAt] = 0;
    ui.renderState();
    syncReadiness();
  }
  if (context && context.slot !== undefined) {
    return installRotor(def, context);
  }
  toast(`已保存齿轮 "${def.name}"`);
  return true;
}

function saveReflector(def) {
  if (sameCharSet(def.mapSource, currentAlphabet())) {
    def = normalizePartOrder(def, currentAlphabet());
  }
  putCustomPart(state.customReflectors, def);
  persistState();
  toast(`已保存反射板 "${def.name}"，可在反射板仓库中选用`);
  return true;
}

function addSlot() {
  if (state.slots.length >= 4) {
    toast('最多支持 4 个齿轮（M4 军用型）', true);
    return;
  }
  const candidates = compatibleRotors();
  const unused = candidates.find((d) => !state.slots.includes(d.id));
  const pick = unused || candidates[0];
  if (!pick) {
    toast('仓库中没有与当前字母表兼容的齿轮，请新建一个', true);
    return;
  }
  state.slots.push(pick.id); // new slot becomes the leftmost
  state.positions.push(0);
  persistState();
  ui.renderState();
  toast(`已加装 "${pick.name}"（最左侧）`);
}

function removeSlot() {
  if (state.slots.length <= 1) {
    toast('至少要保留一个齿轮', true);
    return;
  }
  const removed = defOf(state.slots.pop()).name;
  state.positions.pop();
  persistState();
  ui.renderState();
  syncReadiness();
  toast(`已拆下 ${removed}`);
}

/* ---------- toolbar actions ---------- */

function zeroPositions() {
  state.positions = state.slots.map(() => 0);
  ui.lampOffAll();
  ui.renderPositions();
  persistState();
  toast('齿轮已全部归零');
}

function randomize() {
  if (!machineReady()) {
    toast('字母表未统一，暂不能随机配置', true);
    return;
  }
  const rotors = compatibleRotors();
  const alpha = currentAlphabet();
  const reflectors = reflectorsForCharSet(alpha).map((d) => normalizePartOrder(d, alpha));
  const ref = reflectors[Math.floor(Math.random() * reflectors.length)];
  state.reflector = ref.id;
  state.slots = state.slots.map(() => rotors[Math.floor(Math.random() * rotors.length)].id);
  state.positions = state.slots.map((id) => Math.floor(Math.random() * defOf(id).mapSource.length));
  const letters = Array.from(currentAlphabet());
  const pool = letters.slice();
  state.plugs = [];
  const pairCount = Math.floor(Math.random() * 11);
  for (let i = 0; i < pairCount && pool.length >= 2; i++) {
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const b = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    state.plugs.push([a, b]);
  }
  ui.setAlphabet(currentAlphabet());
  ui.renderState();
  persistState();
  toast('已生成随机配置');
}

function factoryReset() {
  cancelTyping();
  resetConfig();
  ui.setAlphabet(currentAlphabet());
  ui.renderState();
  tapeClear();
  toast('已恢复默认配置（自定义齿轮保留）');
}

/* ---------- paper tape (plaintext line above, ciphertext line below) ---------- */

const tape = { plain: '', cipher: '' };
const TAPE_DISPLAY_LIMIT = 800; // full text is kept for copying; only the tail is rendered

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTape() {
  const plainEl = document.getElementById('tape-plain');
  const cipherEl = document.getElementById('tape-cipher');
  if (!tape.plain) {
    plainEl.innerHTML = '<span class="tape-hint">敲击键盘，或直接在页面上粘贴文本开始加密</span>';
    cipherEl.innerHTML = '';
  } else {
    const truncated = tape.plain.length > TAPE_DISPLAY_LIMIT;
    const plain = truncated ? tape.plain.slice(-TAPE_DISPLAY_LIMIT) : tape.plain;
    const cipher = truncated ? tape.cipher.slice(-TAPE_DISPLAY_LIMIT) : tape.cipher;
    const chunk = (text) => (text.match(/.{1,5}/gsu) || []).map(escapeHtml).join('&nbsp;');
    const ellipsis = truncated ? '<span class="tape-ellipsis">…</span>' : '';
    plainEl.innerHTML = ellipsis + chunk(plain);
    cipherEl.innerHTML = ellipsis + chunk(cipher);
  }
  const scroller = document.getElementById('tape-scroll');
  scroller.scrollLeft = scroller.scrollWidth;
}

async function copyTape(kind) {
  const text = kind === 'plain' ? tape.plain : tape.cipher;
  const label = kind === 'plain' ? '明文' : '密文';
  if (!text) {
    toast('纸带还是空的', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(`已复制${label}（${text.length} 个字符）`);
  } catch (err) {
    // Older iOS Safari / non-secure contexts (e.g. LAN http): temporary textarea.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    if (area.setSelectionRange) area.setSelectionRange(0, area.value.length);
    try {
      document.execCommand('copy');
      toast(`已复制${label}`);
    } catch (fallbackError) {
      toast('复制失败，请手动选择文本', true);
    }
    area.remove();
  }
}

// Horizontal drag scrolling for the paper tape (mouse and touch friendly).
function enableDragScroll(el) {
  let dragging = false;
  let startX = 0;
  let startLeft = 0;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startLeft = el.scrollLeft;
    el.classList.add('dragging');
    if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    el.scrollLeft = startLeft - (e.clientX - startX);
  });
  const end = () => {
    dragging = false;
    el.classList.remove('dragging');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
}

function tapeAppend(input, output) {
  tape.plain += input;
  tape.cipher += output; // keep everything: copy must include the whole message
  renderTape();
}

function tapeClear() {
  tape.plain = '';
  tape.cipher = '';
  renderTape();
}

/* ---------- physical keyboard & pasted text ---------- */

window.addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!engineReady || typing) return;
  const t = e.target;
  if (t.closest && (t.closest('input, textarea, select') || t.closest('dialog'))) return;
  const letter = e.key.toUpperCase();
  if (!Array.from(currentAlphabet()).includes(letter)) return;
  e.preventDefault();
  ui.flashKey(letter);
  sfx.clack(true);
  pressKey(letter);
});
window.addEventListener('keyup', () => ui.lampOffAll());
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  if (typing) {
    cancelTyping();
    toast('已停止输入');
    return;
  }
  ui.disarmPlug();
});

// Pasting text anywhere on the page feeds it into the machine, one letter
// at a time. Inputs and dialogs keep the browser's normal paste behaviour.
document.addEventListener('paste', (e) => {
  const t = e.target;
  if (t.closest && (t.closest('input, textarea') || t.closest('dialog'))) return;
  if (!engineReady) return;
  const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  if (!text.trim()) return;
  e.preventDefault();
  feedText(text);
});

// Custom-alphabet mode: explicit send (button or Enter), which also plays
// nicely with IME composition.
function submitAltInput() {
  const input = document.getElementById('alt-input');
  const text = input.value;
  if (!text.trim()) return;
  input.value = '';
  feedText(text);
}
document.getElementById('alt-send').addEventListener('click', submitAltInput);
document.getElementById('alt-input').addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return; // IME composition in progress
  if (e.key === 'Enter') {
    e.preventDefault();
    submitAltInput();
  }
});

/* ---------- boot & shell ---------- */

function setBootStatus(message, isError = false) {
  const status = document.getElementById('boot-status');
  status.textContent = message;
  status.classList.toggle('boot-error', isError);
}

function bindToolbar() {
  document.getElementById('btn-zero').addEventListener('click', zeroPositions);
  document.getElementById('btn-random').addEventListener('click', randomize);
  document.getElementById('btn-factory').addEventListener('click', factoryReset);
  document.getElementById('tape-clear').addEventListener('click', tapeClear);
  document.getElementById('tape-copy-plain').addEventListener('click', () => copyTape('plain'));
  document.getElementById('tape-copy-cipher').addEventListener('click', () => copyTape('cipher'));
  enableDragScroll(document.getElementById('tape-scroll'));
  const soundBtn = document.getElementById('btn-sound');
  const paintSound = () => {
    soundBtn.textContent = state.sound ? '🔊 声音开' : '🔇 声音关';
  };
  paintSound();
  soundBtn.addEventListener('click', () => {
    state.sound = !state.sound;
    persistState();
    paintSound();
  });
  // Mechanism switches (mirror the Enigma constructor flags).
  const rotateUp = document.getElementById('opt-rotate-up');
  const rotateAfter = document.getElementById('opt-rotate-after');
  rotateUp.checked = state.rotateUp;
  rotateAfter.checked = state.rotateAfterType;
  rotateUp.addEventListener('change', () => {
    state.rotateUp = rotateUp.checked;
    persistState();
    toast(state.rotateUp ? '已启用反向轮转 rotate_up' : '已恢复默认旋转方向');
  });
  rotateAfter.addEventListener('change', () => {
    state.rotateAfterType = rotateAfter.checked;
    persistState();
    toast(state.rotateAfterType ? '已改为加密后再步进' : '已恢复先步进后加密');
  });
  const layoutSelect = document.getElementById('opt-layout');
  layoutSelect.value = state.layout;
  layoutSelect.addEventListener('change', () => {
    state.layout = layoutSelect.value;
    persistState();
    ui.setAlphabet(currentAlphabet());
    ui.renderState();
    syncReadiness();
    toast('键盘布局：' + layoutSelect.selectedOptions[0].textContent);
  });
  document.getElementById('btn-help').addEventListener('click', () => {
    document.getElementById('dlg-help').showModal();
  });
  document.getElementById('btn-settings').addEventListener('click', () => {
    document.getElementById('dlg-settings').showModal();
  });

  // Mobile: collapse the toolbar into a single ☰ menu button.
  const menuBtn = document.getElementById('btn-menu');
  const toolbar = document.getElementById('toolbar');
  const setMenu = (open) => {
    toolbar.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  };
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMenu(!toolbar.classList.contains('open'));
  });
  document.addEventListener('click', (e) => {
    if (!toolbar.classList.contains('open')) return;
    if (e.target.closest('#toolbar') || e.target.closest('#btn-menu')) return;
    setMenu(false);
  });
  toolbar.addEventListener('click', (e) => {
    if (e.target.closest('.btn')) setMenu(false); // close after choosing an action
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenu(false);
  });
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });
}

function fitScale() {
  const stage = document.querySelector('.machine-scale');
  const machine = document.querySelector('.machine');
  if (!stage || !machine) return;
  stage.style.transform = 'none';
  // scrollWidth covers content that is wider than the box (e.g. a very
  // narrow phone), so the machine is scaled to fit instead of overflowing.
  const natural = Math.max(machine.offsetWidth, machine.scrollWidth);
  const available = Math.min(window.innerWidth - 20, 960);
  const scale = Math.min(1, available / natural);
  stage.style.transform = `scale(${scale})`;
  stage.style.transformOrigin = 'top center';
  stage.parentElement.style.height = `${machine.offsetHeight * scale}px`;
}

window.addEventListener('resize', fitScale);
window.addEventListener('machine:layout', () => requestAnimationFrame(fitScale));

window.addEventListener('error', (e) => showError(e.message));
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  showError((reason && reason.message) || String(reason));
});

function showError(message) {
  const chip = document.getElementById('err-chip');
  chip.hidden = false;
  chip.textContent = `⚠ ${message}`;
}

async function boot() {
  loadState();
  ui.mount();
  ui.setAlphabet(currentAlphabet());
  ui.renderState();
  ui.setEnabled(false);
  bindToolbar();
  configureEditor({
    onInstallRotor: installRotor,
    onInstallReflector: installReflector,
    onSaveRotor: saveRotor,
    onSaveReflector: saveReflector,
    onPersist: persistState,
    api: {
      validateRotor: (s) => api.api_validate_rotor(s),
      validateReflector: (s) => api.api_validate_reflector(s),
    },
  });
  fitScale();
  try {
    api = await bootBridge(setBootStatus);
    const info = api.api_info();
    document.getElementById('footer-info').textContent =
      `加密引擎 myenigma v${info.myenigma} · CPython ${info.python} / Pyodide (WASM)，纯前端无后端`;
    engineReady = true;
    syncReadiness();
    setTimeout(() => document.getElementById('boot-overlay').classList.add('done'), 350);
  } catch (err) {
    console.error(err);
    setBootStatus(`加载失败：${err.message}`, true);
    const retry = document.getElementById('boot-retry');
    retry.hidden = false;
    retry.addEventListener('click', () => window.location.reload());
  }
}

boot();
