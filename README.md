# Bundestag Wortschatz

Wie oft wurde ein Wort im Deutschen Bundestag gesagt? Die Seite zählt jedes Wort aus den Plenarprotokollen seit
1949, Sitzung für Sitzung, mit seinem ersten Vorkommen und ab der 19. Wahlperiode mit der Person, die es zuerst
gesagt hat: <https://ungeschneuer.github.io/plenum_first_said_website/>

Die Seite ist statisch. Eine Pipeline in Python zählt die Wörter und schreibt JSON-Dateien; das Frontend (React,
Vite) liest sie direkt. Ein Workflow schreibt die Daten täglich fort und veröffentlicht die Seite auf GitHub Pages.

## Aufbau

| Teil | Aufgabe |
|---|---|
| `pipeline/protocol_text.py` | zerlegt den Protokolltext in Wortformen; entfernt Kopfzeilen, Liste der Entschuldigten und Druckimpressum |
| `pipeline/fragments.py` | erkennt Bruchstücke von Wörtern, die an Seitenumbrüchen getrennt wurden |
| `pipeline/lemmatizer.py` | führt Wortformen auf ihr Lemma zurück (siehe unten) |
| `pipeline/speakers.py` | sucht in den strukturierten Protokollen des Bundestages, wer ein Lemma zuerst gesagt hat |
| `pipeline/export_static_data.py` | holt Protokolle, zählt pro Protokoll und Lemma, schreibt die Dateien; das Datenformat steht im Docstring |
| `frontend/` | die Seite; `src/utils/staticData.js` liest die Dateien |
| `.github/workflows/pages.yml` | täglich: Datenstand aus dem Release `daten` laden, neue Protokolle aus DIP aufnehmen, sichern, veröffentlichen |
| `.github/workflows/rebuild.yml` | von Hand: alle Protokolle neu aus DIP zählen, nötig nach Änderungen an Zerlegung oder Lemmatisierung |

## Lemmatisierung

Gezählt wird pro Lemma. Grundlage ist das Wörterbuch von simplemma; Regeln ergänzen unbekannte Komposita (letztes
Glied), Partizipien und Adjektive. Weibliche Formen bleiben eigene Lemmata, Namen bleiben unverändert, alte und neue
Rechtschreibung werden zusammengefasst (Ausschuß, Ausschuss). Bedeutungsunterschiede wie Daten und Datum stehen in
`SEMANTIC_EXCEPTIONS`. `pipeline/lemma_gold.tsv` ist ein von Hand geprüfter Goldstandard; die Tests verlangen
mindestens 97 Prozent. Eine Wortform behält ihr Lemma in späteren Läufen; eine geänderte Regel wirkt erst nach
einem Neuaufbau.

## Lokal arbeiten

```bash
python -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
.venv/bin/python -m unittest discover --start-directory pipeline --top-level-directory pipeline

# Datenstand aus dem Release holen und fortschreiben
gh release download daten --pattern static-data.tar.gz && mkdir previous && tar -xzf static-data.tar.gz -C previous
DIP_API_KEY=... .venv/bin/python pipeline/export_static_data.py --previous previous --fetch-dip --output static-data

# Seite mit diesen Daten starten
ln -s ../../static-data frontend/public/data
cd frontend && npm ci && npm run dev
```

Ohne Netz lässt `--skip-speakers` die Rednersuche aus. Einen API-Schlüssel für DIP gibt es auf der
[Hilfeseite der DIP-API](https://dip.bundestag.de/%C3%BCber-dip/hilfe/api).

## Herkunft und Lizenz

Die Seite ist aus dem Bot [Plenum First Said](https://github.com/ungeschneuer/plenum_first_said) entstanden, der auf
[NYT First Said](https://github.com/MaxBittker/nyt-first-said) von Max Bittker zurückgeht. Der Code steht unter der
GNU General Public License 3. Die Plenarprotokolle stammen vom Deutschen Bundestag (DIP und Open Data) und stehen
unter der Datenlizenz Deutschland – Namensnennung – Version 2.0; das gilt auch für die daraus abgeleiteten Zählungen.
