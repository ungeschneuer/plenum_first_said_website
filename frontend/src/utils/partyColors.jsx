/**
 * Official German party colors for badge styling.
 * Lookup is case-insensitive and handles common name variants.
 */

const PARTY_COLORS = {
  'spd':          { bg: '#E3000F', text: '#ffffff' },
  'cdu':          { bg: '#000000', text: '#ffffff' },
  'csu':          { bg: '#0073B0', text: '#ffffff' },
  'cdu/csu':      { bg: '#000000', text: '#ffffff' },
  'fdp':          { bg: '#FFED00', text: '#000000' },
  'afd':          { bg: '#009FE3', text: '#ffffff' },
  'die grünen':   { bg: '#1AA037', text: '#ffffff' },
  'grüne':        { bg: '#1AA037', text: '#ffffff' },
  'bündnis 90/die grünen': { bg: '#1AA037', text: '#ffffff' },
  'die linke':    { bg: '#BE3075', text: '#ffffff' },
  'linke':        { bg: '#BE3075', text: '#ffffff' },
  'bsw':          { bg: '#6D0F6D', text: '#ffffff' },
  'ssw':          { bg: '#003F85', text: '#ffffff' },
  'fraktionslos': { bg: '#6b7280', text: '#ffffff' },
};

const PARTY_FULL_NAMES = {
  'spd':          'Sozialdemokratische Partei Deutschlands',
  'cdu':          'Christlich Demokratische Union Deutschlands',
  'csu':          'Christlich-Soziale Union in Bayern',
  'cdu/csu':      'CDU/CSU-Fraktion',
  'fdp':          'Freie Demokratische Partei',
  'afd':          'Alternative für Deutschland',
  'die grünen':   'Bündnis 90/Die Grünen',
  'grüne':        'Bündnis 90/Die Grünen',
  'bündnis 90/die grünen': 'Bündnis 90/Die Grünen',
  'die linke':    'Die Linke',
  'linke':        'Die Linke',
  'bsw':          'Bündnis Sahra Wagenknecht',
  'ssw':          'Südschleswigscher Wählerverband',
};

/**
 * Returns the full official party name, or the original name if not known.
 */
export function getPartyFullName(partyName) {
  if (!partyName) return partyName;
  return PARTY_FULL_NAMES[partyName.toLowerCase().trim()] ?? partyName;
}

/**
 * Returns inline style object {backgroundColor, color} for a party name.
 * Falls back to muted gray for unknown parties.
 */
export function getPartyStyle(partyName) {
  if (!partyName) return null;
  const colors = PARTY_COLORS[partyName.toLowerCase().trim()];
  if (!colors) return null;
  return { backgroundColor: colors.bg, color: colors.text, borderColor: 'transparent' };
}

/**
 * PartyBadge — renders a Badge with the party's official color.
 * Falls back to the standard secondary variant for unknown parties.
 */
import { Badge } from '../components/ui/badge';

export function PartyBadge({ party, className, ...props }) {
  const style = getPartyStyle(party);
  return (
    <Badge
      variant={style ? undefined : 'secondary'}
      className={className}
      style={style ?? undefined}
      {...props}
    >
      {party}
    </Badge>
  );
}
