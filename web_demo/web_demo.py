from pywebio import start_server
from pywebio.pin import put_textarea, put_select, pin, put_actions, pin_wait_change
from pywebio.output import put_markdown, put_row, put_scope, use_scope, clear

from src.myenigma import Enigma
from src.myenigma.part.plate import Reflector, Rotor
from src.myenigma.part.plate.plate import _ALPHABET
from src.myenigma.sample_plate import rotor, reflector

rotor_func_list = [
    rotor.rotor_i, rotor.rotor_ii, rotor.rotor_iii, rotor.rotor_iv, rotor.rotor_v, rotor.rotor_vi, rotor.rotor_vii,
    rotor.rotor_viii, rotor.rotor_beta, rotor.rotor_gamma
]

reflector_func_list = [
    reflector.reflector_b, reflector.reflector_c, reflector.reflector_b_thin, reflector.reflector_c_thin
]

rotor_opt = []
reflector_opt = []

position_opt = [
    {
        'label': '%02d - %s' % (character_i + 1, character),
        'value': character_i
    }
    for character_i, character in enumerate(_ALPHABET)
]

for rotor_func in rotor_func_list:
    rotor = rotor_func()
    rotor_label_index = rotor.current_state['left']
    for turnover_i in rotor.turnover:
        rotor_label_index[turnover_i] = f'[{rotor_label_index[turnover_i]}]'
    rotor_opt.append(
        {
            'label': f'{rotor.name} - {"".join(rotor_label_index)}',
            'value': rotor_func.__name__
        }
    )

for reflector_func in reflector_func_list:
    reflector_func_exec = reflector_func()
    reflector_label_index = reflector_func_exec.current_state['left']
    reflector_opt.append(
        {
            'label': f'{reflector_func_exec.name} - {"".join(reflector_label_index)}',
            'value': reflector_func.__name__
        }
    )

title_md_zh = '# 恩尼格玛密码机'

title_md_en = '# Enigma Machine'

intro_md_zh = """本页面使用 Python 的 `myenigma` 包模拟恩尼格玛机。

项目地址：[GitHub][1] | [Gitee][2]

网页交互功能由 [`PyWebIO`][3] 实现。

下面提到的转子，按从右到左的顺序排列。有效的输入值仅为大写字母，小写字母会自动转换，空格将被忽略。

[1]: https://github.com/DingJunyao/myenigma
[2]: https://gitee.com/DingJunyao/myenigma
[3]: https://github.com/pywebio/PyWebIO
"""

intro_md_en = """This page use `myenigma` package in Python to emulate Enigma machine.

Project URL: [GitHub][1] | [Gitee][2]

Web interactive function is powered by [`PyWebIO`][3].

The rotors below are ordered from right to left. Only capital letter can be input in;
lowercase letters will be transfered to uppercase, and space will be ignored.

[1]: https://github.com/DingJunyao/myenigma
[2]: https://gitee.com/DingJunyao/myenigma
[3]: https://github.com/pywebio/PyWebIO
"""

def input_validate(input_str: str):
    err_str = '有效的输入值仅为大写字母，小写字母会自动转换，空格将被忽略。 / Only capital letter can be input in; ' \
              'lowercase letters will be transfered to uppercase, and space will be ignored.'
    input_str = input_str.replace(' ', '').upper()
    input_str_set = set(input_str)
    if len(input_str_set) <= 26:
        for i in input_str_set:
            if ord(i) > ord('Z') or ord(i) < ord('A'):
                return ''


class PlateFunc:

    @staticmethod
    def rotor_i():
        """Rotor I."""
        return Rotor('EKMFLGDQVZNTOWYHXUSPAIBRCJ', name='Rotor I', turnover='Q')

    @staticmethod
    def rotor_ii():
        """Rotor II."""
        return Rotor('AJDKSIRUXBLHWTMCQGZNPYFVOE', name='Rotor II', turnover='E')

    @staticmethod
    def rotor_iii():
        """Rotor III."""
        return Rotor('BDFHJLCPRTXVZNYEIWGAKMUSQO', name='Rotor III', turnover='V')

    @staticmethod
    def rotor_iv():
        """Rotor IV."""
        return Rotor('ESOVPZJAYQUIRHXLNFTGKDCMWB', name='Rotor IV', turnover='J')

    @staticmethod
    def rotor_v():
        """Rotor V."""
        return Rotor('VZBRGITYUPSDNHLXAWMJQOFECK', name='Rotor V', turnover='Z')

    @staticmethod
    def rotor_vi():
        """Rotor VI."""
        return Rotor('JPGVOUMFYQBENHZRDKASXLICTW', name='Rotor VI', turnover=['Z', 'M'])

    @staticmethod
    def rotor_vii():
        """Rotor VII."""
        return Rotor('NZJHGRCXMYSWBOUFAIVLPEKQDT', name='Rotor VII', turnover=['Z', 'M'])

    @staticmethod
    def rotor_viii():
        """Rotor VIII."""
        return Rotor('FKQHTLXOCBJSPDZRAMEWNIUYGV', name='Rotor VIII', turnover=['Z', 'M'])

    @staticmethod
    def rotor_beta():
        """Rotor Beta."""
        return Rotor('LEYJVCNIXWPBQMDRTAKZGFUHOS', name='Rotor Beta')

    @staticmethod
    def rotor_gamma():
        """Rotor Gamma."""
        return Rotor('FSOKANUERHMBTIYCWLQPZXVGJD', name='Rotor Gamma')

    @staticmethod
    def reflector_b():
        """Reflector B."""
        return Reflector('YRUHQSLDPXNGOKMIEBFZCWVJAT', name='Reflector B')

    @staticmethod
    def reflector_c():
        """Reflector C."""
        return Reflector('FVPJIAOYEDRZXWGCTKUQSBNMHL', name='Reflector C')

    @staticmethod
    def reflector_b_thin():
        """Reflector B Thin."""
        return Reflector('ENKQAUYWJICOPBLMDXZVFTHRGS', name='Reflector B Thin')

    @staticmethod
    def reflector_c_thin():
        """Reflector C Thin."""
        return Reflector('RDOBJNTKVEHMLFCWZAXGYIPSUQ', name='Reflector C Thin')



def enigma_web():
    global history_in_text, history_out_text
    put_row([
        put_markdown(title_md_zh),
        put_markdown(title_md_en),
    ])
    put_row([
        put_markdown(intro_md_zh),
        put_markdown(intro_md_en),
    ])
    put_row([
        put_markdown("""---"""),
    ])
    put_row([
        put_select('rotor_0', rotor_opt.copy(), label="右转子 / Right Rotor"),
        put_select('rotor_0_pos', position_opt.copy(), label="位置 / Position")

    ])
    put_row([
        put_select('rotor_1', rotor_opt.copy(), label="中转子 / Middle Rotor"),
        put_select('rotor_1_pos', position_opt.copy(), label="位置 / Position")
    ])
    put_row([
        put_select('rotor_2', rotor_opt.copy(), label="左转子 / Left Rotor"),
        put_select('rotor_2_pos', position_opt.copy(), label="位置 / Position")
    ])
    put_row([
        put_select('reflector_func_exec', reflector_opt.copy(), label="反射器 / Reflector")
    ])
    put_row([
        put_textarea('in_text', label="输入文本 / Input code"),
        put_scope('output')
    ])
    btn = put_actions(
        'input_btn',
        buttons=[
            {
                'label': '输入 / Input',
                'value': 'input',
                'type': 'submit',
                'color': 'primary'
            },
        ],
    )

    put_row([btn])
    with use_scope('output', clear=True):
        while True:
            change_detail = pin_wait_change('input_btn')
            err_str = '> 有效的输入值仅为大写字母，小写字母会自动转换，空格将被忽略。\n' \
                      '> Only capital letter can be input in; ' \
                      'lowercase letters will be transfered to uppercase, and space will be ignored.'
            input_str = pin.in_text.replace(' ', '').upper()
            input_str_set = set(input_str)
            clear('output')
            if len(input_str_set) <= 26:
                for i in input_str_set:
                    if ord(i) > ord('Z') or ord(i) < ord('A'):
                        put_markdown(err_str)
                        break
                else:
                    rotor_0: Rotor = getattr(PlateFunc, pin.rotor_0)()
                    rotor_1: Rotor = getattr(PlateFunc, pin.rotor_1)()
                    rotor_2: Rotor = getattr(PlateFunc, pin.rotor_2)()
                    reflector_plate: Reflector = getattr(PlateFunc, pin.reflector_func_exec)()
                    e = Enigma(
                        [rotor_0, rotor_1, rotor_2],
                        reflector_plate,
                    )
                    e.set_position(pin.rotor_0_pos, pin.rotor_1_pos, pin.rotor_2_pos)
                    put_markdown('```text\n' + e.input(input_str) + '\n```')
            else:
                put_markdown(err_str)
                continue



if __name__ == '__main__':
    start_server(enigma_web, port=8080, debug=True)
