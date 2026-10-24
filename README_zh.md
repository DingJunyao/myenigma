# myenigma

[![PyPI](https://img.shields.io/pypi/v/myenigma)](https://pypi.org/project/myenigma/) ![PyPI - Downloads](https://img.shields.io/pypi/dm/myenigma)

基于 Python 的恩尼格玛（Enigma）密码机实现。

[View README in English](README.md)

[开发这个项目的简单教程](https://4ading.com/posts/enigma-in-python)

## 网页 Demo

在浏览器里试用一台写实的恩尼格玛密码机：可更换、新建齿轮（转子），插拔接线板电线，甚至使用自定义字母表。全部运算通过 Pyodide（WASM 版 Python）在浏览器本地完成，无后端：

**[▶ 打开网页 Demo](https://dingjunyao.github.io/myenigma/)**

本地运行（Pyodide 运行时与 wheel 都从本地加载，不依赖 CDN；开发服务器已禁用缓存，手机访问总能拿到最新资源）：

```bash
uv build --wheel
python scripts/vendor_webapp.py --skip-build
python scripts/serve_webapp.py 8123
# 然后打开 http://127.0.0.1:8123/（手机用 http://<局域网IP>:8123/）
```

## 小红书小工具

`minitool/` 是同一台机器面向小红书小工具容器改写的离线 H5 页面，打包为可直接上传的 zip。容器禁止 WebAssembly，因此 Pyodide 运行时被 `minitool/js/engine.js` 取代——本库的纯 JavaScript 移植，算法、桥接 API 与错误信息完全一致。界面保留全部功能（齿轮仓库、自定义字母表、插线板、电报纸带、双语），并遵守容器规则：经典脚本、Chrome 61 基线、无剪贴板/网络 API。

```bash
# 对拍测试：JS 引擎 vs 本 Python 库
python minitool/test/gen_expected.py        # 需已安装 myenigma
node minitool/test/check_engine.mjs         # 60 组随机配置 + 校验器
node minitool/test/smoke_dom.mjs            # 整个 UI 的 DOM 冒烟测试

# 暂存 dist/ 并生成待上传 zip（index.html 位于 zip 根目录）
python minitool/build.py
```

上传产物为 `minitool/myenigma-minitool.zip`；构建产物（`dist/`、zip）不提交入库。

## 安装

```bash
pip install myenigma
```

目前只支持 Python 3.10 及以上版本。

## 使用方法

### 导入

```python
from myenigma import Enigma
```

模块内提供了一些示例的圆盘（包括转子（`rotor`）和反射器（`reflector`））:

```python
from myenigma.sample_plate.rotor import rotor_i, rotor_ii, rotor_iii
from myenigma.sample_plate.reflector import reflector_b
```
### 定义

转子从右向左排序：

```python
e = Enigma([rotor_iii(), rotor_ii(), rotor_i()], reflector_b())
```

### 加/解密

输入：

```python
assert e.input('HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO') == 'ILBDAAMTAZIJNXSCSIJJPDDWZBRCCUPGQXGRJXQOFGHL'
```

更改转子位置（默认为全部转到初始位置）：

```python
e.set_position()
assert e.input('ILBDAAMTAZIJNXSCSIJJPDDWZBRCCUPGQXGRJXQOFGHL') == 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO'
```

更改转子位置时，数字从 0 开始，从右向左排序。你也可以使用字母：

```python
e.set_position(3, 12, 21)
assert e.input('HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO') == 'XTGHAGDIVUPGBZVQSFMBSGLKVQHQWESYRTSRMOOFGRLE'
e.set_position('D', 12, 21)
assert e.input('XTGHAGDIVUPGBZVQSFMBSGLKVQHQWESYRTSRMOOFGRLE') == 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO'
```

### 自定义

你可以自由地自定义你想要的恩尼格玛密码机。比如说，自定义转子的连线（或者说是映射）：

```python
from myenigma.part.plate import Rotor, Reflector

rotor_I = Rotor('EKMFLGDQVZNTOWYHXUSPAIBRCJ', name='Rotor I', turnover='Q')
rotor_II = Rotor('AJDKSIRUXBLHWTMCQGZNPYFVOE', name='Rotor II', turnover='E')
rotor_III = Rotor('BDFHJLCPRTXVZNYEIWGAKMUSQO', name='Rotor III', turnover='V')
reflector_B = Reflector('YRUHQSLDPXNGOKMIEBFZCWVJAT', name='Reflector B')
e_customize = Enigma([rotor_III, rotor_II, rotor_I], reflector_B)
# 和上面的 e 一样
```

一个微型的恩尼格玛密码机：

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

甚至可以用别的字符！

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

### 接线板

本模块也支持接线板：

```python
e.plugboard.plug('L', 'M')
e.plugboard.plug('O', 'P')
assert e.input('HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO') == 'IMKPJAITPZIJNXSCSIJEOEDWZBRMCUOGQXGRJXQPFGHF'
e.set_position()
assert e.input('IMKPJAITPZIJNXSCSIJEOEDWZBRMCUOGQXGRJXQPFGHF') == 'HELLOWORLDBYTHEAUTHOROFTHISPACKAGEDINGJUNYAO'
e.unplug('L')
e.unplug('P')
```

## 参考资料

- [恩尼格玛密码机 - 维基百科，自由的百科全书](https://zh.wikipedia.org/wiki/%E6%81%A9%E5%B0%BC%E6%A0%BC%E7%8E%9B%E5%AF%86%E7%A0%81%E6%9C%BA)
- [Enigma Sim Manual](http://users.telenet.be/d.rijmenants/Enigma%20Sim%20Manual.pdf)
- [Enigma Simulator](http://users.telenet.be/d.rijmenants/en/enigmasim.htm)
- [Enigma Rotor and Umkehrwalze Wirings](http://www.ellsbury.com/ultraenigmawirings.htm)
- [恩尼格玛密码机密码加密/解密 - 一个工具箱 - 好用的在线工具都在这里！](http://www.atoolbox.net/Tool.php?Id=993)

## 协议

MIT 协议。
