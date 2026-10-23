"""Bridge API exposed to JavaScript through Pyodide.

Every function takes and returns plain JSON strings, so the JS side never
touches Python objects directly.  The whole machine is rebuilt from the
config on every call - the bridge is stateless, which means the JS UI and
the Python engine can never drift apart.

Config schema (JSON):

    {
      "rotors": [                          # RIGHT to LEFT, index 0 = rightmost
        {
          "name": "Rotor I",
          "map_table": "EKMFLGDQVZNTOWYHXUSPAIBRCJ",
          "turnover": ["Q"],               # [] -> library default (last letter)
          "map_source": "ABC...Z",
          "position": 0                    # int index into map_source
        },
        ...
      ],
      "reflector": {"name": "Reflector B", "map_table": "YRUH...", "map_source": "ABC...Z"},
      "plugs": [["A", "M"], ...],
      "rotate_up": false,           # Enigma(rotate_up=...) - rotation direction
      "rotate_after_type": false,   # Enigma(rotate_after_type=...) - step after typing
    }
"""

import importlib.metadata
import json
import sys

from myenigma import Enigma
from myenigma.part.plate import Rotor, Reflector


def _error(exc: Exception) -> str:
    return json.dumps({"error": str(exc)})


def _build_enigma(cfg: dict) -> Enigma:
    rotors = [
        Rotor(
            r["map_table"],
            init_position=int(r["position"]),
            name=r.get("name"),
            map_source=r["map_source"],
            turnover=r.get("turnover") or None,
        )
        for r in cfg["rotors"]
    ]
    reflector = Reflector(
        cfg["reflector"]["map_table"],
        name=cfg["reflector"].get("name"),
        map_source=cfg["reflector"]["map_source"],
    )
    enigma = Enigma(
        rotors,
        reflector,
        rotate_up=bool(cfg.get("rotate_up", False)),
        rotate_after_type=bool(cfg.get("rotate_after_type", False)),
    )
    for a, b in cfg.get("plugs", []):
        enigma.plugboard.plug(a, b)
    return enigma


def api_press(config_json: str, letter: str) -> str:
    """Advance the machine by one letter and encrypt it."""
    try:
        cfg = json.loads(config_json)
        enigma = _build_enigma(cfg)
        before = [r.position for r in enigma.rotors]
        output = enigma.input(letter)
        after = [r.position for r in enigma.rotors]
        return json.dumps(
            {
                "input": letter,
                "output": output,
                "positions": after,
                "moved": [b != a for b, a in zip(before, after)],
            }
        )
    except Exception as exc:  # noqa: BLE001 - surfaced to the JS UI
        return _error(exc)


def api_validate_rotor(def_json: str) -> str:
    """Validate a rotor definition the same way the library would."""
    try:
        d = json.loads(def_json)
        Rotor(
            d.get("map_table", d.get("mapTable")),
            name=d.get("name"),
            map_source=d.get("map_source", d.get("mapSource")),
            turnover=d.get("turnover") or None,
        )
        return json.dumps({"ok": True})
    except Exception as exc:  # noqa: BLE001
        return _error(exc)


def api_validate_reflector(def_json: str) -> str:
    """Validate a reflector definition the same way the library would."""
    try:
        d = json.loads(def_json)
        Reflector(
            d.get("map_table", d.get("mapTable")),
            name=d.get("name"),
            map_source=d.get("map_source", d.get("mapSource")),
        )
        return json.dumps({"ok": True})
    except Exception as exc:  # noqa: BLE001
        return _error(exc)


def api_info() -> str:
    """Versions of the runtime parts, for the footer."""
    try:
        version = importlib.metadata.version("myenigma")
    except Exception:  # noqa: BLE001
        version = "?"
    return json.dumps({"myenigma": version, "python": sys.version.split()[0]})
