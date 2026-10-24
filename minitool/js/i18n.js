// i18n.js - minimal i18n for the minitool.
//
// Chinese is the source of truth: it lives in the markup / JS defaults.
// English translations live in EN below. The language is detected from the
// container on first visit and can be changed in the Settings dialog
// (persisted under myenigma.lang).
//
// Classic script (no modules): everything hangs off window.myenigmaMinTool.

(function (global) {
  'use strict';

  var NS = (global.myenigmaMinTool = global.myenigmaMinTool || {});

  var LANG_KEY = 'myenigma.lang';

  var lang = null;

  var EN = {
    'menu.open': 'Open menu',
    'btn.zero': 'Zero',
    'btn.zero.title': 'Set all rotors back to position A',
    'btn.random': 'Randomize',
    'btn.random.title': 'Random rotors, positions & plugs',
    'btn.factory': 'Defaults',
    'btn.factory.title': 'Factory configuration (keeps custom parts)',
    'sound.on': '🔊 Sound on',
    'sound.off': '🔇 Sound off',
    'btn.settings': 'Settings',
    'btn.help': 'Help',
    'close': 'Close',
    'reflector.title': 'Click to swap / create the reflector',
    'slot.add.title': 'Add a rotor (max 4)',
    'slot.del.title': 'Remove the leftmost rotor',
    'tape.caption': 'FUNKSPRUCH · Paper Tape',
    'tape.paste': 'Paste & encrypt',
    'tape.paste.short': 'Paste',
    'tape.paste.title': 'Open the paste box',
    'tape.copyPlain': 'Show plain',
    'tape.copyCipher': 'Show cipher',
    'tape.clear': 'Clear',
    'tape.copyPlain.short': 'Plain',
    'tape.copyCipher.short': 'Cipher',
    'tape.clear.short': 'Clear',
    'tape.copyPlain.title': 'Show the whole plaintext',
    'tape.copyCipher.title': 'Show the whole ciphertext',
    'alt.send': 'Send',
    'footer.loading': 'Encryption engine ready',
    'tape.label.plain': 'Plain',
    'tape.label.cipher': 'Cipher',
    'tape.hint': 'Type on the keyboard, or paste text anywhere to start encrypting',
    'alt.output': 'AUSGABE · Output',
    'alt.placeholder': 'Type or paste text (IME supported)',
    'alt.plugs': 'STECKER · Plugs (click two characters to connect, click a connected one to remove)',
    'settings.title': 'Settings',
    'settings.rotateUp': 'rotate_up (reverse stepping)',
    'settings.rotateUp.hint': 'Rotation direction of the rotors. Standard Enigma keeps this off; the tiny CJK example needs it on.',
    'settings.rotateAfter': 'rotate_after_type (step after typing)',
    'settings.rotateAfter.hint': 'Step timing: on = encrypt first, then step; off (standard) = step first, then encrypt.',
    'settings.layout': 'Keyboard layout',
    'settings.layout.hint': 'On-screen keyboard arrangement, 26 Latin letters only; physical typing is unaffected.',
    'layout.qwertz': 'QWERTZ (standard Enigma)',
    'layout.qwerty': 'QWERTY',
    'layout.azerty': 'AZERTY',
    'layout.dvorak': 'Dvorak',
    'layout.abc': 'A–Z alphabetical',
    'settings.lang': 'Language',
    'settings.lang.hint': 'Interface language (detected by default).',
    'lang.zh': '中文',
    'lang.en': 'English',
    'done': 'Done',
    'inventory.rotors': 'Rotor warehouse',
    'inventory.slot': 'Swap rotor in slot {n}',
    'inventory.reflectors': 'Reflector warehouse',
    'inventory.hint': 'Custom parts are stored on this device',
    'inventory.newRotor': '＋ New rotor',
    'inventory.newReflector': '＋ New reflector',
    'install.slot': 'Install into slot {n}',
    'install': 'Install',
    'use': 'Use',
    'edit': 'Edit',
    'delete': 'Delete',
    'card.turnover': 'Turnover: {t}',
    'card.turnover.default': 'default (last character)',
    'card.alphabet': 'Alphabet {a}',
    'editor.title.rotor': 'Rotor editor',
    'editor.title.rotorNew': 'New rotor',
    'editor.title.rotorEdit': 'Edit rotor',
    'editor.title.reflector': 'Reflector editor',
    'editor.title.reflectorNew': 'New reflector',
    'editor.title.reflectorEdit': 'Edit reflector',
    'editor.name': 'Name',
    'editor.alphabet': 'Alphabet map_source (distinct characters, default A–Z)',
    'editor.alphabet.note': 'The whole machine shares one alphabet: when the reflector and all rotors match, the keyboard/lamps/plugboard enable; order-only differences count as the same alphabet (wiring is re-expressed automatically). Non-26-Latin alphabets swap the panels for a generic character panel.',
    'editor.wiring': 'Wiring map_table (character i = what alphabet character i maps to)',
    'editor.turnover': 'Turnover (carries the rotor to the left when stepped past; none = last character)',
    'editor.identity': 'Identity',
    'editor.random': 'Random wiring',
    'editor.cancel': 'Cancel',
    'editor.save': 'Save',
    'editor.valid': '✓ Wiring is valid',
    'editor.err.charset': 'The alphabet must consist of distinct characters',
    'editor.err.length': 'Wiring must be {n} characters long',
    'editor.err.repeat': 'Wiring characters must not repeat',
    'editor.err.foreign': 'Wiring contains "{c}" which is not in the alphabet',
    'editor.err.oddRandom': 'A random reflector needs an even-length alphabet',
    'editor.defaultRotorName': 'Custom Rotor {n}',
    'editor.defaultReflectorName': 'Custom Reflector {n}',
    'help.title': 'Help',
    'help.done': 'Got it',
    'help.body': `<ol>
<li><b>Encrypt</b>: type on your keyboard (or click the keys) — the lit lamp shows the ciphertext; the paper tape logs “plain › cipher”.</li>
<li><b>Adjust rotors</b>: use the ▲▼ buttons or scroll on a rotor disc; the machine steps automatically before each encryption, just like the real one.</li>
<li><b>Swap rotors</b>: click a rotor disc to open the warehouse — install I–VIII, Beta, Gamma, or edit and create custom rotors with your own wiring, turnover, even a custom alphabet (e.g. “甲乙丙丁”).</li>
<li><b>Plugboard</b>: click one socket, then another to connect a cable; click a cable or a connected socket to remove it. Up to 10 cables, like the real machine.</li>
<li><b>Reflector</b>: click the reflector window (top left) to switch B / C / B-thin / C-thin or create your own.</li>
<li><b>Decrypt</b>: the Enigma is self-reciprocal — set the rotors back to the starting position and type the ciphertext; the plaintext lights up.</li>
<li><b>Paste to type</b>: paste text into the input box on generic-alphabet machines — characters outside the alphabet are ignored and the rest is encrypted at a steady pace (press Esc to stop).</li>
<li><b>Keyboard layout</b>: choose QWERTZ / QWERTY / AZERTY / Dvorak / A–Z in the Settings dialog (26 Latin letters only; rows mirror the real keyboards; physical typing is unaffected). On phones the keys enlarge to fill the row.</li>
<li><b>Mechanics</b>: “rotate_up” and “rotate_after_type” in the Settings dialog map to the library's Enigma constructor flags; enable both to reproduce the tiny CJK example (甲乙丙丁).</li>
<li><b>Custom alphabets</b>: rotors and reflectors can be created and swapped freely, but the machine requires one shared alphabet — keyboard, lamps and plugboard enable once everything matches (a hint appears above). For non-Latin alphabets they are replaced by a generic character panel: click characters, or type in the box and press Send / Enter.</li>
</ol>
<p>Everything is computed inside this page by a pure-JavaScript engine with the exact algorithm of the myenigma Python library — <b>no backend server, no network access</b>. Your parts and settings stay on this device.</p>`,
    'copy.title.plain': 'Plaintext',
    'copy.title.cipher': 'Ciphertext',
    'copy.hint': 'One-tap copy is unavailable here: press and hold (or drag-select) the text below to copy it manually.',
    'paste.title': 'Paste text',
    'paste.hint': 'The clipboard cannot be read automatically here: long-press the box below, choose Paste, then tap Send.',
    'paste.placeholder': 'Paste the text to encrypt here…',
    'plug.count': '{n}/{max} · {left} cables left',
    'plugs.none': 'No cables ({left} left)',
    'plugs.some': 'Connected: {pairs} ({left} left)',
    'ready.hint': '⚠ Alphabets not unified: reflector is "{ref}", rotors [{list}] do not match. Install matching rotors from the warehouse — the keyboard/lamps/plugboard enable automatically once complete.',
    'machine.disc.title': 'Click to swap the rotor; scroll or use the arrows to turn it',
    'machine.notch.title': 'Turnover (stepping past this character carries the next rotor)',
    'machine.step': 'Turn',
    'machine.back': 'Turn back',
    'machine.socket.title': 'Plug {c}',
    'toast.engine': 'Engine error: {msg}',
    'toast.notReady.input': 'Alphabet not unified — input is disabled',
    'toast.notReady.random': 'Alphabet not unified — cannot randomize',
    'toast.noChars': 'The text contains no characters of the current alphabet',
    'toast.stopped': 'Input stopped',
    'toast.zeroed': 'All rotors zeroed',
    'toast.randomized': 'Random configuration generated',
    'toast.factory': 'Defaults restored (custom parts kept)',
    'toast.slotMax': 'At most 4 rotors (M4)',
    'toast.noCompatible': 'No compatible rotor in the warehouse — create one first',
    'toast.added': 'Installed "{name}" (leftmost)',
    'toast.minOne': 'Keep at least one rotor',
    'toast.removed': 'Removed {name}',
    'toast.installed': 'Installed "{name}" into slot {n}',
    'toast.installedPartial': 'Installed "{name}" — keyboard enables when alphabets match',
    'toast.used': 'Switched to {name}',
    'toast.usedPartial': 'Switched to {name}; keyboard enables when rotors match',
    'toast.savedRotor': 'Rotor "{name}" saved',
    'toast.savedReflector': 'Reflector "{name}" saved — pick it in the reflector warehouse',
    'toast.plugMax': 'The plugboard allows at most 10 cables',
    'toast.rotateUpOn': 'rotate_up enabled',
    'toast.rotateUpOff': 'Default rotation direction restored',
    'toast.rotateAfterOn': 'Stepping after typing enabled',
    'toast.rotateAfterOff': 'Stepping before typing restored',
    'toast.layout': 'Keyboard layout: {name}',
    'toast.tapeEmpty': 'The tape is empty',
    'toast.copied': '{label} shown — copy it from the dialog',
    'label.plain': 'plaintext',
    'label.cipher': 'ciphertext',
    'toast.inUse.rotor': 'This rotor is installed — swap it out before deleting',
    'toast.inUse.reflector': 'This reflector is in use and cannot be deleted',
    'toast.deleted': 'Deleted {name}',
    'footer.engine': 'Engine myenigma v{v} · pure JavaScript (same algorithm as the Python library) — offline',
  };

  function detectLang() {
    try {
      var stored = localStorage.getItem(LANG_KEY);
      if (stored === 'zh' || stored === 'en') return stored;
    } catch (err) { /* no storage */ }
    var navLang = (typeof navigator !== 'undefined' && navigator.language) || 'zh-CN';
    return navLang.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
  }

  function getLang() {
    return lang;
  }

  // zhDefault is the Chinese source text; when lang is 'zh' it is returned as-is,
  // when 'en' the EN dictionary entry is used (falling back to zhDefault).
  function t(key, zhDefault, vars) {
    vars = vars || {};
    var text = lang === 'en' && EN[key] ? EN[key] : (zhDefault !== undefined && zhDefault !== null ? zhDefault : key);
    for (var k in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, k)) {
        text = text.split('{' + k + '}').join(String(vars[k]));
      }
    }
    return text;
  }

  function original(el, attr) {
    var store = el.__i18n || (el.__i18n = {});
    var k = attr || 'text';
    if (!(k in store)) store[k] = attr ? el.getAttribute(attr) : el.textContent;
    return store[k];
  }

  // Replace text of [data-i18n], html of [data-i18n-html], placeholder of
  // [data-i18n-ph] and title of [data-i18n-title] according to the language.
  function applyI18n(root) {
    root = root || document;
    var nodes = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      (function (el) { el.textContent = t(el.dataset.i18n, original(el, '')); })(nodes[i]);
    }
    var htmls = root.querySelectorAll('[data-i18n-html]');
    for (var h = 0; h < htmls.length; h++) {
      (function (el) { el.innerHTML = t(el.dataset.i18nHtml, original(el, '')); })(htmls[h]);
    }
    var phs = root.querySelectorAll('[data-i18n-ph]');
    for (var p = 0; p < phs.length; p++) {
      (function (el) { el.placeholder = t(el.dataset.i18nPh, original(el, 'placeholder')); })(phs[p]);
    }
    var titles = root.querySelectorAll('[data-i18n-title]');
    for (var x = 0; x < titles.length; x++) {
      (function (el) { el.title = t(el.dataset.i18nTitle, original(el, 'title')); })(titles[x]);
    }
    var arias = root.querySelectorAll('[data-i18n-aria]');
    for (var a = 0; a < arias.length; a++) {
      (function (el) { el.setAttribute('aria-label', t(el.dataset.i18nAria, original(el, 'aria'))); })(arias[a]);
    }
  }

  function setLang(next) {
    lang = next;
    try { localStorage.setItem(LANG_KEY, next); } catch (err) { /* private mode */ }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
    }
    applyI18n();
    global.dispatchEvent(new CustomEvent('langchange'));
  }

  lang = detectLang();
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }

  NS.i18n = {
    t: t,
    applyI18n: applyI18n,
    setLang: setLang,
    getLang: getLang,
    detectLang: detectLang,
    EN: EN,
  };
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
