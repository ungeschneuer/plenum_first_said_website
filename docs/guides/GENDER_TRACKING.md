# Gender-bewusste Wortanalyse

## Forschungsfrage

**Wann wurden weibliche Formen zum ersten Mal verwendet?**

Beispiele:
- "Bundeskanzler" (1949) vs "Bundeskanzlerin" (2005 - Angela Merkel)
- "Ministerpräsident" vs "Ministerpräsidentin"
- "Abgeordneter" vs "Abgeordnete"

Dies zeigt die **Evolution geschlechtergerechter Sprache** im Bundestag!

## Verfeinerter Ansatz

### Was NICHT mergen:
❌ **Gendered Forms** - Separat halten!
- "Bundeskanzler" ≠ "Bundeskanzlerin"
- "Präsident" ≠ "Präsidentin"
- "Sprecher" ≠ "Sprecherin"

### Was MERGEN:
✅ **Grammatische Fälle** - Zusammenfassen
- "Bundeskanzlerin" = "Bundeskanzlerinnen" (Plural)
- "Bundeskanzlerin" = "Bundeskanzlerin" (Nominativ) = "Bundeskanzlerin" (Akkusativ)
- Aber: Separat von "Bundeskanzler"

✅ **Groß-/Kleinschreibung** (außer Satzanfang)
- "bundeskanzlerin" → "Bundeskanzlerin" (Nomen)
- "laufen" bleibt "laufen" (Verb)

## Implementierung mit spaCy

### 1. Erweitertes Wort-Analyse-System

```python
import spacy
from typing import Dict, Optional

nlp = spacy.load("de_core_news_lg")

def analyze_word_with_gender(word: str) -> Dict:
    """
    Analysiert ein Wort mit Gender-Awareness.

    Returns:
        {
            'original': str,           # Originalform
            'base_lemma': str,         # Basis ohne Gender (z.B. "Bundeskanzler")
            'gender': str,             # 'MASC', 'FEM', 'NEUT', 'UNKNOWN'
            'gendered_lemma': str,     # Mit Gender (z.B. "Bundeskanzlerin")
            'pos': str,                # NOUN, VERB, etc.
            'number': str,             # 'SING', 'PLUR'
            'is_capitalized': bool     # Großgeschrieben
        }
    """
    doc = nlp(word)

    if not doc:
        return create_fallback_analysis(word)

    token = doc[0]

    # Basis-Lemma ohne Gender-Suffix
    base_lemma = token.lemma_

    # Gender bestimmen
    gender = determine_gender(token, word)

    # Gendered Lemma: Lemma MIT Gender-Information
    gendered_lemma = create_gendered_lemma(base_lemma, gender)

    return {
        'original': word,
        'base_lemma': base_lemma,
        'gender': gender,
        'gendered_lemma': gendered_lemma,
        'pos': token.pos_,
        'number': get_number(token),
        'is_capitalized': word[0].isupper() if word else False
    }


def determine_gender(token, word: str) -> str:
    """
    Bestimmt das grammatische Geschlecht.

    Nutzt:
    1. spaCy's morphologische Analyse
    2. Wort-Endungen (-in, -er)
    3. Kontext
    """
    # spaCy morphology
    if token.morph.get("Gender"):
        gender_value = token.morph.get("Gender")[0]
        return gender_value.upper()  # 'Masc', 'Fem', 'Neut' -> 'MASC', 'FEM', 'NEUT'

    # Fallback: Endungsanalyse
    if word.endswith('in') and not word.endswith('erin'):
        # Bundeskanzlerin, Ministerin
        return 'FEM'
    elif word.endswith('erin'):
        # Sprecherin, Lehrerin
        return 'FEM'
    elif word.endswith('innen'):
        # Bundeskanzlerinnen (Plural weiblich)
        return 'FEM'

    return 'MASC'  # Default für unbekannte Nomen


def create_gendered_lemma(base_lemma: str, gender: str) -> str:
    """
    Erstellt gender-spezifisches Lemma.

    Beispiele:
    - base: "Bundeskanzler", gender: "FEM" -> "Bundeskanzlerin"
    - base: "Bundeskanzler", gender: "MASC" -> "Bundeskanzler"
    """
    if gender == 'FEM':
        # Füge feminine Endung hinzu wenn nicht schon vorhanden
        if not base_lemma.endswith('in'):
            return base_lemma + 'in'
    return base_lemma


def get_number(token) -> str:
    """Singul
ar oder Plural."""
    if token.morph.get("Number"):
        return token.morph.get("Number")[0].upper()
    return 'SING'


# Beispiele:
"""
analyze_word_with_gender("Bundeskanzlerin")
-> {
    'original': 'Bundeskanzlerin',
    'base_lemma': 'Bundeskanzler',
    'gender': 'FEM',
    'gendered_lemma': 'Bundeskanzlerin',
    'pos': 'NOUN',
    'number': 'SING',
    'is_capitalized': True
}

analyze_word_with_gender("Bundeskanzlerinnen")
-> {
    'original': 'Bundeskanzlerinnen',
    'base_lemma': 'Bundeskanzler',
    'gender': 'FEM',
    'gendered_lemma': 'Bundeskanzlerin',  # Singular-Form als Lemma
    'pos': 'NOUN',
    'number': 'PLUR',
    'is_capitalized': True
}

analyze_word_with_gender("Bundeskanzler")
-> {
    'original': 'Bundeskanzler',
    'base_lemma': 'Bundeskanzler',
    'gender': 'MASC',
    'gendered_lemma': 'Bundeskanzler',
    'pos': 'NOUN',
    'number': 'SING',
    'is_capitalized': True
}
"""
```

### 2. Verbesserte Datenbankstruktur

```sql
CREATE TABLE words (
    word_id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Gender-bewusstes Lemma (DIE Hauptform)
    gendered_lemma TEXT NOT NULL,        -- "Bundeskanzlerin" oder "Bundeskanzler"

    -- Zusätzliche Informationen
    base_lemma TEXT,                     -- "Bundeskanzler" (ohne Gender)
    gender TEXT,                         -- 'MASC', 'FEM', 'NEUT'
    pos_tag TEXT,                        -- 'NOUN', 'VERB', etc.

    -- Erste Verwendung
    first_protocol_id TEXT,
    first_date DATE,
    first_original_form TEXT,            -- Wie es das erste Mal geschrieben wurde

    -- Statistiken
    total_count INTEGER DEFAULT 0,

    UNIQUE(gendered_lemma, pos_tag),     -- Eine Zeile pro Gender-Form
    INDEX(gendered_lemma),
    INDEX(base_lemma),
    INDEX(gender),
    INDEX(first_date)
);

-- Tabelle für alle Varianten (Plural, Fälle, etc.)
CREATE TABLE word_forms (
    form_id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    form_text TEXT NOT NULL,             -- "Bundeskanzlerinnen", "Bundeskanzlerin"
    count INTEGER DEFAULT 0,
    FOREIGN KEY (word_id) REFERENCES words(word_id),
    UNIQUE(word_id, form_text)
);

-- Vorkommen bleiben gleich
CREATE TABLE word_occurrences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    protocol_id TEXT NOT NULL,
    count INTEGER NOT NULL,
    date DATE NOT NULL,
    FOREIGN KEY (word_id) REFERENCES words(word_id)
);
```

### 3. Verarbeitungslogik

```python
def process_word_for_storage(word: str, protocol_id: str, protocol_date: str):
    """
    Verarbeitet ein Wort für die Speicherung.

    WICHTIG: Hält Gender-Formen getrennt!
    """
    # Analysiere das Wort
    analysis = analyze_word_with_gender(word)

    # Suche oder erstelle Eintrag für gendered_lemma
    word_entry = get_or_create_word(
        gendered_lemma=analysis['gendered_lemma'],
        base_lemma=analysis['base_lemma'],
        gender=analysis['gender'],
        pos_tag=analysis['pos'],
        first_protocol_id=protocol_id,
        first_date=protocol_date,
        first_original_form=analysis['original']
    )

    # Speichere diese spezifische Form
    add_word_form(
        word_id=word_entry['word_id'],
        form_text=analysis['original']
    )

    # Füge zur Häufigkeit hinzu
    add_word_occurrence(
        word_id=word_entry['word_id'],
        protocol_id=protocol_id,
        date=protocol_date
    )


# Beispiel-Ergebnisse in der Datenbank:

"""
words Tabelle:

word_id | gendered_lemma      | base_lemma       | gender | pos  | first_date | first_original_form
--------|---------------------|------------------|--------|------|------------|--------------------
1       | Bundeskanzler       | Bundeskanzler    | MASC   | NOUN | 1949-09-07 | Bundeskanzler
2       | Bundeskanzlerin     | Bundeskanzler    | FEM    | NOUN | 2005-11-22 | Bundeskanzlerin
3       | Ministerpräsident   | Ministerpräsident| MASC   | NOUN | 1950-01-10 | Ministerpräsident
4       | Ministerpräsidentin | Ministerpräsident| FEM    | NOUN | 1993-05-12 | Ministerpräsidentin

Jetzt können Sie sehen:
- "Bundeskanzlerin" wurde 2005 zum ersten Mal verwendet!
- 56 Jahre nach "Bundeskanzler" (1949)
```

### 4. Verbesserte Suchabfragen

```python
def search_gendered_forms(query: str):
    """
    Sucht nach einem Begriff und zeigt BEIDE Gender-Formen.

    Returns:
        {
            'base_lemma': 'Bundeskanzler',
            'forms': [
                {
                    'gendered_lemma': 'Bundeskanzler',
                    'gender': 'MASC',
                    'first_used': '1949-09-07',
                    'total_count': 1250,
                    'variants': ['Bundeskanzler', 'Bundeskanzlers']
                },
                {
                    'gendered_lemma': 'Bundeskanzlerin',
                    'gender': 'FEM',
                    'first_used': '2005-11-22',  # <-- Wichtig!
                    'total_count': 850,
                    'variants': ['Bundeskanzlerin', 'Bundeskanzlerinnen']
                }
            ],
            'timeline': {
                'combined': [...],  # Beide zusammen
                'by_gender': {
                    'MASC': [...],
                    'FEM': [...]
                }
            }
        }
    """
    pass


def compare_gender_timeline(base_lemma: str):
    """
    Vergleicht männliche und weibliche Form im Zeitverlauf.

    Zeigt:
    - Wann tauchte die weibliche Form zum ersten Mal auf?
    - Wie hat sich die Verwendung über Zeit entwickelt?
    - Gibt es einen Trend zu mehr weiblichen Formen?
    """
    pass
```

### 5. UI-Features

**Suchergebnisse mit Gender-Trennung:**

```javascript
<div className="word-group">
  <h2>Bundeskanzler (Base Lemma)</h2>

  <div className="gender-forms">
    {/* Männliche Form */}
    <div className="gender-form male">
      <h3>Bundeskanzler (männlich)</h3>
      <p>Erstes Vorkommen: 7. September 1949</p>
      <p>Gesamtvorkommen: 1.250</p>
      <p>Formen: Bundeskanzler, Bundeskanzlers</p>
      <button>Zeitachse anzeigen</button>
    </div>

    {/* Weibliche Form */}
    <div className="gender-form female">
      <h3>Bundeskanzlerin (weiblich)</h3>
      <p>Erstes Vorkommen: 22. November 2005 ⚡ NEU!</p>
      <p className="highlight">
        56 Jahre nach der männlichen Form
      </p>
      <p>Gesamtvorkommen: 850</p>
      <p>Formen: Bundeskanzlerin, Bundeskanzlerinnen</p>
      <button>Zeitachse anzeigen</button>
    </div>
  </div>

  {/* Vergleichsdiagramm */}
  <button>Beide Formen vergleichen</button>
</div>
```

**Vergleichsdiagramm:**

```javascript
// Zeigt beide Gender-Formen im gleichen Chart
<Chart
  data={{
    labels: dates,
    datasets: [
      {
        label: 'Bundeskanzler (männlich)',
        data: maleData,
        borderColor: 'blue'
      },
      {
        label: 'Bundeskanzlerin (weiblich)',
        data: femaleData,
        borderColor: 'pink',
        // Markiere ersten Einsatz
        pointStyle: firstUsageMarker
      }
    ]
  }}
/>
```

## Interessante Forschungsfragen

Mit diesem System können Sie untersuchen:

1. **Wann wurden weibliche Berufsbezeichnungen eingeführt?**
   - Bundeskanzlerin: 2005 (Merkel)
   - Verteidigungsministerin: ?
   - Fraktionsvorsitzende: ?

2. **Entwicklung geschlechtergerechter Sprache**
   - Verhältnis männlich/weiblich über Zeit
   - Welche Wörter wurden früher gegendert?
   - Gibt es einen Trend?

3. **Politische Meilensteine**
   - Korrelation mit weiblichen Politikerinnen
   - Einfluss auf Sprachgebrauch

4. **Vergleich verschiedener Begriffe**
   - "Abgeordneter" vs "Abgeordnete"
   - Welche Begriffe bleiben männlich?

## Implementierungsschritte

### Phase 1: spaCy-Integration (2 Tage)
```bash
# Installation
uv add spacy
uv run python -m spacy download de_core_news_lg

# Test-Skript erstellen
uv run python backend/test_gender_analysis.py
```

### Phase 2: Datenbank-Migration (1 Tag)
- Neue Spalten hinzufügen
- Migration für bestehende Daten
- Indizes erstellen

### Phase 3: Re-Processing (2-3 Tage)
- Alle Protokolle neu analysieren
- Gender-Information hinzufügen
- Erste Vorkommen neu berechnen

### Phase 4: API erweitern (1 Tag)
- Gender-Filter in Suche
- Vergleichs-Endpunkte
- Timeline nach Gender

### Phase 5: UI (2 Tage)
- Gender-getrennte Anzeige
- Vergleichsdiagramme
- "Erstes Vorkommen" hervorheben

## Beispiel-Ausgabe

```
Suche: "bundeskanzler"

Ergebnisse für Base-Lemma: "Bundeskanzler"

┌─────────────────────────────────────────────────────────┐
│ Bundeskanzler (männlich)                                │
│ ─────────────────────────────────────────────────────   │
│ Erstes Vorkommen: 7. September 1949                     │
│ Gesamtvorkommen: 1.250                                  │
│ Formen: Bundeskanzler, Bundeskanzlers                   │
│                                                          │
│ [Zeitachse anzeigen]                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Bundeskanzlerin (weiblich) ⭐ NEUE FORM                 │
│ ─────────────────────────────────────────────────────   │
│ Erstes Vorkommen: 22. November 2005                     │
│ ⏱️ 56 Jahre nach der männlichen Form                    │
│ Gesamtvorkommen: 850                                    │
│ Formen: Bundeskanzlerin, Bundeskanzlerinnen             │
│                                                          │
│ [Zeitachse anzeigen]                                    │
└─────────────────────────────────────────────────────────┘

[Beide Formen vergleichen 📊]
```

## Zusammenfassung

Dieser Ansatz:
✅ **Trennt** männliche und weibliche Formen
✅ **Merged** grammatische Fälle (Plural, Genitiv, etc.)
✅ **Unterscheidet** Nomen von Verben
✅ **Verfolgt** erstes Vorkommen jeder Gender-Form
✅ **Ermöglicht** linguistische Forschung zur Sprachentwicklung

Dies macht Ihr Tool zu einem **wertvollen Instrument für Gender-Linguistik**! 🎯
