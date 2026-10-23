// Smoke test for alphabet compatibility (order-insensitive) and readiness.
// Run with: node scripts/alphabet_smoke.mjs
import assert from 'node:assert/strict';
import { state, machineReady, buildConfig, sameCharSet, normalizePartOrder } from '../webapp/js/store.js';

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// 1. Compatibility is about the character set, not the order.
assert.equal(sameCharSet('1234', '3241'), true);
assert.equal(sameCharSet('1234', '1235'), false);
assert.equal(sameCharSet('甲乙丙丁', '丁丙乙甲'), true);

// 2. Normalising to another order preserves every letter pair.
const rotor = { id: 'r', name: 'R', mapSource: '3241', mapTable: 'DCBA', turnover: [], custom: true };
// pairs: 3->D, 2->C, 4->B, 1->A
const norm = normalizePartOrder(rotor, '1234');
assert.equal(norm.mapSource, '1234');
assert.equal(norm.mapTable, 'ACDB'); // pairs: 1->A, 2->C, 3->D, 4->B (unchanged behaviour)
assert.equal(rotor.mapSource, '3241', 'original definition stays untouched');

function reset() {
  state.slots = ['III', 'II', 'I'];
  state.reflector = 'B';
  state.positions = [0, 0, 0];
  state.plugs = [];
  state.customRotors = [];
  state.customReflectors = [];
}

// 3. Readiness ignores order: reflector "3241" + rotor "1234" are compatible.
reset();
state.customReflectors.push({ id: 'rx', name: 'RX', mapTable: '2143', mapSource: '3241', custom: true });
state.reflector = 'rx';
state.customRotors.push({ id: 'c1', name: 'C1', mapTable: '2143', turnover: [], mapSource: '1234', custom: true });
state.slots = ['c1', 'c1', 'c1'];
assert.equal(machineReady(), true, 'order-only difference must be compatible');

// 4. buildConfig re-expresses every rotor in the reflector's order, and the
//    Python library (which compares map_source strings) accepts the config.
const cfg = buildConfig();
assert.equal(cfg.alphabet, '3241');
assert.ok(cfg.rotors.every((r) => r.map_source === '3241'));
// rotor pairs 1->2,2->1,3->4,4->3 re-expressed on "3241" become 3->4,2->1,4->3,1->2
assert.equal(cfg.rotors[0].map_table, '4132');

// 5. Truly different character sets still count as incompatible.
state.customRotors.push({ id: 'az', name: 'AZ', mapTable: AZ, turnover: [], mapSource: AZ, custom: true });
state.slots = ['az', 'c1', 'c1'];
assert.equal(machineReady(), false, 'different character sets stay incompatible');

console.log('ALPHABET OK');
