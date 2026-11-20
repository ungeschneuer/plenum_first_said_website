// Mirrors clean_name and person_id in pipeline/speaker_statistics.py; the ids name the files below personen/.
const LETTER_REPLACEMENTS = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
const NOISE_BEFORE_NAME = /^(?:.*\b(?:Beifall|Gegenruf|Zuruf)\b.*?[-–\x96]\s*|(?:Weiterer )?Gegenruf des Abg\.\s*)/;
const TITLE_BEFORE_NAME = /^(?:Abg\.|Ministerpräsident(?:in)?|Minister(?:in)?|Senator(?:in)?|Staatsminister(?:in)?|Regierende[r]? Bürgermeister(?:in)?)\s+/;
const ROLE_AFTER_NAME = /,\s.*$/;
const NOTE_IN_NAME = /\b(?:Beifall|Zuruf|Gegenruf)\b/;
export const CHAIR_ROLES = new Set(['Präsident', 'Präsidentin', 'Vizepräsident', 'Vizepräsidentin', 'Alterspräsident',
  'Alterspräsidentin']);

export function cleanName(name) {
  let cleaned = name.replaceAll('\xad', '').replace(NOISE_BEFORE_NAME, '').trim();
  cleaned = cleaned.replace(TITLE_BEFORE_NAME, '').replace(ROLE_AFTER_NAME, '').trim();
  const first = cleaned.charAt(0);
  if (!first || first === first.toLowerCase() || NOTE_IN_NAME.test(cleaned)) return '';
  return cleaned;
}

export function personId(name) {
  const folded = Array.from(name.toLowerCase(), (character) => LETTER_REPLACEMENTS[character] ?? character)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
  return folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const personPath = (name) => {
  const id = personId(cleanName(name));
  return id ? `/person/${id}` : null;
};

export const ALL_TERMS = 'alle';

// Value and attribution of a person in the chosen term; chair words count only if asked for.
function standing(person, term, includeChair) {
  if (term === ALL_TERMS) {
    return { value: person.anzahl - (includeChair ? 0 : person.sitzungsleitung), attribution: person.zuordnung };
  }
  const entry = person.wahlperioden[term];
  if (!entry) return null;
  const [count, asChair, attribution] = entry;
  return { value: count - (includeChair ? 0 : asChair), attribution };
}

// Competition ranking: equal values share a rank, the next rank skips accordingly.
export function rankPersons(persons, term, includeChair) {
  const rows = persons
    .map((person) => ({ person, ...standing(person, term, includeChair) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.person.name.localeCompare(b.person.name, 'de'));
  rows.forEach((row, index) => {
    row.rank = index > 0 && rows[index - 1].value === row.value ? rows[index - 1].rank : index + 1;
  });
  return rows;
}

