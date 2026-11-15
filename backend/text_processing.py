"""
Text processing utilities adapted from the original plenum_first_said bot.
This module handles word extraction, normalization, and filtering.
Enhanced with NLP analysis for gender tracking and linguistic features.
"""

import re
import logging
from typing import List, Dict, Tuple
from collections import Counter, defaultdict



def find_beginn(text: str) -> str:
    """Find the beginning of the session, skipping the table of contents.

    Looks for the session-start marker 'Beginn: <time>' (e.g. 'Beginn: 14 Uhr').
    If not found, returns the full text unchanged to avoid cutting content when
    'Beginn' appears only as a regular German word.

    Only cuts to the marker when at least 500 characters remain after it — this
    guards against old-format protocols (e.g. early Wahlperioden) where 'Beginn'
    appears at the very end of the document rather than at the start of proceedings.
    """
    match = re.search(r'Beginn\s*:\s*\d', text)
    if match:
        remaining = text[match.start():]
        if len(remaining) >= 500:
            return remaining
    return text


def dehyphenate(text: str) -> str:
    """Remove hyphenation from line breaks."""
    lines = text.split('\n')
    for num, line in enumerate(lines):
        if line.endswith('-'):
            try:
                end = lines[num + 1].split()[0]
                lines[num] = line[:-1] + end
                lines[num + 1] = lines[num + 1][len(end) + 1:]
            except Exception as e:
                logging.debug(f'Dehyphenation error: {e}')
                continue
    return '\n'.join(lines)


def pre_split_clean(text: str) -> str:
    """Clean text before splitting into words."""
    # Remove URLs
    regex_url = r'(http|ftp|https|http)://([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?'
    text = re.sub(regex_url, '', text)

    # Replace punctuation with spaces
    punctuation = r"""#"!$%&'()*+,‚.":;<=>?@[\]^_`{|}~""„'ʼ"""
    punctuation += '“”‘’«»‹›–—…/'
    for character in punctuation:
        text = text.replace(character, ' ')

    text = text.replace('\xa0', ' ')  # Remove special characters
    text = text.replace('  ', ' ')  # Double spaces to single

    return text


def wordsplitter(text: str) -> List[str]:
    """Split text into words."""
    try:
        return text.split()
    except Exception as e:
        logging.error(f'Word splitting error: {e}')
        return []


def de_enumeration(words: List[str]) -> List[str]:
    """Remove enumeration artifacts."""
    clean_words = []
    skip = 0

    for word in words:
        if skip > 0:
            skip -= 1
            continue

        if word.endswith('-') or word.endswith('–'):
            skip = 2
        else:
            clean_words.append(word)

    return clean_words


MAXIMUM_ABBREVIATION_LENGTH = 6


def looks_like_abbreviation(part: str) -> bool:
    capitals = sum(character.isupper() for character in part)
    return part[:1].isupper() and capitals >= 2 and len(part) <= MAXIMUM_ABBREVIATION_LENGTH


def has_capital_inside_word(word: str) -> bool:
    """Capitals inside a word mark glued words or OCR errors, except in abbreviations (AfD, CSU-Fraktion)."""
    return any(any(character.isupper() for character in part[1:])
               for part in word.split('-') if not looks_like_abbreviation(part))


def ok_word(word: str) -> bool:
    """Check if a word is valid."""
    # Reject single characters (isolated letters are parsing artifacts)
    if len(word) < 2:
        return False
    # Reject 2-char lowercase words (consonant clusters and word fragments)
    if len(word) == 2 and word[0].islower():
        return False

    # Word has same character repeated too many times
    regmul = re.compile('([A-z])\\1{4,}')
    if regmul.search(word) or has_capital_inside_word(word):
        return False

    return not any(i.isdigit() or i in '(.@/#_§ ' for i in word)


def words_filter(words: List[str]) -> List[str]:
    """Filter words to keep only valid ones."""
    new_words = []
    regchar = re.compile('([A-Z])|([a-z])\\w+')

    for word in words:
        if regchar.search(word):
            # Remove remaining enumeration artifacts
            if word.endswith('-,') or word.endswith('-') or word.endswith('–') or word.startswith('-'):
                continue

            if ok_word(word):
                new_words.append(word)

    return new_words


def normalize_word(word: str) -> str:
    """Normalize a word to its base form (lowercase)."""
    return word.lower()


def extract_words(text: str) -> List[str]:
    """
    Main function to extract and process words from text.
    Returns a list of normalized words.
    """
    if not text:
        return []

    # Process text
    text = find_beginn(text)
    text = pre_split_clean(text)
    text = dehyphenate(text)

    # Process words
    words = wordsplitter(text)
    words = de_enumeration(words)
    words = words_filter(words)

    return words


def count_word_frequencies(text: str) -> Dict[str, int]:
    """
    Extract words and count their frequencies.
    Returns a dictionary of {normalized_word: count}.
    """
    words = extract_words(text)

    # Normalize all words to lowercase for counting
    normalized_words = [normalize_word(word) for word in words]

    # Count frequencies
    word_counts = Counter(normalized_words)

    return dict(word_counts)


def count_word_frequencies_enhanced(text: str) -> Tuple[Dict[str, int], Dict[str, Dict]]:
    """
    Extract words and count their frequencies with NLP analysis.

    Returns:
        Tuple of (word_counts, nlp_data):
        - word_counts: Dict[str, int] - {gendered_lemma: count}
        - nlp_data: Dict[str, Dict] - {gendered_lemma: nlp_analysis}

    Note: Words are stored by their gendered_lemma to:
    - Merge grammatical cases: "Bundeskanzlers" (Genitiv) → "Bundeskanzler"
    - Keep gender forms separate: "Bundeskanzler" ≠ "Bundeskanzlerin"
    """
    words = extract_words(text)

    try:
        from enhanced_text_processing import analyze_words_batch
    except ImportError:
        logging.warning("Enhanced NLP processing not available")
        analyze_words_batch = None

    if analyze_words_batch is None:
        # Fallback to simple lowercase counting
        normalized_words = [normalize_word(word) for word in words]
        word_counts = Counter(normalized_words)
        return dict(word_counts), {}

    # Analyze all unique words in one batch (nlp.pipe is ~20x faster than
    # calling nlp(word) individually for each token).
    unique_words = list(set(words))
    word_analyses = analyze_words_batch(unique_words)

    # Count by gendered lemma — merges grammatical cases while preserving
    # gender distinctions ("Bundeskanzler" ≠ "Bundeskanzlerin").
    word_counts: dict = defaultdict(int)
    nlp_data: dict = {}

    for word in words:
        analysis = word_analyses.get(word, {'gendered_lemma': word})
        key = analysis.get('gendered_lemma', word)
        # German nouns are always capitalized; all other POS should be stored
        # lowercase to prevent duplicates like "Ursprünglich"/"ursprünglich".
        pos = analysis.get('pos', '')
        if pos not in ('NOUN', 'PROPN') and key:
            key = key.lower()
        word_counts[key] += 1
        if key not in nlp_data:
            nlp_data[key] = analysis

    return dict(word_counts), nlp_data


def get_total_word_count(text: str) -> int:
    """Get total number of words in text."""
    words = extract_words(text)
    return len(words)


if __name__ == "__main__":
    # Test the text processing
    sample_text = """
    Beginn: Dies ist ein Test-Text mit verschiedenen Wörtern.
    Dieser Text enthält auch Wörter mit Silben-
    trennung und andere Besonderheiten.
    """

    word_counts = count_word_frequencies(sample_text)
    print(f"Word frequencies: {word_counts}")
    print(f"Total words: {get_total_word_count(sample_text)}")
