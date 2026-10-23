"""Tests for the web demo bridge (webapp/python/enigma_api.py).

These protect the JS <-> Python contract: the exact JSON config the UI
sends must produce the same results as using myenigma directly.
"""

import importlib.util
import json
from pathlib import Path

import pytest

from myenigma import Enigma
from myenigma.part.plate import Rotor, Reflector

ROOT = Path(__file__).resolve().parents[1]
API_PATH = ROOT / 'webapp' / 'python' / 'enigma_api.py'

_spec = importlib.util.spec_from_file_location('enigma_api', API_PATH)
enigma_api = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(enigma_api)

AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

ROTORS = {
    'I': {'name': 'Rotor I', 'map_table': 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', 'turnover': ['Q']},
    'II': {'name': 'Rotor II', 'map_table': 'AJDKSIRUXBLHWTMCQGZNPYFVOE', 'turnover': ['E']},
    'III': {'name': 'Rotor III', 'map_table': 'BDFHJLCPRTXVZNYEIWGAKMUSQO', 'turnover': ['V']},
}
REFLECTOR_B = {'name': 'Reflector B', 'map_table': 'YRUHQSLDPXNGOKMIEBFZCWVJAT'}


def make_config(rotor_ids=('III', 'II', 'I'), positions=None, plugs=None, reflector=None):
    """Build the same JSON shape webapp/js/store.js buildConfig() produces."""
    positions = positions or [0] * len(rotor_ids)
    reflector = reflector or REFLECTOR_B
    return {
        'alphabet': reflector['map_source'] if 'map_source' in reflector else AZ,
        'rotors': [
            dict(ROTORS[rid], map_source=AZ, position=positions[i])
            for i, rid in enumerate(rotor_ids)
        ],
        'reflector': dict(reflector, map_source=reflector.get('map_source', AZ)),
        'plugs': plugs or [],
    }


def press_string(config, text):
    """Press letters one by one, mirroring the stateless bridge + JS position tracking."""
    outputs = []
    positions = [r['position'] for r in config['rotors']]
    for letter in text:
        cfg = json.loads(json.dumps(config))
        for rotor, pos in zip(cfg['rotors'], positions):
            rotor['position'] = pos
        result = json.loads(enigma_api.api_press(json.dumps(cfg), letter))
        assert 'error' not in result, result
        positions = result['positions']
        outputs.append(result['output'])
    return ''.join(outputs), positions


def test_default_machine_matches_library():
    text = 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO'
    config = make_config()
    output, positions = press_string(config, text)

    e = Enigma([Rotor(ROTORS['III']['map_table'], name='Rotor III', turnover='V'),
                Rotor(ROTORS['II']['map_table'], name='Rotor II', turnover='E'),
                Rotor(ROTORS['I']['map_table'], name='Rotor I', turnover='Q')],
               Reflector(REFLECTOR_B['map_table'], name='Reflector B'))
    expected = e.input(text)

    assert output == expected == 'ILBDAAMTAZIJNXSCSIJJPDDWZBRCCUPGQXGRJXQOFGHL'
    assert positions == [r.position for r in e.rotors]


def test_plugboard_via_bridge():
    config = make_config(plugs=[['L', 'M'], ['O', 'P']])
    output, _ = press_string(config, 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO')
    assert output == 'IMKPJAITPZIJNXSCSIJEOEDWZBRMCUOGQXGRJXQPFGHF'


def test_custom_alphabet_round_trip():
    alphabet = '甲乙丙丁'
    config = {
        'alphabet': alphabet,
        'rotors': [
            {'name': 'I', 'map_table': '甲丁乙丙', 'turnover': [], 'map_source': alphabet, 'position': 0},
            {'name': 'II', 'map_table': '乙丙甲丁', 'turnover': [], 'map_source': alphabet, 'position': 0},
            {'name': 'III', 'map_table': '丙丁甲乙', 'turnover': [], 'map_source': alphabet, 'position': 0},
        ],
        'reflector': {'name': 'R', 'map_table': '丙丁甲乙', 'map_source': alphabet},
        'plugs': [],
    }
    cipher, _ = press_string(config, '甲甲')
    reset = json.loads(json.dumps(config))
    plain, _ = press_string(reset, cipher)
    assert plain == '甲甲'


def test_turnover_advances_left_rotor():
    # Rightmost rotor (Rotor I, turnover Q) turns over from Q -> the left rotor must step.
    # slots are right-to-left, so positions[0] is the fast rotor at Q (index 16).
    config = make_config(rotor_ids=('I', 'II', 'III'), positions=[16, 0, 0])
    result = json.loads(enigma_api.api_press(json.dumps(config), 'A'))
    assert result['positions'] == [17, 1, 0]  # Q -> R, middle carried


def test_invalid_rotor_is_rejected():
    bad = {'name': 'Bad', 'map_table': 'ABCDEFGHIJKLMNOPQRSTUVWXYA', 'turnover': [], 'map_source': AZ}
    assert 'error' in json.loads(enigma_api.api_validate_rotor(json.dumps(bad)))

    good = {'name': 'Good', 'map_table': 'BCDEFGHIJKLMNOPQRSTUVWXYZA', 'turnover': [], 'map_source': AZ}
    assert json.loads(enigma_api.api_validate_rotor(json.dumps(good))) == {'ok': True}


def test_readme_tiny_chinese_machine():
    """README example with rotate_up=True, rotate_after_type=True, 甲乙丙丁."""
    alphabet = '甲乙丙丁'
    config = {
        'alphabet': alphabet,
        'rotate_up': True,
        'rotate_after_type': True,
        'rotors': [
            {'name': 'I', 'map_table': '甲丁乙丙', 'turnover': [], 'map_source': alphabet, 'position': 0},
            {'name': 'II', 'map_table': '乙丙甲丁', 'turnover': [], 'map_source': alphabet, 'position': 0},
            {'name': 'III', 'map_table': '丙丁甲乙', 'turnover': [], 'map_source': alphabet, 'position': 0},
        ],
        'reflector': {'name': 'R', 'map_table': '丙丁甲乙', 'map_source': alphabet},
        'plugs': [],
    }
    cipher, _ = press_string(config, '甲甲')
    assert cipher == '乙丙'
    plain, _ = press_string(json.loads(json.dumps(config)), cipher)
    assert plain == '甲甲'


def test_validator_accepts_camel_case():
    """The editor sends camelCase; the validator must not raise KeyError."""
    rotor = {'name': 'X', 'mapTable': 'BCDEFGHIJKLMNOPQRSTUVWXYZA', 'mapSource': AZ, 'turnover': []}
    assert json.loads(enigma_api.api_validate_rotor(json.dumps(rotor))) == {'ok': True}
    reflector = {'name': 'R', 'mapTable': 'YRUHQSLDPXNGOKMIEBFZCWVJAT', 'mapSource': AZ}
    assert json.loads(enigma_api.api_validate_reflector(json.dumps(reflector))) == {'ok': True}


def test_alphabet_mismatch_is_reported():
    config = make_config()
    config['reflector']['map_source'] = '甲乙丙丁'
    result = json.loads(enigma_api.api_press(json.dumps(config), 'A'))
    assert 'error' in result
