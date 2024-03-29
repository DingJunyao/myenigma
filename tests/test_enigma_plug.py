from src.myenigma import Enigma
from src.myenigma.part.plate import Rotor, Reflector
from src.myenigma.sample_plate.rotor import rotor_i, rotor_ii, rotor_iii
from src.myenigma.sample_plate.reflector import reflector_b


def test_200_enigma_plug():
    e = Enigma([rotor_iii(), rotor_ii(), rotor_i()], reflector_b())
    e.plugboard.plug('L', 'M')
    e.plugboard.plug('O', 'P')
    for rotor in e.rotors:
        assert rotor.position == 0
    for not_letter in 'ABCDEFGHIJKNQRSTUVWXYZ':
        assert not_letter not in e.plugboard.map_dict
    assert e.plugboard.map_dict['L'] == 'M'
    assert e.plugboard.map_dict['M'] == 'L'
    assert e.plugboard.map_dict['O'] == 'P'
    assert e.plugboard.map_dict['P'] == 'O'
    assert e.input('HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO') == 'IMKPJAITPZIJNXSCSIJEOEDWZBRMCUOGQXGRJXQPFGHF'
    e.set_position()
    for rotor in e.rotors:
        assert rotor.position == 0
    for not_letter in 'ABCDEFGHIJKNQRSTUVWXYZ':
        assert not_letter not in e.plugboard.map_dict
    assert e.plugboard.map_dict['L'] == 'M'
    assert e.plugboard.map_dict['M'] == 'L'
    assert e.plugboard.map_dict['O'] == 'P'
    assert e.plugboard.map_dict['P'] == 'O'
    assert e.input('IMKPJAITPZIJNXSCSIJEOEDWZBRMCUOGQXGRJXQPFGHF') == 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO'


def test_201_enigma_plug_custom_source():
    map_source = 'ASDF'
    e = Enigma(
        [
            Rotor('AFSD', name='I', map_source=map_source),
            Rotor('SDAF', name='II', map_source=map_source),
            Rotor('DFAS', name='III', map_source=map_source),
        ],
        Reflector('DFAS', name='R', map_source=map_source),
        rotate_up=True, rotate_after_type=True,
    )
    e.plugboard.plug('A', 'D')
    assert e.input('A') == 'F'
    e.set_position()
    assert e.input('S') == 'D'
    e.set_position()
    assert e.input('D') == 'S'
    e.set_position()
    assert e.input('F') == 'A'
