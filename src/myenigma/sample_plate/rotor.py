from ..part.plate import Rotor


def rotor_i():
    return Rotor('EKMFLGDQVZNTOWYHXUSPAIBRCJ', name='Rotor I', turnover='Q')


def rotor_ii():
    return Rotor('AJDKSIRUXBLHWTMCQGZNPYFVOE', name='Rotor II', turnover='E')


def rotor_iii():
    return Rotor('BDFHJLCPRTXVZNYEIWGAKMUSQO', name='Rotor III', turnover='V')


def rotor_iv():
    return Rotor('ESOVPZJAYQUIRHXLNFTGKDCMWB', name='Rotor IV', turnover='J')


def rotor_v():
    return Rotor('VZBRGITYUPSDNHLXAWMJQOFECK', name='Rotor V', turnover='Z')


def rotor_vi():
    return Rotor('JPGVOUMFYQBENHZRDKASXLICTW', name='Rotor VI', turnover=['Z', 'M'])


def rotor_vii():
    return Rotor('NZJHGRCXMYSWBOUFAIVLPEKQDT', name='Rotor VII', turnover=['Z', 'M'])


def rotor_viii():
    return Rotor('FKQHTLXOCBJSPDZRAMEWNIUYGV', name='Rotor VIII', turnover=['Z', 'M'])


def rotor_beta():
    return Rotor('LEYJVCNIXWPBQMDRTAKZGFUHOS', name='Rotor Beta')


def rotor_gamma():
    return Rotor('FSOKANUERHMBTIYCWLQPZXVGJD', name='Rotor Gamma')
