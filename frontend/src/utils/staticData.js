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
  };
}

async function loadSeries(word) {
  const normalizedWord = word.toLowerCase();
  const key = shardKeyFor(normalizedWord, await loadShardKeys());
  const series = key && (await loadShard(key))[normalizedWord];
  if (!series) {
    throw new Error(`Das Wort „${word}“ kommt in keinem Protokoll vor`);
  }
  return series;
}

export async function getWordTimeline(word) {
  const [protocols, series] = await Promise.all([loadProtocols(), loadSeries(word)]);
  const countByProtocolIndex = new Map(
    decodeSeries(series).map(({ protocolIndex, count }) => [protocolIndex, count])
  );
  return protocols.map((protocol, index) => timelinePoint(protocol, countByProtocolIndex.get(index) ?? 0));
}

export async function getWordDetails(word) {
  const [protocols, series] = await Promise.all([loadProtocols(), loadSeries(word)]);
  const occurrences = decodeSeries(series);
  const firstProtocol = protocols[occurrences[0].protocolIndex];
  return {
    word: word.toLowerCase(),
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

async function loadSearchEntries(prefix) {
  try {
    return await loadJson(`search/${prefix}.json`);
  } catch {
    return [];
  }
}

export async function searchWords(query, limit = 20) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < MINIMUM_QUERY_LENGTH) {
    return { items: [], pagination: { total: 0 } };
  }
  const entries = await loadSearchEntries(foldForShardKey(normalizedQuery).slice(0, SEARCH_PREFIX_LENGTH));
  const matches = entries
    .filter(([word]) => word.startsWith(normalizedQuery))
    .map(([word, total]) => ({ word, word_id: word, occurrence_count: total }));
  return { items: matches.slice(0, limit), pagination: { total: matches.length } };
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
