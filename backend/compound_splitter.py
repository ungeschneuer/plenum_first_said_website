"""
Simple German compound word splitter.
Uses pattern matching and a basic vocabulary for splitting compounds.
"""

import re

# Common German word parts and stems (simplified list)
COMMON_STEMS = {
    # Institutions
    'bundestag', 'bundesrat', 'bundeskanzler', 'bundesregierung', 'bundes',
    'landtag', 'parlament',

    # Titles
    'minister', 'präsident', 'kanzler', 'abgeordnete', 'abgeordneter',
    'vorsitzende', 'vorsitzender', 'sprecher', 'sprecherin',

    # Topics
    'klima', 'energie', 'umwelt', 'wirtschaft', 'finanzen', 'bildung',
    'gesundheit', 'arbeit', 'sozial', 'digital', 'europa',

    # Actions/Concepts
    'politik', 'gesetz', 'reform', 'schutz', 'sicherheit', 'wende',
    'konzept', 'paket', 'plan', 'programm', 'strategie',

    # Modifiers
    'neu', 'alt', 'groß', 'klein', 'ober', 'unter', 'haupt', 'neben'
}

# Fugenelement (linking elements in compounds)
FUGEN_ELEMENTS = ['s', 'n', 'en', 'es', 'e', 'er']


def split_compound_simple(word: str, min_part_length: int = 3) -> list[str]:
    """
    Simple compound splitter for German words.

    Strategy:
    1. Try to find known stems
    2. Handle common linking elements (Fugen-s, Fugen-n)
    3. Return parts if found, otherwise return whole word

    Args:
        word: Word to split
        min_part_length: Minimum length for a valid part

    Returns:
        List of parts (or [word] if not splittable)
    """
    word_lower = word.lower()

    # Don't split short words
    if len(word) < 8:
        return [word]

    parts = []
    remaining = word_lower
    original_remaining = word

    while len(remaining) >= min_part_length:
        found = False

        # Try to find a stem at the beginning
        for length in range(len(remaining), min_part_length - 1, -1):
            prefix = remaining[:length]

            # Check if this prefix is a known stem
            if prefix in COMMON_STEMS:
                # Found a part!
                parts.append(original_remaining[:length])
                remaining = remaining[length:]
                original_remaining = original_remaining[length:]

                # Handle Fugenelement
                for fuge in FUGEN_ELEMENTS:
                    if remaining.startswith(fuge):
                        # Skip the linking element
                        skip_len = len(fuge)
                        remaining = remaining[skip_len:]
                        original_remaining = original_remaining[skip_len:]
                        break

                found = True
                break

        if not found:
            # Couldn't split further
            if remaining:
                parts.append(original_remaining)
            break

    # Return parts if we successfully split, otherwise return original
    if len(parts) > 1:
        return parts
    else:
        return [word]


def analyze_compound(word: str) -> dict:
    """
    Analyzes a compound word.

    Returns:
        {
            'original': str,
            'is_compound': bool,
            'parts': list[str],
            'head': str,           # Last part (determines properties)
            'modifiers': list[str] # All parts except last
        }
    """
    parts = split_compound_simple(word)

    is_compound = len(parts) > 1

    return {
        'original': word,
        'is_compound': is_compound,
        'parts': parts,
        'head': parts[-1] if parts else word,
        'modifiers': parts[:-1] if len(parts) > 1 else []
    }


def get_compound_gender_hint(word: str) -> str:
    """
    Tries to determine gender from compound structure.

    In German, the last part (head) determines the gender.
    """
    compound_info = analyze_compound(word)
    head = compound_info['head'].lower()

    # Check head for gender indicators
    if head.endswith('in'):
        return 'FEM'
    elif head.endswith('ung') or head.endswith('keit') or head.endswith('heit'):
        return 'FEM'
    elif head.endswith('er') or head.endswith('ismus'):
        return 'MASC'
    elif head.endswith('chen') or head.endswith('lein'):
        return 'NEUT'
    elif head.endswith('um'):
        return 'NEUT'

    return 'UNKNOWN'


if __name__ == "__main__":
    # Test the compound splitter
    test_words = [
        "Bundeskanzler",
        "Bundeskanzlerin",
        "Bundestagsabgeordnete",
        "Energiewende",
        "Klimaschutzgesetz",
        "Klimakanzlerin",
        "Bundesregierung",
        "Ministerpräsident",
        "Europaabgeordnete"
    ]

    print("Compound Splitter Tests:\n")
    for word in test_words:
        result = analyze_compound(word)
        gender = get_compound_gender_hint(word)

        print(f"{word}:")
        if result['is_compound']:
            print(f"  ✓ Compound: {' + '.join(result['parts'])}")
            print(f"  Head: {result['head']}")
            if result['modifiers']:
                print(f"  Modifiers: {', '.join(result['modifiers'])}")
        else:
            print(f"  ✗ Not split")

        if gender != 'UNKNOWN':
            print(f"  Gender hint: {gender}")
        print()
