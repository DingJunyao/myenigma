// Smoke test: load the vendored Pyodide runtime and the local myenigma wheel
// from webapp/ exactly like the browser does, then encrypt through the bridge
// API and compare with the library's documented output.
//
// Requires `python scripts/vendor_webapp.py --skip-build` to have run first.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'webapp');
const pyodideDir = path.join(site, 'pyodide');

const { loadPyodide } = await import(pathToFileURL(path.join(pyodideDir, 'pyodide.mjs')).href);

const pyodide = await loadPyodide({ indexURL: pyodideDir + path.sep });
console.log('python', pyodide.runPython('import sys; sys.version.split()[0]'));

const wheelName = JSON.parse(readFileSync(path.join(site, 'wheels', 'index.json'), 'utf8')).wheel;
const wheelBytes = new Uint8Array(readFileSync(path.join(site, 'wheels', wheelName)));
pyodide.FS.mkdirTree('/tmp/pylib');
pyodide.FS.writeFile('/tmp/myenigma.whl', wheelBytes);
await pyodide.runPythonAsync(`
import sys, zipfile
with zipfile.ZipFile('/tmp/myenigma.whl') as zf:
    zf.extractall('/tmp/pylib')
sys.path.insert(0, '/tmp/pylib')
import myenigma  # noqa: F401
`);
await pyodide.runPythonAsync(readFileSync(path.join(site, 'python', 'enigma_api.py'), 'utf8'));

const az = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const config = {
  alphabet: az,
  rotors: [
    { name: 'III', map_table: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', turnover: ['V'], map_source: az, position: 0 },
    { name: 'II', map_table: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', turnover: ['E'], map_source: az, position: 0 },
    { name: 'I', map_table: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', turnover: ['Q'], map_source: az, position: 0 },
  ],
  reflector: { name: 'B', map_table: 'YRUHQSLDPXNGOKMIEBFZCWVJAT', map_source: az },
  plugs: [],
};

const press = pyodide.globals.get('api_press');
const expected = 'ILBDAAMTAZIJNXSCSIJJPDDWZBRCCUPGQXGRJXQOFGHL';
let positions = [0, 0, 0];
let cipher = '';
for (const ch of 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO') {
  const cfg = JSON.parse(JSON.stringify(config));
  cfg.rotors.forEach((r, i) => {
    r.position = positions[i];
  });
  const result = JSON.parse(press(JSON.stringify(cfg), ch));
  if (result.error) throw new Error(result.error);
  positions = result.positions;
  cipher += result.output;
}
if (cipher !== expected) throw new Error(`cipher mismatch:\n  ${cipher}\n  ${expected}`);
console.log('BRIDGE OK:', cipher);
