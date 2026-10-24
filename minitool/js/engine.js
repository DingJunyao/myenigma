// engine.js - pure-JavaScript port of the myenigma Python library
// (Enigma machine model), replacing the WASM/Pyodide runtime which the
// minitool container forbids. The algorithm mirrors src/myenigma/ exactly:
// Plate / Rotor / Reflector / EntryPlate / Plugboard / Enigma.
//
// The bridge API keeps the same shape as python/enigma_api.py so the UI code
// behaves identically: every call rebuilds the machine from the config and
// returns plain objects (no Python objects involved).

(function (global) {
  'use strict';

  var NS = (global.myenigmaMinTool = global.myenigmaMinTool || {});

  var AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function toChars(str) {
    return Array.from(String(str));
  }

  function hasDistinctChars(str) {
    var chars = toChars(str);
    var seen = {};
    for (var i = 0; i < chars.length; i++) {
      if (seen[chars[i]]) return false;
      seen[chars[i]] = true;
    }
    return true;
  }

  /* ---------- Plate ---------- */

  function Plate(mapTable, initPosition, autoRotatable, rightPlate, leftPlate, rotateUp, name, mapSource) {
    mapTable = mapTable === undefined ? AZ : mapTable;
    mapSource = mapSource === undefined ? AZ : mapSource;
    Plate.mapTableCheck(mapTable, mapSource);

    // A Map keeps insertion order (Python dicts do too) even for
    // integer-like characters such as digits in a custom alphabet.
    var sourceChars = toChars(mapSource);
    var tableChars = toChars(mapTable);
    this.dictTable = new Map();
    for (var i = 0; i < sourceChars.length; i++) {
      this.dictTable.set(sourceChars[i], tableChars[i]);
    }

    if (typeof initPosition === 'string') {
      if (toChars(initPosition).length !== 1 || sourceChars.indexOf(initPosition) === -1) {
        throw initPositionError(initPosition, sourceChars.length);
      }
      this.position = sourceChars.indexOf(initPosition);
    } else if (typeof initPosition === 'number' && isFinite(initPosition)) {
      if (initPosition >= 0 && initPosition < tableChars.length) {
        this.position = initPosition;
      } else {
        throw initPositionError(initPosition, sourceChars.length);
      }
    } else {
      throw initPositionError(initPosition, sourceChars.length);
    }

    this.autoRotatable = !!autoRotatable;
    this.rightPlate = rightPlate || null;
    this.leftPlate = leftPlate || null;
    this.rotateUp = !!rotateUp;
    this.name = name === undefined ? null : name;
    this.mapSource = mapSource;
    this.turnover = [];
  }

  function initPositionError(value, sourceLen) {
    return new Error(
      'init_position "' + value + '" is invalid. ' +
      'A letter string in map_source or an int between 0 and ' + (sourceLen - 1) + ' is required.'
    );
  }

  Plate.mapTableCheck = function (mapTable, mapSource) {
    if (!hasDistinctChars(mapSource)) {
      throw new Error('map_source "' + mapSource + '" is invalid. It must be str with different letters.');
    }
    var sourceLen = toChars(mapSource).length;
    var tableChars = toChars(mapTable);
    var seen = {};
    for (var i = 0; i < tableChars.length; i++) {
      seen[tableChars[i]] = true;
    }
    if (Object.keys(seen).length !== sourceLen || tableChars.length !== sourceLen) {
      throw new Error(
        'map_table "' + mapTable + '" is invalid. ' +
        'It must be str with different letters, and every letter is in map_source "' + mapSource + '".'
      );
    }
    var sourceChars = toChars(mapSource);
    for (var j = 0; j < sourceChars.length; j++) {
      if (tableChars.indexOf(sourceChars[j]) === -1) {
        throw new Error('"' + sourceChars[j] + '" not in map table.');
      }
    }
  };

  Plate.prototype.currentRight = function () {
    var right = Array.from(this.dictTable.keys());
    var shift = (-2 * (this.rotateUp ? 1 : 0) + 1) * this.position;
    return right.slice(shift).concat(right.slice(0, shift));
  };

  Plate.prototype.transformLetter = function (letter, fromPlate) {
    var letterIndex = fromPlate.currentRight().indexOf(letter);
    return this.currentRight()[letterIndex];
  };

  Plate.prototype.encrypt = function (letter, letterFrom) {
    if (
      typeof letter !== 'string' || toChars(letter).length !== 1 ||
      toChars(this.mapSource).indexOf(letter) === -1
    ) {
      throw new Error('Input "' + letter + '" is invalid. A letter string in map_source is required.');
    }
    var fromPlate = letterFrom === 'left' ? this.leftPlate : this.rightPlate;
    if (fromPlate) {
      letter = this.transformLetter(letter, fromPlate);
    }
    var sourceChars = Array.from(this.dictTable.keys());
    var self = this;
    var tableChars = sourceChars.map(function (k) { return self.dictTable.get(k); });
    if (letterFrom === 'left') {
      var keyIndex = tableChars.indexOf(letter);
      return sourceChars[keyIndex];
    }
    return this.dictTable.get(letter);
  };

  Plate.prototype.setPosition = function (position) {
    var sourceChars = toChars(this.mapSource);
    var positionInt = null;
    if (typeof position === 'string') {
      var idx = sourceChars.indexOf(position);
      if (idx !== -1) positionInt = idx;
    } else if (typeof position === 'number' && isFinite(position)) {
      if (position >= 0 && position < sourceChars.length) positionInt = position;
    }
    if (positionInt === null) {
      throw new Error(
        'position "' + position + '" is invalid. ' +
        'A letter string in map_source or an int between 0 and ' + (sourceChars.length - 1) + ' is required.'
      );
    }
    this.position = positionInt;
  };

  /* ---------- Rotor ---------- */

  function Rotor(mapTable, options) {
    options = options || {};
    var initPosition = options.initPosition === undefined ? 0 : options.initPosition;
    Plate.call(this, mapTable, initPosition, true, options.rightPlate, options.leftPlate,
      options.rotateUp, options.name, options.mapSource === undefined ? AZ : options.mapSource);

    var sourceChars = toChars(this.mapSource);
    var turnover = options.turnover === undefined || options.turnover === null ? null : options.turnover;
    if (turnover === null || (typeof turnover !== 'string' && !turnover.length)) {
      turnover = sourceChars[sourceChars.length - 1];
    }
    var items = typeof turnover === 'string' ? [turnover] : Array.prototype.slice.call(turnover);
    var list = [];
    for (var i = 0; i < items.length; i++) {
      list.push(standardizeTurnover(items[i], sourceChars));
    }
    this.turnover = list;
  }

  Rotor.prototype = Object.create(Plate.prototype);
  Rotor.prototype.constructor = Rotor;

  function standardizeTurnover(value, sourceChars) {
    if (typeof value === 'string') {
      var idx = sourceChars.indexOf(value);
      if (idx !== -1) return idx;
    } else if (typeof value === 'number' && isFinite(value)) {
      if (value >= 0 && value < sourceChars.length) return value;
    }
    throw new Error(
      'turnover "' + value + '" is invalid. ' +
      'A letter string in map_source or an int between 0 and ' + (sourceChars.length - 1) + ' is required.'
    );
  }

  Rotor.prototype.forward = function () {
    var originalPosition = this.position;
    var sourceLen = toChars(this.mapSource).length;
    if (originalPosition === sourceLen - 1) {
      this.position = 0;
    } else {
      this.position += 1;
    }
    if (this.turnover.indexOf(originalPosition) !== -1) {
      if (this.leftPlate && this.leftPlate.autoRotatable) {
        this.leftPlate.forward();
      }
    }
    return this.position;
  };

  /* ---------- Reflector / EntryPlate ---------- */

  function Reflector(mapTable, options) {
    options = options || {};
    var initPosition = options.initPosition === undefined ? 0 : options.initPosition;
    Plate.call(this, mapTable, initPosition, false, options.rightPlate, null,
      false, options.name, options.mapSource === undefined ? AZ : options.mapSource);
  }

  Reflector.prototype = Object.create(Plate.prototype);
  Reflector.prototype.constructor = Reflector;

  function EntryPlate(mapTable, options) {
    options = options || {};
    var initPosition = options.initPosition === undefined ? 0 : options.initPosition;
    // map_source equals map_table, so the entry wiring is the identity map.
    Plate.call(this, mapTable, initPosition, false, null, options.leftPlate,
      false, options.name === undefined ? 'Entry Plate' : options.name, mapTable);
  }

  EntryPlate.prototype = Object.create(Plate.prototype);
  EntryPlate.prototype.constructor = EntryPlate;

  /* ---------- Plugboard ---------- */

  function Plugboard(parent) {
    this.mapDict = {};
    this.parent = parent || null;
  }

  Plugboard.prototype.plug = function (letter1, letter2) {
    if (letter1 === letter2) {
      throw new Error("Two letters can't be equal");
    }
    var sourceChars = toChars(this.parent.entryPlate.mapSource);
    var letters = [letter1, letter2];
    for (var i = 0; i < letters.length; i++) {
      var letter = letters[i];
      if (sourceChars.indexOf(letter) === -1) {
        throw new Error('"' + letter + '" is not in map_source');
      }
      if (this.mapDict[letter]) {
        throw new Error('"' + letter + '" have been set to be connected with another letter');
      }
    }
    this.mapDict[letter1] = letter2;
    this.mapDict[letter2] = letter1;
  };

  Plugboard.prototype.unplug = function (letter) {
    var sourceChars = toChars(this.parent.entryPlate.mapSource);
    if (sourceChars.indexOf(letter) === -1) {
      throw new Error('"' + letter + '" is not in map_source');
    }
    if (!(letter in this.mapDict)) {
      throw new Error('"' + letter + '" have not been set');
    }
    var another = this.mapDict[letter];
    delete this.mapDict[letter];
    delete this.mapDict[another];
  };

  /* ---------- Enigma ---------- */

  function Enigma(rotorList, reflector, rotateUp, rotateAfterType) {
    this.rotors = Array.prototype.slice.call(rotorList);
    this.reflector = reflector;
    this.reflector.rightPlate = this.rotors[this.rotors.length - 1];
    this.entryPlate = new EntryPlate(this.reflector.mapSource, { leftPlate: this.rotors[0] });

    for (var i = 0; i < this.rotors.length; i++) {
      var rotor = this.rotors[i];
      if (rotor.mapSource !== this.reflector.mapSource) {
        throw new Error('map_source of rotor[' + i + '] is not equal to that in reflector');
      }
      if (i < this.rotors.length - 1) {
        rotor.leftPlate = this.rotors[i + 1];
      } else {
        rotor.leftPlate = this.reflector;
      }
      if (i > 0) {
        rotor.rightPlate = this.rotors[i - 1];
      } else {
        rotor.rightPlate = this.entryPlate;
      }
    }
    for (var j = 0; j < this.rotors.length; j++) {
      this.rotors[j].rotateUp = !!rotateUp;
    }
    this.rotateAfterType = !!rotateAfterType;
    this.plugboard = new Plugboard(this);
  }

  Enigma.prototype.input = function (string) {
    var out = [];
    var letters = toChars(string);
    for (var i = 0; i < letters.length; i++) {
      var letter = letters[i];
      if (!this.rotateAfterType) {
        this.rotors[0].forward();
      }
      if (this.plugboard.mapDict[letter]) {
        letter = this.plugboard.mapDict[letter];
      }
      for (var r = 0; r < this.rotors.length; r++) {
        letter = this.rotors[r].encrypt(letter, 'right');
      }
      letter = this.reflector.encrypt(letter, 'right');
      for (var l = this.rotors.length - 1; l >= 0; l--) {
        letter = this.rotors[l].encrypt(letter, 'left');
      }
      letter = this.entryPlate.encrypt(letter, 'left');
      if (this.plugboard.mapDict[letter]) {
        letter = this.plugboard.mapDict[letter];
      }
      out.push(letter);
      if (this.rotateAfterType) {
        this.rotors[0].forward();
      }
    }
    return out.join('');
  };

  Enigma.prototype.setPositions = function (positionList) {
    if (!positionList || !positionList.length) {
      positionList = this.rotors.map(function () { return 0; });
    }
    if (positionList.length !== this.rotors.length) {
      throw new Error('Position list length is not equal to rotors number');
    }
    for (var i = 0; i < this.rotors.length; i++) {
      this.rotors[i].setPosition(positionList[i]);
    }
  };

  /* ---------- bridge API (mirrors python/enigma_api.py) ---------- */

  function buildRotor(r) {
    return new Rotor(r.map_table, {
      initPosition: typeof r.position === 'number' ? Math.floor(r.position) : 0,
      name: r.name,
      mapSource: r.map_source,
      turnover: r.turnover && r.turnover.length ? r.turnover : null,
    });
  }

  function buildEnigma(cfg) {
    var rotors = cfg.rotors.map(buildRotor);
    var reflector = new Reflector(cfg.reflector.map_table, {
      name: cfg.reflector.name,
      mapSource: cfg.reflector.map_source,
    });
    var enigma = new Enigma(rotors, reflector, !!cfg.rotate_up, !!cfg.rotate_after_type);
    var plugs = cfg.plugs || [];
    for (var i = 0; i < plugs.length; i++) {
      enigma.plugboard.plug(plugs[i][0], plugs[i][1]);
    }
    return enigma;
  }

  function positionsOf(enigma) {
    return enigma.rotors.map(function (r) { return r.position; });
  }

  function apiPress(config, letter) {
    try {
      var enigma = buildEnigma(config);
      var before = positionsOf(enigma);
      var output = enigma.input(letter);
      var after = positionsOf(enigma);
      return {
        input: letter,
        output: output,
        positions: after,
        moved: after.map(function (p, i) { return p !== before[i]; }),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  function validatePlate(kind, d) {
    try {
      var mapTable = d.map_table !== undefined ? d.map_table : d.mapTable;
      var mapSource = d.map_source !== undefined ? d.map_source : d.mapSource;
      if (kind === 'rotor') {
        new Rotor(mapTable, {
          name: d.name,
          mapSource: mapSource,
          turnover: d.turnover && d.turnover.length ? d.turnover : null,
        });
      } else {
        new Reflector(mapTable, { name: d.name, mapSource: mapSource });
      }
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  function apiValidateRotor(d) {
    return validatePlate('rotor', d);
  }

  function apiValidateReflector(d) {
    return validatePlate('reflector', d);
  }

  function apiInfo() {
    return { myenigma: '2.0.2', engine: 'JavaScript' };
  }

  NS.engine = {
    api_press: apiPress,
    api_validate_rotor: apiValidateRotor,
    api_validate_reflector: apiValidateReflector,
    api_info: apiInfo,
    // exposed for tests
    Enigma: Enigma,
    Rotor: Rotor,
    Reflector: Reflector,
  };
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
