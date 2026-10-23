// machine.js - builds and operates the physical machine UI:
// reflector window, rotor slots, lampboard, keyboard (layout-selectable)
// and plugboard.

import { state, defOf, currentAlphabet, KEYBOARD_LAYOUTS } from './store.js';
import { t } from './i18n.js';

const CABLE_COLORS = [
  '#8a8f98', '#a34d3d', '#3d6ea3', '#3d8f5f', '#a3863d',
  '#7a5fa0', '#a05f7a', '#5fa09b', '#9b8b5f', '#666a70',
];
const MAX_PLUGS = 10;

const sfx = (() => {
  let ctx = null;
  function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function clack(held) {
    if (!state.sound) return;
    try {
      const c = ensure();
      const dur = 0.06;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const filt = c.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = held ? 2100 : 1400;
      filt.Q.value = 1.1;
      const g = c.createGain();
      g.gain.value = held ? 0.5 : 0.3;
      src.connect(filt).connect(g).connect(c.destination);
      src.start();
    } catch { /* audio unavailable */ }
  }
  function tick() {
    if (!state.sound) return;
    try {
      const c = ensure();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'square';
      o.frequency.value = 1900;
      g.gain.setValueAtTime(0.05, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.03);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.04);
    } catch { /* audio unavailable */ }
  }
  return { clack, tick };
})();

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

// Keyboard rows mirror the real keyboard of the selected layout
// (QWERTZ 9/8/9, QWERTY 10/9/7, AZERTY 10/9/6, Dvorak 7/10/9, A–Z 9/9/8).
// Custom alphabets split into three roughly even rows.
export function rowsFor(alphabet) {
  const letters = Array.from(alphabet);
  if (letters.length === 26) {
    const layout = KEYBOARD_LAYOUTS[state.layout] || KEYBOARD_LAYOUTS.qwertz;
    return layout.map((row) => Array.from(row));
  }
  const a = Math.ceil(letters.length / 3);
  const b = Math.ceil((letters.length - a) / 2);
  return [letters.slice(0, a), letters.slice(a, a + b), letters.slice(a + b)];
}

export class MachineUI {
  constructor(handlers) {
    this.handlers = handlers;
    this.alphabet = '';
    this.armedPlug = null;
    this.enabled = false;
    this.els = {};
    this.lampTimer = null;
    this.resizeObserver = null;
  }

  mount() {
    this.els.reflectorWindow = document.getElementById('reflector-window');
    this.els.rotorRow = document.getElementById('rotor-row');
    this.els.lampboard = document.getElementById('lampboard');
    this.els.keyboard = document.getElementById('keyboard');
    this.els.plugboard = document.getElementById('plugboard');
    this.els.plugGrid = document.getElementById('plug-grid');
    this.els.plugSvg = document.getElementById('plug-svg');
    this.els.plugCount = document.getElementById('plug-count');
    this.els.lampPanel = document.querySelector('.lamp-panel');
    this.els.keyPanel = document.querySelector('.key-panel');
    this.els.machineFront = document.querySelector('.machine-front');
    this.els.altPanel = document.getElementById('alt-panel');
    this.els.altOutput = document.getElementById('alt-output');
    this.els.altKeys = document.getElementById('alt-keys');
    this.els.altPlugs = document.getElementById('alt-plugs');
    this.els.altPairs = document.getElementById('alt-pairs');

    this.els.reflectorWindow.addEventListener('click', () => this.handlers.onReflectorClick());
    document.getElementById('slot-add').addEventListener('click', () => this.handlers.onAddSlot());
    document.getElementById('slot-del').addEventListener('click', () => this.handlers.onRemoveSlot());

    this.resizeObserver = new ResizeObserver(() => this.drawCables());
    this.resizeObserver.observe(this.els.plugboard);
  }

  setEnabled(v) {
    this.enabled = v;
    this.els.keyboard.classList.toggle('disabled', !v);
    this.els.altPanel.classList.toggle('disabled', !v);
  }

  setAlphabet(alpha) {
    const latin = alpha === 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    this.alphabet = alpha;
    this.latin = latin;
    this.armedPlug = null;
    this.els.lampPanel.hidden = !latin;
    this.els.keyPanel.hidden = !latin;
    this.els.machineFront.hidden = !latin;
    this.els.altPanel.hidden = latin;
    if (latin) {
      this.buildLampboard();
      this.buildKeyboard();
      this.buildPlugboard();
    } else {
      this.buildAltPanel();
    }
    this.setEnabled(this.enabled);
  }

  /* ---------- construction ---------- */

  buildLampboard() {
    this.els.lampboard.innerHTML = '';
    for (const row of rowsFor(this.alphabet)) {
      const rowEl = el('div', 'lamp-row');
      for (const ch of row) {
        rowEl.appendChild(el('div', 'lamp', `<span>${ch}</span>`)).dataset.letter = ch;
      }
      this.els.lampboard.appendChild(rowEl);
    }
  }

  buildKeyboard() {
    this.els.keyboard.innerHTML = '';
    for (const row of rowsFor(this.alphabet)) {
      const rowEl = el('div', 'key-row');
      for (const ch of row) {
        const key = el('button', 'key', `<span>${ch}</span>`);
        key.type = 'button';
        key.dataset.letter = ch;
        key.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (!this.enabled) return;
          key.classList.add('pressed');
          sfx.clack(true);
          this.handlers.onKey(ch);
        });
        const release = () => {
          key.classList.remove('pressed');
          this.lampOff(ch);
        };
        key.addEventListener('pointerup', release);
        key.addEventListener('pointercancel', release);
        key.addEventListener('pointerleave', release);
        rowEl.appendChild(key);
      }
      this.els.keyboard.appendChild(rowEl);
    }
  }

  buildPlugboard() {
    this.els.plugGrid.innerHTML = '';
    this.els.plugSvg.innerHTML = '';
    for (const row of rowsFor(this.alphabet)) {
      const rowEl = el('div', 'plug-row');
      for (const ch of row) {
        const socket = el('button', 'plug-socket', `<span class="socket-hole"></span><span class="socket-letter">${ch}</span>`);
        socket.type = 'button';
        socket.dataset.letter = ch;
        socket.title = t('machine.socket.title', `插线板 ${ch}`, { c: ch });
        socket.addEventListener('click', () => this.onPlugClick(ch));
        rowEl.appendChild(socket);
      }
      this.els.plugGrid.appendChild(rowEl);
    }
  }

  buildAltPanel() {
    this.els.altKeys.innerHTML = '';
    this.els.altPlugs.innerHTML = '';
    this.els.altOutput.textContent = '—';
    this.els.altOutput.classList.remove('lit');
    const altInput = document.getElementById('alt-input');
    if (altInput) altInput.value = '';
    for (const ch of Array.from(this.alphabet)) {
      const key = el('button', 'alt-key', ch);
      key.type = 'button';
      key.dataset.letter = ch;
      key.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!this.enabled) return;
        key.classList.add('pressed');
        sfx.clack(true);
        this.handlers.onKey(ch);
      });
      const release = () => {
        key.classList.remove('pressed');
        this.lampOff(ch);
      };
      key.addEventListener('pointerup', release);
      key.addEventListener('pointercancel', release);
      key.addEventListener('pointerleave', release);
      this.els.altKeys.appendChild(key);

      const plug = el('button', 'alt-plug', ch);
      plug.type = 'button';
      plug.dataset.letter = ch;
      plug.title = `接线 ${ch}`;
      plug.addEventListener('click', () => this.onPlugClick(ch));
      this.els.altPlugs.appendChild(plug);
    }
    this.renderPlugs();
  }

  /* ---------- rendering ---------- */

  renderState() {
    const ref = defOf(state.reflector);
    const short = ref.name.replace(/^Reflector\s+/, '');
    this.els.reflectorWindow.textContent = short;

    this.els.rotorRow.innerHTML = '';
    // state.slots is right-to-left: slots[0] is the rightmost (fastest) rotor.
    // The DOM shows rotors left to right, so render in reverse order.
    const order = state.slots.map((_, i) => state.slots.length - 1 - i);
    for (const stateIndex of order) {
      this.els.rotorRow.appendChild(this.buildRotorUnit(state.slots[stateIndex], stateIndex));
    }
    this.renderPositions();
    this.renderPlugs();
    window.dispatchEvent(new CustomEvent('machine:layout'));
  }

  buildRotorUnit(id, slotIndex) {
    const def = defOf(id);
    const unit = el('div', 'rotor-unit');
    unit.dataset.slot = String(slotIndex);

    const disc = el('div', 'rotor-disc');
    disc.title = t('machine.disc.title', '点击更换 / 取出齿轮，滚轮或箭头调节位置');
    disc.innerHTML = `
      <div class="rotor-ring"></div>
      <div class="rotor-notch" title="${t('machine.notch.title', '转换点（步进经过此字符时带动左侧齿轮）')}"></div>
      <div class="rotor-window">
        <div class="rotor-drum">
          <span class="drum-line"></span>
          <span class="drum-line"></span>
          <span class="drum-line d-cur"></span>
          <span class="drum-line"></span>
          <span class="drum-line"></span>
        </div>
      </div>
      <div class="rotor-name"></div>`;

    disc.addEventListener('click', () => this.handlers.onRotorClick(slotIndex));
    disc.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.enabled) return;
      this.handlers.onTurn(slotIndex, e.deltaY > 0 ? -1 : 1);
    }, { passive: false });

    const controls = el('div', 'rotor-controls');
    const up = el('button', 'rotor-turn', '▲');
    up.type = 'button';
    up.title = t('machine.step', '转动一格');
    up.addEventListener('click', () => this.handlers.onTurn(slotIndex, 1));
    const down = el('button', 'rotor-turn', '▼');
    down.type = 'button';
    down.title = t('machine.back', '反转一格');
    down.addEventListener('click', () => this.handlers.onTurn(slotIndex, -1));
    controls.append(up, down);

    unit.append(disc, controls);
    unit.querySelector('.rotor-name').textContent = def.name.replace(/^Rotor\s+/, '');
    this.setDrum(disc, def.mapSource, state.positions[slotIndex]);
    return unit;
  }

  /* ---------- rotor drum ---------- */

  setDrum(disc, alphabet, position) {
    const L = alphabet.length;
    const pos = ((position % L) + L) % L;
    const at = (offset) => alphabet[((pos + offset) % L + L) % L];
    const lines = disc.querySelectorAll('.drum-line');
    const values = [at(-2), at(-1), at(0), at(1), at(2)];
    lines.forEach((line, i) => {
      line.textContent = values[i];
    });
    disc.dataset.pos = String(pos);
  }

  // Height of one drum line in CSS pixels. Read the resolved line-height
  // because custom properties containing clamp() stay unresolved tokens.
  drumLineHeight(disc) {
    const line = disc && disc.querySelector('.drum-line');
    if (line) {
      const value = parseFloat(getComputedStyle(line).lineHeight);
      if (value > 0) return value;
    }
    return 16;
  }

  // Reset the drum to its resting offset without animation.
  restDrum(disc) {
    const drum = disc.querySelector('.rotor-drum');
    const line = this.drumLineHeight(disc);
    const prev = drum.style.transition;
    drum.style.transition = 'none';
    drum.style.transform = `translateY(${-line}px)`;
    void drum.offsetHeight;
    drum.style.transition = prev || '';
  }

  renderPositions() {
    const units = this.els.rotorRow.children;
    for (let domIndex = 0; domIndex < units.length; domIndex++) {
      const unit = units[domIndex];
      const stateIndex = Number(unit.dataset.slot);
      const def = defOf(state.slots[stateIndex]);
      const len = def.mapSource.length;
      const pos = ((state.positions[stateIndex] % len) + len) % len;
      const disc = unit.querySelector('.rotor-disc');
      this.setDrum(disc, def.mapSource, pos);
      this.restDrum(disc);
      disc.dataset.angle = String(pos * (360 / len));
      disc.querySelector('.rotor-ring').style.transform = `rotate(${disc.dataset.angle}deg)`;
      disc.classList.toggle('at-turnover', (def.turnover || []).includes(def.mapSource[pos]));
    }
  }

  // Animate one rotor step: the drum slides by one line while the knurled
  // ring turns by one notch. Arbitrary jumps (>1 position) snap instead.
  animateStep(disc, alphabet, fromPos, toPos) {
    const L = alphabet.length;
    const from = ((fromPos % L) + L) % L;
    const to = ((toPos % L) + L) % L;
    if (from === to) return;
    const delta = ((to - from) % L + L) % L;
    const dir = delta === 1 ? 1 : delta === L - 1 ? -1 : 0;
    const drum = disc.querySelector('.rotor-drum');
    const ring = disc.querySelector('.rotor-ring');

    clearTimeout(disc._drumTimer);
    // settle any in-flight animation on the previous letter first
    this.setDrum(disc, alphabet, from);
    this.restDrum(disc);

    const angle = Number(disc.dataset.angle || 0) + (dir || 1) * delta * (360 / L);
    disc.dataset.angle = String(angle);
    ring.style.transform = `rotate(${angle}deg)`;

    if (!dir) {
      this.setDrum(disc, alphabet, to);
      this.restDrum(disc);
      return;
    }

    const line = this.drumLineHeight(disc);
    drum.style.transition = 'transform 0.17s cubic-bezier(0.2, 0.7, 0.3, 1)';
    drum.style.transform = `translateY(${dir === 1 ? -2 * line : 0}px)`;
    disc.dataset.pos = String(to);

    disc._drumTimer = setTimeout(() => {
      drum.style.transition = 'none';
      this.setDrum(disc, alphabet, to);
      void drum.offsetHeight;
      drum.style.transform = `translateY(${-line}px)`;
      void drum.offsetHeight;
      drum.style.transition = '';
      disc._drumTimer = null;
    }, 190);
  }

  // Manual thumbwheel turn (no encryption involved).
  showTurn(slot, fromPos, toPos) {
    const unit = Array.from(this.els.rotorRow.children).find(
      (u) => Number(u.dataset.slot) === slot,
    );
    if (!unit) return;
    const def = defOf(state.slots[slot]);
    const disc = unit.querySelector('.rotor-disc');
    this.animateStep(disc, def.mapSource, fromPos, toPos);
    const len = def.mapSource.length;
    const pos = ((toPos % len) + len) % len;
    disc.classList.toggle('at-turnover', (def.turnover || []).includes(def.mapSource[pos]));
  }

  renderPlugs() {
    const connected = new Map();
    state.plugs.forEach((p) => {
      connected.set(p[0], p[1]);
      connected.set(p[1], p[0]);
    });
    const left = MAX_PLUGS - state.plugs.length;
    if (this.latin) {
      this.els.plugGrid.querySelectorAll('.plug-socket').forEach((socket) => {
        const ch = socket.dataset.letter;
        socket.classList.toggle('connected', connected.has(ch));
        socket.classList.toggle('armed', this.armedPlug === ch);
      });
      this.drawCables();
      this.els.plugCount.textContent = t('plug.count', '{n}/{max} · 剩余连线 {left}', {
        n: state.plugs.length, max: MAX_PLUGS, left,
      });
    } else {
      this.els.altPlugs.querySelectorAll('.alt-plug').forEach((plug) => {
        const ch = plug.dataset.letter;
        plug.classList.toggle('connected', connected.has(ch));
        plug.classList.toggle('armed', this.armedPlug === ch);
      });
      const pairs = state.plugs.map((p) => `${p[0]}–${p[1]}`).join('　');
      this.els.altPairs.textContent = pairs
        ? t('plugs.some', `已连线：{pairs}（剩余 {left} 根）`, { pairs, left })
        : t('plugs.none', `尚未接线（剩余 {left} 根）`, { left });
    }
  }

  drawCables() {
    if (!this.latin) return;
    const svg = this.els.plugSvg;
    svg.innerHTML = '';
    if (!state.plugs.length) return;
    const box = this.els.plugboard.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.setAttribute('width', box.width);
    svg.setAttribute('height', box.height);

    state.plugs.forEach((pair, index) => {
      const a = this.els.plugGrid.querySelector(`.plug-socket[data-letter="${pair[0]}"]`);
      const b = this.els.plugGrid.querySelector(`.plug-socket[data-letter="${pair[1]}"]`);
      if (!a || !b) return;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.left + ra.width / 2 - box.left;
      const y1 = ra.top + ra.height / 2 - box.top;
      const x2 = rb.left + rb.width / 2 - box.left;
      const y2 = rb.top + rb.height / 2 - box.top;
      const sag = 34 + Math.min(60, Math.abs(x2 - x1) / 3);
      const color = CABLE_COLORS[index % CABLE_COLORS.length];

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.classList.add('plug-cable');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${y1 + sag}, ${x2} ${y2 + sag}, ${x2} ${y2}`);
      path.setAttribute('stroke', color);
      group.appendChild(path);
      for (const [x, y] of [[x1, y1], [x2, y2]]) {
        const cap = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        cap.setAttribute('cx', x);
        cap.setAttribute('cy', y);
        cap.setAttribute('r', 6.5);
        cap.setAttribute('fill', color);
        group.appendChild(cap);
      }
      group.addEventListener('click', () => this.onPlugClick(pair[0]));
      svg.appendChild(group);
    });
  }

  /* ---------- interaction ---------- */

  onPlugClick(ch) {
    if (!this.enabled) return;
    const plugged = state.plugs.find((p) => p[0] === ch || p[1] === ch);
    if (plugged) {
      this.armedPlug = null;
      this.handlers.onUnplug(ch);
      return;
    }
    if (!this.armedPlug) {
      this.armedPlug = ch;
    } else if (this.armedPlug === ch) {
      this.armedPlug = null;
    } else {
      const from = this.armedPlug;
      this.armedPlug = null;
      this.handlers.onPlug(from, ch);
      return;
    }
    this.renderPlugs();
  }

  disarmPlug() {
    if (this.armedPlug) {
      this.armedPlug = null;
      this.renderPlugs();
    }
  }

  /* ---------- feedback ---------- */

  lampOn(letter) {
    if (!this.latin) {
      this.els.altOutput.textContent = letter;
      this.els.altOutput.classList.add('lit');
      return;
    }
    const lamp = this.els.lampboard.querySelector(`.lamp[data-letter="${letter}"]`);
    if (!lamp) return;
    lamp.classList.add('lit');
  }

  lampOff(letter) {
    if (!this.latin) {
      this.els.altOutput.classList.remove('lit');
      return;
    }
    const lamp = this.els.lampboard.querySelector(`.lamp[data-letter="${letter}"]`);
    if (lamp) lamp.classList.remove('lit');
  }

  lampOffAll() {
    if (!this.latin) {
      this.els.altOutput.classList.remove('lit');
      return;
    }
    this.els.lampboard.querySelectorAll('.lamp.lit').forEach((l) => l.classList.remove('lit'));
  }

  // Rotor stepping + lamp after an encrypted keypress.
  showPress(output, positions, moved) {
    state.positions = positions;
    this.els.rotorRow.querySelectorAll('.rotor-unit').forEach((unit) => {
      const stateIndex = Number(unit.dataset.slot);
      const def = defOf(state.slots[stateIndex]);
      const disc = unit.querySelector('.rotor-disc');
      if (moved && moved[stateIndex]) {
        const from = Number(disc.dataset.pos ?? state.positions[stateIndex]);
        this.animateStep(disc, def.mapSource, from, state.positions[stateIndex]);
        sfx.tick();
      }
      const len = def.mapSource.length;
      const pos = ((state.positions[stateIndex] % len) + len) % len;
      disc.classList.toggle('at-turnover', (def.turnover || []).includes(def.mapSource[pos]));
    });
    // Only the latest lamp stays lit; a replay presses faster than the
    // 350 ms timeout, so clear first or the lamps would never go out.
    this.lampOffAll();
    this.lampOn(output);
    clearTimeout(this.lampTimer);
    this.lampTimer = setTimeout(() => this.lampOffAll(), 350);
  }

  flashKey(letter) {
    if (!this.latin) {
      const key = Array.from(this.els.altKeys.querySelectorAll('.alt-key')).find(
        (k) => k.dataset.letter === letter,
      );
      if (!key) return;
      key.classList.add('pressed');
      setTimeout(() => key.classList.remove('pressed'), 160);
      return;
    }
    const key = this.els.keyboard.querySelector(`.key[data-letter="${letter}"]`);
    if (!key) return;
    key.classList.add('pressed');
    setTimeout(() => key.classList.remove('pressed'), 160);
  }

  flashLamp(letter) {
    this.lampOn(letter);
    clearTimeout(this.lampTimer);
    this.lampTimer = setTimeout(() => this.lampOffAll(), 350);
  }
}

export { sfx, MAX_PLUGS };
