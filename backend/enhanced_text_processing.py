"""
Enhanced text processing with:
- spaCy for linguistic analysis
- Custom dictionary for political terms
- Compound splitting for German
- Gender-aware analysis
- OOV tracking
"""

import spacy
import logging
from typing import Dict, List, Optional, Tuple
from custom_dictionary import lookup_custom_word
from compound_splitter import analyze_compound, get_compound_gender_hint

# Load German spaCy model
try:
    nlp = spacy.load("de_core_news_sm", disable=["parser", "ner"])
    logging.info("Loaded spaCy model: de_core_news_sm")
except:
    logging.error("Could not load spaCy model. Run: uv pip install de_core_news_sm")
    nlp = None


def determine_gender(token, word: str) -> str:
    """
    Determines grammatical gender using multiple strategies.

    Strategies:
    1. spaCy morphology
    2. Word endings
    3. Compound analysis
    """
    # Strategy 1: spaCy morphology
    if token and token.morph.get("Gender"):
        gender_values = token.morph.get("Gender")
        if gender_values:
            gender = gender_values[0]
            # Convert spaCy format to our format
            if gender == "Masc":
                return "MASC"
            elif gender == "Fem":
                return "FEM"
            elif gender == "Neut":
                return "NEUT"

    # Strategy 2: Word endings
    word_lower = word.lower()

    # Feminine endings
    if word.endswith('in') and len(word) > 2:
        return "FEM"
    if word.endswith('ung') or word.endswith('keit') or word.endswith('heit'):
        return "FEM"
    if word.endswith('schaft') or word.endswith('ion'):
        return "FEM"

    # Masculine endings
    if word.endswith('er') and len(word) > 2:
        # But not words ending in -erin (feminine)
        if not word.endswith('erin'):
            return "MASC"
    if word.endswith('ismus') or word.endswith('ling'):
        return "MASC"

    # Neuter endings
    if word.endswith('chen') or word.endswith('lein'):
        return "NEUT"
    if word.endswith('um') or word.endswith('ment'):
        return "NEUT"

    # Strategy 3: Try compound analysis
    gender_hint = get_compound_gender_hint(word)
    if gender_hint != "UNKNOWN":
        return gender_hint

    # Default for capitalized nouns
    if word and word[0].isupper():
        return "UNKNOWN_NOUN"

    return "UNKNOWN"


def derive_base_from_feminine(word: str) -> Tuple[str, str]:
    """
    Derive masculine base form from feminine word ending in -in.

    Returns (base_lemma, gendered_lemma)

    Examples:
        Bundeskanzlerin → (Bundeskanzler, Bundeskanzlerin)
        Ministerin → (Minister, Ministerin)
        Abgabe → (Abgabe, Abgabe)  # Not gendered
    """
    if word.endswith('in') and len(word) > 2:
        # Check if this is a gendered form by looking at what comes before -in
        stem = word[:-2]

        # If stem ends in 'er', it's likely a profession (Lehrer → Lehrerin)
        if stem.endswith('er'):
            return (stem, word)

        # If stem ends in consonant, might be gendered (Arzt → Ärztin)
        # But we can't reliably detect this, so keep it as-is
        return (word, word)
    else:
        # Not a gendered form
        return (word, word)


def analyze_word_enhanced(word: str) -> Dict:
    """
    Comprehensive word analysis using all available strategies.

    Pipeline:
    1. Custom Dictionary (HIGH confidence)
    2. spaCy Standard (HIGH confidence)
    3. Compound Splitting (MEDIUM confidence)
    4. Pattern Fallback (LOW confidence)

    Returns:
        {
            'original': str,
            'lemma': str,
            'gendered_lemma': str,
            'base_lemma': str,
            'gender': str,
            'pos': str,
            'is_compound': bool,
            'compound_parts': list,
            'source': str,
            'confidence': str
        }
    """
    # Stage 0: All-caps acronym detection
    if word.isupper() and 2 <= len(word) <= 7:
        return {
            'original': word, 'lemma': word, 'gendered_lemma': word,
            'base_lemma': word, 'gender': 'NONE', 'pos': 'PROPN',
            'is_compound': False, 'compound_parts': [word],
            'source': 'ACRONYM', 'confidence': 'MEDIUM',
            'is_abbreviation': True,
        }

    # Stage 1: Custom Dictionary
    custom_result = lookup_custom_word(word)
    if custom_result:
        return {
            **custom_result,
            'is_compound': False,
            'compound_parts': [word],
            'source': 'CUSTOM_DICT',
            'confidence': 'HIGH'
        }

    # Stage 2: spaCy Analysis
    if nlp:
        try:
            doc = nlp(word)
            if doc and len(doc) > 0:
                result = _build_spacy_result(doc[0], word)
                if result:
                    return result
        except Exception as e:
            logging.debug(f"spaCy analysis failed for '{word}': {e}")

    # Stages 3+4: Compound Splitting and Pattern Fallback
    return _build_fallback_result(word)


def _build_spacy_result(token, word: str) -> Optional[Dict]:
    """Build an analysis dict from a spaCy token - shared by single and batch paths."""
    if token.pos_ != 'X' or token.lemma_ != word:
        gender = determine_gender(token, word)
        base_lemma = token.lemma_

        if (base_lemma == word and
                token.morph.get("Number") == ["Plur"] and
                token.morph.get("Case") == ["Dat"] and
                word.endswith("n") and not word.endswith("en")):
            base_lemma = word[:-1]

        # Fix A: spaCy strips only "-n" from a "-en" plural suffix, leaving an
        # ungrammatical intermediate (e.g. "Agenturen" → "Agenture" not "Agentur").
        # Applies when the word ends in a pattern whose correct base ends in a
        # consonant cluster: -ur, -or, -ar, -är, -ir.
        if base_lemma == word[:-1]:
            w_lower = word.lower()
            for bad_suffix in ("uren", "oren", "aren", "ären", "iren"):
                if w_lower.endswith(bad_suffix):
                    base_lemma = word[:-2]
                    break

        # Fix B: spaCy doesn't strip the plural "-e" suffix at all for certain
        # German noun classes. Two safe patterns:
        #   -eure  →  -eur  (Friseure → Friseur, Masseure → Masseur)
        #   -äre   →  -är   (Staatssekretäre → Staatssekretär, Millionäre → Millionär)
        # These base forms (-eur, -är) never end in "-e" in German, so the fix
        # is unambiguous. French loanwords ending in "-aire"/"-oire" are excluded.
        if base_lemma == word and token.pos_ in ('NOUN', 'PROPN') and len(word) > 5:
            w_lower = word.lower()
            if w_lower.endswith("eure") or (
                    w_lower.endswith("äre") and
                    not w_lower.endswith("phäre") and   # Atmosphäre, Biosphäre are correct FEM
                    not w_lower.endswith("affäre")):    # Affäre is correct FEM
                base_lemma = word[:-1]

        # Fix C: inflected adjective "-e" forms stored instead of base adjective.
        # e.g. "vertretbare" → "vertretbar", "revolutionäre" → "revolutionär".
        # Safe for -are/-äre/-ure/-ire patterns; French -aire/-oire excluded.
        if base_lemma == word and token.pos_ == 'ADJ' and len(word) > 5:
            w_lower = word.lower()
            for bad_end in ("are", "äre", "ure", "ire"):
                if (w_lower.endswith(bad_end) and
                        not w_lower.endswith("aire") and
                        not w_lower.endswith("oire")):
                    base_lemma = word[:-1]
                    break

        # Fix D: -iert compound adjectives that spaCy could not analyse (returned
        # the word unchanged as lemma), typically misidentified as VERB or NOUN.
        # e.g. "effizienzorientierten" (VERB) → "effizienzorientiert" (ADJ)
        #      "eigenorientierter"     (NOUN) → "eigenorientiert"     (ADJ)
        # Only fires when base_lemma == word (spaCy gave up and returned the
        # surface form), so known -ieren verbs like "integrieren" are unaffected.
        if base_lemma == word and len(word) > 8:
            w_lower = word.lower()
            for suffix, strip_n in (("ierten", 2), ("ierter", 2),
                                    ("iertem", 2), ("iertes", 2), ("ierte", 1)):
                if w_lower.endswith(suffix):
                    base_lemma = word[:-strip_n]
                    gendered_lemma = base_lemma
                    break

        # Fix E: -ig compound adjective declined forms that spaCy could not
        # analyse (returned the word unchanged as lemma).
        # e.g. "sozialversicherungspflichtigen" → "sozialversicherungspflichtig"
        #      "verschreibungspflichtiges"      → "verschreibungspflichtig"
        # Threshold len > 18 avoids real verb infinitives ending in -igen
        # (e.g. "berücksichtigen" is 15 chars and known to spaCy anyway).
        if base_lemma == word and len(word) > 18:
            w_lower = word.lower()
            for suffix, strip_n in (("igen", 2), ("iges", 2), ("igem", 2),
                                    ("iger", 2), ("ige", 1)):
                if w_lower.endswith(suffix):
                    candidate = word[:-strip_n]
                    if candidate.lower().endswith('ig'):
                        base_lemma = candidate
                        gendered_lemma = base_lemma
                        break

        # Fix F: -lich/-isch/-bar/-los/-voll compound adjective declined forms.
        # e.g. "verfassungsrechtlichen" → "verfassungsrechtlich"
        #      "gesellschaftspolitischen" → "gesellschaftspolitisch"
        #      "unveräußerbaren" → "unveräußerbar"
        # Threshold len > 16 safely excludes known short verbs/past-participles
        # (e.g. "verstaatlichen" is 14 chars).
        if base_lemma == word and len(word) > 16:
            w_lower = word.lower()
            for base_sfx, inflect_sfxs in (
                ('lich',  (('lichen', 2), ('liches', 2), ('lichem', 2),
                           ('licher', 2), ('liche',  1))),
                ('isch',  (('ischen', 2), ('isches', 2), ('ischem', 2),
                           ('ischer', 2), ('ische',  1))),
                ('bar',   (('baren',  2), ('bares',  2), ('barem',  2),
                           ('barer',  2), ('bare',   1))),
                ('los',   (('losen',  2), ('loses',  2), ('losem',  2),
                           ('loser',  2), ('lose',   1))),
                ('voll',  (('vollen', 2), ('volles', 2), ('vollem', 2),
                           ('voller', 2), ('volle',  1))),
            ):
                matched = False
                for suffix, strip_n in inflect_sfxs:
                    if w_lower.endswith(suffix):
                        candidate = word[:-strip_n]
                        if candidate.lower().endswith(base_sfx):
                            base_lemma = candidate
                            gendered_lemma = base_lemma
                            matched = True
                        break
                if matched:
                    break

        if gender == 'FEM' and token.pos_ == 'NOUN':
            base_lemma, gendered_lemma = derive_base_from_feminine(base_lemma)
        else:
            gendered_lemma = base_lemma

        return {
            'original': word,
            'lemma': token.lemma_,
            'gendered_lemma': gendered_lemma,
            'base_lemma': base_lemma,
            'gender': gender,
            'pos': token.pos_,
            'is_compound': False,
            'compound_parts': [word],
            'source': 'SPACY',
            'confidence': 'HIGH'
        }
    return None


def _build_fallback_result(word: str) -> Dict:
    """Stage 3+4 analysis for words spaCy could not handle."""
    compound_info = analyze_compound(word)
    if compound_info['is_compound']:
        head = compound_info['head']
        gender = get_compound_gender_hint(word)
        head_pos = 'NOUN'
        if nlp:
            try:
                head_doc = nlp(head)
                if head_doc and len(head_doc) > 0:
                    head_token = head_doc[0]
                    if head_token.pos_ != 'X':
                        head_pos = head_token.pos_
                        if gender == 'UNKNOWN':
                            gender = determine_gender(head_token, head)
            except Exception as e:
                logging.warning(f"spaCy analysis failed for compound head '{head}' of '{word}': {e}")
        canonical = "".join(compound_info['parts'])
        return {
            'original': word,
            'lemma': canonical,
            'gendered_lemma': canonical,
            'base_lemma': canonical,
            'gender': gender if gender != 'UNKNOWN' else 'UNKNOWN_NOUN',
            'pos': head_pos,
            'is_compound': True,
            'compound_parts': compound_info['parts'],
            'source': 'COMPOUND_SPLIT',
            'confidence': 'MEDIUM'
        }

    is_capitalized = word[0].isupper() if word else False
    if is_capitalized:
        gender = determine_gender(None, word)
        return {
            'original': word, 'lemma': word, 'gendered_lemma': word,
            'base_lemma': word,
            'gender': gender if gender != 'UNKNOWN' else 'UNKNOWN_NOUN',
            'pos': 'NOUN', 'is_compound': False, 'compound_parts': [word],
            'source': 'PATTERN_FALLBACK', 'confidence': 'LOW'
        }
    pos = 'VERB' if word.endswith('en') else 'ADJ'
    return {
        'original': word, 'lemma': word, 'gendered_lemma': word,
        'base_lemma': word, 'gender': 'NONE', 'pos': pos,
        'is_compound': False, 'compound_parts': [word],
        'source': 'PATTERN_FALLBACK', 'confidence': 'LOW'
    }


def analyze_words_batch(words: List[str]) -> Dict[str, Dict]:
    """
    Batch version of analyze_word_enhanced.

    Uses nlp.pipe() for ~20x faster spaCy throughput compared to calling
    nlp(word) individually.  Returns a mapping {word: analysis_dict}.
    """
    results: Dict[str, Dict] = {}
    spacy_queue: List[str] = []

    # Stage 0+1: Acronym detection then Custom Dictionary (no NLP needed)
    for word in words:
        if word.isupper() and 2 <= len(word) <= 7:
            results[word] = {
                'original': word, 'lemma': word, 'gendered_lemma': word,
                'base_lemma': word, 'gender': 'NONE', 'pos': 'PROPN',
                'is_compound': False, 'compound_parts': [word],
                'source': 'ACRONYM', 'confidence': 'MEDIUM',
                'is_abbreviation': True,
            }
            continue
        custom_result = lookup_custom_word(word)
        if custom_result:
            results[word] = {
                **custom_result,
                'is_compound': False,
                'compound_parts': [word],
                'source': 'CUSTOM_DICT',
                'confidence': 'HIGH'
            }
        else:
            spacy_queue.append(word)

    # Stage 2: spaCy batch — one forward pass for all remaining words
    if nlp and spacy_queue:
        try:
            for word, doc in zip(spacy_queue, nlp.pipe(spacy_queue, batch_size=256)):
                if doc and len(doc) > 0:
                    result = _build_spacy_result(doc[0], word)
                    if result:
                        results[word] = result
        except Exception as e:
            logging.debug(f"spaCy batch processing error: {e}")

    # Stage 3+4: Compound / Pattern fallback for words still unresolved
    for word in words:
        if word not in results:
            results[word] = _build_fallback_result(word)

    return results


if __name__ == "__main__":
    # Test the enhanced analysis
    test_words = [
        "Energiewende",
        "Bundeskanzlerin",
        "Klimapaket",
        "Bundestagsabgeordnete",
        "Digitalisierung",
        "Klimakanzlerin",  # Neologism!
        "GroKo",
        "laufen",
        "Minister",
        "Ministerin"
    ]

    print("Enhanced Word Analysis Tests:\n")
    print("=" * 80)

    for word in test_words:
        result = analyze_word_enhanced(word)

        print(f"\n{word}:")
        print(f"  Lemma: {result['lemma']}")
        print(f"  Gendered Lemma: {result['gendered_lemma']}")
        print(f"  POS: {result['pos']}, Gender: {result['gender']}")

        if result['is_compound']:
            print(f"  ✓ Compound: {' + '.join(result['compound_parts'])}")

        print(f"  Source: {result['source']} (Confidence: {result['confidence']})")

    print("\n" + "=" * 80)
