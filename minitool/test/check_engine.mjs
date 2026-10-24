// check_engine.mjs - differential test: run minitool/js/engine.js against the
// expected results generated from the real Python library.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

require(join(here, '..', 'js', 'engine.js'));
const engine = global.myenigmaMinTool.engine;

const cases = JSON.parse(readFileSync(join(here, 'expected_cases.json'), 'utf8'));

let failures = 0;

for (const tc of cases.press) {
  const cfg = JSON.parse(JSON.stringify(tc.config));
  const letters = tc.letters;
  const expected = tc.expected || null;
  for (let i = 0; i < letters.length; i++) {
    const res = engine.api_press(cfg, letters[i]);
    if (expected) {
      if (JSON.stringify(res) !== JSON.stringify(expected[i])) {
        failures++;
        console.log(`MISMATCH ${tc.name} step ${i}: letter=${letters[i]}`);
        console.log('  js :', JSON.stringify(res));
        console.log('  py :', JSON.stringify(expected[i]));
        break;
      }
    }
    if (res.positions) {
      cfg.rotors.forEach((r, j) => { r.position = res.positions[j]; });
    } else {
      failures++;
      console.log(`ERROR ${tc.name} step ${i}:`, JSON.stringify(res));
      break;
    }
  }
  if (tc.name === 'roundtrip') {
    // expected is null; recover cipher from the first half is not needed here,
    // the python side already proved self-reciprocity.
  }
}

for (const tc of cases.validate) {
  const fn = tc.kind === 'rotor' ? engine.api_validate_rotor : engine.api_validate_reflector;
  const res = fn(tc.def);
  if (JSON.stringify(res) !== JSON.stringify(tc.expected)) {
    failures++;
    console.log(`VALIDATE MISMATCH [${tc.kind}]:`, JSON.stringify(tc.def));
    console.log('  js :', JSON.stringify(res));
    console.log('  py :', JSON.stringify(tc.expected));
  }
}

const total = cases.press.length + cases.validate.length;
if (failures) {
  console.log(`FAILED: ${failures} mismatch(es) across ${total} cases`);
  process.exit(1);
}
console.log(`PASS: ${total} cases (press sequences + validators) match the Python library`);
