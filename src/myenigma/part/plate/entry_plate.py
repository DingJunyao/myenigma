from .plate import Plate, _ALPHABET


class EntryPlate(Plate):
    """Entry Plate of an Enigma."""

    def __init__(
            self, map_table: str = _ALPHABET, init_position: str | int = 0, left_plate: Plate = None,
            name: str = 'Entry Plate'
    ):
        super().__init__(map_table, init_position, False, None, left_plate, name=name, map_source=map_table)
