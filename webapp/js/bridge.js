// bridge.js - boots Pyodide (CPython on WASM), installs myenigma and exposes
// a tiny JSON-in / JSON-out API.
//
// Loading order:
//   1. pyodide/ vendored next to the page (self-contained, works offline);
//   2. jsDelivr Pyodide distribution;
//   3. unpkg Pyodide npm package.
// The myenigma wheel is installed from wheels/ when the site was built with
// scripts/vendor_webapp.py, otherwise through micropip from PyPI.

const PYODIDE_VERSION = '314.0.1';

// Pyodide resolves `indexURL` differently for dynamic imports (relative to
// its own module) and fetches (relative to the page), so pass an absolute URL.
const LOCAL_BASE = new URL('pyodide/', document.baseURI).href;

const PYODIDE_SOURCES = [
  { label: '本地 runtime', base: LOCAL_BASE },
  { label: 'jsDelivr', base: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/` },
  { label: 'unpkg', base: `https://unpkg.com/pyodide@${PYODIDE_VERSION}/` },
];

const API_FUNCTIONS = ['api_press', 'api_validate_rotor', 'api_validate_reflector', 'api_info'];
const SCRIPT_TIMEOUT = 60000;
const RUNTIME_TIMEOUT = 180000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label}超时（${Math.round(ms / 1000)} 秒）`)), ms);
    }),
  ]);
}

async function installLocalWheel(pyodide, progress) {
  try {
    const meta = await fetch('wheels/index.json', { cache: 'no-cache' });
    if (!meta.ok) return false;
    const { wheel } = await meta.json();
    if (!wheel) return false;
    progress(`正在加载本地 myenigma wheel（${wheel}）…`);
    const response = await fetch('wheels/' + wheel);
    if (!response.ok) return false;
    const bytes = new Uint8Array(await response.arrayBuffer());
    pyodide.FS.mkdirTree('/tmp/pylib');
    pyodide.FS.writeFile('/tmp/myenigma.whl', bytes);
    await pyodide.runPythonAsync(`
import sys, zipfile
with zipfile.ZipFile('/tmp/myenigma.whl') as zf:
    zf.extractall('/tmp/pylib')
if '/tmp/pylib' not in sys.path:
    sys.path.insert(0, '/tmp/pylib')
`);
    return true;
  } catch (err) {
    console.warn('Local wheel install failed.', err);
    return false;
  }
}

async function installViaMicropip(pyodide, progress) {
  progress('正在从 PyPI 安装 myenigma…');
  await pyodide.loadPackage('micropip');
  const micropip = pyodide.pyimport('micropip');
  await micropip.install('myenigma');
}

async function trySource(source, progress) {
  progress(`正在从 ${source.label} 加载 Pyodide…`);
  const { loadPyodide } = await withTimeout(
    import(/* @vite-ignore */ source.base + 'pyodide.mjs'),
    SCRIPT_TIMEOUT,
    `${source.label} 脚本`,
  );
  const pyodide = await withTimeout(
    loadPyodide({ indexURL: source.base }),
    RUNTIME_TIMEOUT,
    `${source.label} 运行时`,
  );

  if (!(await installLocalWheel(pyodide, progress))) {
    await withTimeout(installViaMicropip(pyodide, progress), RUNTIME_TIMEOUT, 'PyPI 安装');
  }

  progress('正在初始化桥接 API…');
  const response = await fetch('python/enigma_api.py');
  if (!response.ok) throw new Error(`无法加载 python/enigma_api.py (HTTP ${response.status})`);
  await pyodide.runPythonAsync(await response.text());

  const api = {};
  for (const name of API_FUNCTIONS) {
    const fn = pyodide.globals.get(name);
    if (!fn) throw new Error(`桥接缺少函数 ${name}`);
    api[name] = (...args) => JSON.parse(fn(...args));
  }
  return api;
}

export async function bootBridge(onProgress) {
  const progress = onProgress || (() => {});
  let lastError = null;
  for (const source of PYODIDE_SOURCES) {
    try {
      return await trySource(source, progress);
    } catch (err) {
      lastError = err;
      console.warn(`Pyodide source "${source.label}" failed:`, err);
      progress(`${source.label} 不可用，尝试下一个来源…`);
    }
  }
  throw new Error(
    lastError ? `无法加载 Pyodide：${lastError.message}` : '无法加载 Pyodide（未知错误）',
  );
}
