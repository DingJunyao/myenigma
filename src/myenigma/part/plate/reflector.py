from .plate import Plate, _ALPHABET


class Reflector(Plate):
    """Reflector (Umkehrwalze in German) of an Enigma."""

    def __init__(
            self, map_table: str = _ALPHABET, init_position: str | int = 0, right_plate: Plate = None,
            name: str = None, map_source: str = _ALPHABET
    ):
        """Defining a reflector.

        :param map_table: String for map table.
        :param init_position: Initial position.
        :param right_plate: The plate on the right of this plate.
        :param name: The name of the plate.
        :param map_source: String for map source. the circuits are:
            item in map_source -> item in map_table
        :raise AttributeError: If map_table or init_position is invalid.
        """
        super().__init__(map_table, init_position, False, right_plate, None, name=name, map_source=map_source)
