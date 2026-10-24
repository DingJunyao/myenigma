// machine.js - builds and operates the physical machine UI:
// reflector window, rotor slots, lampboard, keyboard (layout-selectable)
// and plugboard.

(function (global) {
  'use strict';

  var NS = (global.myenigmaMinTool = global.myenigmaMinTool || {});
  var store = NS.store;
  var state = store.state;
  var defOf = store.defOf;
  var KEYBOARD_LAYOUTS = store.KEYBOARD_LAYOUTS;
  var t = NS.i18n.t;

  var CABLE_COLORS = [
    '#8a8f98', '#a34d3d', '#3d6ea3', '#3d8f5f', '#a3863d',
    '#7a5fa0', '#a05f7a', '#5fa09b', '#9b8b5f', '#666a70',
  ];
  var MAX_PLUGS = 10;

  var sfx = (function () {
    var ctx = null;
    function ensure() {
      if (!ctx) ctx = new (global.AudioContext || global.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function clack(held) {
      if (!state.sound) return;
      try {
        var c = ensure();
        var dur = 0.06;
        var buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
        }
        var src = c.createBufferSource();
        src.buffer = buf;
        var filt = c.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = held ? 2100 : 1400;
        filt.Q.value = 1.1;
        var g = c.createGain();
        g.gain.value = held ? 0.5 : 0.3;
        src.connect(filt).connect(g).connect(c.destination);
        src.start();
      } catch (err) { /* audio unavailable */ }
    }
    function tick() {
      if (!state.sound) return;
      try {
        var c = ensure();
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = 'square';
        o.frequency.value = 1900;
        g.gain.setValueAtTime(0.05, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.03);
        o.connect(g).connect(c.destination);
        o.start();
        o.stop(c.currentTime + 0.04);
      } catch (err) { /* audio unavailable */ }
    }
    return { clack: clack, tick: tick };
  })();

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  // Keyboard rows mirror the real keyboard of the selected layout
  // (QWERTZ 9/8/9, QWERTY 10/9/7, AZERTY 10/9/6, Dvorak 7/10/9, A–Z 9/9/8).
  // Custom alphabets split into three roughly even rows.
  function rowsFor(alphabet) {
    var letters = Array.from(alphabet);
    if (letters.length === 26) {
      var layout = KEYBOARD_LAYOUTS[state.layout] || KEYBOARD_LAYOUTS.qwertz;
      return layout.map(function (row) { return Array.from(row); });
    }
    var a = Math.ceil(letters.length / 3);
    var b = Math.ceil((letters.length - a) / 2);
    return [letters.slice(0, a), letters.slice(a, a + b), letters.slice(a + b)];
  }

  function MachineUI(handlers) {
    this.handlers = handlers;
    this.alphabet = '';
    this.latin = true;
    this.armedPlug = null;
    this.enabled = false;
    this.els = {};
    this.lampTimer = null;
    this.resizeObserver = null;
  }

  MachineUI.prototype.mount = function () {
    var self = this;
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

    this.els.reflectorWindow.addEventListener('click', function () { self.handlers.onReflectorClick(); });
    document.getElementById('slot-add').addEventListener('click', function () { self.handlers.onAddSlot(); });
    document.getElementById('slot-del').addEventListener('click', function () { self.handlers.onRemoveSlot(); });

    // ResizeObserver is Chrome 64+; on Chrome 61 redraw the cables on window
    // resizes instead (the machine:layout event covers content changes).
    if (typeof global.ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(function () { self.drawCables(); });
      this.resizeObserver.observe(this.els.plugboard);
    } else {
      global.addEventListener('resize', function () { self.drawCables(); });
    }
  };

  MachineUI.prototype.setEnabled = function (v) {
    this.enabled = v;
    this.els.keyboard.classList.toggle('disabled', !v);
    this.els.altPanel.classList.toggle('disabled', !v);
  };

  MachineUI.prototype.setAlphabet = function (alpha) {
    var latin = alpha === 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
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
  };

  /* ---------- construction ---------- */

  MachineUI.prototype.buildLampboard = function () {
    var self = this;
    this.els.lampboard.innerHTML = '';
    rowsFor(this.alphabet).forEach(function (row) {
      var rowEl = el('div', 'lamp-row');
      row.forEach(function (ch) {
        var lamp = el('div', 'lamp', '<span>' + ch + '</span>');
        lamp.dataset.letter = ch;
        rowEl.appendChild(lamp);
      });
      self.els.lampboard.appendChild(rowEl);
    });
  };

  MachineUI.prototype.buildKeyboard = function () {
    var self = this;
    this.els.keyboard.innerHTML = '';
    rowsFor(this.alphabet).forEach(function (row) {
      var rowEl = el('div', 'key-row');
      row.forEach(function (ch) {
        var key = el('button', 'key', '<span>' + ch + '</span>');
        key.type = 'button';
        key.dataset.letter = ch;
        key.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          if (!self.enabled) return;
          key.classList.add('pressed');
          sfx.clack(true);
          self.handlers.onKey(ch);
        });
        var release = function () {
          key.classList.remove('pressed');
          self.lampOff(ch);
        };
        key.addEventListener('pointerup', release);
        key.addEventListener('pointercancel', release);
        key.addEventListener('pointerleave', release);
        rowEl.appendChild(key);
      });
      self.els.keyboard.appendChild(rowEl);
    });
  };

  MachineUI.prototype.buildPlugboard = function () {
    var self = this;
    this.els.plugGrid.innerHTML = '';
    this.els.plugSvg.innerHTML = '';
    rowsFor(this.alphabet).forEach(function (row) {
      var rowEl = el('div', 'plug-row');
      row.forEach(function (ch) {
        var socket = el('button', 'plug-socket', '<span class="socket-hole"></span><span class="socket-letter">' + ch + '</span>');
        socket.type = 'button';
        socket.dataset.letter = ch;
        socket.title = t('machine.socket.title', '插线板 {c}', { c: ch });
        socket.addEventListener('click', function () { self.onPlugClick(ch); });
        rowEl.appendChild(socket);
      });
      self.els.plugGrid.appendChild(rowEl);
    });
  };

  MachineUI.prototype.buildAltPanel = function () {
    var self = this;
    this.els.altKeys.innerHTML = '';
    this.els.altPlugs.innerHTML = '';
    this.els.altOutput.textContent = '—';
    this.els.altOutput.classList.remove('lit');
    var altInput = document.getElementById('alt-input');
    if (altInput) altInput.value = '';
    Array.from(this.alphabet).forEach(function (ch) {
      var key = el('button', 'alt-key', ch);
      key.type = 'button';
      key.dataset.letter = ch;
      key.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (!self.enabled) return;
        key.classList.add('pressed');
        sfx.clack(true);
        self.handlers.onKey(ch);
      });
      var release = function () {
        key.classList.remove('pressed');
        self.lampOff(ch);
      };
      key.addEventListener('pointerup', release);
      key.addEventListener('pointercancel', release);
      key.addEventListener('pointerleave', release);
      self.els.altKeys.appendChild(key);

      var plug = el('button', 'alt-plug', ch);
      plug.type = 'button';
      plug.dataset.letter = ch;
      plug.title = '接线 ' + ch;
      plug.addEventListener('click', function () { self.onPlugClick(ch); });
      self.els.altPlugs.appendChild(plug);
    });
    this.renderPlugs();
  };

  /* ---------- rendering ---------- */

  MachineUI.prototype.renderState = function () {
    var self = this;
    var ref = defOf(state.reflector);
    var short = ref.name.replace(/^Reflector\s+/, '');
    this.els.reflectorWindow.textContent = short;

    this.els.rotorRow.innerHTML = '';
    // state.slots is right-to-left: slots[0] is the rightmost (fastest) rotor.
    // The DOM shows rotors left to right, so render in reverse order.
    var order = state.slots.map(function (_, i) { return state.slots.length - 1 - i; });
    order.forEach(function (stateIndex) {
      self.els.rotorRow.appendChild(self.buildRotorUnit(state.slots[stateIndex], stateIndex));
    });
    this.renderPositions();
    this.renderPlugs();
    global.dispatchEvent(new CustomEvent('machine:layout'));
  };

  MachineUI.prototype.buildRotorUnit = function (id, slotIndex) {
    var self = this;
    var def = defOf(id);
    var unit = el('div', 'rotor-unit');
    unit.dataset.slot = String(slotIndex);

    var disc = el('div', 'rotor-disc');
    disc.title = t('machine.disc.title', '点击更换 / 取出齿轮，滚轮或箭头调节位置');
    disc.innerHTML =
      '<div class="rotor-ring"></div>' +
      '<div class="rotor-notch" title="' + t('machine.notch.title', '转换点（步进经过此字符时带动左侧齿轮）') + '"></div>' +
      '<div class="rotor-window">' +
        '<div class="rotor-drum">' +
          '<span class="drum-line"></span>' +
          '<span class="drum-line"></span>' +
          '<span class="drum-line d-cur"></span>' +
          '<span class="drum-line"></span>' +
          '<span class="drum-line"></span>' +
        '</div>' +
      '</div>' +
      '<div class="rotor-name"></div>';

    disc.addEventListener('click', function () { self.handlers.onRotorClick(slotIndex); });
    disc.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (!self.enabled) return;
      self.handlers.onTurn(slotIndex, e.deltaY > 0 ? -1 : 1);
    }, { passive: false });

    var controls = el('div', 'rotor-controls');
    var up = el('button', 'rotor-turn', '▲');
    up.type = 'button';
    up.title = t('machine.step', '转动一格');
    up.addEventListener('click', function () { self.handlers.onTurn(slotIndex, 1); });
    var down = el('button', 'rotor-turn', '▼');
    down.type = 'button';
    down.title = t('machine.back', '反转一格');
    down.addEventListener('click', function () { self.handlers.onTurn(slotIndex, -1); });
    controls.appendChild(up);
    controls.appendChild(down);

    unit.appendChild(disc);
    unit.appendChild(controls);
    unit.querySelector('.rotor-name').textContent = def.name.replace(/^Rotor\s+/, '');
    this.setDrum(disc, def.mapSource, state.positions[slotIndex]);
    return unit;
  };

  /* ---------- rotor drum ---------- */

  MachineUI.prototype.setDrum = function (disc, alphabet, position) {
    var L = alphabet.length;
    var pos = ((position % L) + L) % L;
    var lines = disc.querySelectorAll('.drum-line');
    var values = [];
    for (var offset = -2; offset <= 2; offset++) {
      values.push(alphabet[((pos + offset) % L + L) % L]);
    }
    for (var i = 0; i < lines.length; i++) {
      lines[i].textContent = values[i];
    }
    disc.dataset.pos = String(pos);
  };

  // Height of one drum line in CSS pixels. Read the resolved line-height
  // because custom properties containing sizes stay unresolved tokens.
  MachineUI.prototype.drumLineHeight = function (disc) {
    var line = disc && disc.querySelector('.drum-line');
    if (line) {
      var value = parseFloat(getComputedStyle(line).lineHeight);
      if (value > 0) return value;
    }
    return 16;
  };

  // Reset the drum to its resting offset without animation.
  MachineUI.prototype.restDrum = function (disc) {
    var drum = disc.querySelector('.rotor-drum');
    var line = this.drumLineHeight(disc);
    var prev = drum.style.transition;
    drum.style.transition = 'none';
    drum.style.transform = 'translateY(' + (-line) + 'px)';
    void drum.offsetHeight;
    drum.style.transition = prev || '';
  };

  MachineUI.prototype.renderPositions = function () {
    var units = this.els.rotorRow.children;
    for (var domIndex = 0; domIndex < units.length; domIndex++) {
      var unit = units[domIndex];
      var stateIndex = Number(unit.dataset.slot);
      var def = defOf(state.slots[stateIndex]);
      var len = def.mapSource.length;
      var pos = ((state.positions[stateIndex] % len) + len) % len;
      var disc = unit.querySelector('.rotor-disc');
      this.setDrum(disc, def.mapSource, pos);
      this.restDrum(disc);
      disc.dataset.angle = String(pos * (360 / len));
      disc.querySelector('.rotor-ring').style.transform = 'rotate(' + disc.dataset.angle + 'deg)';
      disc.classList.toggle('at-turnover', (def.turnover || []).indexOf(def.mapSource[pos]) !== -1);
    }
  };

  // Animate one rotor step: the drum slides by one line while the knurled
  // ring turns by one notch. Arbitrary jumps (>1 position) snap instead.
  MachineUI.prototype.animateStep = function (disc, alphabet, fromPos, toPos) {
    var L = alphabet.length;
    var from = ((fromPos % L) + L) % L;
    var to = ((toPos % L) + L) % L;
    if (from === to) return;
    var delta = ((to - from) % L + L) % L;
    var dir = delta === 1 ? 1 : delta === L - 1 ? -1 : 0;
    var drum = disc.querySelector('.rotor-drum');
    var ring = disc.querySelector('.rotor-ring');

    clearTimeout(disc._drumTimer);
    // settle any in-flight animation on the previous letter first
    this.setDrum(disc, alphabet, from);
    this.restDrum(disc);

    var angle = Number(disc.dataset.angle || 0) + (dir || 1) * delta * (360 / L);
    disc.dataset.angle = String(angle);
    ring.style.transform = 'rotate(' + angle + 'deg)';

    if (!dir) {
      this.setDrum(disc, alphabet, to);
      this.restDrum(disc);
      return;
    }

    var line = this.drumLineHeight(disc);
    drum.style.transition = 'transform 0.17s cubic-bezier(0.2, 0.7, 0.3, 1)';
    drum.style.transform = 'translateY(' + (dir === 1 ? -2 * line : 0) + 'px)';
    disc.dataset.pos = String(to);

    var self = this;
    disc._drumTimer = setTimeout(function () {
      drum.style.transition = 'none';
      self.setDrum(disc, alphabet, to);
      void drum.offsetHeight;
      drum.style.transform = 'translateY(' + (-line) + 'px)';
      void drum.offsetHeight;
      drum.style.transition = '';
      disc._drumTimer = null;
    }, 190);
  };

  // Manual thumbwheel turn (no encryption involved).
  MachineUI.prototype.showTurn = function (slot, fromPos, toPos) {
    var units = Array.prototype.slice.call(this.els.rotorRow.children);
    var unit = null;
    units.forEach(function (u) {
      if (Number(u.dataset.slot) === slot) unit = u;
    });
    if (!unit) return;
    var def = defOf(state.slots[slot]);
    var disc = unit.querySelector('.rotor-disc');
    this.animateStep(disc, def.mapSource, fromPos, toPos);
    var len = def.mapSource.length;
    var pos = ((toPos % len) + len) % len;
    disc.classList.toggle('at-turnover', (def.turnover || []).indexOf(def.mapSource[pos]) !== -1);
  };

  MachineUI.prototype.renderPlugs = function () {
    var self = this;
    var connected = new Map();
    state.plugs.forEach(function (p) {
      connected.set(p[0], p[1]);
      connected.set(p[1], p[0]);
    });
    var left = MAX_PLUGS - state.plugs.length;
    if (this.latin) {
      var sockets = this.els.plugGrid.querySelectorAll('.plug-socket');
      for (var i = 0; i < sockets.length; i++) {
        var socket = sockets[i];
        var ch = socket.dataset.letter;
        socket.classList.toggle('connected', connected.has(ch));
        socket.classList.toggle('armed', self.armedPlug === ch);
      }
      this.drawCables();
      this.els.plugCount.textContent = t('plug.count', '{n}/{max} · 剩余连线 {left}', {
        n: state.plugs.length, max: MAX_PLUGS, left: left,
      });
    } else {
      var plugs = this.els.altPlugs.querySelectorAll('.alt-plug');
      for (var j = 0; j < plugs.length; j++) {
        var plug = plugs[j];
        var c = plug.dataset.letter;
        plug.classList.toggle('connected', connected.has(c));
        plug.classList.toggle('armed', self.armedPlug === c);
      }
      var pairs = state.plugs.map(function (p) { return p[0] + '–' + p[1]; }).join('　');
      this.els.altPairs.textContent = pairs
        ? t('plugs.some', '已连线：{pairs}（剩余 {left} 根）', { pairs: pairs, left: left })
        : t('plugs.none', '尚未接线（剩余 {left} 根）', { left: left });
    }
  };

  MachineUI.prototype.drawCables = function () {
    if (!this.latin) return;
    var self = this;
    var svg = this.els.plugSvg;
    svg.innerHTML = '';
    if (!state.plugs.length) return;
    var box = this.els.plugboard.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
    svg.setAttribute('width', box.width);
    svg.setAttribute('height', box.height);

    state.plugs.forEach(function (pair, index) {
      var a = self.els.plugGrid.querySelector('.plug-socket[data-letter="' + pair[0] + '"]');
      var b = self.els.plugGrid.querySelector('.plug-socket[data-letter="' + pair[1] + '"]');
      if (!a || !b) return;
      var ra = a.getBoundingClientRect();
      var rb = b.getBoundingClientRect();
      var x1 = ra.left + ra.width / 2 - box.left;
      var y1 = ra.top + ra.height / 2 - box.top;
      var x2 = rb.left + rb.width / 2 - box.left;
      var y2 = rb.top + rb.height / 2 - box.top;
      var sag = 34 + Math.min(60, Math.abs(x2 - x1) / 3);
      var color = CABLE_COLORS[index % CABLE_COLORS.length];

      var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.classList.add('plug-cable');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + (y1 + sag) + ', ' + x2 + ' ' + (y2 + sag) + ', ' + x2 + ' ' + y2);
      path.setAttribute('stroke', color);
      group.appendChild(path);
      [x1, x2].forEach(function (x, i) {
        var y = i === 0 ? y1 : y2;
        var cap = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        cap.setAttribute('cx', x);
        cap.setAttribute('cy', y);
        cap.setAttribute('r', 6.5);
        cap.setAttribute('fill', color);
        group.appendChild(cap);
      });
      group.addEventListener('click', function () { self.onPlugClick(pair[0]); });
      svg.appendChild(group);
    });
  };

  /* ---------- interaction ---------- */

  MachineUI.prototype.onPlugClick = function (ch) {
    var self = this;
    if (!this.enabled) return;
    var plugged = null;
    state.plugs.forEach(function (p) {
      if (p[0] === ch || p[1] === ch) plugged = p;
    });
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
      var from = this.armedPlug;
      this.armedPlug = null;
      this.handlers.onPlug(from, ch);
      return;
    }
    this.renderPlugs();
  };

  MachineUI.prototype.disarmPlug = function () {
    if (this.armedPlug) {
      this.armedPlug = null;
      this.renderPlugs();
    }
  };

  /* ---------- feedback ---------- */

  MachineUI.prototype.lampOn = function (letter) {
    if (!this.latin) {
      this.els.altOutput.textContent = letter;
      this.els.altOutput.classList.add('lit');
      return;
    }
    var lamp = this.els.lampboard.querySelector('.lamp[data-letter="' + letter + '"]');
    if (!lamp) return;
    lamp.classList.add('lit');
  };

  MachineUI.prototype.lampOff = function (letter) {
    if (!this.latin) {
      this.els.altOutput.classList.remove('lit');
      return;
    }
    var lamp = this.els.lampboard.querySelector('.lamp[data-letter="' + letter + '"]');
    if (lamp) lamp.classList.remove('lit');
  };

  MachineUI.prototype.lampOffAll = function () {
    if (!this.latin) {
      this.els.altOutput.classList.remove('lit');
      return;
    }
    var lamps = this.els.lampboard.querySelectorAll('.lamp.lit');
    for (var i = 0; i < lamps.length; i++) {
      lamps[i].classList.remove('lit');
    }
  };

  // Rotor stepping + lamp after an encrypted keypress.
  MachineUI.prototype.showPress = function (output, positions, moved) {
    var self = this;
    state.positions = positions;
    var units = this.els.rotorRow.querySelectorAll('.rotor-unit');
    for (var i = 0; i < units.length; i++) {
      (function (unit) {
        var stateIndex = Number(unit.dataset.slot);
        var def = defOf(state.slots[stateIndex]);
        var disc = unit.querySelector('.rotor-disc');
        if (moved && moved[stateIndex]) {
          var from = disc.dataset.pos !== undefined && disc.dataset.pos !== ''
            ? Number(disc.dataset.pos)
            : state.positions[stateIndex];
          self.animateStep(disc, def.mapSource, from, state.positions[stateIndex]);
          sfx.tick();
        }
        var len = def.mapSource.length;
        var pos = ((state.positions[stateIndex] % len) + len) % len;
        disc.classList.toggle('at-turnover', (def.turnover || []).indexOf(def.mapSource[pos]) !== -1);
      })(units[i]);
    }
    // Only the latest lamp stays lit; a replay presses faster than the
    // 350 ms timeout, so clear first or the lamps would never go out.
    this.lampOffAll();
    this.lampOn(output);
    clearTimeout(this.lampTimer);
    this.lampTimer = setTimeout(function () { self.lampOffAll(); }, 350);
  };

  MachineUI.prototype.flashKey = function (letter) {
    var key = null;
    if (!this.latin) {
      var altKeys = this.els.altKeys.querySelectorAll('.alt-key');
      for (var i = 0; i < altKeys.length; i++) {
        if (altKeys[i].dataset.letter === letter) key = altKeys[i];
      }
      if (!key) return;
      key.classList.add('pressed');
      setTimeout(function () { key.classList.remove('pressed'); }, 160);
      return;
    }
    key = this.els.keyboard.querySelector('.key[data-letter="' + letter + '"]');
    if (!key) return;
    key.classList.add('pressed');
    setTimeout(function () { key.classList.remove('pressed'); }, 160);
  };

  MachineUI.prototype.flashLamp = function (letter) {
    var self = this;
    this.lampOn(letter);
    clearTimeout(this.lampTimer);
    this.lampTimer = setTimeout(function () { self.lampOffAll(); }, 350);
  };

  NS.MachineUI = MachineUI;
  NS.sfx = sfx;
  NS.MAX_PLUGS = MAX_PLUGS;
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
