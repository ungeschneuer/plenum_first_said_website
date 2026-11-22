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
| `pipeline/text_speakers.py`, `pipeline/speaker_lines.py` | Redner aus den Rednerzeilen des Textes vor der 19. Wahlperiode |
| `pipeline/update_name_lists.py` | erzeugt aus den Stammdaten der Abgeordneten die Namenslisten zur Namenserkennung |
| `pipeline/fragments.py` | erkennt Bruchstücke von Wörtern, die an Seitenumbrüchen getrennt wurden |
| `pipeline/lemmatizer.py` | führt Wortformen auf ihr Lemma zurück (siehe unten) |
| `pipeline/speakers.py` | sucht in den strukturierten Protokollen des Bundestages, wer ein Lemma zuerst gesagt hat |
| `pipeline/export_static_data.py` | holt Protokolle, zählt pro Protokoll und Lemma, schreibt die Dateien; das Datenformat steht im Docstring |
| `pipeline/speaker_statistics.py` | zählt aus einem fertigen Export je Person die Wörter, die sie zuerst gesagt hat; läuft nach jedem Export und gehört nicht zu den Zählregeln |
| `pipeline/word_statistics.py` | Wiederkehrer, Einmalwörter und typische Wörter der Fraktionen aus einem fertigen Export; läuft nach jedem Export und gehört nicht zu den Zählregeln |
| `frontend/` | die Seite; `src/utils/staticData.js` liest die Dateien |
| `frontend/src/pageMeta.js` | Titel, Beschreibung und Vorschaubild jeder Seite; `frontend/scripts/page-html.mjs` schreibt daraus nach dem Bau eine HTML-Datei je Seite, auch je Person und je neuem Wort, damit Links die passende Vorschau zeigen |
| `frontend/scripts/og-images.mjs` | erzeugt die Vorschau- und Teilen-Bilder mit Playwright, jeweils als Link-Vorschau und für LinkedIn (1200 × 630), Instagram-Post (1080 × 1350, Endung `-post`) und Instagram-Story (1080 × 1920, Endung `-story`); Personen- und Wortseiten bieten sie zum Herunterladen an: ohne Argument die Bilder der festen Seiten in `frontend/public/og/`, die nach einer Änderung der Texte neu erzeugt und eingecheckt werden; mit `--dist dist` beim Veröffentlichen ein Bild je Person (Name, Zahl der zuerst gesagten Wörter, Balken je Wahlperiode) und je neuem Wort (erstes Vorkommen und erste Person) |
| `.github/workflows/pages.yml` | täglich: Datenstand aus dem Release `daten` laden, neue Protokolle aus DIP aufnehmen, sichern, veröffentlichen; startet den Neuaufbau, wenn sich die Zählregeln geändert haben, und schlägt fehl, wenn seit Wochen kein neues Protokoll kam (`pipeline/check_freshness.py`) |
| `.github/workflows/rebuild.yml` | alle Protokolle neu aus DIP zählen, mit dem bisherigen Datenstand vergleichen (`pipeline/compare_data.py`) und ihn ersetzen; nötig, wenn sich der Fingerabdruck der Zählregeln (`pipeline/rules_version.py`) ändert |

## Lemmatisierung

Gezählt wird pro Lemma. Grundlage ist das Wörterbuch von simplemma; Regeln ergänzen unbekannte Komposita (letztes
Glied), Partizipien und Adjektive. Weibliche Formen bleiben eigene Lemmata, Namen bleiben unverändert, alte und neue
Rechtschreibung werden zusammengefasst (Ausschuß, Ausschuss). Bedeutungsunterschiede wie Daten und Datum stehen in
`SEMANTIC_EXCEPTIONS`. `pipeline/lemma_gold.tsv` ist ein von Hand geprüfter Goldstandard; die Tests verlangen
mindestens 97 Prozent. Eine Wortform behält ihr Lemma in späteren Läufen; eine geänderte Regel wirkt erst nach
einem Neuaufbau.

## Daten nachnutzen

Der vollständige Datenstand liegt als `static-data.tar.gz` im Release
[daten](https://github.com/ungeschneuer/plenum_first_said_website/releases/tag/daten) und wird bei jedem Lauf mit
neuen Protokollen ersetzt; einzelne Dateien liegen auch unter `https://ungeschneuer.github.io/plenum_first_said_website/data/`.
Alle Dateien sind JSON in UTF-8.

| Datei | Inhalt |
|---|---|
| `protocols.json` | alle Protokolle nach Datum: `id` (DIP), `wahlperiode`, `nummer` (z. B. `21/108`), `datum`, `pdf`, `woerter` (gezählte Wörter), `datum_dip` (nur wenn das Datum aus DIP nicht zur Reihenfolge der Sitzungen passte und korrigiert wurde, siehe `pipeline/protocol_dates.py`), `gemeinsam_mit` (bei einer Sitzung, die im Protokoll einer anderen Sitzung desselben Tages steht: deren Nummer; die Sitzung wird dann nicht gezählt); die Position in der Liste ist der Protokollindex |
| `shards.json` | Schlüssel der Teildateien; ein Lemma steht in der Teildatei mit dem längsten Schlüssel, der seine gefaltete Schreibung beginnt (klein, ä zu ae, ß zu ss, alles außer a bis z zu `_`) |
| `words/<Schlüssel>.json` | je Lemma: `reihe` (Paare aus Abstand zum vorigen Protokollindex und Anzahl, das erste Paar mit dem absoluten Index), `formen` (Wortform: Anzahl), `erste` (Name und Fraktion oder Rolle der ersten Person, `zwischenruf` bei Zwischenrufen, `null` wenn unbekannt), `beleg` (Satz des ersten Vorkommens), `fraktionen` (je Wahlperiode ab der 19. die Anzahl je Fraktion in Reden) |
| `search/<Präfix>.json` | Suchindex: `[Lemma, Anzahl]` und `[Wortform, Anzahl des Lemmas, Lemma]`, nach Anzahl sortiert |
| `fraktionen.json` | je Wahlperiode die gezählten Wörter jeder Fraktion in Reden, die Bezugsgröße für Anteile |
| `stand.json` | `zaehlregeln` (Fingerabdruck der Zählregeln, mit denen der Datenstand erstellt wurde) und `erstellt` (Datum) |
| `neue-woerter.json` | Lemmata, die in den Protokollen der letzten 90 Tage zum ersten Mal vorkommen, mit Protokoll, Formen, erster Person und Beleg |
| `personen.json` | je Person (`id`, `name`) die Anzahl der Wörter, die sie zuerst gesagt hat (`anzahl`, ohne vorgelesene Zitate), davon `zwischenrufe` und `sitzungsleitung`, die häufigste `zuordnung` (Fraktion, sonst Rolle) und je Wahlperiode `[Anzahl, davon Sitzungsleitung, Zuordnung]`; dazu `fraktionen`: je Wahlperiode die Anzahl je Fraktion |
| `personen/<id>.json` | je Person `zuordnungen` (Fraktion oder Rolle: Anzahl) und `woerter`: `[Lemma, Protokollindex, 1 bei Zwischenruf]` |
| `statistik.json` | `wiederkehrer` (`laengste` und `zuletzt`: Lemma, Protokollindex vor und nach der längsten Lücke, Anzahl davor und danach), `einmalwoerter` (je Wahlperiode `[neue Lemmata, davon nur einmal gesagt]` und Beispiele mit Beleg), `typisch` (je Wahlperiode ab der 19. und Fraktion `[Lemma, Anzahl, Verhältnis zu den übrigen Fraktionen]`); Namen sind ausgenommen |

Beispiel: `"reihe": [3, 1, 4, 2]` heißt einmal in Protokoll 3 und zweimal in Protokoll 7. Die Texte stammen vom
Deutschen Bundestag (Datenlizenz Deutschland – Namensnennung – Version 2.0); bitte nennen Sie bei einer Nachnutzung
den Deutschen Bundestag als Quelle.

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
