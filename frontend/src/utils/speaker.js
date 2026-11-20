// "Name (Fraktion, Rolle)" of the person who said a word first, with a prefix for interjections and quotations.
export function speakerOf(word) {
  if (!word.erste) return null;
  const { name, fraktion, rolle, zwischenruf, zitat } = word.erste;
  const affiliation = [fraktion, rolle].filter(Boolean).join(', ');
  const prefix = zitat ? 'Zitat, vorgelesen von ' : zwischenruf ? 'Zwischenruf von ' : '';
  return `${prefix}${name}${affiliation ? ` (${affiliation})` : ''}`;
}
