from src.enigma.part.plate import Rotor

rotor_I = lambda: Rotor('EKMFLGDQVZNTOWYHXUSPAIBRCJ', name='Rotor I', turnover='Q')
rotor_II = lambda: Rotor('AJDKSIRUXBLHWTMCQGZNPYFVOE', name='Rotor II', turnover='E')
rotor_III = lambda: Rotor('BDFHJLCPRTXVZNYEIWGAKMUSQO', name='Rotor III', turnover='V')
rotor_IV = lambda: Rotor('ESOVPZJAYQUIRHXLNFTGKDCMWB', name='Rotor IV', turnover='J')
rotor_V = lambda: Rotor('VZBRGITYUPSDNHLXAWMJQOFECK', name='Rotor V', turnover='Z')
rotor_VI = lambda: Rotor('JPGVOUMFYQBENHZRDKASXLICTW', name='Rotor VI', turnover=['Z', 'M'])
rotor_VII = lambda: Rotor('NZJHGRCXMYSWBOUFAIVLPEKQDT', name='Rotor VII', turnover=['Z', 'M'])
rotor_VIII = lambda: Rotor('FKQHTLXOCBJSPDZRAMEWNIUYGV', name='Rotor VIII', turnover=['Z', 'M'])
rotor_Beta = lambda: Rotor('LEYJVCNIXWPBQMDRTAKZGFUHOS', name='Rotor Beta')
rotor_Gamma = lambda: Rotor('FSOKANUERHMBTIYCWLQPZXVGJD', name='Rotor Gamma')
