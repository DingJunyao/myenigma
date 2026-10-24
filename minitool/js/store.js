// store.js - sample catalogue, machine state and localStorage persistence.

(function (global) {
  'use strict';

  var NS = (global.myenigmaMinTool = global.myenigmaMinTool || {});

  var AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  var SAMPLE_ROTORS = [
    { id: 'I', name: 'Rotor I', mapTable: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', turnover: ['Q'], mapSource: AZ },
    { id: 'II', name: 'Rotor II', mapTable: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', turnover: ['E'], mapSource: AZ },
    { id: 'III', name: 'Rotor III', mapTable: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', turnover: ['V'], mapSource: AZ },
    { id: 'IV', name: 'Rotor IV', mapTable: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', turnover: ['J'], mapSource: AZ },
    { id: 'V', name: 'Rotor V', mapTable: 'VZBRGITYUPSDNHLXAWMJQOFECK', turnover: ['Z'], mapSource: AZ },
    { id: 'VI', name: 'Rotor VI', mapTable: 'JPGVOUMFYQBENHZRDKASXLICTW', turnover: ['Z', 'M'], mapSource: AZ },
    { id: 'VII', name: 'Rotor VII', mapTable: 'NZJHGRCXMYSWBOUFAIVLPEKQDT', turnover: ['Z', 'M'], mapSource: AZ },
    { id: 'VIII', name: 'Rotor VIII', mapTable: 'FKQHTLXOCBJSPDZRAMEWNIUYGV', turnover: ['Z', 'M'], mapSource: AZ },
    { id: 'BETA', name: 'Rotor Beta', mapTable: 'LEYJVCNIXWPBQMDRTAKZGFUHOS', turnover: [], mapSource: AZ },
    { id: 'GAMMA', name: 'Rotor Gamma', mapTable: 'FSOKANUERHMBTIYCWLQPZXVGJD', turnover: [], mapSource: AZ },
  ];

  var SAMPLE_REFLECTORS = [
    { id: 'B', name: 'Reflector B', mapTable: 'YRUHQSLDPXNGOKMIEBFZCWVJAT', mapSource: AZ },
    { id: 'C', name: 'Reflector C', mapTable: 'FVPJIAOYEDRZXWGCTKUQSBNMHL', mapSource: AZ },
    { id: 'B-THIN', name: 'Reflector B Thin', mapTable: 'ENKQAUYWJICOPBLMDXZVFTHRGS', mapSource: AZ },
    { id: 'C-THIN', name: 'Reflector C Thin', mapTable: 'RDOBJNTKVEHMLFCWZAXGYIPSUQ', mapSource: AZ },
  ];

  var STORAGE_KEY = 'myenigma.minitool.v1';

  var KEYBOARD_LAYOUTS = {
    qwertz: ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'],
    qwerty: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
    azerty: ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'],
    dvorak: ['PYFGCRL', 'AOEUIDHTNS', 'QJKXBMWVZ'],
    abc: ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ'],
  };

  function defaultState() {
    return {
      slots: ['III', 'II', 'I'], // rotor ids, RIGHT to LEFT (index 0 = rightmost)
      reflector: 'B',
      positions: [0, 0, 0], // int positions into map_source, right to left
      plugs: [], // [[letterA, letterB], ...]
      sound: true,
      rotateUp: false, // Enigma(rotate_up=...)
      rotateAfterType: false, // Enigma(rotate_after_type=...)
      layout: 'qwertz', // on-screen keyboard arrangement (26-letter machines)
      customRotors: [],
      customReflectors: [],
    };
  }

  var state = defaultState();

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (Array.isArray(saved.customRotors)) state.customRotors = saved.customRotors;
      if (Array.isArray(saved.customReflectors)) state.customReflectors = saved.customReflectors;
      var cfg = saved.config || {};
      if (Array.isArray(cfg.slots) && cfg.slots.length >= 1 && cfg.slots.every(function (s) { return !!defOf(s); })) {
        state.slots = cfg.slots.slice(0, 4);
        state.positions = Array.isArray(cfg.positions)
          ? cfg.positions.slice(0, state.slots.length).map(function (p) { return Number.isInteger(p) ? p : 0; })
          : state.slots.map(function () { return 0; });
        while (state.positions.length < state.slots.length) state.positions.push(0);
      }
      if (typeof cfg.reflector === 'string' && defOf(cfg.reflector)) state.reflector = cfg.reflector;
      if (Array.isArray(cfg.plugs)) {
        state.plugs = cfg.plugs.filter(function (p) {
          return Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string';
        });
      }
      if (typeof cfg.sound === 'boolean') state.sound = cfg.sound;
      if (typeof cfg.rotateUp === 'boolean') state.rotateUp = cfg.rotateUp;
      if (typeof cfg.rotateAfterType === 'boolean') state.rotateAfterType = cfg.rotateAfterType;
      if (typeof cfg.layout === 'string' && KEYBOARD_LAYOUTS[cfg.layout]) state.layout = cfg.layout;
    } catch (err) {
      console.warn('Failed to restore saved state, using defaults.', err);
    }
  }

  function persistState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          config: {
            slots: state.slots,
            reflector: state.reflector,
            positions: state.positions,
            plugs: state.plugs,
            sound: state.sound,
            rotateUp: state.rotateUp,
            rotateAfterType: state.rotateAfterType,
            layout: state.layout,
          },
          customRotors: state.customRotors,
          customReflectors: state.customReflectors,
        }),
      );
    } catch (err) {
      console.warn('Failed to persist state.', err);
    }
  }

  function resetConfig() {
    var customRotors = state.customRotors;
    var customReflectors = state.customReflectors;
    Object.assign(state, defaultState(), { customRotors: customRotors, customReflectors: customReflectors });
    persistState();
  }

  function defOf(id) {
    var found = null;
    SAMPLE_ROTORS.forEach(function (r) { if (r.id === id) found = r; });
    if (!found) SAMPLE_REFLECTORS.forEach(function (r) { if (r.id === id) found = r; });
    if (!found) state.customRotors.forEach(function (r) { if (r.id === id) found = r; });
    if (!found) state.customReflectors.forEach(function (r) { if (r.id === id) found = r; });
    return found;
  }

  // Cryptographic randomness when the container provides it (Math.random is
  // predictable): used for custom-part IDs, random configurations and random
  // wirings. crypto.getRandomValues is not a container-restricted Web API.
  function randomInt(max) {
    var cryptoObj = global.crypto || global.msCrypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function' && max > 0 && max <= 4294967296) {
      var range = 4294967296; // 2^32 values from one Uint32 draw
      var limit = range - (range % max); // rejection sampling keeps draws uniform
      var buf = new Uint32Array(1);
      do {
        cryptoObj.getRandomValues(buf);
      } while (buf[0] >= limit);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function newCustomId() {
    return 'c' + Date.now().toString(36) + randomInt(1679616).toString(36).padStart(4, '0');
  }

  function currentAlphabet() {
    return defOf(state.reflector).mapSource;
  }

  /* ---------- alphabet compatibility ---------- */

  // Two alphabets are compatible when they contain the same characters,
  // regardless of order. "1234" and "3241" are the same alphabet.
  function sameCharSet(a, b) {
    var x = Array.from(a);
    var y = Array.from(b);
    return x.length === y.length && x.every(function (c) { return y.indexOf(c) !== -1; });
  }

  // Re-express a part (rotor/reflector) against a different ordering of the
  // same character set. The (source[i] -> table[i]) pairs are preserved, so
  // the part behaves exactly the same afterwards. Returns a new object.
  function normalizePartOrder(def, canonicalSource) {
    if (def.mapSource === canonicalSource) return def;
    if (!sameCharSet(def.mapSource, canonicalSource)) return def;
    var oldSource = Array.from(def.mapSource);
    var mapTable = Array.from(canonicalSource)
      .map(function (ch) { return def.mapTable[oldSource.indexOf(ch)]; })
      .join('');
    return Object.assign({}, def, { mapSource: canonicalSource, mapTable: mapTable });
  }

  function rotorsForCharSet(alpha) {
    return state.customRotors.concat(SAMPLE_ROTORS).filter(function (d) {
      return sameCharSet(d.mapSource, alpha);
    });
  }

  function reflectorsForCharSet(alpha) {
    return state.customReflectors.concat(SAMPLE_REFLECTORS).filter(function (d) {
      return sameCharSet(d.mapSource, alpha);
    });
  }

  // The config consumed by the JS engine (engine.js). The engine compares
  // map_source strings exactly, so every rotor wiring is re-expressed in the
  // reflector's order here.
  function buildConfig() {
    var ref = defOf(state.reflector);
    return {
      alphabet: ref.mapSource,
      rotors: state.slots.map(function (id, i) {
        var d = normalizePartOrder(defOf(id), ref.mapSource);
        return {
          name: d.name,
          map_table: d.mapTable,
          turnover: d.turnover || [],
          map_source: d.mapSource,
          position: ((state.positions[i] % d.mapSource.length) + d.mapSource.length) % d.mapSource.length,
        };
      }),
      reflector: { name: ref.name, map_table: ref.mapTable, map_source: ref.mapSource },
      plugs: state.plugs.map(function (p) { return [p[0], p[1]]; }),
      rotate_up: !!state.rotateUp,
      rotate_after_type: !!state.rotateAfterType,
    };
  }

  /* ---------- readiness ---------- */

  // The machine only runs once the reflector and every rotor share one
  // character set (order may differ; buildConfig normalises it).
  function machineReady() {
    if (!state.slots.length) return false;
    var ref = defOf(state.reflector);
    if (!ref) return false;
    return state.slots.every(function (id) {
      var d = defOf(id);
      return d && sameCharSet(d.mapSource, ref.mapSource);
    });
  }

  NS.store = {
    AZ: AZ,
    state: state,
    SAMPLE_ROTORS: SAMPLE_ROTORS,
    SAMPLE_REFLECTORS: SAMPLE_REFLECTORS,
    KEYBOARD_LAYOUTS: KEYBOARD_LAYOUTS,
    loadState: loadState,
    persistState: persistState,
    resetConfig: resetConfig,
    defOf: defOf,
    newCustomId: newCustomId,
    randomInt: randomInt,
    currentAlphabet: currentAlphabet,
    sameCharSet: sameCharSet,
    normalizePartOrder: normalizePartOrder,
    rotorsForCharSet: rotorsForCharSet,
    reflectorsForCharSet: reflectorsForCharSet,
    buildConfig: buildConfig,
    machineReady: machineReady,
  };
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
