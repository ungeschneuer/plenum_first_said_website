// Writes an HTML file with its own title, description and preview image for each page of the built site, so that
// link previews show the matching page. GitHub Pages serves dist/<path>/index.html for <path>; every other path gets
// 404.html, which loads the same app.
//
// Usage: node scripts/page-html.mjs <dist directory> <public URL of the site>
// Pages for persons and new words are written when dist/data holds personen.json and neue-woerter.json; their
// preview images come from scripts/og-images.mjs --dist, which runs before.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_DESCRIPTION, PAGES, SITE_NAME, pageTitle, personPage, wordPage } from '../src/pageMeta.js';

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// siteUrl ends with a slash; page.path starts with one and is relative to the site. A page without path (the
// 404 page, which stands for every path without its own file) gets no address.
export function headTags(page, siteUrl) {
  const title = pageTitle(page.title);
  // GitHub Pages answers a path without its file name by redirecting to the same path with a slash.
  const url = page.path == null ? null : siteUrl + page.path.replace(/^\//, '').replace(/([^/])$/, '$1/');
  const image = `${siteUrl}og/${page.image}.png`;
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    url && `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:locale" content="de_DE" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    url && `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:width" content="${IMAGE_WIDTH}" />`,
    `<meta property="og:image:height" content="${IMAGE_HEIGHT}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(`${page.title}: ${SITE_NAME}`)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ];
  return tags.filter(Boolean).join('\n    ');
}

export function withHead(html, page, siteUrl) {
  if (!/<title>[^<]*<\/title>/.test(html)) {
    throw new Error('index.html enthält kein <title>');
  }
  return html.replace(/<title>[^<]*<\/title>/, () => headTags(page, siteUrl));
}

// The file that GitHub Pages serves for a page path; null for a path that cannot be a directory name.
export function fileOfPath(distDirectory, pagePath) {
  if (pagePath === '/') return path.join(distDirectory, 'index.html');
  const segments = pagePath.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments.some((segment) => segment === '.' || segment === '..' || /[/\\\0]/.test(segment))) return null;
  return path.join(distDirectory, ...segments, 'index.html');
}

function readJson(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function pagesFromData(dataDirectory) {
  const persons = readJson(path.join(dataDirectory, 'personen.json'))?.personen ?? [];
  const newWords = readJson(path.join(dataDirectory, 'neue-woerter.json')) ?? [];
  return [
    // An id is the folded name (pipeline/speaker_statistics.py); anything else would not be a safe file name.
    ...persons.filter((person) => /^[a-z0-9-]+$/.test(person.id ?? '') && person.name).map(personPage),
    ...newWords.filter((word) => word.lemma).map(wordPage),
  ];
}

export function writePages(distDirectory, siteUrl) {
  const base = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  const template = readFileSync(path.join(distDirectory, 'index.html'), 'utf8');
  const fallback = { path: null, title: SITE_NAME, description: DEFAULT_DESCRIPTION, image: 'start' };
  writeFileSync(path.join(distDirectory, '404.html'), withHead(template, fallback, base));

  let written = 0;
  for (const page of [...PAGES, ...pagesFromData(path.join(distDirectory, 'data'))]) {
    const file = fileOfPath(distDirectory, page.path);
    if (!file) continue;
    // Pages of persons and words use their own image once scripts/og-images.mjs has rendered it.
    const ownImage = existsSync(path.join(distDirectory, 'og', `${page.image}.png`));
    const shown = page.fallbackImage && !ownImage ? { ...page, image: page.fallbackImage } : page;
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, withHead(template, shown, base));
    written += 1;
  }
  return written;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [distDirectory, siteUrl] = process.argv.slice(2);
  if (!distDirectory || !siteUrl) {
    console.error('Aufruf: node scripts/page-html.mjs <dist> <Adresse der Seite>');
    process.exit(2);
  }
  const written = writePages(distDirectory, siteUrl);
  console.log(`${written} Seiten mit eigenen Vorschauangaben geschrieben.`);
}
