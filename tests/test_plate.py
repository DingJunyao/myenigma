from src.myenigma.part.plate.plate import Plate


def test_000_plate():
    r = Plate('EKMFLGDQVZNTOWYHXUSPAIBRCJ')
    r.encrypt('A', 'right')
