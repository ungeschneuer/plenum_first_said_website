// cardHtml with the fonts and hyphenation of the browser, for the previews of the admin view. Loaded only there:
// the German hyphenation patterns are about 750 kilobytes.
import hyphenDe from 'hyphen/de';
import latin400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import latin600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import latin800 from '@fontsource/inter/files/inter-latin-800-normal.woff2?url';
import latinExt400 from '@fontsource/inter/files/inter-latin-ext-400-normal.woff2?url';
import latinExt600 from '@fontsource/inter/files/inter-latin-ext-600-normal.woff2?url';
import latinExt800 from '@fontsource/inter/files/inter-latin-ext-800-normal.woff2?url';
import { cardHtml } from './card.js';

const FONT_FILES = [[400, latin400], [600, latin600], [800, latin800], [400, latinExt400], [600, latinExt600], [800, latinExt800]];

// The document lives in an iframe without base address, so the font addresses must be absolute.
const fonts = FONT_FILES.map(([weight, url]) =>
  `@font-face { font-family: Inter; font-weight: ${weight}; font-style: normal; ` +
  `src: url(${new URL(url, window.location.href).href}) format('woff2'); }`).join('\n');

export function previewHtml(card, formatKey) {
  return cardHtml(card, { fonts, hyphenate: hyphenDe.hyphenateSync, formatKey });
}
