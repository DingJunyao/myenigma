# myenigma

[![PyPI](https://img.shields.io/pypi/v/myenigma)](https://pypi.org/project/myenigma/) ![PyPI - Downloads](https://img.shields.io/pypi/dm/myenigma)

Python-based Enigma.

[查看中文版 README](README_zh.md)

[A brief tutorial of how to develop it (in Chinese)](https://4ading.com/posts/enigma-in-python)

## Install

```bash
pip install myenigma
```

Only supports Python 3.10 or above.

## Usage

### Import

```python
from myenigma import Enigma
```

The package also contains some sample plate:

```python
from myenigma.sample_plate.rotor import rotor_i, rotor_ii, rotor_iii
from myenigma.sample_plate.reflector import reflector_b
```
### Defining

Make sure the rotors are from right to left:

```python
e = Enigma([rotor_iii(), rotor_ii(), rotor_i()], reflector_b())
```

### Encryption / Decryption

Just input:

```python
assert e.input('HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO') == 'ILBDAAMTAZIJNXSCSIJJPDDWZBRCCUPGQXGRJXQOFGHL'
```

And change the positions of the rotors (Defaults to all origin):

```python
e.set_position()
assert e.input('ILBDAAMTAZIJNXSCSIJJPDDWZBRCCUPGQXGRJXQOFGHL') == 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO'
```

Number starts from 0, and also from right to left. You can also use letter:

```python
e.set_position(3, 12, 21)
assert e.input('HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO') == 'XTGHAGDIVUPGBZVQSFMBSGLKVQHQWESYRTSRMOOFGRLE'
e.set_position('D', 12, 21)
assert e.input('XTGHAGDIVUPGBZVQSFMBSGLKVQHQWESYRTSRMOOFGRLE') == 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO'
```

### Customize

You can freely customize your Enigma. For example, customize the circuits of rotors:

```python
from myenigma.part.plate import Rotor, Reflector

rotor_I = Rotor('EKMFLGDQVZNTOWYHXUSPAIBRCJ', name='Rotor I', turnover='Q')
rotor_II = Rotor('AJDKSIRUXBLHWTMCQGZNPYFVOE', name='Rotor II', turnover='E')
rotor_III = Rotor('BDFHJLCPRTXVZNYEIWGAKMUSQO', name='Rotor III', turnover='V')
reflector_B = Reflector('YRUHQSLDPXNGOKMIEBFZCWVJAT', name='Reflector B')
e_customize = Enigma([rotor_III, rotor_II, rotor_I], reflector_B)
# same as e above
```

A tiny Enigma:

```python
map_source = 'ASDF'
e_custom_1 = Enigma(
    [
        Rotor('AFSD', name='I', map_source=map_source),
        Rotor('SDAF', name='II', map_source=map_source),
        Rotor('DFAS', name='III', map_source=map_source),
    ],
    Reflector('DFAS', name='R', map_source=map_source),
    rotate_up=True, rotate_after_type=True
)
assert e_custom_1.input('AA') == 'SD'
e_custom_1.set_position()
assert e_custom_1.input('SD') == 'AA'
```

And even in other character!

```python
map_source_2 = '甲乙丙丁'
e_custom_2 = Enigma(
    [
        Rotor('甲丁乙丙', name='I', map_source=map_source_2),
        Rotor('乙丙甲丁', name='II', map_source=map_source_2),
        Rotor('丙丁甲乙', name='III', map_source=map_source_2),
    ],
    Reflector('丙丁甲乙', name='R', map_source=map_source_2),
    rotate_up=True, rotate_after_type=True
)
assert e_custom_2.input('甲甲') == '乙丙'
e_custom_2.set_position()
assert e_custom_2.input('乙丙') == '甲甲'
```

### Plugboard

Plugboard is also supported:

```python
e.plugboard.plug('L', 'M')
e.plugboard.plug('O', 'P')
assert e.input('HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO') == 'IMKPJAITPZIJNXSCSIJEOEDWZBRMCUOGQXGRJXQPFGHF'
e.set_position()
assert e.input('IMKPJAITPZIJNXSCSIJEOEDWZBRMCUOGQXGRJXQPFGHF') == 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO'
e.unplug('L')
e.unplug('P')
```

## Reference

- [恩尼格玛密码机 - 维基百科，自由的百科全书](https://zh.wikipedia.org/wiki/%E6%81%A9%E5%B0%BC%E6%A0%BC%E7%8E%9B%E5%AF%86%E7%A0%81%E6%9C%BA)
- [Enigma Sim Manual](http://users.telenet.be/d.rijmenants/Enigma%20Sim%20Manual.pdf)
- [Enigma Simulator](http://users.telenet.be/d.rijmenants/en/enigmasim.htm)
- [Enigma Rotor and Umkehrwalze Wirings](http://www.ellsbury.com/ultraenigmawirings.htm)
- [恩尼格玛密码机密码加密/解密 - 一个工具箱 - 好用的在线工具都在这里！](http://www.atoolbox.net/Tool.php?Id=993)

## License

MIT License.
