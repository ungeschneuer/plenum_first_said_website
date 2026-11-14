# Umgang mit Neologismen im Bundestag

## Das Problem

### Was sind Neologismen?
Neuwörter, die nicht im Standard-Wortschatz oder in spaCy's Trainingsdaten enthalten sind.

### Beispiele aus dem Bundestag:

**Politische Neologismen:**
- "Energiewende" (seit ~2011)
- "Jamaika-Koalition" (Schwarz-Gelb-Grün)
- "GroKo" (Große Koalition)
- "Maaßen-Affäre"
- "Dieselgate"
- "Klimapaket"
- "Corona-Pandemie"
- "Ampel-Koalition" (Rot-Gelb-Grün)

**Deutsche Komposita (zusammengesetzte Wörter):**
- "Bundestagsabgeordnete" = Bundestag + Abgeordnete
- "Klimaschutzgesetz" = Klima + Schutz + Gesetz
- "Mindestlohnerhöhung" = Mindest + Lohn + Erhöhung
- "Datenschutzgrundverordnung" = Daten + Schutz + Grund + Verordnung

### Probleme für NLP:

❌ **spaCy kennt sie nicht**
- Falsche POS-Tags
- Falsche oder keine Lemmatisierung
- Als "PROPN" (Eigenname) fehlklassifiziert

❌ **Keine Gender-Information**
- "Klimakanzlerin" → spaCy kennt das Wort nicht
- Kann Gender nicht bestimmen

❌ **Kompositazerlegung**
- "Energiewendepolitik" sollte analysiert werden als:
  - Energie + Wende + Politik
- Aber spaCy behandelt es als ein unbekanntes Wort

## Lösungsstrategien

### 1. Deutsche Kompositazerlegung

**Problem:** Deutsch bildet produktiv neue Wörter durch Zusammensetzung.

**Lösung:** Compound Splitting Library

```python
from german_compound_splitter import comp_split

def split_compound(word: str) -> list[str]:
    """
    Zerlegt deutsche Komposita in Bestandteile.

    Beispiele:
    - "Energiewende" → ["Energie", "Wende"]
    - "Klimaschutzgesetz" → ["Klima", "Schutz", "Gesetz"]
    - "Bundestagsabgeordnete" → ["Bundestag", "Abgeordnete"]
    """
    splits = comp_split(word)

    # Wenn zerlegbar, analysiere Teile
    if len(splits) > 1:
        return splits

    # Sonst: Ganzes Wort zurück
    return [word]


def analyze_compound(word: str) -> dict:
    """
    Analysiert Kompositum mit Zerlegung.

    Returns:
        {
            'original': 'Energiewende',
            'is_compound': True,
            'parts': ['Energie', 'Wende'],
            'head': 'Wende',           # Letzter Teil bestimmt Wortart
            'modifiers': ['Energie'],
            'pos': 'NOUN',             # Von 'Wende'
            'gender': 'FEM'            # Von 'Wende' (die Wende)
        }
    """
    parts = split_compound(word)

    if len(parts) > 1:
        # Letzter Teil ist der "Kopf" (head) - bestimmt Eigenschaften
        head = parts[-1]
        head_analysis = analyze_word_with_gender(head)

        return {
            'original': word,
            'is_compound': True,
            'parts': parts,
            'head': head,
            'modifiers': parts[:-1],
            'pos': head_analysis['pos'],
            'gender': head_analysis['gender'],
            'base_lemma': word  # Kompositum bleibt zusammen
        }
    else:
        # Kein Kompositum
        return {
            'original': word,
            'is_compound': False,
            'parts': [word],
            'head': word,
            'modifiers': [],
            'pos': 'UNKNOWN',
            'gender': 'UNKNOWN',
            'base_lemma': word
        }


# Beispiele:
"""
analyze_compound("Energiewende")
→ {
    'original': 'Energiewende',
    'is_compound': True,
    'parts': ['Energie', 'Wende'],
    'head': 'Wende',
    'modifiers': ['Energie'],
    'pos': 'NOUN',        # von "Wende"
    'gender': 'FEM'       # von "die Wende"
}

analyze_compound("Klimakanzlerin")
→ {
    'original': 'Klimakanzlerin',
    'is_compound': True,
    'parts': ['Klima', 'Kanzlerin'],
    'head': 'Kanzlerin',
    'modifiers': ['Klima'],
    'pos': 'NOUN',
    'gender': 'FEM'       # von "Kanzlerin"!
}
"""
```

### 2. Custom Dictionary für häufige Neologismen

**Strategie:** Manuell kuratierte Liste wichtiger politischer Begriffe.

```python
# custom_words.py

CUSTOM_DICTIONARY = {
    'Energiewende': {
        'pos': 'NOUN',
        'gender': 'FEM',
        'lemma': 'Energiewende',
        'first_known': '2011-03-11',  # Fukushima
        'definition': 'Übergang zu erneuerbaren Energien'
    },
    'GroKo': {
        'pos': 'NOUN',
        'gender': 'FEM',
        'lemma': 'GroKo',
        'full_form': 'Große Koalition',
        'definition': 'Koalition aus CDU/CSU und SPD'
    },
    'Klimapaket': {
        'pos': 'NOUN',
        'gender': 'NEUT',
        'lemma': 'Klimapaket',
        'definition': 'Bündel von Klimaschutzmaßnahmen'
    },
    'Dieselgate': {
        'pos': 'NOUN',
        'gender': 'NEUT',
        'lemma': 'Dieselgate',
        'definition': 'Abgasskandal bei Dieselfahrzeugen'
    }
}

def lookup_custom_word(word: str) -> dict:
    """
    Schaut im Custom Dictionary nach.

    Returns:
        Custom-Analyse oder None
    """
    word_lower = word.lower()
    word_title = word.capitalize()

    # Exakte Übereinstimmung
    if word in CUSTOM_DICTIONARY:
        return CUSTOM_DICTIONARY[word]

    # Case-insensitive
    if word_lower in CUSTOM_DICTIONARY:
        return CUSTOM_DICTIONARY[word_lower]

    if word_title in CUSTOM_DICTIONARY:
        return CUSTOM_DICTIONARY[word_title]

    return None


def analyze_with_fallback(word: str) -> dict:
    """
    Multi-Stage-Analyse mit Fallbacks.

    1. Custom Dictionary
    2. spaCy (Standard)
    3. Compound Splitting
    4. Pattern-based Fallback
    """
    # Stage 1: Custom Dictionary
    custom = lookup_custom_word(word)
    if custom:
        return {
            'source': 'CUSTOM_DICT',
            'original': word,
            **custom
        }

    # Stage 2: spaCy Standard
    try:
        spacy_result = analyze_word_with_gender(word)
        if spacy_result['pos'] != 'X':  # X = Unknown
            return {
                'source': 'SPACY',
                **spacy_result
            }
    except:
        pass

    # Stage 3: Compound Splitting
    compound_result = analyze_compound(word)
    if compound_result['is_compound']:
        return {
            'source': 'COMPOUND_SPLIT',
            **compound_result
        }

    # Stage 4: Pattern-based Fallback
    return pattern_based_fallback(word)


def pattern_based_fallback(word: str) -> dict:
    """
    Heuristiken für unbekannte Wörter.

    Regeln:
    - Großgeschrieben → wahrscheinlich NOUN
    - Endung -in → wahrscheinlich FEM NOUN
    - Endung -ung → wahrscheinlich FEM NOUN
    - Endung -keit, -heit → FEM NOUN
    - Endung -en (lowercase) → VERB
    """
    is_capitalized = word[0].isupper() if word else False

    # Großgeschrieben → Nomen
    if is_capitalized:
        # Gender-Heuristiken
        if word.endswith('in'):
            gender = 'FEM'
        elif word.endswith('ung') or word.endswith('keit') or word.endswith('heit'):
            gender = 'FEM'
        elif word.endswith('er') or word.endswith('ismus'):
            gender = 'MASC'
        elif word.endswith('chen') or word.endswith('lein'):
            gender = 'NEUT'
        else:
            gender = 'UNKNOWN'

        return {
            'source': 'PATTERN_FALLBACK',
            'original': word,
            'lemma': word,
            'pos': 'NOUN',
            'gender': gender,
            'confidence': 'LOW'
        }
    else:
        # Kleingeschrieben → wahrscheinlich Verb oder Adjektiv
        if word.endswith('en'):
            return {
                'source': 'PATTERN_FALLBACK',
                'original': word,
                'lemma': word,
                'pos': 'VERB',
                'confidence': 'LOW'
            }

    return {
        'source': 'UNKNOWN',
        'original': word,
        'lemma': word,
        'pos': 'UNKNOWN',
        'gender': 'UNKNOWN',
        'confidence': 'NONE'
    }
```

### 3. OOV (Out-of-Vocabulary) Tracking

**Strategie:** Unbekannte Wörter tracken für manuelle Überprüfung.

```python
# Neue Datenbanktabelle
CREATE TABLE unknown_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT UNIQUE,
    first_seen_protocol TEXT,
    first_seen_date DATE,
    occurrence_count INTEGER DEFAULT 1,
    analysis_source TEXT,      -- 'COMPOUND_SPLIT', 'PATTERN_FALLBACK', etc.
    confidence TEXT,           -- 'HIGH', 'MEDIUM', 'LOW', 'NONE'
    manually_reviewed BOOLEAN DEFAULT 0,
    correct_pos TEXT,          -- Manuell korrigiert
    correct_gender TEXT,
    notes TEXT
);

def track_unknown_word(word: str, protocol_id: str, protocol_date: str,
                       analysis: dict):
    """
    Speichert unbekannte Wörter für Review.
    """
    if analysis['source'] in ['COMPOUND_SPLIT', 'PATTERN_FALLBACK', 'UNKNOWN']:
        add_or_update_unknown_word(
            word=word,
            protocol_id=protocol_id,
            date=protocol_date,
            source=analysis['source'],
            confidence=analysis.get('confidence', 'NONE')
        )


def get_words_for_review(limit: int = 50) -> list:
    """
    Holt die häufigsten unbekannten Wörter zur manuellen Prüfung.
    """
    return db.query("""
        SELECT word, occurrence_count, first_seen_date, analysis_source
        FROM unknown_words
        WHERE manually_reviewed = 0
        ORDER BY occurrence_count DESC
        LIMIT ?
    """, [limit])


# Review-UI könnte zeigen:
"""
Unbekannte Wörter zur Überprüfung:

1. "Energiewende" (127 Vorkommen)
   Erste Verwendung: 2011-03-14
   Analyse: COMPOUND_SPLIT → [Energie, Wende]
   Vorschlag: NOUN, FEM
   [✓ Korrekt] [✗ Korrigieren] [+ Zum Dictionary]

2. "Klimakanzlerin" (45 Vorkommen)
   Erste Verwendung: 2019-09-20
   Analyse: COMPOUND_SPLIT → [Klima, Kanzlerin]
   Vorschlag: NOUN, FEM
   [✓ Korrekt] [✗ Korrigieren] [+ Zum Dictionary]
"""
```

### 4. Zeitbasierte Neologismen-Erkennung

**Strategie:** Wörter, die plötzlich häufig werden, sind wahrscheinlich neu.

```python
def detect_emerging_terms(timeframe_days: int = 90) -> list:
    """
    Findet Wörter, die in letzter Zeit neu auftauchen.

    Kriterien:
    - Vorher selten oder nie verwendet
    - Plötzlicher Anstieg in Verwendung
    - Keine oder wenige historische Vorkommen
    """
    return db.query("""
        WITH recent_words AS (
            SELECT w.word, COUNT(*) as recent_count
            FROM words w
            JOIN word_occurrences wo ON w.word_id = wo.word_id
            WHERE wo.date >= DATE('now', '-{} days')
            GROUP BY w.word
        ),
        historical_words AS (
            SELECT w.word, COUNT(*) as historical_count
            FROM words w
            JOIN word_occurrences wo ON w.word_id = wo.word_id
            WHERE wo.date < DATE('now', '-{} days')
            GROUP BY w.word
        )
        SELECT
            r.word,
            r.recent_count,
            COALESCE(h.historical_count, 0) as historical_count,
            r.recent_count * 1.0 / NULLIF(COALESCE(h.historical_count, 0), 0) as growth_factor
        FROM recent_words r
        LEFT JOIN historical_words h ON r.word = h.word
        WHERE r.recent_count >= 10
          AND (h.historical_count IS NULL OR h.historical_count < 5)
        ORDER BY growth_factor DESC
        LIMIT 50
    """.format(timeframe_days, timeframe_days))


# Beispiel-Ausgabe (2020):
"""
Aufstrebende Begriffe (letzte 90 Tage):

1. "Corona-Pandemie" (312 Vorkommen)
   Historisch: 0 → NEU!
   Wachstumsfaktor: ∞

2. "Lockdown" (156 Vorkommen)
   Historisch: 0 → NEU!
   Wachstumsfaktor: ∞

3. "Homeoffice" (89 Vorkommen)
   Historisch: 3
   Wachstumsfaktor: 29.7x
"""
```

### 5. Compound-Splitter Installation

```bash
# Option 1: CharSplit (empfohlen)
uv add CharSplit

# Option 2: compound-split
uv add compound-split

# Option 3: Self-made mit Morphologie-Datenbank
# Nutzt DWDS oder DeReKo
```

**Verwendung:**

```python
from CharSplit import Splitter

splitter = Splitter()

# Beispiele
splitter.split_compound("Energiewende")
# → ['Energie', 'Wende']

splitter.split_compound("Klimaschutzgesetz")
# → ['Klima', 'Schutz', 'Gesetz']

splitter.split_compound("Bundeskanzlerin")
# → ['Bund', 'Kanzlerin'] oder ['Bundestag', 'Kanzlerin']
# Ambig! Braucht Kontext.
```

### 6. Vollständiger Analyse-Pipeline

```python
def analyze_word_comprehensive(word: str, context: str = None) -> dict:
    """
    Vollständige Analyse mit allen Fallbacks.

    Pipeline:
    1. Custom Dictionary
    2. spaCy Standard
    3. Compound Splitting
    4. Pattern Fallback
    5. OOV Tracking
    """

    # 1. Custom Dictionary
    custom = lookup_custom_word(word)
    if custom:
        return {
            **custom,
            'source': 'CUSTOM_DICT',
            'confidence': 'HIGH'
        }

    # 2. spaCy mit Vertrauen
    try:
        doc = nlp(word)
        if doc and doc[0].pos_ != 'X':
            # Bekanntes Wort
            return {
                'original': word,
                'lemma': doc[0].lemma_,
                'pos': doc[0].pos_,
                'gender': determine_gender(doc[0], word),
                'source': 'SPACY',
                'confidence': 'HIGH'
            }
    except:
        pass

    # 3. Compound Splitting
    compound = analyze_compound(word)
    if compound['is_compound']:
        return {
            **compound,
            'source': 'COMPOUND_SPLIT',
            'confidence': 'MEDIUM'
        }

    # 4. Pattern Fallback
    fallback = pattern_based_fallback(word)

    # 5. Track für Review
    track_for_review = fallback['confidence'] in ['LOW', 'NONE']

    return {
        **fallback,
        'needs_review': track_for_review
    }
```

## Implementierungsplan

### Phase 1: Compound Splitting (2 Tage)
```bash
uv add CharSplit
# Test mit bekannten Komposita
# Integration in text_processing.py
```

### Phase 2: Custom Dictionary (1 Tag)
```python
# Datei: custom_words.py
# 50-100 häufigste politische Neologismen
# Integration in Analyse-Pipeline
```

### Phase 3: OOV Tracking (1 Tag)
```sql
# Neue Tabelle: unknown_words
# Track-Funktion
# Review-Interface (Admin-UI)
```

### Phase 4: Pattern Fallbacks (1 Tag)
```python
# Heuristische Regeln
# Gender-Inferenz
# POS-Inferenz
```

### Phase 5: Integration & Testing (1 Tag)
```python
# Vollständige Pipeline
# Tests mit Neologismen
# Performance-Optimierung
```

## Beispiel: "Energiewende"

```python
# Ohne Neologismen-Handling:
analyze("Energiewende")
→ {
    'pos': 'X',           # Unknown
    'lemma': 'Energiewende',
    'source': 'SPACY',
    'error': 'Not in vocabulary'
}

# Mit Neologismen-Handling:
analyze_comprehensive("Energiewende")
→ {
    'original': 'Energiewende',
    'is_compound': True,
    'parts': ['Energie', 'Wende'],
    'head': 'Wende',
    'pos': 'NOUN',
    'gender': 'FEM',         # von "die Wende"
    'lemma': 'Energiewende',
    'source': 'COMPOUND_SPLIT',
    'confidence': 'MEDIUM',
    'needs_review': False
}
```

## Vorteile

✅ **Robustheit** - Funktioniert auch mit unbekannten Wörtern
✅ **Deutschspezifisch** - Nutzt Kompositabildung
✅ **Lernfähig** - Custom Dictionary wächst mit
✅ **Qualitätssicherung** - Review unbekannter Wörter
✅ **Zeitbasiert** - Erkennt neue Trends
✅ **Vollständigkeit** - Alle Wörter werden analysiert

## Zusammenfassung

Neologismen sind in politischer Sprache normal und häufig. Durch:
1. **Compound Splitting** (Deutsch-spezifisch)
2. **Custom Dictionary** (kuratiert)
3. **OOV Tracking** (zur manuellen Prüfung)
4. **Pattern Fallbacks** (heuristisch)
5. **Zeitanalyse** (Trend-Erkennung)

...kann Ihr System auch mit neuen Wörtern umgehen! 🎯

**Empfehlung:** Start mit Compound Splitting + Custom Dictionary für Top 100 politische Begriffe.
