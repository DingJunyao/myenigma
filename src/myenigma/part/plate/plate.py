from typing import Optional

_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'


class Plate:
    """Plate of an Enigma, including Entry Plate, Rotors (Walzen in German) and Reflector (Umkehrwalze in German)."""

    @staticmethod
    def _map_table_check(map_table: str, map_source: str = _ALPHABET):
        """Raise AttributeError if map table is invalid."""
        if len(set(map_source)) != len(map_source):
            raise AttributeError(f'map_source "{map_source}" is invalid. It must be str with different letters.')
        if len(set(map_table)) != len(map_source) or len(map_table) != len(map_source):
            raise AttributeError(
                f'map_table "{map_table}" is invalid. '
                f'It must be str with different letters, and every letter is in map_source "{map_source}".'
            )
        for letter in map_source:
            if letter not in map_table:
                raise AttributeError(f'"{letter}" not in map table.')

    def __init_init_position_attr_exception(self, init_position: int | str, map_source: str):
        """Raise AttributeError if init_position is invalid."""
        raise AttributeError(
            f'init_position "{init_position}" is invalid. '
            f'A letter string in map_source or an int between 0 and {len(map_source) - 1} is required.'
        )

    def __init__(
            self, map_table: str = _ALPHABET, init_position: str | int = 0, auto_rotatable: bool = False,
            right_plate=None, left_plate=None, rotate_up: bool = False, name: str = None, map_source: str = _ALPHABET
    ):
        """Defining a plate.

        :param map_table: String for map table.
        :param init_position: Initial position.
        :param auto_rotatable: If the plate is auto rotatable.
            If it's True, the plate will be rotatable if other plate let it rotate.
            Or it's False, but you can also let it rotate by setting its position.
        :param right_plate: The plate on the right of this plate.
        :param left_plate: The plate on the left of this plate.
        :param rotate_up: Rotate direction of this plate.
            If it's True, it will rotate from small to large by index.
                (If upper is A, lower is B, the plate will rotate from lower to upper when change from A to B.)
            Or it's False (Default).
                (If upper is B, lower is A, the plate will rotate from upper to lower when change from A to B.)
        :param name: The name of the plate.
        :param map_source: String for map source. the circuits are:
            item in map_source -> item in map_table
        :raise AttributeError: If map_table or init_position is invalid.
        """
        self._map_table_check(map_table, map_source)
        dict_table = {}
        for input_letter_index, input_letter in enumerate(map_source):
            dict_table[input_letter] = map_table[input_letter_index]
        self.dict_table = dict_table
        if type(init_position) == str:
            if len(init_position) != 1 or init_position not in map_source:
                self.__init_init_position_attr_exception(init_position, map_source)
            self.position = map_source.index(init_position)
        elif type(init_position) == int:
            if 0 <= init_position < len(map_table):
                self.position = init_position
            else:
                self.__init_init_position_attr_exception(init_position, map_source)
        else:
            self.__init_init_position_attr_exception(init_position, map_source)
        self.auto_rotatable = auto_rotatable
        self.right_plate = right_plate
        self.left_plate = left_plate
        self.rotate_up = rotate_up
        self.name = name
        self.map_source = map_source
        self.turnover = []

    @property
    def current_state(self) -> dict:
        """Return a dict with 'left' and 'right' keys, which show the current state."""
        right = list(self.dict_table.keys())
        left = list(self.dict_table.values())
        transform_position = (-2 * self.rotate_up + 1) * self.position
        current_right = right[transform_position:] + right[:transform_position]
        current_left = left[transform_position:] + left[:transform_position]
        return {'left': current_left, 'right': current_right}

    def transform_letter(self, letter: str, from_plate) -> str:
        """Transform letter from previous process to the letter on the plate.

        :param letter: Letter from the previous process.
        :param from_plate: 'left' or 'right'
        :return: transformed letter.
        """
        letter_index = from_plate.current_state['right'].index(letter)
        return self.current_state['right'][letter_index]

    def encrypt(self, letter: str, letter_from: str = 'right') -> str:
        """Return the output letter through the plate.

        :param letter: A letter.
        :param letter_from: 'left' or 'right'.
        :return: A letter.
        :raise AttributeError: Input invalid
        """
        if type(letter) != str or len(letter) != 1 or letter not in self.map_source:
            raise AttributeError(f'Input "{letter}" is invalid. A letter string in map_source is required.')
        if letter_from == 'left':
            from_plate = self.left_plate
        else:
            from_plate = self.right_plate
        if from_plate:
            letter = self.transform_letter(letter, from_plate)
        if letter_from == 'left':
            key_index = list(self.dict_table.values()).index(letter)
            left_letter = list(self.dict_table.keys())[key_index]
            return left_letter
        else:
            return self.dict_table[letter]

    def set_position(self, position: int | str):
        """Set position of the plate.

        :param position: Index or letter.
        :raise AttributeError: If position is invalid.
        """
        position_int: Optional[int] = None
        if isinstance(position, str):
            if position in self.map_source:
                position_int = self.map_source.index(position)
        elif isinstance(position, int):
            if 0 <= position < len(self.map_source):
                position_int = position
        if position_int is None:
            raise AttributeError(
                f'position "{position}" is invalid. '
                f'A letter string in map_source or an int between 0 and {len(self.map_source) - 1} is required.'
            )
        self.position = position_int
