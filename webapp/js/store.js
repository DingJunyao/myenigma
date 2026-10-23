// store.js - sample catalogue, machine state and localStorage persistence.

export const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const SAMPLE_ROTORS = [
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

export const SAMPLE_REFLECTORS = [
  { id: 'B', name: 'Reflector B', mapTable: 'YRUHQSLDPXNGOKMIEBFZCWVJAT', mapSource: AZ },
  { id: 'C', name: 'Reflector C', mapTable: 'FVPJIAOYEDRZXWGCTKUQSBNMHL', mapSource: AZ },
  { id: 'B-THIN', name: 'Reflector B Thin', mapTable: 'ENKQAUYWJICOPBLMDXZVFTHRGS', mapSource: AZ },
  { id: 'C-THIN', name: 'Reflector C Thin', mapTable: 'RDOBJNTKVEHMLFCWZAXGYIPSUQ', mapSource: AZ },
];

const STORAGE_KEY = 'myenigma.webdemo.v1';

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

export const state = defaultState();

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.customRotors)) state.customRotors = saved.customRotors;
    if (Array.isArray(saved.customReflectors)) state.customReflectors = saved.customReflectors;
    const cfg = saved.config || {};
    if (Array.isArray(cfg.slots) && cfg.slots.length >= 1 && cfg.slots.every((s) => defOf(s))) {
      state.slots = cfg.slots.slice(0, 4);
      state.positions = Array.isArray(cfg.positions)
        ? cfg.positions.slice(0, state.slots.length).map((p) => (Number.isInteger(p) ? p : 0))
        : state.slots.map(() => 0);
      while (state.positions.length < state.slots.length) state.positions.push(0);
    }
    if (typeof cfg.reflector === 'string' && defOf(cfg.reflector)) state.reflector = cfg.reflector;
    if (Array.isArray(cfg.plugs)) {
      state.plugs = cfg.plugs.filter(
        (p) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string',
      );
    }
    if (typeof cfg.sound === 'boolean') state.sound = cfg.sound;
    if (typeof cfg.rotateUp === 'boolean') state.rotateUp = cfg.rotateUp;
    if (typeof cfg.rotateAfterType === 'boolean') state.rotateAfterType = cfg.rotateAfterType;
    if (typeof cfg.layout === 'string' && KEYBOARD_LAYOUTS[cfg.layout]) state.layout = cfg.layout;
  } catch (err) {
    console.warn('Failed to restore saved state, using defaults.', err);
  }
}

export function persistState() {
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

export function resetConfig() {
  const customRotors = state.customRotors;
  const customReflectors = state.customReflectors;
  Object.assign(state, defaultState(), { customRotors, customReflectors });
  persistState();
}

export function defOf(id) {
  return (
    SAMPLE_ROTORS.find((r) => r.id === id) ||
    SAMPLE_REFLECTORS.find((r) => r.id === id) ||
    state.customRotors.find((r) => r.id === id) ||
    state.customReflectors.find((r) => r.id === id) ||
    null
  );
}

export function newCustomId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function currentAlphabet() {
  return defOf(state.reflector).mapSource;
}

// On-screen keyboard arrangements, one entry per physical row (like the
// real keyboards): QWERTZ 9/8/9, QWERTY 10/9/7, AZERTY 10/9/6,
// Dvorak 7/10/9, A–Z alphabetical 9/9/8.
export const KEYBOARD_LAYOUTS = {
  qwertz: ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'],
  qwerty: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
  azerty: ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'],
  dvorak: ['PYFGCRL', 'AOEUIDHTNS', 'QJKXBMWVZ'],
  abc: ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ'],
};

/* ---------- alphabet compatibility ---------- */

// Two alphabets are compatible when they contain the same characters,
// regardless of order. "1234" and "3241" are the same alphabet.
export function sameCharSet(a, b) {
  const x = Array.from(a);
  const y = Array.from(b);
  return x.length === y.length && x.every((c) => y.includes(c));
}

// Re-express a part (rotor/reflector) against a different ordering of the
// same character set. The (source[i] -> table[i]) pairs are preserved, so
// the part behaves exactly the same afterwards. Returns a new object.
export function normalizePartOrder(def, canonicalSource) {
  if (def.mapSource === canonicalSource) return def;
  if (!sameCharSet(def.mapSource, canonicalSource)) return def;
  const oldSource = Array.from(def.mapSource);
  const mapTable = Array.from(canonicalSource)
    .map((ch) => def.mapTable[oldSource.indexOf(ch)])
    .join('');
  return { ...def, mapSource: canonicalSource, mapTable };
}

export function rotorsForCharSet(alpha) {
  return [...state.customRotors, ...SAMPLE_ROTORS].filter((d) => sameCharSet(d.mapSource, alpha));
}

export function reflectorsForCharSet(alpha) {
  return [...state.customReflectors, ...SAMPLE_REFLECTORS].filter((d) => sameCharSet(d.mapSource, alpha));
}

// The JSON config consumed by the Python bridge (enigma_api.py).
// The Python library compares map_source strings exactly, so every rotor
// wiring is re-expressed in the reflector's order here.
export function buildConfig() {
  const ref = defOf(state.reflector);
  return {
    alphabet: ref.mapSource,
    rotors: state.slots.map((id, i) => {
      const d = normalizePartOrder(defOf(id), ref.mapSource);
      return {
        name: d.name,
        map_table: d.mapTable,
        turnover: d.turnover || [],
        map_source: d.mapSource,
        position: ((state.positions[i] % d.mapSource.length) + d.mapSource.length) % d.mapSource.length,
      };
    }),
    reflector: { name: ref.name, map_table: ref.mapTable, map_source: ref.mapSource },
    plugs: state.plugs.map((p) => [p[0], p[1]]),
    rotate_up: !!state.rotateUp,
    rotate_after_type: !!state.rotateAfterType,
  };
}

/* ---------- readiness ---------- */

// The machine only runs once the reflector and every rotor share one
// character set (order may differ; buildConfig normalises it).
export function machineReady() {
  if (!state.slots.length) return false;
  const ref = defOf(state.reflector);
  if (!ref) return false;
  return state.slots.every((id) => {
    const d = defOf(id);
    return d && sameCharSet(d.mapSource, ref.mapSource);
  });
}
