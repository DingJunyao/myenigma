// editor.js - inventory picker, rotor/reflector editor, help dialog and toasts.

(function (global) {
  'use strict';

  var NS = (global.myenigmaMinTool = global.myenigmaMinTool || {});
  var store = NS.store;
  var state = store.state;
  var t = NS.i18n.t;

  var callbacks = {
    onInstallRotor: null,
    onInstallReflector: null,
    onSaveRotor: null,
    onSaveReflector: null,
    onPersist: null,
  };

  function configureEditor(options) {
    Object.assign(callbacks, options);
  }

  /* ---------- toast ---------- */

  function toast(message, isError) {
    var area = document.getElementById('toast-area');
    var node = document.createElement('div');
    node.className = 'toast' + (isError ? ' toast-error' : '');
    node.textContent = message;
    area.appendChild(node);
    setTimeout(function () { node.classList.add('show'); }, 10);
    setTimeout(function () {
      node.classList.remove('show');
      setTimeout(function () { node.remove(); }, 300);
    }, isError ? 4200 : 2600);
  }

  /* ---------- helpers ---------- */

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = store.randomInt(i + 1);
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function randomRotorWiring(alphabet) {
    var letters = Array.from(alphabet);
    var arr;
    var guard = 0;
    do {
      arr = shuffle(letters.slice());
      guard++;
    } while (arr.some(function (c, i) { return c === letters[i]; }) && guard < 50);
    return arr.join('');
  }

  function randomReflectorWiring(alphabet) {
    var letters = Array.from(alphabet);
    if (letters.length % 2) return null;
    var arr = shuffle(letters.slice());
    var map = {};
    for (var i = 0; i < arr.length; i += 2) {
      map[arr[i]] = arr[i + 1];
      map[arr[i + 1]] = arr[i];
    }
    return letters.map(function (c) { return map[c]; }).join('');
  }

  function distinctCount(chars) {
    var seen = {};
    var n = 0;
    for (var i = 0; i < chars.length; i++) {
      if (!seen[chars[i]]) {
        seen[chars[i]] = true;
        n++;
      }
    }
    return n;
  }

  function wiringError(mapTable, mapSource) {
    var src = Array.from(mapSource);
    var tbl = Array.from(mapTable);
    if (!mapSource || distinctCount(src) !== src.length) {
      return t('editor.err.charset', '字母表必须由互不相同的字符组成');
    }
    if (tbl.length !== src.length) return t('editor.err.length', '接线长度必须为 {n}', { n: src.length });
    if (distinctCount(tbl) !== tbl.length) return t('editor.err.repeat', '接线字符不能重复');
    for (var i = 0; i < tbl.length; i++) {
      if (src.indexOf(tbl[i]) === -1) {
        return t('editor.err.foreign', '接线中出现了字母表之外的字符 "{c}"', { c: tbl[i] });
      }
    }
    return null;
  }

  /* ---------- inventory ---------- */

  function plateCard(def, type, context) {
    var card = document.createElement('div');
    card.className = 'plate-card';
    var turnoverText = def.turnover && def.turnover.length
      ? def.turnover.join(' / ')
      : t('card.turnover.default', '默认（最后一个字符）');
    var turnoverHtml = type === 'rotor'
      ? '<div class="card-row small">' + t('card.turnover', '转换点：{t}', { t: turnoverText }) + '</div>'
      : '';
    var alphaBadge = def.mapSource !== store.AZ
      ? '<span class="alpha-badge">' + t('card.alphabet', '字母表 {a}', { a: def.mapSource }) + '</span>'
      : '';
    card.innerHTML =
      '<div class="card-head"><b>' + def.name + '</b>' + alphaBadge + '</div>' +
      '<div class="card-wiring">' + def.mapTable + '</div>' +
      turnoverHtml +
      '<div class="card-actions"></div>';
    var actions = card.querySelector('.card-actions');
    if (type === 'rotor') {
      var btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = context && context.slot !== undefined
        ? t('install.slot', '装入第 {n} 槽', { n: context.slot + 1 })
        : t('install', '装入');
      btn.addEventListener('click', function () { callbacks.onInstallRotor(def, context); });
      actions.appendChild(btn);
    } else {
      var useBtn = document.createElement('button');
      useBtn.className = 'btn btn-primary';
      useBtn.textContent = t('use', '使用此反射板');
      useBtn.addEventListener('click', function () { callbacks.onInstallReflector(def); });
      actions.appendChild(useBtn);
    }
    if (def.id && String(def.id).charAt(0) === 'c') {
      var edit = document.createElement('button');
      edit.className = 'btn';
      edit.textContent = t('edit', '编辑');
      edit.addEventListener('click', function () { openEditor(type, def, context); });
      var del = document.createElement('button');
      del.className = 'btn btn-danger';
      del.textContent = t('delete', '删除');
      del.addEventListener('click', function () {
        if (type === 'rotor' && state.slots.indexOf(def.id) !== -1) {
          toast(t('toast.inUse.rotor', '该齿轮正在机器上使用，请先更换下来'), true);
          return;
        }
        if (type === 'reflector' && state.reflector === def.id) {
          toast(t('toast.inUse.reflector', '该反射板正在使用中，无法删除'), true);
          return;
        }
        if (type === 'rotor') {
          state.customRotors = state.customRotors.filter(function (d) { return d.id !== def.id; });
        } else {
          state.customReflectors = state.customReflectors.filter(function (d) { return d.id !== def.id; });
        }
        callbacks.onPersist();
        toast(t('toast.deleted', '已删除 {name}', { name: def.name }));
        openInventory(type, context); // refresh list
      });
      actions.appendChild(edit);
      actions.appendChild(del);
    }
    return card;
  }

  function openInventory(type, context) {
    context = context || {};
    var dlg = document.getElementById('dlg-inventory');
    var title = document.getElementById('inventory-title');
    var grid = document.getElementById('inventory-grid');
    var newBtn = document.getElementById('inventory-new');
    var isRotor = type === 'rotor';

    title.textContent = isRotor
      ? (context.slot !== undefined
        ? t('inventory.slot', '更换第 {n} 槽齿轮', { n: context.slot + 1 })
        : t('inventory.rotors', '齿轮仓库'))
      : t('inventory.reflectors', '反射板仓库');
    grid.innerHTML = '';
    var samples = isRotor ? store.SAMPLE_ROTORS : store.SAMPLE_REFLECTORS;
    var customs = isRotor ? state.customRotors : state.customReflectors;
    customs.forEach(function (def) { grid.appendChild(plateCard(def, type, context)); });
    samples.forEach(function (def) { grid.appendChild(plateCard(def, type, context)); });

    newBtn.textContent = isRotor ? t('inventory.newRotor', '＋ 新建齿轮') : t('inventory.newReflector', '＋ 新建反射板');
    newBtn.onclick = function () { openEditor(type, null, context); };
    // Refreshing from the delete button happens while the dialog is open;
    // showModal would throw InvalidStateError there.
    if (!dlg.open) dlg.showModal();
  }

  /* ---------- editor ---------- */

  function chipRow(container, alphabet, selected) {
    container.innerHTML = '';
    Array.from(alphabet).forEach(function (ch) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (selected.has(ch) ? ' chip-on' : '');
      chip.textContent = ch;
      chip.addEventListener('click', function () {
        if (selected.has(ch)) selected.delete(ch);
        else selected.add(ch);
        chip.classList.toggle('chip-on');
      });
      container.appendChild(chip);
    });
  }

  function openEditor(type, def, context) {
    def = def || null;
    context = context || {};
    var dlg = document.getElementById('dlg-editor');
    var isRotor = type === 'rotor';
    document.getElementById('editor-title').textContent = isRotor
      ? (def ? t('editor.title.rotorEdit', '编辑齿轮') : t('editor.title.rotorNew', '新建齿轮'))
      : (def ? t('editor.title.reflectorEdit', '编辑反射板') : t('editor.title.reflectorNew', '新建反射板'));
    var defaultAlphabet = isRotor && context.slot !== undefined
      ? store.defOf(state.slots[context.slot]).mapSource
      : store.currentAlphabet();

    var nameInput = document.getElementById('editor-name');
    var sourceInput = document.getElementById('editor-map-source');
    var tableInput = document.getElementById('editor-map-table');
    var turnoverWrap = document.getElementById('editor-turnover-wrap');
    var turnoverRow = document.getElementById('editor-turnover-chips');
    var message = document.getElementById('editor-message');

    var selectedTurnover = new Set(def && def.turnover ? def.turnover : []);
    nameInput.value = def ? def.name
      : isRotor
        ? t('editor.defaultRotorName', '自定义齿轮 {n}', { n: state.customRotors.length + 1 })
        : t('editor.defaultReflectorName', '自定义反射板 {n}', { n: state.customReflectors.length + 1 });
    sourceInput.value = def ? def.mapSource : defaultAlphabet;
    tableInput.value = def ? def.mapTable : Array.from(sourceInput.value).join('');
    message.textContent = '';

    var lastChipAlphabet = null;
    var lastSyncedSource = sourceInput.value.trim();
    var refreshChips = function (force) {
      var src = sourceInput.value.trim();
      if (!force && src === lastChipAlphabet) return;
      lastChipAlphabet = src;
      chipRow(turnoverRow, src, selectedTurnover);
    };
    turnoverWrap.hidden = !isRotor;
    if (isRotor) refreshChips(true);
    else turnoverRow.innerHTML = ''; // reflectors have no turnover

    var refreshWiringHint = function () {
      var err = wiringError(tableInput.value, sourceInput.value.trim());
      message.textContent = err || t('editor.valid', '✓ 接线有效');
      message.classList.toggle('ok', !err);
    };
    refreshWiringHint();

    // Rebuilding all turnover chips and re-validating on every keystroke made
    // typing feel laggy; debounce, and only rebuild chips on real changes.
    var sourceTimer = null;
    var syncFromSource = function () {
      var src = sourceInput.value.trim();
      tableInput.value = Array.from(src).join('');
      lastSyncedSource = src;
      if (isRotor) {
        Array.from(selectedTurnover).forEach(function (ch) {
          if (Array.from(src).indexOf(ch) === -1) selectedTurnover.delete(ch);
        });
        refreshChips();
      }
      refreshWiringHint();
    };
    sourceInput.oninput = function () {
      clearTimeout(sourceTimer);
      sourceTimer = setTimeout(syncFromSource, 180);
    };
    var tableTimer = null;
    tableInput.oninput = function () {
      clearTimeout(tableTimer);
      tableTimer = setTimeout(refreshWiringHint, 180);
    };

    document.getElementById('editor-identity').onclick = function () {
      tableInput.value = Array.from(sourceInput.value.trim()).join('');
      refreshWiringHint();
    };
    document.getElementById('editor-random').onclick = function () {
      var src = sourceInput.value.trim();
      var wiring = isRotor ? randomRotorWiring(src) : randomReflectorWiring(src);
      if (wiring === null) {
        toast(t('editor.err.oddRandom', '随机反射板需要偶数个字符的字母表'), true);
        return;
      }
      tableInput.value = wiring;
      refreshWiringHint();
    };

    document.getElementById('editor-save').onclick = function () {
      // A pending debounce might still hold an older wiring for the typed
      // alphabet; normalise before validating.
      if (sourceInput.value.trim() !== lastSyncedSource) syncFromSource();
      var name = nameInput.value.trim() || 'Unnamed';
      var mapSource = sourceInput.value.trim();
      var mapTable = tableInput.value.replace(/\s+/g, '');
      var err = wiringError(mapTable, mapSource);
      if (err) {
        message.textContent = err;
        message.classList.remove('ok');
        return;
      }
      var candidate = {
        id: def ? def.id : store.newCustomId(),
        name: name,
        mapTable: mapTable,
        turnover: isRotor ? Array.from(selectedTurnover) : undefined,
        mapSource: mapSource,
        custom: true,
      };
      // The engine validators speak the same snake_case schema as buildConfig().
      var payload = {
        name: name,
        map_table: mapTable,
        map_source: mapSource,
        turnover: isRotor ? Array.from(selectedTurnover) : [],
      };
      var validator = isRotor ? callbacks.api.validateRotor : callbacks.api.validateReflector;
      var result = validator(payload);
      if (result.error) {
        message.textContent = result.error;
        message.classList.remove('ok');
        return;
      }
      var saved = isRotor ? callbacks.onSaveRotor(candidate, context) : callbacks.onSaveReflector(candidate);
      if (saved === true) dlg.close();
    };

    dlg.showModal();
  }

  function closeEditor() {
    document.getElementById('dlg-editor').close();
  }

  NS.editor = {
    configureEditor: configureEditor,
    toast: toast,
    openInventory: openInventory,
    openEditor: openEditor,
    closeEditor: closeEditor,
  };
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
