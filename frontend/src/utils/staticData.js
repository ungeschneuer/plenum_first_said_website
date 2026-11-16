// Reads the files written by pipeline/export_static_data.py; see its docstring for the layout.

const DATA_BASE_URL = import.meta.env.VITE_DATA_BASE_URL || `${import.meta.env.BASE_URL}data`;
const LETTER_REPLACEMENTS = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
const SEARCH_PREFIX_LENGTH = 3;
export const MINIMUM_QUERY_LENGTH = 3;

const pendingFiles = new Map();

function loadJson(path) {
  if (!pendingFiles.has(path)) {
    const request = fetch(`${DATA_BASE_URL}/${path}`).then((response) => {
      if (!response.ok) {
        throw new Error(`Datei ${path} konnte nicht geladen werden (${response.status})`);
      }
      return response.json();
    });
    request.catch(() => pendingFiles.delete(path));
    pendingFiles.set(path, request);
  }
  return pendingFiles.get(path);
}

const loadProtocols = () => loadJson('protocols.json');
const loadShardKeys = () => loadJson('shards.json');
const loadShard = (key) => loadJson(`words/${key}.json`);

export function foldForShardKey(word) {
  return Array.from(word.toLowerCase())
    .map((character) => LETTER_REPLACEMENTS[character] ?? character)
    .join('')
    .replace(/[^a-z]/g, '_');
}

export function shardKeyFor(word, shardKeys) {
  const folded = foldForShardKey(word);
  for (let length = folded.length; length > 0; length--) {
    if (shardKeys.includes(folded.slice(0, length))) {
      return folded.slice(0, length);
    }
  }
  return null;
}

export function decodeSeries(series) {
  const occurrences = [];
  let protocolIndex = 0;
  for (let position = 0; position < series.length; position += 2) {
    protocolIndex += series[position];
    occurrences.push({ protocolIndex, count: series[position + 1] });
  }
  return occurrences;
}

function totalCount(series) {
  let total = 0;
  for (let position = 1; position < series.length; position += 2) {
    total += series[position];
  }
  return total;
}

function sessionNumber(protocol) {
  return protocol.nummer.split('/').pop();
}

function timelinePoint(protocol, count) {
  return {
    date: protocol.datum,
    count,
    total_words: protocol.woerter,
    percentage: protocol.woerter > 0 ? (count / protocol.woerter) * 100 : 0,
    protocol_id: protocol.id,
    wahlperiode: protocol.wahlperiode,
    protokollnummer: sessionNumber(protocol),
    pdf_url: protocol.pdf,
    source: protocol.quelle ?? null,
  };
}

async function loadSearchEntries(prefix) {
  try {
    return await loadJson(`search/${prefix}.json`);
  } catch {
    return [];
  }
}

function searchPrefix(word) {
  return foldForShardKey(word).slice(0, SEARCH_PREFIX_LENGTH);
}

const lemmaOfEntry = ([word, , lemma]) => lemma ?? word;

async function findLemmaEntry(lemma) {
  const key = shardKeyFor(lemma, await loadShardKeys());
  return key ? (await loadShard(key))[lemma] : undefined;
}

// An exact spelling only wins against a far more frequent lemma spelt alike up to capitals if it is not
// a rarity: links and typing are often lower case, and the corpus holds lower-case typos of nouns.
const MINIMUM_SHARE_OF_EXACT_SPELLING = 0.1;

async function lemmaForSpelling(word) {
  const lowercaseWord = word.toLowerCase();
  const candidates = (await loadSearchEntries(searchPrefix(word)))
    .filter(([spelling]) => spelling.toLowerCase() === lowercaseWord)
    .map((entry) => ({ lemma: lemmaOfEntry(entry), total: entry[1] }));
  const mostFrequent = candidates[0];
  const exact = candidates.find(({ lemma }) => lemma === word);
  if (exact && exact.total >= mostFrequent.total * MINIMUM_SHARE_OF_EXACT_SPELLING) return exact.lemma;
  return mostFrequent?.lemma ?? word;
}

async function loadWord(word) {
  const lemma = await lemmaForSpelling(word);
  const entry = await findLemmaEntry(lemma);
  if (!entry) {
    throw new Error(`Das Wort „${word}“ kommt in keinem Protokoll vor`);
  }
  return {
    lemma,
    series: entry.reihe,
    forms: Object.entries(entry.formen),
    firstSpeaker: entry.erste ?? null,
    evidence: entry.beleg ?? null,
    groupCounts: entry.fraktionen ?? {},
  };
}

export async function getWordTimeline(word) {
  const [protocols, { series }] = await Promise.all([loadProtocols(), loadWord(word)]);
  const countByProtocolIndex = new Map(
    decodeSeries(series).map(({ protocolIndex, count }) => [protocolIndex, count])
  );
  return protocols.map((protocol, index) => timelinePoint(protocol, countByProtocolIndex.get(index) ?? 0));
}

export async function getWordDetails(word) {
  const [protocols, { lemma, series, forms, firstSpeaker, evidence, groupCounts }] = await Promise.all([
    loadProtocols(),
    loadWord(word),
  ]);
  const occurrences = decodeSeries(series);
  const firstProtocol = protocols[occurrences[0].protocolIndex];
  return {
    word: lemma,
    forms,
    first_speaker: firstSpeaker,
    evidence,
    group_counts: groupCounts,
    first_date: firstProtocol.datum,
    wahlperiode: firstProtocol.wahlperiode,
    protokollnummer: sessionNumber(firstProtocol),
    pdf_url: firstProtocol.pdf,
    total_count: totalCount(series),
    protocol_count: occurrences.length,
  };
}

export async function getWordsComparison(words) {
  const timelines = await Promise.all(words.map((word) => getWordTimeline(word).catch(() => [])));
  return { words: Object.fromEntries(words.map((word, index) => [word, timelines[index]])) };
}

export async function searchWords(query, limit = 20) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < MINIMUM_QUERY_LENGTH) {
    return { items: [], pagination: { total: 0 } };
  }
  const seenLemmas = new Set();
  const matches = [];
  for (const entry of await loadSearchEntries(searchPrefix(normalizedQuery))) {
    const lemma = lemmaOfEntry(entry);
    if (entry[0].toLowerCase().startsWith(normalizedQuery) && !seenLemmas.has(lemma)) {
      seenLemmas.add(lemma);
      matches.push({ word: lemma, word_id: lemma, matched_form: entry[2] ? entry[0] : null, occurrence_count: entry[1] });
    }
  }
  return { items: matches.slice(0, limit), pagination: { total: matches.length } };
}

export async function getGroupTotals() {
  try {
    return await loadJson('fraktionen.json');
  } catch {
    return {};
  }
}

export async function getRecentlyFirstSaid() {
  return loadJson('neue-woerter.json');
}

export async function getStatus() {
  const protocols = await loadProtocols();
  return {
    processed_protocols: protocols.length,
    total_protocols: protocols.length,
    first_date: protocols[0]?.datum,
    last_date: protocols.at(-1)?.datum,
  };
}
