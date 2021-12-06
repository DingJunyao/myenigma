from src.myenigma import Enigma
from src.myenigma.part.plate import Rotor, Reflector
from src.myenigma.sample_plate.rotor import rotor_i, rotor_ii, rotor_iii
from src.myenigma.sample_plate.reflector import reflector_b


def test_100_enigma():
    e = Enigma([rotor_iii(), rotor_ii(), rotor_i()], reflector_b())
    for input_letter, result in zip('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'BAQMFEXIHSWPDYTLCVJOZRKGNU'):
        e.set_position()
        assert e.input(input_letter) == result
    e.set_position()
    assert e.input('HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO') == 'ILBDAAMTAZIJNXSCSIJJPDDWZBRCCUPGQXGRJXQOFGHL'
    e.set_position()
    assert e.input('ILBDAAMTAZIJNXSCSIJJPDDWZBRCCUPGQXGRJXQOFGHL') == 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO'
    e.set_position(0, 0, 0)
    assert e.input('HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO') == 'ILBDAAMTAZIJNXSCSIJJPDDWZBRCCUPGQXGRJXQOFGHL'
    e.set_position(0, 0, 0)
    assert e.input('ILBDAAMTAZIJNXSCSIJJPDDWZBRCCUPGQXGRJXQOFGHL') == 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO'
    e.set_position(25, 0, 0)
    assert e.rotors[0].position == 25
    assert e.rotors[1].position == 0
    assert e.rotors[2].position == 0
    assert e.input('HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO') == 'ZFEBMQKNGRKZEGBMJEQEVLCEVXFKHABTARMWPXSGALSX'
    e.set_position(25, 0, 0)
    assert e.input('ZFEBMQKNGRKZEGBMJEQEVLCEVXFKHABTARMWPXSGALSX') == 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO'
    e.set_position(3, 12, 21)
    assert e.input('HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO') == 'XTGHAGDIVUPGBZVQSFMBSGLKVQHQWESYRTSRMOOFGRLE'
    e.set_position('D', 12, 21)
    assert e.input('XTGHAGDIVUPGBZVQSFMBSGLKVQHQWESYRTSRMOOFGRLE') == 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO'


def test_101_enigma_custom_source_1():
    map_source = 'ASDF'
    e = Enigma(
        [
            Rotor('AFSD', name='I', map_source=map_source),
            Rotor('SDAF', name='II', map_source=map_source),
            Rotor('DFAS', name='III', map_source=map_source),
        ],
        Reflector('DFAS', name='R', map_source=map_source),
        rotate_up=True, rotate_after_type=True
    )
    assert e.input('A') == 'S'
    e.set_position()
    assert e.input('S') == 'A'
    e.set_position()
    assert e.input('D') == 'F'
    e.set_position()
    assert e.input('F') == 'D'
    e.set_position()
    assert e.input('AA') == 'SD'
    e.set_position()
    assert e.input('SD') == 'AA'


def test_102_enigma_custom_source_2():
    map_source = '甲乙丙丁'
    e = Enigma(
        [
            Rotor('甲丁乙丙', name='I', map_source=map_source),
            Rotor('乙丙甲丁', name='II', map_source=map_source),
            Rotor('丙丁甲乙', name='III', map_source=map_source),
        ],
        Reflector('丙丁甲乙', name='R', map_source=map_source),
        rotate_up=True, rotate_after_type=True
    )
    assert e.input('甲甲') == '乙丙'
    e.set_position()
    assert e.input('乙丙') == '甲甲'
