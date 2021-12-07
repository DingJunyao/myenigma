from .plate import Plate, _ALPHABET


class Rotor(Plate):
    """Rotor (Walzen in German) of an Enigma."""

    def __turnover_attr_exception(
            self, turnover: int | str | list[int | str] | tuple[int | str], map_source: str
    ):
        """Raise AttributeError if the turnover value is invalid."""
        raise AttributeError(
            f'turnover "{turnover}" is invalid. '
            f'A letter string in map_source or an int between 0 and {len(map_source) - 1} is required.'
        )

    def turnover_single_check_and_standardize(self, turnover_single: int | str, map_source: str) -> int:
        """Check single turnover value and standardize it.

        :return: int: index of the letter.
        :raise AttributeError: If the value is invalid.
        """
        if isinstance(turnover_single, str):
            if turnover_single in map_source:
                return map_source.index(turnover_single)
        elif isinstance(turnover_single, int):
            if 0 <= turnover_single < len(map_source):
                return turnover_single
        self.__turnover_attr_exception(turnover_single, map_source)

    def __init__(
            self, map_table: str = _ALPHABET, init_position: int | str = 0, auto_rotatable: bool = True,
            right_plate: Plate = None, left_plate: Plate = None, rotate_up: bool = False, name: str = None,
            map_source: str = _ALPHABET, turnover: int | str | list[int | str] | tuple[int | str] = None
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
        :param turnover: Define turnover position.
            For example, if it's set to 'T',
                it will let the left rotor rotate a step when this rotor rotates from T to U (in alphabet).
        :raise AttributeError: If map_table or init_position is invalid.
        """
        super().__init__(map_table, init_position, auto_rotatable, right_plate, left_plate, rotate_up, name,
                         map_source=map_source)
        if turnover is None:
            turnover = map_source[-1]
        if isinstance(turnover, list) or isinstance(turnover, tuple):
            turnover_list = []
            for turnover_item in turnover:
                turnover_list.append(self.turnover_single_check_and_standardize(turnover_item, map_source))
        else:
            turnover_list = [self.turnover_single_check_and_standardize(turnover, map_source)]
        self.turnover = turnover_list

    def forward(self) -> int:
        """Forward the plate.

        :return: Position of the plate.
        """
        original_position = self.position
        if original_position == len(self.map_source) - 1:
            self.position = 0
        else:
            self.position += 1
        if original_position in self.turnover:
            if self.left_plate:
                if self.left_plate.auto_rotatable:
                    self.left_plate.forward()
        return self.position
