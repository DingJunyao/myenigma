class Plugboard:
    """Plugboard (Steckerbrett in German) of an Enigma."""
    def __init__(self, parent=None):
        self.map_dict = {}
        self.parent = parent

    def check_parent(self):
        if self.parent is None:
            raise RuntimeError('parent of the Plugboard is None')

    def plug(self, letter_1: str, letter_2: str):
        if letter_1 == letter_2:
            raise AttributeError('Two letters can\'t be equal')
        for letter in (letter_1, letter_2):
            if letter not in self.parent.entry_plate.map_source:
                raise AttributeError(f'"{letter}" is not in map_source')
            if letter in self.map_dict and self.map_dict[letter]:
                raise RuntimeError(f'"{letter}" have been set to be connected with another letter')
        self.map_dict[letter_1] = letter_2
        self.map_dict[letter_2] = letter_1

    def unplug(self, letter: str):
        if letter not in self.parent.entry_plate.map_source:
            raise AttributeError(f'"{letter}" is not in map_source')
        if letter not in self.map_dict:
            raise RuntimeError(f'"{letter}" have not been set')
        another_letter = self.map_dict[letter]
        del self.map_dict[letter]
        del self.map_dict[another_letter]
