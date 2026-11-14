/**
 * German language utilities for formatting dates and plurals
 */

/**
 * Format date to German format (DD.MM.YYYY)
 * @param {string} dateString - Date in ISO format (YYYY-MM-DD)
 * @returns {string} Date in German format (DD.MM.YYYY)
 */
export function formatGermanDate(dateString) {
  if (!dateString) return '';

  // Handle ISO format (YYYY-MM-DD)
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}.${month}.${year}`;
  }

  return dateString;
}

/**
 * Get plural form of German word based on count
 * @param {number} count - The count
 * @param {string} singular - Singular form
 * @param {string} plural - Plural form
 * @returns {string} Formatted string with count and word
 */
export function pluralize(count, singular, plural) {
  const word = count === 1 ? singular : plural;
  return `${count} ${word}`;
}

/**
 * Common German pluralizations
 */
export const germanPlurals = {
  protokoll: (count) => pluralize(count, 'Protokoll', 'Protokolle'),
  vorkommen: (count) => pluralize(count, 'Vorkommen', 'Vorkommen'),
  ergebnis: (count) => pluralize(count, 'Ergebnis', 'Ergebnisse'),
  wort: (count) => pluralize(count, 'Wort', 'Wörter'),
};

/**
 * Format legislature info in German
 * @param {number} wahlperiode - Legislature period
 * @param {number} protokollnummer - Protocol number
 * @returns {string} Formatted string
 */
export function formatLegislature(wahlperiode, protokollnummer) {
  return `Wahlperiode ${wahlperiode}, Protokoll ${protokollnummer}`;
}

/**
 * Format short legislature info
 * @param {number} wahlperiode - Legislature period
 * @param {number} protokollnummer - Protocol number
 * @returns {string} Short formatted string (WP X/Y)
 */
export function formatLegislatureShort(wahlperiode, protokollnummer) {
  return `WP ${wahlperiode}/${protokollnummer}`;
}

/**
 * Get current calendar date in German format
 * @returns {object} Object with weekday, day, month, year
 */
export function getCurrentCalendarDate() {
  const now = new Date();
  const weekdays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch',
                    'Donnerstag', 'Freitag', 'Samstag'];
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  return {
    weekday: weekdays[now.getDay()],
    day: now.getDate(),
    month: months[now.getMonth()],
    year: now.getFullYear()
  };
}

/**
 * Format a date string to German calendar format
 * @param {string} dateString - Date in ISO format (YYYY-MM-DD)
 * @returns {object} Object with weekday, day, month, year
 */
export function formatCalendarDate(dateString) {
  if (!dateString) return { weekday: '', day: 0, month: '', year: 0 };

  const date = new Date(dateString);
  const weekdays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch',
                    'Donnerstag', 'Freitag', 'Samstag'];
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  return {
    weekday: weekdays[date.getDay()],
    day: date.getDate(),
    month: months[date.getMonth()],
    year: date.getFullYear()
  };
}
