"""
Custom dictionary for political neologisms and special terms.
Manually curated list of important Bundestag terminology.
"""

# Political neologisms and special terms
CUSTOM_DICTIONARY = {
    # Energy & Environment
    'energiewende': {
        'lemma': 'Energiewende',
        'gendered_lemma': 'Energiewende',
        'base_lemma': 'Energiewende',
        'pos': 'NOUN',
        'gender': 'FEM',
        'definition': 'Übergang zu erneuerbaren Energien',
        'first_known': '2011-03-11'  # Nach Fukushima
    },
    'klimapaket': {
        'lemma': 'Klimapaket',
        'gendered_lemma': 'Klimapaket',
        'base_lemma': 'Klimapaket',
        'pos': 'NOUN',
        'gender': 'NEUT',
        'definition': 'Bündel von Klimaschutzmaßnahmen'
    },
    'klimaschutzgesetz': {
        'lemma': 'Klimaschutzgesetz',
        'gendered_lemma': 'Klimaschutzgesetz',
        'base_lemma': 'Klimaschutzgesetz',
        'pos': 'NOUN',
        'gender': 'NEUT'
    },

    # Coalitions
    'groko': {
        'lemma': 'GroKo',
        'gendered_lemma': 'GroKo',
        'base_lemma': 'GroKo',
        'pos': 'NOUN',
        'gender': 'FEM',
        'is_abbreviation': True,
        'full_form': 'Große Koalition',
        'definition': 'Koalition aus CDU/CSU und SPD'
    },
    'ampel': {
        'lemma': 'Ampel',
        'gendered_lemma': 'Ampel',
        'base_lemma': 'Ampel',
        'pos': 'NOUN',
        'gender': 'FEM',
        'context': 'Ampel-Koalition (SPD, Grüne, FDP)'
    },
    'jamaika': {
        'lemma': 'Jamaika',
        'gendered_lemma': 'Jamaika',
        'base_lemma': 'Jamaika',
        'pos': 'NOUN',
        'gender': 'NEUT',
        'context': 'Jamaika-Koalition (CDU/CSU, FDP, Grüne)'
    },

    # Scandals & Affairs
    'dieselgate': {
        'lemma': 'Dieselgate',
        'gendered_lemma': 'Dieselgate',
        'base_lemma': 'Dieselgate',
        'pos': 'NOUN',
        'gender': 'NEUT',
        'definition': 'Abgasskandal bei Dieselfahrzeugen'
    },

    # Covid-related (newer terms)
    'corona-pandemie': {
        'lemma': 'Corona-Pandemie',
        'gendered_lemma': 'Corona-Pandemie',
        'base_lemma': 'Corona-Pandemie',
        'pos': 'NOUN',
        'gender': 'FEM',
        'first_known': '2020-03-01'
    },
    'lockdown': {
        'lemma': 'Lockdown',
        'gendered_lemma': 'Lockdown',
        'base_lemma': 'Lockdown',
        'pos': 'NOUN',
        'gender': 'MASC',
        'first_known': '2020-03-15'
    },
    'homeoffice': {
        'lemma': 'Homeoffice',
        'gendered_lemma': 'Homeoffice',
        'base_lemma': 'Homeoffice',
        'pos': 'NOUN',
        'gender': 'NEUT'
    },

    # Migration
    'flüchtlingskrise': {
        'lemma': 'Flüchtlingskrise',
        'gendered_lemma': 'Flüchtlingskrise',
        'base_lemma': 'Flüchtlingskrise',
        'pos': 'NOUN',
        'gender': 'FEM',
        'first_known': '2015-09-01'
    },

    # Digital
    'digitalisierung': {
        'lemma': 'Digitalisierung',
        'gendered_lemma': 'Digitalisierung',
        'base_lemma': 'Digitalisierung',
        'pos': 'NOUN',
        'gender': 'FEM'
    },
    'datenschutzgrundverordnung': {
        'lemma': 'Datenschutzgrundverordnung',
        'gendered_lemma': 'Datenschutzgrundverordnung',
        'base_lemma': 'Datenschutzgrundverordnung',
        'pos': 'NOUN',
        'gender': 'FEM',
        'abbreviation': 'DSGVO'
    },

    # Economic
    'schuldenbremse': {
        'lemma': 'Schuldenbremse',
        'gendered_lemma': 'Schuldenbremse',
        'base_lemma': 'Schuldenbremse',
        'pos': 'NOUN',
        'gender': 'FEM'
    },
    'mindestlohn': {
        'lemma': 'Mindestlohn',
        'gendered_lemma': 'Mindestlohn',
        'base_lemma': 'Mindestlohn',
        'pos': 'NOUN',
        'gender': 'MASC'
    },

    # Abbreviations — Parties
    'spd': {
        'lemma': 'SPD', 'gendered_lemma': 'SPD', 'base_lemma': 'SPD',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Sozialdemokratische Partei Deutschlands',
    },
    'cdu': {
        'lemma': 'CDU', 'gendered_lemma': 'CDU', 'base_lemma': 'CDU',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Christlich Demokratische Union Deutschlands',
    },
    'csu': {
        'lemma': 'CSU', 'gendered_lemma': 'CSU', 'base_lemma': 'CSU',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Christlich-Soziale Union in Bayern',
    },
    'fdp': {
        'lemma': 'FDP', 'gendered_lemma': 'FDP', 'base_lemma': 'FDP',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Freie Demokratische Partei',
    },
    'afd': {
        'lemma': 'AfD', 'gendered_lemma': 'AfD', 'base_lemma': 'AfD',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Alternative für Deutschland',
    },
    'ssw': {
        'lemma': 'SSW', 'gendered_lemma': 'SSW', 'base_lemma': 'SSW',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Südschleswigscher Wählerverband',
    },
    'bsw': {
        'lemma': 'BSW', 'gendered_lemma': 'BSW', 'base_lemma': 'BSW',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bündnis Sahra Wagenknecht',
    },
    'npd': {
        'lemma': 'NPD', 'gendered_lemma': 'NPD', 'base_lemma': 'NPD',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Nationaldemokratische Partei Deutschlands',
    },
    'kpd': {
        'lemma': 'KPD', 'gendered_lemma': 'KPD', 'base_lemma': 'KPD',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Kommunistische Partei Deutschlands',
    },
    'wasg': {
        'lemma': 'WASG', 'gendered_lemma': 'WASG', 'base_lemma': 'WASG',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Wahlalternative Arbeit und soziale Gerechtigkeit',
    },
    'pds': {
        'lemma': 'PDS', 'gendered_lemma': 'PDS', 'base_lemma': 'PDS',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Partei des Demokratischen Sozialismus',
    },

    # Abbreviations — Parliamentary & Constitutional
    'breg': {
        'lemma': 'BReg', 'gendered_lemma': 'BReg', 'base_lemma': 'BReg',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundesregierung',
    },
    'btag': {
        'lemma': 'BTag', 'gendered_lemma': 'BTag', 'base_lemma': 'BTag',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundestag',
    },
    'brat': {
        'lemma': 'BRat', 'gendered_lemma': 'BRat', 'base_lemma': 'BRat',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundesrat',
    },
    'gg': {
        'lemma': 'GG', 'gendered_lemma': 'GG', 'base_lemma': 'GG',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Grundgesetz',
    },

    # Abbreviations — Federal Ministries
    'bmf': {
        'lemma': 'BMF', 'gendered_lemma': 'BMF', 'base_lemma': 'BMF',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundesministerium der Finanzen',
    },
    'bmi': {
        'lemma': 'BMI', 'gendered_lemma': 'BMI', 'base_lemma': 'BMI',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundesministerium des Innern',
    },
    'bmbf': {
        'lemma': 'BMBF', 'gendered_lemma': 'BMBF', 'base_lemma': 'BMBF',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundesministerium für Bildung und Forschung',
    },
    'bmwk': {
        'lemma': 'BMWK', 'gendered_lemma': 'BMWK', 'base_lemma': 'BMWK',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundesministerium für Wirtschaft und Klimaschutz',
    },
    'bmj': {
        'lemma': 'BMJ', 'gendered_lemma': 'BMJ', 'base_lemma': 'BMJ',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundesministerium der Justiz',
    },
    'bmvj': {
        'lemma': 'BMVJ', 'gendered_lemma': 'BMVJ', 'base_lemma': 'BMVJ',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundesministerium der Justiz und für Verbraucherschutz',
    },
    'bmgs': {
        'lemma': 'BMGS', 'gendered_lemma': 'BMGS', 'base_lemma': 'BMGS',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundesministerium für Gesundheit und Soziale Sicherung',
    },

    # Abbreviations — Security & Intelligence
    'bka': {
        'lemma': 'BKA', 'gendered_lemma': 'BKA', 'base_lemma': 'BKA',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundeskriminalamt',
    },
    'bfv': {
        'lemma': 'BfV', 'gendered_lemma': 'BfV', 'base_lemma': 'BfV',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundesamt für Verfassungsschutz',
    },
    'bnd': {
        'lemma': 'BND', 'gendered_lemma': 'BND', 'base_lemma': 'BND',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bundesnachrichtendienst',
    },
    'mad': {
        'lemma': 'MAD', 'gendered_lemma': 'MAD', 'base_lemma': 'MAD',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Militärischer Abschirmdienst',
    },

    # Abbreviations — European & International
    'ezb': {
        'lemma': 'EZB', 'gendered_lemma': 'EZB', 'base_lemma': 'EZB',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Europäische Zentralbank',
    },
    'eu': {
        'lemma': 'EU', 'gendered_lemma': 'EU', 'base_lemma': 'EU',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Europäische Union',
    },
    'nato': {
        'lemma': 'NATO', 'gendered_lemma': 'NATO', 'base_lemma': 'NATO',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'North Atlantic Treaty Organization',
    },
    'wto': {
        'lemma': 'WTO', 'gendered_lemma': 'WTO', 'base_lemma': 'WTO',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'World Trade Organization',
    },
    'iwf': {
        'lemma': 'IWF', 'gendered_lemma': 'IWF', 'base_lemma': 'IWF',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Internationaler Währungsfonds',
    },
    'un': {
        'lemma': 'UN', 'gendered_lemma': 'UN', 'base_lemma': 'UN',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'United Nations',
    },
    'who': {
        'lemma': 'WHO', 'gendered_lemma': 'WHO', 'base_lemma': 'WHO',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'World Health Organization',
    },
    'oecd': {
        'lemma': 'OECD', 'gendered_lemma': 'OECD', 'base_lemma': 'OECD',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Organisation for Economic Co-operation and Development',
    },
    'osze': {
        'lemma': 'OSZE', 'gendered_lemma': 'OSZE', 'base_lemma': 'OSZE',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Organisation für Sicherheit und Zusammenarbeit in Europa',
    },

    # Abbreviations — German States (Bundesländer)
    'nrw': {
        'lemma': 'NRW', 'gendered_lemma': 'NRW', 'base_lemma': 'NRW',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Nordrhein-Westfalen',
    },
    'bw': {
        'lemma': 'BW', 'gendered_lemma': 'BW', 'base_lemma': 'BW',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Baden-Württemberg',
    },
    'by': {
        'lemma': 'BY', 'gendered_lemma': 'BY', 'base_lemma': 'BY',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Bayern',
    },

    # Abbreviations — Mixed-case (handled by custom_dict Stage 1)
    'gmbh': {
        'lemma': 'GmbH', 'gendered_lemma': 'GmbH', 'base_lemma': 'GmbH',
        'pos': 'NOUN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Gesellschaft mit beschränkter Haftung',
    },
    'ag': {
        'lemma': 'AG', 'gendered_lemma': 'AG', 'base_lemma': 'AG',
        'pos': 'NOUN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Aktiengesellschaft',
    },
    'dsgvo': {
        'lemma': 'DSGVO', 'gendered_lemma': 'DSGVO', 'base_lemma': 'DSGVO',
        'pos': 'PROPN', 'gender': 'NONE',
        'is_abbreviation': True,
        'full_form': 'Datenschutz-Grundverordnung',
    },

    # Titles (gendered - examples)
    'bundeskanzlerin': {
        'lemma': 'Bundeskanzlerin',
        'gendered_lemma': 'Bundeskanzlerin',
        'base_lemma': 'Bundeskanzler',
        'pos': 'NOUN',
        'gender': 'FEM',
        'first_known': '2005-11-22'
    },
    'ministerpräsidentin': {
        'lemma': 'Ministerpräsidentin',
        'gendered_lemma': 'Ministerpräsidentin',
        'base_lemma': 'Ministerpräsident',
        'pos': 'NOUN',
        'gender': 'FEM'
    },
}


def lookup_custom_word(word: str) -> dict:
    """
    Looks up a word in the custom dictionary.

    Args:
        word: Word to look up (case-insensitive)

    Returns:
        Dictionary with word information or None
    """
    word_lower = word.lower()
    word_title = word.capitalize()

    # Try exact match
    if word in CUSTOM_DICTIONARY:
        return {**CUSTOM_DICTIONARY[word], 'original': word}

    # Try lowercase
    if word_lower in CUSTOM_DICTIONARY:
        return {**CUSTOM_DICTIONARY[word_lower], 'original': word}

    # Try title case
    if word_title.lower() in CUSTOM_DICTIONARY:
        return {**CUSTOM_DICTIONARY[word_title.lower()], 'original': word}

    return None


def is_in_custom_dict(word: str) -> bool:
    """Check if word is in custom dictionary."""
    return lookup_custom_word(word) is not None


def get_all_custom_words() -> list[str]:
    """Get list of all words in custom dictionary."""
    return list(CUSTOM_DICTIONARY.keys())


def add_to_custom_dict(word_info: dict):
    """
    Add a word to the custom dictionary (for future expansions).

    Args:
        word_info: Dictionary with word information
    """
    word_key = word_info.get('lemma', '').lower()
    if word_key:
        CUSTOM_DICTIONARY[word_key] = word_info


if __name__ == "__main__":
    # Test the dictionary
    print(f"Custom dictionary contains {len(CUSTOM_DICTIONARY)} entries\n")

    # Test lookups
    test_words = ['Energiewende', 'groko', 'KLIMAPAKET', 'Bundeskanzlerin']

    for word in test_words:
        result = lookup_custom_word(word)
        if result:
            print(f"'{word}' found:")
            print(f"  Lemma: {result['lemma']}")
            print(f"  POS: {result['pos']}, Gender: {result['gender']}")
            if 'definition' in result:
                print(f"  Definition: {result['definition']}")
        else:
            print(f"'{word}' not in dictionary")
        print()
