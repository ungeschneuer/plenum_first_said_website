"""Rules-based German noun inflection generator."""
from typing import List


def generate_word_forms(word: str, pos_tag: str, gender: str) -> List[str]:
    """
    Generate typical German case forms that get merged into this lemma.
    Returns list with canonical form first; returns [word] if no variants apply.
    Only meaningful for NOUN and PROPN.
    """
    if pos_tag not in ('NOUN', 'PROPN') or not word:
        return [word]

    forms = {word}
    w = word.lower()
    sibilant = w.endswith(('s', 'ss', 'sch', 'tz', 'z', 'x', 'ß'))

    if pos_tag == 'PROPN':
        if not sibilant:
            forms.add(word + 's')
    elif gender in ('MASC', 'NEUT'):
        forms.add(word + 'es' if sibilant else word + 's')
        if gender == 'MASC' and w.endswith(('er', 'el', 'en')):
            forms.add(word + 'n')   # Dativ Plural: Bundeskanzlern
    elif gender == 'FEM':
        if w.endswith('in') and not w.endswith('ion') and len(word) > 3:
            forms.add(word + 'nen')  # Bundeskanzlerinnen
        elif w.endswith(('ung', 'heit', 'keit', 'schaft')):
            forms.add(word + 'en')   # Regierungen

    # Canonical form always first
    variants = sorted(forms - {word})
    return [word] + variants
