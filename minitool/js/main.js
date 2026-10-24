// main.js - application glue: init, keypress flow, machine handlers.
//
// The engine is the pure-JS port loaded before this file (js/engine.js), so
// there is no WASM runtime and no boot phase: the machine is ready at once.

(function (global) {
  'use strict';

  var NS = (global.myenigmaMinTool = global.myenigmaMinTool || {});
  var store = NS.store;
  var state = store.state;
  var engine = NS.engine;
  var ui8n = NS.i18n;
  var t = ui8n.t;

  var engineInfo = engine.api_info();
  var engineReady = true;

  var TYPE_INTERVAL = 80; // ms per character when replaying pasted text
  var typing = false;
  var typeQueue = [];

  var ui = new NS.MachineUI({
    onKey: handleKey,
    onTurn: turnRotor,
    onRotorClick: function (slot) { NS.editor.openInventory('rotor', { slot: slot }); },
    onReflectorClick: function () { NS.editor.openInventory('reflector'); },
    onPlug: plugPair,
    onUnplug: unplugLetter,
    onAddSlot: addSlot,
    onRemoveSlot: removeSlot,
  });

  /* ---------- readiness ---------- */

  // The machine only works once reflector and every rotor share one alphabet.
  function syncReadiness() {
    var ok = engineReady && store.machineReady();
    ui.setEnabled(ok);
    var hint = document.getElementById('ready-hint');
    if (!engineReady) {
      hint.hidden = true;
      return;
    }
    hint.hidden = ok;
    if (!ok) {
      var refAlpha = store.currentAlphabet();
      var mismatched = state.slots
        .map(function (id) { return store.defOf(id); })
        .filter(function (d) { return d.mapSource !== refAlpha; })
        .map(function (d) { return d.name; });
      hint.textContent = t('ready.hint', '⚠ 字母表未统一：反射板为「{ref}」，齿轮 [{list}] 与之不符。请在齿轮仓库中安装同字母表的齿轮，安装齐全后键盘/灯盘/插线板会自动启用。', {
        ref: refAlpha,
        list: mismatched.join('、'),
      });
    }
  }

  /* ---------- core flows ---------- */

  function handleKey(letter) {
    if (typing) return; // let the paste replay finish in order
    pressKey(letter);
  }

  function pressKey(letter) {
    if (!engineReady || !store.machineReady()) return;
    var res;
    try {
      res = engine.api_press(store.buildConfig(), letter);
    } catch (err) {
      NS.editor.toast(t('toast.engine', '引擎错误：{msg}', { msg: err.message }), true);
      return;
    }
    if (res.error) {
      NS.editor.toast(res.error, true);
      return;
    }
    ui.showPress(res.output, res.positions, res.moved);
    tapeAppend(letter, res.output);
    store.persistState();
  }

  /* ---------- pasted text replay ---------- */

  function feedText(text) {
    if (!engineReady || !store.machineReady()) {
      NS.editor.toast(t('toast.notReady.input', '字母表未统一，暂不能输入'), true);
      return;
    }
    var alphabet = store.currentAlphabet();
    var chars = Array.from(String(text).toUpperCase()).filter(function (c) { return alphabet.indexOf(c) !== -1; });
    if (!chars.length) {
      NS.editor.toast(t('toast.noChars', '粘贴的文本不包含当前字母表中的字符'), true);
      return;
    }
    chars.forEach(function (ch) { typeQueue.push(ch); }); // no length limit
    if (!typing) pumpTyping();
  }

  function pumpTyping() {
    if (!typeQueue.length) {
      typing = false;
      return;
    }
    typing = true;
    var ch = typeQueue.shift();
    ui.flashKey(ch);
    NS.sfx.clack(true);
    pressKey(ch);
    setTimeout(pumpTyping, TYPE_INTERVAL);
  }

  function cancelTyping() {
    typeQueue.length = 0;
    typing = false;
  }

  function turnRotor(slot, delta) {
    var len = store.defOf(state.slots[slot]).mapSource.length;
    var from = state.positions[slot];
    state.positions[slot] = ((from + delta) % len + len) % len;
    ui.showTurn(slot, from, state.positions[slot]);
    NS.sfx.tick();
    store.persistState();
  }

  function plugPair(a, b) {
    if (state.plugs.length >= 10) {
      NS.editor.toast(t('toast.plugMax', '插线板最多同时使用 10 根连线'), true);
      ui.renderPlugs();
      return;
    }
    state.plugs.push([a, b]);
    NS.sfx.tick();
    ui.renderPlugs();
    store.persistState();
  }

  function unplugLetter(letter) {
    state.plugs = state.plugs.filter(function (p) { return p[0] !== letter && p[1] !== letter; });
    ui.renderPlugs();
    store.persistState();
  }

  /* ---------- rotor / reflector management ---------- */

  function compatibleRotors() {
    var alpha = store.currentAlphabet();
    return store.rotorsForCharSet(alpha).map(function (d) { return store.normalizePartOrder(d, alpha); });
  }

  // Parts can be swapped freely; the machine only runs once reflector and
  // every rotor share one alphabet (see syncReadiness).
  function installRotor(def, context) {
    var slot = context && context.slot !== undefined ? context.slot : 0;
    state.slots[slot] = def.id;
    state.positions[slot] = 0;
    store.persistState();
    ui.renderState();
    syncReadiness();
    document.getElementById('dlg-inventory').close();
    NS.editor.toast(store.machineReady()
      ? t('toast.installed', '已将 "{name}" 装入第 {n} 槽', { name: def.name, n: slot + 1 })
      : t('toast.installedPartial', '已装入 "{name}"；字母表统一后启用键盘', { name: def.name }));
    return true;
  }

  function installReflector(def) {
    var previous = store.currentAlphabet();
    state.reflector = def.id;
    if (def.mapSource !== previous) {
      cancelTyping();
      var letters = Array.from(def.mapSource);
      state.plugs = state.plugs.filter(function (p) {
        return letters.indexOf(p[0]) !== -1 && letters.indexOf(p[1]) !== -1;
      });
      state.positions = state.slots.map(function () { return 0; });
      ui.setAlphabet(def.mapSource);
    }
    store.persistState();
    ui.renderState();
    syncReadiness();
    document.getElementById('dlg-inventory').close();
    NS.editor.toast(store.machineReady()
      ? t('toast.used', '已换用 {name}', { name: def.name })
      : t('toast.usedPartial', '已换用 {name}；安装同字母表齿轮后启用键盘', { name: def.name }));
    return true;
  }

  function saveRotor(def, context) {
    // Keep warehouse parts aligned with the machine's alphabet order when the
    // character set matches (order-only differences are the same alphabet).
    if (store.sameCharSet(def.mapSource, store.currentAlphabet())) {
      def = store.normalizePartOrder(def, store.currentAlphabet());
    }
    putCustomPart(state.customRotors, def);
    store.persistState();
    var installedAt = state.slots.indexOf(def.id);
    if (installedAt >= 0) {
      state.positions[installedAt] = 0;
      ui.renderState();
      syncReadiness();
    }
    if (context && context.slot !== undefined) {
      return installRotor(def, context);
    }
    NS.editor.toast(t('toast.savedRotor', '已保存齿轮 "{name}"', { name: def.name }));
    return true;
  }

  function saveReflector(def) {
    if (store.sameCharSet(def.mapSource, store.currentAlphabet())) {
      def = store.normalizePartOrder(def, store.currentAlphabet());
    }
    putCustomPart(state.customReflectors, def);
    store.persistState();
    NS.editor.toast(t('toast.savedReflector', '已保存反射板 "{name}"，可在反射板仓库中选用', { name: def.name }));
    return true;
  }

  function putCustomPart(list, def) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === def.id) {
        list[i] = def;
        return;
      }
    }
    list.push(def);
  }

  function addSlot() {
    if (state.slots.length >= 4) {
      NS.editor.toast(t('toast.slotMax', '最多支持 4 个齿轮（M4 军用型）'), true);
      return;
    }
    var candidates = compatibleRotors();
    var pick = null;
    candidates.forEach(function (d) {
      if (!pick && state.slots.indexOf(d.id) === -1) pick = d;
    });
    if (!pick && candidates.length) pick = candidates[0];
    if (!pick) {
      NS.editor.toast(t('toast.noCompatible', '仓库中没有与当前字母表兼容的齿轮，请新建一个'), true);
      return;
    }
    state.slots.push(pick.id); // new slot becomes the leftmost
    state.positions.push(0);
    store.persistState();
    ui.renderState();
    NS.editor.toast(t('toast.added', '已加装 "{name}"（最左侧）', { name: pick.name }));
  }

  function removeSlot() {
    if (state.slots.length <= 1) {
      NS.editor.toast(t('toast.minOne', '至少要保留一个齿轮'), true);
      return;
    }
    var removed = store.defOf(state.slots.pop()).name;
    state.positions.pop();
    store.persistState();
    ui.renderState();
    syncReadiness();
    NS.editor.toast(t('toast.removed', '已拆下 {name}', { name: removed }));
  }

  /* ---------- toolbar actions ---------- */

  function zeroPositions() {
    state.positions = state.slots.map(function () { return 0; });
    ui.lampOffAll();
    ui.renderPositions();
    store.persistState();
    NS.editor.toast(t('toast.zeroed', '齿轮已全部归零'));
  }

  function randomize() {
    if (!store.machineReady()) {
      NS.editor.toast(t('toast.notReady.random', '字母表未统一，暂不能随机配置'), true);
      return;
    }
    var rotors = compatibleRotors();
    var alpha = store.currentAlphabet();
    var reflectors = store.reflectorsForCharSet(alpha).map(function (d) {
      return store.normalizePartOrder(d, alpha);
    });
    var ref = reflectors[store.randomInt(reflectors.length)];
    state.reflector = ref.id;
    state.slots = state.slots.map(function () {
      return rotors[store.randomInt(rotors.length)].id;
    });
    state.positions = state.slots.map(function (id) {
      return store.randomInt(store.defOf(id).mapSource.length);
    });
    var letters = Array.from(store.currentAlphabet());
    var pool = letters.slice();
    state.plugs = [];
    var pairCount = store.randomInt(11);
    for (var i = 0; i < pairCount && pool.length >= 2; i++) {
      var a = pool.splice(store.randomInt(pool.length), 1)[0];
      var b = pool.splice(store.randomInt(pool.length), 1)[0];
      state.plugs.push([a, b]);
    }
    ui.setAlphabet(store.currentAlphabet());
    ui.renderState();
    store.persistState();
    NS.editor.toast(t('toast.randomized', '已生成随机配置'));
  }

  function factoryReset() {
    cancelTyping();
    store.resetConfig();
    ui.setAlphabet(store.currentAlphabet());
    ui.renderState();
    tapeClear();
    NS.editor.toast(t('toast.factory', '已恢复默认配置（自定义齿轮保留）'));
  }

  /* ---------- paper tape (plaintext line above, ciphertext line below) ---------- */

  var tape = { plain: '', cipher: '' };
  var TAPE_DISPLAY_LIMIT = 800; // full text is kept for copying; only the tail is rendered

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function chunk5(text) {
    var chars = Array.from(text);
    var out = [];
    for (var i = 0; i < chars.length; i += 5) {
      out.push(chars.slice(i, i + 5).join(''));
    }
    return out;
  }

  function renderTape() {
    var plainEl = document.getElementById('tape-plain');
    var cipherEl = document.getElementById('tape-cipher');
    if (!tape.plain) {
      plainEl.innerHTML = '<span class="tape-hint">' + t('tape.hint', '敲击键盘，或直接在页面上粘贴文本开始加密') + '</span>';
      cipherEl.innerHTML = '';
    } else {
      var truncated = tape.plain.length > TAPE_DISPLAY_LIMIT;
      var plain = truncated ? tape.plain.slice(-TAPE_DISPLAY_LIMIT) : tape.plain;
      var cipher = truncated ? tape.cipher.slice(-TAPE_DISPLAY_LIMIT) : tape.cipher;
      var ellipsis = truncated ? '<span class="tape-ellipsis">…</span>' : '';
      plainEl.innerHTML = ellipsis + chunk5(plain).map(escapeHtml).join('&nbsp;');
      cipherEl.innerHTML = ellipsis + chunk5(cipher).map(escapeHtml).join('&nbsp;');
    }
    var scroller = document.getElementById('tape-scroll');
    scroller.scrollLeft = scroller.scrollWidth;
  }

  // The container has no programmatic clipboard (both clipboard APIs are
  // unavailable): show the text selectable and let the user copy it manually,
  // as the capability guide prescribes.
  function showTape(kind) {
    var text = kind === 'plain' ? tape.plain : tape.cipher;
    var label = kind === 'plain' ? t('label.plain', '明文') : t('label.cipher', '密文');
    if (!text) {
      NS.editor.toast(t('toast.tapeEmpty', '纸带还是空的'), true);
      return;
    }
    document.getElementById('copy-title').textContent = t(
      kind === 'plain' ? 'copy.title.plain' : 'copy.title.cipher',
      kind === 'plain' ? '明文' : '密文'
    );
    var area = document.getElementById('copy-text');
    area.value = text;
    document.getElementById('dlg-copy').showModal();
    area.focus();
    area.select();
    NS.editor.toast(t('toast.copied', '已展示{label}，请在弹窗中手动复制', { label: label }));
  }

  // The container cannot read the clipboard programmatically (the clipboard
  // APIs are unavailable and no platform API exists): open a box the user
  // pastes into manually, as the capability guide prescribes.
  function showPasteDialog() {
    var box = document.getElementById('paste-text');
    box.value = '';
    document.getElementById('dlg-paste').showModal();
    box.focus();
  }

  function submitPaste() {
    var box = document.getElementById('paste-text');
    var text = box.value;
    box.value = '';
    document.getElementById('dlg-paste').close();
    if (text.trim()) feedText(text);
  }

  // Horizontal drag scrolling for the paper tape (mouse and touch friendly).
  function enableDragScroll(el) {
    var dragging = false;
    var startX = 0;
    var startLeft = 0;
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      el.classList.add('dragging');
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      el.scrollLeft = startLeft - (e.clientX - startX);
    });
    var end = function () {
      dragging = false;
      el.classList.remove('dragging');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  }

  function paintSound() {
    var soundBtn = document.getElementById('btn-sound');
    if (!soundBtn) return;
    soundBtn.textContent = state.sound ? t('sound.on', '🔊 声音开') : t('sound.off', '🔇 声音关');
  }

  function updateFooter() {
    document.getElementById('footer-info').textContent =
      t('footer.engine', '加密引擎 myenigma v{v} · 纯 JS 实现（与 Python 库同算法），离线运行', {
        v: engineInfo.myenigma,
      });
  }

  function refreshTexts() {
    ui.setAlphabet(store.currentAlphabet());
    ui.renderState();
    syncReadiness();
    renderTape();
    paintSound();
    updateFooter();
    fitScale();
  }
  global.addEventListener('langchange', refreshTexts);

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

  global.addEventListener('keydown', function (e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!engineReady || typing) return;
    var target = e.target;
    if (target.closest && (target.closest('input, textarea, select') || target.closest('dialog'))) return;
    var letter = e.key.toUpperCase();
    if (letter.length !== 1 || Array.from(store.currentAlphabet()).indexOf(letter) === -1) return;
    e.preventDefault();
    ui.flashKey(letter);
    NS.sfx.clack(true);
    pressKey(letter);
  });
  global.addEventListener('keyup', function () { ui.lampOffAll(); });
  global.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (typing) {
      cancelTyping();
      NS.editor.toast(t('toast.stopped', '已停止输入'));
      return;
    }
    ui.disarmPlug();
  });

  // Pasting text anywhere on the page feeds it into the machine, one letter
  // at a time. Inputs and dialogs keep the browser's normal paste behaviour.
  // (Reading e.clipboardData on a paste event is plain web behaviour; the
  // programmatic clipboard APIs are the ones the container blocks.)
  document.addEventListener('paste', function (e) {
    var target = e.target;
    if (target.closest && (target.closest('input, textarea') || target.closest('dialog'))) return;
    if (!engineReady) return;
    var source = e.clipboardData || global.clipboardData;
    var text = (source && source.getData && source.getData('text')) || '';
    if (!text.trim()) return;
    e.preventDefault();
    feedText(text);
  });

  // Custom-alphabet mode: explicit send (button or Enter), which also plays
  // nicely with IME composition.
  function submitAltInput() {
    var input = document.getElementById('alt-input');
    var text = input.value;
    if (!text.trim()) return;
    input.value = '';
    feedText(text);
  }

  /* ---------- toolbar & shell ---------- */

  function bindToolbar() {
    document.getElementById('btn-zero').addEventListener('click', zeroPositions);
    document.getElementById('btn-random').addEventListener('click', randomize);
    document.getElementById('btn-factory').addEventListener('click', factoryReset);
    document.getElementById('tape-clear').addEventListener('click', tapeClear);
    document.getElementById('tape-paste').addEventListener('click', showPasteDialog);
    document.getElementById('paste-send').addEventListener('click', submitPaste);
    document.getElementById('tape-copy-plain').addEventListener('click', function () { showTape('plain'); });
    document.getElementById('tape-copy-cipher').addEventListener('click', function () { showTape('cipher'); });
    enableDragScroll(document.getElementById('tape-scroll'));
    document.getElementById('alt-send').addEventListener('click', submitAltInput);
    document.getElementById('alt-input').addEventListener('keydown', function (e) {
      if (e.isComposing || e.keyCode === 229) return; // IME composition in progress
      if (e.key === 'Enter') {
        e.preventDefault();
        submitAltInput();
      }
    });
    var soundBtn = document.getElementById('btn-sound');
    paintSound();
    soundBtn.addEventListener('click', function () {
      state.sound = !state.sound;
      store.persistState();
      paintSound();
    });
    var langSelect = document.getElementById('opt-lang');
    langSelect.value = ui8n.getLang();
    langSelect.addEventListener('change', function () {
      ui8n.setLang(langSelect.value);
      refreshTexts();
    });
    // Mechanism switches (mirror the Enigma constructor flags).
    var rotateUp = document.getElementById('opt-rotate-up');
    var rotateAfter = document.getElementById('opt-rotate-after');
    rotateUp.checked = state.rotateUp;
    rotateAfter.checked = state.rotateAfterType;
    rotateUp.addEventListener('change', function () {
      state.rotateUp = rotateUp.checked;
      store.persistState();
      NS.editor.toast(state.rotateUp ? t('toast.rotateUpOn', '已启用反向轮转 rotate_up') : t('toast.rotateUpOff', '已恢复默认旋转方向'));
    });
    rotateAfter.addEventListener('change', function () {
      state.rotateAfterType = rotateAfter.checked;
      store.persistState();
      NS.editor.toast(state.rotateAfterType ? t('toast.rotateAfterOn', '已改为加密后再步进') : t('toast.rotateAfterOff', '已恢复先步进后加密'));
    });
    var layoutSelect = document.getElementById('opt-layout');
    layoutSelect.value = state.layout;
    layoutSelect.addEventListener('change', function () {
      state.layout = layoutSelect.value;
      store.persistState();
      ui.setAlphabet(store.currentAlphabet());
      ui.renderState();
      syncReadiness();
      NS.editor.toast(t('toast.layout', '键盘布局：{name}', { name: layoutSelect.selectedOptions[0].textContent }));
    });
    document.getElementById('btn-help').addEventListener('click', function () {
      document.getElementById('dlg-help').showModal();
    });
    document.getElementById('btn-settings').addEventListener('click', function () {
      document.getElementById('dlg-settings').showModal();
    });

    // Mobile: collapse the toolbar into a single ☰ menu button.
    var menuBtn = document.getElementById('btn-menu');
    var toolbar = document.getElementById('toolbar');
    var setMenu = function (open) {
      toolbar.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    };
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenu(!toolbar.classList.contains('open'));
    });
    document.addEventListener('click', function (e) {
      if (!toolbar.classList.contains('open')) return;
      if (e.target.closest('#toolbar') || e.target.closest('#btn-menu')) return;
      setMenu(false);
    });
    toolbar.addEventListener('click', function (e) {
      if (e.target.closest('.btn')) setMenu(false); // close after choosing an action
    });
    global.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
    var closeButtons = document.querySelectorAll('[data-close]');
    for (var i = 0; i < closeButtons.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () { btn.closest('dialog').close(); });
      })(closeButtons[i]);
    }
  }

  function fitScale() {
    var stage = document.querySelector('.machine-scale');
    var machine = document.querySelector('.machine');
    if (!stage || !machine) return;
    stage.style.transform = 'none';
    // scrollWidth covers content that is wider than the box (e.g. a very
    // narrow phone), so the machine is scaled to fit instead of overflowing.
    var natural = Math.max(machine.offsetWidth, machine.scrollWidth);
    var available = Math.min(global.innerWidth - 20, 960);
    var scale = Math.min(1, available / natural);
    stage.style.transform = 'scale(' + scale + ')';
    stage.style.transformOrigin = 'top center';
    stage.parentElement.style.height = (machine.offsetHeight * scale) + 'px';
  }

  global.addEventListener('resize', fitScale);
  global.addEventListener('machine:layout', function () {
    requestAnimationFrame(fitScale);
  });

  global.addEventListener('error', function (e) { showError(e.message); });
  global.addEventListener('unhandledrejection', function (e) {
    var reason = e.reason;
    showError((reason && reason.message) || String(reason));
  });

  function showError(message) {
    var chip = document.getElementById('err-chip');
    chip.hidden = false;
    chip.textContent = '⚠ ' + message;
  }

  // Flex `gap` cannot be trusted from a syntax probe (CSS.supports only
  // proves the property is parsed): measure an actual flex column once,
  // then let the CSS enhancement layer take over. Chrome 61 keeps margins.
  function detectFlexGap() {
    var flex = document.createElement('div');
    flex.style.position = 'absolute';
    flex.style.visibility = 'hidden';
    flex.style.display = 'flex';
    flex.style.flexDirection = 'column';
    flex.style.rowGap = '1px';
    flex.appendChild(document.createElement('div'));
    flex.appendChild(document.createElement('div'));
    document.body.appendChild(flex);
    var supported = flex.scrollHeight === 1;
    flex.parentNode.removeChild(flex);
    return supported;
  }

  function init() {
    ui8n.applyI18n();
    if (detectFlexGap()) {
      document.documentElement.classList.add('supports-flex-gap');
    }
    store.loadState();
    ui.mount();
    ui.setAlphabet(store.currentAlphabet());
    ui.renderState();
    ui.setEnabled(false);
    bindToolbar();
    NS.editor.configureEditor({
      onInstallRotor: installRotor,
      onInstallReflector: installReflector,
      onSaveRotor: saveRotor,
      onSaveReflector: saveReflector,
      onPersist: store.persistState,
      api: {
        validateRotor: function (d) { return engine.api_validate_rotor(d); },
        validateReflector: function (d) { return engine.api_validate_reflector(d); },
      },
    });
    syncReadiness();
    updateFooter();
    fitScale();
  }

  init();
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
