// Checks that every i18n key referenced by data-i18n* attributes or t() calls
// exists in the English dictionary (webapp/js/i18n.js).
// Run with: node scripts/i18n_check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { EN_KEYS } = await import(pathToFileURL(path.join(root, 'webapp', 'js', 'i18n.js')).href);

const html = readFileSync(path.join(root, 'webapp', 'index.html'), 'utf8');
const jsFiles = ['main.js', 'machine.js', 'editor.js', 'bridge.js']
  .map((f) => readFileSync(path.join(root, 'webapp', 'js', f), 'utf8'));

const used = new Set();
for (const m of html.matchAll(/data-i18n(?:-html|-ph|-title|-aria)?="([^"]+)"/g)) used.add(m[1]);
for (const src of jsFiles) {
  for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1]);
}

const missing = [...used].filter((k) => !EN_KEYS.has(k));
assert.deepEqual(missing, [], `missing i18n keys: ${missing.join(', ')}`);
console.log(`I18N OK (${used.size} keys)`);
