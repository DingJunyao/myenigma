from ..part.plate import Rotor


def rotor_i():
    """Rotor I."""
    return Rotor('EKMFLGDQVZNTOWYHXUSPAIBRCJ', name='Rotor I', turnover='Q')


def rotor_ii():
    """Rotor II."""
    return Rotor('AJDKSIRUXBLHWTMCQGZNPYFVOE', name='Rotor II', turnover='E')


def rotor_iii():
    """Rotor III."""
    return Rotor('BDFHJLCPRTXVZNYEIWGAKMUSQO', name='Rotor III', turnover='V')


def rotor_iv():
    """Rotor IV."""
    return Rotor('ESOVPZJAYQUIRHXLNFTGKDCMWB', name='Rotor IV', turnover='J')


def rotor_v():
    """Rotor V."""
    return Rotor('VZBRGITYUPSDNHLXAWMJQOFECK', name='Rotor V', turnover='Z')


def rotor_vi():
    """Rotor VI."""
    return Rotor('JPGVOUMFYQBENHZRDKASXLICTW', name='Rotor VI', turnover=['Z', 'M'])


def rotor_vii():
    """Rotor VII."""
    return Rotor('NZJHGRCXMYSWBOUFAIVLPEKQDT', name='Rotor VII', turnover=['Z', 'M'])


def rotor_viii():
    """Rotor VIII."""
    return Rotor('FKQHTLXOCBJSPDZRAMEWNIUYGV', name='Rotor VIII', turnover=['Z', 'M'])


def rotor_beta():
    """Rotor Beta."""
    return Rotor('LEYJVCNIXWPBQMDRTAKZGFUHOS', name='Rotor Beta')


def rotor_gamma():
    """Rotor Gamma."""
    return Rotor('FSOKANUERHMBTIYCWLQPZXVGJD', name='Rotor Gamma')
