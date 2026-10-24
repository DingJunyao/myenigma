"""Generate random Enigma configs + expected per-press results from the real
Python library, using the exact bridge semantics of webapp/python/enigma_api.py
(machine rebuilt from config on every press).

Deterministic LCG instead of the random module so a fixed seed keeps the
fixture reproducible without importing crypto-strength sources for test data.
"""
import json
from pathlib import Path

from myenigma import Enigma
from myenigma.part.plate import Rotor, Reflector

AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
ALPHABETS = [
    AZ,
    AZ,
    AZ,
    "ZYXWVUTSRQPONMLKJIHGFEDCBA",
    "0123456789abcdef",
    "甲乙丙丁戊己庚辛壬癸",
    "QWERTZUIOASDFGHJKPYXCVBNML",
]

SEED = 20261024


class LCG:
    """Small deterministic PRNG (glibc-style constants) for test fixtures."""

    def __init__(self, seed):
        self.state = seed % 2147483647
        if self.state <= 0:
            self.state += 2147483646

    def next(self):
        self.state = (self.state * 48271) % 2147483647
        return self.state

    def randint(self, a, b):
        return a + self.next() % (b - a + 1)

    def choice(self, seq):
        return seq[self.next() % len(seq)]

    def sample(self, seq, k):
        pool = list(seq)
        out = []
        for _ in range(k):
            out.append(pool.pop(self.next() % len(pool)))
        return out

    def shuffle(self, seq):
        pool = list(seq)
        for i in range(len(pool) - 1, 0, -1):
            j = self.next() % (i + 1)
            pool[i], pool[j] = pool[j], pool[i]
        return pool


rng = LCG(SEED)


def shuffled(alpha):
    return "".join(rng.shuffle(list(alpha)))


def involution(alpha):
    chars = rng.shuffle(list(alpha))
    table = {}
    for i in range(0, len(chars) - 1, 2):
        table[chars[i]] = chars[i + 1]
        table[chars[i + 1]] = chars[i]
    return "".join(table[c] for c in alpha)


def make_config():
    alpha = rng.choice(ALPHABETS)
    n_rotors = rng.randint(1, 4)
    rotors = []
    for _ in range(n_rotors):
        rotors.append(
            {
                "name": "R" + "".join(rng.choice(AZ) for _ in range(2)),
                "map_table": shuffled(alpha),
                "turnover": rng.sample(list(alpha), rng.randint(0, min(3, len(alpha)))),
                "map_source": alpha,
                "position": rng.next() % len(alpha),
            }
        )
    reflector = {
        "name": "Ref X",
        "map_table": involution(alpha),
        "map_source": alpha,
    }
    letters = rng.shuffle(list(alpha))
    max_plugs = min(10, len(letters) // 2)
    plugs = []
    for _ in range(rng.randint(0, max_plugs)):
        a = letters.pop()
        b = letters.pop()
        plugs.append([a, b])
    return {
        "alphabet": alpha,
        "rotors": rotors,
        "reflector": reflector,
        "plugs": plugs,
        "rotate_up": rng.next() % 2 == 0,
        "rotate_after_type": rng.next() % 2 == 0,
    }


def build_enigma(cfg):
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


def api_press(cfg, letter):
    try:
        enigma = build_enigma(cfg)
        before = [r.position for r in enigma.rotors]
        output = enigma.input(letter)
        after = [r.position for r in enigma.rotors]
        return {
            "input": letter,
            "output": output,
            "positions": after,
            "moved": [b != a for b, a in zip(after, before)],
        }
    except Exception as exc:
        return {"error": str(exc)}


def api_validate(kind, d):
    try:
        if kind == "rotor":
            Rotor(
                d.get("map_table", d.get("mapTable")),
                name=d.get("name"),
                map_source=d.get("map_source", d.get("mapSource")),
                turnover=d.get("turnover") or None,
            )
        else:
            Reflector(
                d.get("map_table", d.get("mapTable")),
                name=d.get("name"),
                map_source=d.get("map_source", d.get("mapSource")),
            )
        return {"ok": True}
    except Exception as exc:
        return {"error": str(exc)}


press_cases = []
for i in range(60):
    cfg = make_config()
    letters = [rng.choice(list(cfg["alphabet"])) for _ in range(20)]
    work = json.loads(json.dumps(cfg))
    expected = []
    for letter in letters:
        res = api_press(work, letter)
        expected.append(res)
        if "positions" in res:
            for j, p in enumerate(res["positions"]):
                work["rotors"][j]["position"] = p
    press_cases.append({"name": "press-%d" % i, "config": cfg, "letters": letters, "expected": expected})

validate_cases = []
for _ in range(10):
    alpha = rng.choice(ALPHABETS)
    validate_cases.append(
        {"kind": "rotor", "def": {"name": "V", "map_table": shuffled(alpha), "map_source": alpha, "turnover": rng.sample(list(alpha), 2)}, "expected": {"ok": True}}
    )
    validate_cases.append(
        {"kind": "reflector", "def": {"name": "V", "map_table": involution(alpha), "map_source": alpha}, "expected": {"ok": True}}
    )

bad = [
    {"kind": "rotor", "def": {"map_table": "AABCC", "map_source": "ABCDE"}},
    {"kind": "rotor", "def": {"map_table": "ABCDA", "map_source": "ABCDE"}},
    {"kind": "rotor", "def": {"map_table": "ABCDF", "map_source": "ABCDE"}},
    {"kind": "rotor", "def": {"map_table": "ABCDE", "map_source": "ABCE"}},
    {"kind": "rotor", "def": {"map_table": "ABCDE", "map_source": "ABCDE", "turnover": "Z"}},
    {"kind": "rotor", "def": {"map_table": "ABCDE", "map_source": "ABCDE", "turnover": [99]}},
    {"kind": "reflector", "def": {"map_table": "ABCDA", "map_source": "ABCDE"}},
]
for case in bad:
    case["expected"] = api_validate(case["kind"], case["def"])
    assert "error" in case["expected"], case
validate_cases.extend(bad)

# decrypt round-trip on a standard config (self-reciprocity sanity)
cfg = {
    "alphabet": AZ,
    "rotors": [
        {"name": "Rotor III", "map_table": "BDFHJLCPRTXVZNYEIWGAKMUSQO", "turnover": ["V"], "map_source": AZ, "position": 4},
        {"name": "Rotor II", "map_table": "AJDKSIRUXBLHWTMCQGZNPYFVOE", "turnover": ["E"], "map_source": AZ, "position": 11},
        {"name": "Rotor I", "map_table": "EKMFLGDQVZNTOWYHXUSPAIBRCJ", "turnover": ["Q"], "map_source": AZ, "position": 2},
    ],
    "reflector": {"name": "Reflector B", "map_table": "YRUHQSLDPXNGOKMIEBFZCWVJAT", "map_source": AZ},
    "plugs": [["A", "M"], ["F", "I"]],
    "rotate_up": False,
    "rotate_after_type": False,
}
plain = "ATTACKATDAWN"
cipher = ""
work = json.loads(json.dumps(cfg))
for ch in plain:
    res = api_press(work, ch)
    cipher += res["output"]
    for j, p in enumerate(res["positions"]):
        work["rotors"][j]["position"] = p
work = json.loads(json.dumps(cfg))
decoded = ""
for ch in cipher:
    res = api_press(work, ch)
    decoded += res["output"]
    for j, p in enumerate(res["positions"]):
        work["rotors"][j]["position"] = p
assert decoded == plain, (decoded, plain)
press_cases.append({"name": "roundtrip", "config": cfg, "letters": list(plain), "expected": None})

out = {"press": press_cases, "validate": validate_cases}
out_path = Path(__file__).resolve().parent / "expected_cases.json"
out_path.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print("generated %d press cases, %d validate cases; roundtrip OK: %s" % (len(press_cases), len(validate_cases), decoded == plain))
