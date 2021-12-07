from .part import Plugboard
from .part.plate import Rotor, EntryPlate, Reflector


class Enigma:
    """An Enigma machine."""

    def __init__(
            self, rotor_list: list[Rotor] | tuple[Rotor], reflector: Reflector, rotate_up: bool = False,
            rotate_after_type: bool = False
    ):
        """Define the Enigma.

        :param rotor_list: The list of the rotors from right to left. Tuple with rotors is also supported.
        :param reflector: The reflector of the Enigma.
        :param rotate_up: Rotate direction of the rotors.
            If it's True, it will rotate from small to large by index.
                (If upper is A, lower is B, the plate will rotate from lower to upper when change from A to B.)
            Or it's False (Default).
                (If upper is B, lower is A, the plate will rotate from upper to lower when change from A to B.)
        :param rotate_after_type: Set if the rotors rotate after type. Defaults to False.
        :raise AttributeError: If the map_source of any rotor is not equal to that in reflector.
        """
        self.rotors = list(rotor_list)
        self.reflector = reflector
        self.reflector.right_plate = self.rotors[-1]
        self.entry_plate = EntryPlate(map_table=self.reflector.map_source, left_plate=self.rotors[0])
        for rotor_index, rotor in enumerate(self.rotors):
            if rotor.map_source != self.reflector.map_source:
                raise AttributeError(f'map_source of rotor[{rotor_index}] is not equal to that in reflector')
            if rotor_index < len(self.rotors) - 1:
                rotor.left_plate = self.rotors[rotor_index + 1]
            else:
                rotor.left_plate = self.reflector
            if rotor_index > 0:
                rotor.right_plate = self.rotors[rotor_index - 1]
            else:
                rotor.right_plate = self.entry_plate
        for rotor in self.rotors:
            rotor.rotate_up = rotate_up
        self.rotate_after_type = rotate_after_type
        self.plugboard = Plugboard(parent=self)

    def input(self, string: str) -> str:
        """Input string to Enigma.

        :param string: String.
        :return: String of encrypted result.
        """
        new_string_list = []
        for letter in string:
            if not self.rotate_after_type:
                self.rotors[0].forward()
            if letter in self.plugboard.map_dict:
                letter = self.plugboard.map_dict[letter]
            for rotor in self.rotors:
                letter = rotor.encrypt(letter, 'right')
            letter = self.reflector.encrypt(letter, 'right')
            for rotor in reversed(self.rotors):
                letter = rotor.encrypt(letter, 'left')
            letter = self.entry_plate.encrypt(letter, 'left')
            if letter in self.plugboard.map_dict:
                letter = self.plugboard.map_dict[letter]
            new_string_list.append(letter)
            if self.rotate_after_type:
                self.rotors[0].forward()
        return ''.join(new_string_list)

    def set_position(self, *position_list):
        """Set positions of the rotors.

        :param position_list: the position of rotors from right to left.
        :raise AttributeError: If position list length is not equal to rotors number.
        """
        if not position_list:
            position_list = (0, ) * len(self.rotors)
        elif len(position_list) != len(self.rotors):
            raise AttributeError('Position list length is not equal to rotors number')
        for rotor, position in zip(self.rotors, position_list):
            rotor.set_position(position)
