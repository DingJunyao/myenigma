// Smoke test for on-screen keyboard rows (webapp/js/machine.js).
// Run with: node scripts/keyboard_smoke.mjs
//
// Every layout mirrors its real physical keyboard:
// QWERTZ 9/8/9 · QWERTY 10/9/7 · AZERTY 10/9/6 · Dvorak 7/10/9 · A–Z 9/9/8.
import assert from 'node:assert/strict';
import { rowsFor } from '../webapp/js/machine.js';
import { state } from '../webapp/js/store.js';

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

assert.equal(state.layout, 'qwertz', 'default layout is QWERTZ');
assert.deepEqual(
  rowsFor(AZ).map((r) => r.join('')),
  ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'],
);

state.layout = 'qwerty';
assert.deepEqual(
  rowsFor(AZ).map((r) => r.join('')),
  ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
);

state.layout = 'azerty';
assert.deepEqual(
  rowsFor(AZ).map((r) => r.join('')),
  ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'],
);

state.layout = 'dvorak';
assert.deepEqual(
  rowsFor(AZ).map((r) => r.join('')),
  ['PYFGCRL', 'AOEUIDHTNS', 'QJKXBMWVZ'],
);

state.layout = 'abc';
assert.deepEqual(
  rowsFor(AZ).map((r) => r.join('')),
  ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ'],
);
state.layout = 'qwertz';

// Custom alphabets: three roughly even rows.
assert.deepEqual(
  rowsFor('甲乙丙丁').map((r) => r.join('')),
  ['甲乙', '丙', '丁'],
);
const long = rowsFor(AZ + '0123456789');
assert.equal(long.length, 3);
assert.equal(long.flat().join('').length, 36);

console.log('KEYBOARD OK');
