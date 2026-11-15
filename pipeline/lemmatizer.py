"""Lemmatisation of German word forms from plenary protocols.

Each distinct form is lemmatised once, without sentence context, in this order:
  1. semantic exceptions, where the dictionary lemma would merge words of different meaning (Daten, Medien)
  2. hyphenated words: only the last part is inflected (Corona-Pandemien -> Corona-Pandemie)
  3. abbreviations in capitals stay as they are (SPD, AfD)
  4. a capitalised form that is not in the dictionary and occurs more often in lower case stands at the
     start of a sentence and is read in lower case; a lower-case form that the dictionary knows only as a noun
     and whose capitalised spelling occurs far more often is a typo and is read capitalised (klimawandel)
  5. present participles stay adjectives (spannende -> spannend), as they are nearly always used as such
  6. dictionary lookup (simplemma); feminine forms stay their own lemma (Kolleginnen -> Kollegin); for
     capitalised words the lemma must equal the form up to its ending, which keeps names intact
     (Hellmich would otherwise become Hellich)
  7. unknown compounds: the longest known final part decides the inflection (Kompetenzgrenzen -> Kompetenzgrenze)
  8. unknown past participles become the verb if the dictionary knows it (umzingelt -> umzingeln)
  9. unknown adjectives and nouns: an inflection ending is removed if the remaining form occurs in the corpus
     or ends in a productive adjective suffix (quasizensorischer -> quasizensorisch)
 10. otherwise the form is its own lemma
Finally a lemma spelt with ß takes the spelling with ss if that is more frequent since the spelling reform,
because the dictionary mixes both (Ausschuss -> Ausschuß, but Ausschüsse -> Ausschuss) and the protocols
span 1949 to today (Prozeß -> Prozess, daß -> dass; Straße stays).

Lemmas keep their capitalisation, so the noun Leben and the verb leben stay apart.
"""

from collections.abc import Mapping

import re

import simplemma

LANGUAGE = 'de'
MINIMUM_COMPOUND_HEAD_LENGTH = 4
# Short final parts of lower-case words are often word endings that happen to be words (minimalis|tische).
MINIMUM_LOWERCASE_COMPOUND_HEAD_LENGTH = 8
MINIMUM_COMPOUND_MODIFIER_LENGTH = 3
MINIMUM_STRIPPED_LENGTH = 4
LOWERCASE_ENDINGS = ('en', 'em', 'er', 'es', 'e')
CAPITALISED_ENDINGS = ('es', 'en', 's', 'n')
FEMININE_PLURAL_ENDING = 'innen'
ADJECTIVE_SUFFIXES = ('isch', 'lich', 'ig', 'bar', 'los', 'haft', 'sam', 'iv', 'ell', 'ös')
PRESENT_PARTICIPLE = re.compile(r'^([a-zäöüß]{3,}end)(e|en|em|er|es)?$')
MINIMUM_PARTICIPLE_LENGTH = 6
TYPO_FREQUENCY_RATIO = 10
UMLAUT_FREE = str.maketrans({'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 'ss'})

# Forms whose dictionary lemma has another meaning or another referent, or is wrong in the dictionary.
SEMANTIC_EXCEPTIONS = {
    'gesamt': 'gesamt',
    'Gesamt': 'gesamt',
    'Daten': 'Daten',
    'Medien': 'Medien',
    'Kosten': 'Kosten',
    'Schulden': 'Schulden',
    'Finanzen': 'Finanzen',
    'Leute': 'Leute',
    'Eltern': 'Eltern',
    'Grüne': 'Grüne',
    'Grünen': 'Grüne',
    'GRÜNEN': 'Grüne',
    'Linke': 'Linke',
    'Linken': 'Linke',
    'LINKE': 'Linke',
    'Inneres': 'Inneres',
    'Innern': 'Inneres',
    'Inneren': 'Inneres',
}


def is_abbreviation(form: str) -> bool:
    capitals = sum(character.isupper() for character in form)
    return len(form) >= 2 and capitals >= 2 and capitals >= len(form) - 1


def is_known(form: str) -> bool:
    return simplemma.is_known(form, lang=LANGUAGE)


def dictionary_lemma(form: str) -> str:
    return simplemma.lemmatize(form, lang=LANGUAGE)


def keep_feminine(form: str, lemma: str) -> str:
    if form.endswith(FEMININE_PLURAL_ENDING) and not lemma.endswith('in'):
        return form[:-len('nen')]
    return lemma


def lowercase_first(word: str) -> str:
    return word[:1].lower() + word[1:]


def without_umlauts(word: str) -> str:
    return word.lower().translate(UMLAUT_FREE)


def differs_only_in_ending(form: str, lemma: str) -> bool:
    lemma_without_umlauts = without_umlauts(lemma)
    stem = lemma_without_umlauts[:max(2, len(lemma_without_umlauts) - 2)]
    return without_umlauts(form).startswith(stem)


def adjectival_present_participle(form: str) -> str | None:
    match = PRESENT_PARTICIPLE.match(form)
    return match.group(1) if match else None


def plausible_dictionary_lemma(form: str) -> str | None:
    if not is_known(form):
        return None
    lemma = keep_feminine(form, dictionary_lemma(form))
    if form[0].isupper() and lemma[0].isupper() and not differs_only_in_ending(form, lemma):
        return None
    if form[0].islower() and lemma[0].isupper():
        return None
    return lemma


class Lemmatizer:
    def __init__(self, form_counts: Mapping[str, int], reformed_spelling_counts: Mapping[str, int]):
        """form_counts: occurrences of each form in all protocols;
        reformed_spelling_counts: occurrences of forms or lemmas in protocols since the spelling reform."""
        self.form_counts = form_counts
        self.reformed_spelling_counts = reformed_spelling_counts

    def lemma(self, form: str) -> str:
        if form in SEMANTIC_EXCEPTIONS:
            return SEMANTIC_EXCEPTIONS[form]
        if '-' in form.strip('-'):
            return self.hyphenated_lemma(form)
        if is_abbreviation(form):
            return form
        return self.reformed_spelling(form, self.lemma_of_single_word(form))

    def lemma_of_single_word(self, form: str) -> str:
        if self.stands_at_sentence_start(form):
            form = form.lower()
        elif self.is_lowercase_typo_of_noun(form):
            form = form[0].upper() + form[1:]
        if form in SEMANTIC_EXCEPTIONS:
            return SEMANTIC_EXCEPTIONS[form]
        present_participle = adjectival_present_participle(form)
        if present_participle:
            return present_participle
        dictionary = plausible_dictionary_lemma(form)
        if dictionary is not None:
            return self.participle_verb(form) if dictionary == form and self.participle_verb(form) else dictionary
        return self.compound_lemma(form) or self.participle_verb(form) or self.stripped_lemma(form) or form

    def reformed_spelling(self, form: str, lemma: str) -> str:
        if 'ß' not in lemma:
            return lemma
        with_double_s = lemma.replace('ß', 'ss')
        double_s_count = self.reformed_spelling_counts.get(with_double_s, 0)
        sharp_s_count = self.reformed_spelling_counts.get(lemma, 0)
        if double_s_count == sharp_s_count:
            return lemma if 'ß' in form else with_double_s
        return with_double_s if double_s_count > sharp_s_count else lemma

    def hyphenated_lemma(self, form: str) -> str:
        modifier, head = form.rsplit('-', 1)
        if not head:
            return form
        head_lemma = self.lemma(head[0].upper() + head[1:] if form[0].isupper() and head[0].isupper() else head)
        return f'{modifier}-{head_lemma}'

    def stands_at_sentence_start(self, form: str) -> bool:
        lowercase = form.lower()
        return (form[0].isupper() and not is_known(form)
                and self.form_counts.get(lowercase, 0) > self.form_counts.get(form, 0))

    def is_lowercase_typo_of_noun(self, form: str) -> bool:
        capitalised = form[0].upper() + form[1:]
        return (form[0].islower() and is_known(capitalised) and dictionary_lemma(form)[0].isupper()
                and self.form_counts.get(capitalised, 0) >= TYPO_FREQUENCY_RATIO * max(1, self.form_counts.get(form, 0)))

    def compound_lemma(self, form: str) -> str | None:
        capitalised = form[0].isupper()
        minimum_head_length = MINIMUM_COMPOUND_HEAD_LENGTH if capitalised else MINIMUM_LOWERCASE_COMPOUND_HEAD_LENGTH
        for split in range(MINIMUM_COMPOUND_MODIFIER_LENGTH, len(form) - minimum_head_length + 1):
            head = form[split:]
            if capitalised:
                head = head[0].upper() + head[1:]
            if not (head[0].isalpha() and is_known(head)):
                continue
            head_lemma = keep_feminine(head, dictionary_lemma(head))
            if capitalised and not (head_lemma[0].isupper() and differs_only_in_ending(head, head_lemma)):
                continue
            if not capitalised and head_lemma[0].isupper():
                continue
            return form[:split] + (lowercase_first(head_lemma) if capitalised else head_lemma)
        return None

    def participle_verb(self, form: str) -> str | None:
        if form[0].isupper() or not form.endswith('t') or form.endswith('st') or len(form) < MINIMUM_PARTICIPLE_LENGTH:
            return None
        for verb in (form[:-1] + 'en', form[:-1] + 'n'):
            if verb in self.form_counts and is_known(verb) and dictionary_lemma(verb) == verb:
                return verb
        return None

    def stripped_lemma(self, form: str) -> str | None:
        capitalised = form[0].isupper()
        for ending in CAPITALISED_ENDINGS if capitalised else LOWERCASE_ENDINGS:
            base = form[:-len(ending)]
            if not form.endswith(ending) or len(base) < MINIMUM_STRIPPED_LENGTH:
                continue
            if base in self.form_counts or (not capitalised and base.endswith(ADJECTIVE_SUFFIXES)):
                return base
        return None
