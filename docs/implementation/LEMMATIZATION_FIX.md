# Lemmatization Fix - Grammatische Fälle werden zusammengeführt

## Problem

Vorher wurden grammatische Variationen als separate Wörter gespeichert:
- "Bundeskanzler" (Nominativ)
- "Bundeskanzlers" (Genitiv)
- "Bundeskanzlerin" (Nominativ feminin)

Dies führte zu:
- 21,404 eindeutige "Wörter" (viele davon nur grammatische Variationen)
- Aufgeblähte Datenbank
- Schwierige Analyse (Häufigkeiten über Fälle verteilt)

## Lösung

Wörter werden jetzt nach ihrem **gendered_lemma** gespeichert:

### Was wird zusammengeführt:
- **Grammatische Fälle** (Nominativ, Genitiv, Dativ, Akkusativ)
- **Numerus** (Singular, Plural) wenn spaCy die gleiche Lemma zurückgibt

### Was bleibt getrennt:
- **Gender-Formen** (männlich vs weiblich)
  - "Bundeskanzler" (MASC) ≠ "Bundeskanzlerin" (FEM)

## Technische Umsetzung

### Vorher (in `text_processing.py`):
```python
# Verwendete originale Wortform als Schlüssel
key = word
# → "Bundeskanzler" und "Bundeskanzlers" waren separate Einträge
```

### Nachher:
```python
# Verwendet gendered_lemma als Schlüssel
key = analysis.get('gendered_lemma', word)
# → "Bundeskanzler" und "Bundeskanzlers" haben beide gendered_lemma: "Bundeskanzler"
# → Werden zusammengezählt!
```

## Ergebnisse

### Vor der Änderung:
- Eindeutige Wörter: 21,404
- Problem: "Bundeskanzler", "Bundeskanzlers", "Bundeskanzlern" alle separat

### Nach der Änderung:
- Eindeutige Wörter: 4,272 (ca. 80% Reduktion)
- ✓ "Bundeskanzler" + "Bundeskanzlers" → zusammengeführt
- ✓ "Bundeskanzler" ≠ "Bundeskanzlerin" → getrennt (wie gewünscht)

## Verifizierung

```
Bundeskanzler (MASC):
  - Vereint: Bundeskanzler, Bundeskanzlers, Bundeskanzlern, etc.
  - Occurrences: 2 (in den ersten 3 Protokollen)

Bundeskanzlerin (FEM):
  - Separate entry!
  - Occurrences: 2 (in den ersten 3 Protokollen)
```

## Weitere Beispiele

```
Deutschland:
  ✓ Deutschland + Deutschlands → "Deutschland"

Bundesregierung:
  ✓ Bundesregierung + Bundesregierungen → "Bundesregierung"

Gesetz:
  ✓ Gesetz + Gesetzes + Gesetze → "Gesetz"
```

## Vorteile

1. **Korrekte linguistische Zählung**
   - Häufigkeiten über alle grammatischen Formen aggregiert
   - "Bundeskanzler" wurde X-mal verwendet (in allen Fällen)

2. **Reduzierte Datenbankgröße**
   - 80% weniger eindeutige Einträge
   - Schnellere Abfragen

3. **Gender-Tracking bleibt erhalten**
   - "Bundeskanzler" vs "Bundeskanzlerin" immer noch getrennt
   - Forschungsfrage "Wann wurde Bundeskanzlerin erstmals verwendet?" weiterhin möglich

4. **Bessere Suche**
   - Suche nach "Bundeskanzler" findet alle Vorkommen
   - Unabhängig vom grammatischen Fall

## Datenbankschema

Die `words` Tabelle speichert jetzt:

```
word (gendered_lemma)    | gender | pos_tag | occurrences
-------------------------|--------|---------|------------
Bundeskanzler            | MASC   | NOUN    | X
Bundeskanzlerin          | FEM    | NOUN    | Y
Deutschland              | NEUT   | PROPN   | Z
```

Nicht mehr:
```
Bundeskanzler            | MASC   | NOUN    | A
Bundeskanzlers           | MASC   | NOUN    | B
Bundeskanzlern           | MASC   | NOUN    | C
```

## Zusammenfassung

Die Lemmatisierung funktioniert jetzt korrekt:
- ✅ Grammatische Fälle werden zusammengeführt
- ✅ Gender-Formen bleiben getrennt
- ✅ 80% Reduktion der eindeutigen Wörter
- ✅ Linguistisch korrekte Häufigkeitszählung
- ✅ Gender-Tracking für Forschung erhalten

Die Änderung macht die Datenbank effizienter und die Analysen aussagekräftiger!
