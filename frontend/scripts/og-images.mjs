// Renders the preview images (1200 × 630 pixels) with Playwright.
//
//   node scripts/og-images.mjs              images of the fixed pages into public/og/, from src/pageMeta.js;
//                                           they are part of the repository, run this after changing a text
//   node scripts/og-images.mjs --dist dist  one image per person and per new word into dist/og/, from dist/data;
//                                           run by the publishing workflow after the build
//
// The font Inter comes from @fontsource/inter, so the images look the same on every machine.

import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PAGES, SITE_NAME, TEMPLATE_IMAGES } from '../src/pageMeta.js';
import { pagesFromData } from './page-html.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');
// Chromium does not hyphenate long compounds on its own; soft hyphens from German patterns mark the break points.
const { hyphenateSync } = require('hyphen/de');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1200;
const HEIGHT = 630;
const PARALLEL_PAGES = 6;

const BLACK = '#000000';
const WHITE = '#ffffff';
const GOLD = '#ffcc00';
const RED = '#dd0000';
const GREY = '#52525b';
const LIGHT_GREY = '#d4d4d8';
const DARK_GOLD = '#a16207';

// A row of bars with a highlighted bar, one shape per image so that the images differ at a glance.
const MOTIFS = {
  start: [3, 5, 4, 6, 8, 7, 9, 12, 10, 14, 13, 16],
  neu: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16],
  personen: [16, 12, 10, 8, 7, 6, 5, 4, 4, 3, 3, 2],
  statistik: [6, 14, 3, 9, 12, 5, 16, 8, 4, 11, 7, 10],
  vergleich: [[4, 10], [6, 9], [8, 8], [9, 6], [12, 5], [14, 4]],
  faq: [6, 9, 7, 11, 8, 13, 9, 7, 10, 6, 8, 5],
  about: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  wort: [0, 2, 0, 5, 3, 0, 8, 6, 11, 9, 14, 16],
  person: [16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fontFaces() {
  const directory = path.join(path.dirname(require.resolve('@fontsource/inter/package.json')), 'files');
  const faces = [];
  for (const subset of ['latin', 'latin-ext']) {
    for (const weight of [400, 600, 800]) {
      const data = readFileSync(path.join(directory, `inter-${subset}-${weight}-normal.woff2`)).toString('base64');
      faces.push(`@font-face { font-family: Inter; font-weight: ${weight}; font-style: normal; ` +
        `src: url(data:font/woff2;base64,${data}) format('woff2'); }`);
    }
  }
  return faces.join('\n');
}

// Values may be any size; the highest bar fills the chart.
function bars(values) {
  const width = 360;
  const height = 300;
  const paired = Array.isArray(values[0]);
  const columns = values.length;
  const gap = paired ? 14 : Math.max(2, Math.min(8, 96 / columns));
  const columnWidth = (width - gap * (columns - 1)) / columns;
  const maximum = Math.max(1, ...values.flat());
  const unit = height / maximum;
  const highest = paired ? -1 : values.lastIndexOf(Math.max(...values));
  const rects = values.map((value, index) => {
    const x = index * (columnWidth + gap);
    if (paired) {
      const half = (columnWidth - 4) / 2;
      return [
        `<rect x="${x}" y="${height - value[0] * unit}" width="${half}" height="${value[0] * unit}" fill="${GOLD}" rx="3"/>`,
        `<rect x="${x + half + 4}" y="${height - value[1] * unit}" width="${half}" height="${value[1] * unit}" fill="${RED}" rx="3"/>`,
      ].join('');
    }
    const barHeight = Math.max(value * unit, 4);
    return `<rect x="${x}" y="${height - barHeight}" width="${columnWidth}" height="${barHeight}" ` +
      `fill="${index === highest ? GOLD : LIGHT_GREY}" rx="${Math.min(3, columnWidth / 3)}"/>`;
  });
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rects.join('')}</svg>`;
}

// Large headings get at most three lines, from SMALL_HEADING_SIZE on four.
const MAX_HEADING_LINES = 4;
const SMALL_HEADING_SIZE = 44;
const MIN_HEADING_SIZE = 30;
const SHRINK_BEFORE_HYPHENATING = 44;
const MIN_TEXT_SCALE = 0.75;

// Fits the heading first by shrinking it with breaks only between words and at hyphens in the text, down to
// SHRINK_BEFORE_HYPHENATING; if that is not enough, again from the start with hyphenation of long words, down to
// MIN_HEADING_SIZE. Then the smaller texts shrink until the whole column fits. Only text that does not fit even then
// is cut.
function fitText({ maxLines, smallSize, minSize, hyphenateBelow, minScale }) {
  const main = document.querySelector('main');
  const column = document.querySelector('.text');
  const heading = document.querySelector('h1');
  const small = [...document.querySelectorAll('p, .detail')];
  const smallSizes = small.map((element) => parseFloat(getComputedStyle(element).fontSize));
  const headingFits = () => {
    const size = parseFloat(heading.style.fontSize || getComputedStyle(heading).fontSize);
    const lines = Math.round(heading.getBoundingClientRect().height / (size * 1.05));
    return heading.scrollWidth <= heading.clientWidth + 1 && lines <= (size > smallSize ? maxLines - 1 : maxLines);
  };
  const columnFits = () => column.scrollHeight <= main.clientHeight - 48;
  const startSize = parseFloat(getComputedStyle(heading).fontSize);
  const shrink = (lowest) => {
    let size = startSize;
    heading.style.fontSize = `${size}px`;
    while (!(headingFits() && columnFits()) && size > lowest) {
      size -= 2;
      heading.style.fontSize = `${size}px`;
    }
    return headingFits() && columnFits();
  };
  heading.style.hyphens = 'none';
  if (!shrink(hyphenateBelow)) {
    heading.style.hyphens = 'manual';
    shrink(minSize);
  }
  for (let scale = 0.95; !columnFits() && scale >= minScale; scale -= 0.05) {
    small.forEach((element, index) => { element.style.fontSize = `${smallSizes[index] * scale}px`; });
  }
  if (!headingFits()) heading.classList.add('squeezed');
  if (!columnFits()) column.classList.add('squeezed');
}

// Starting size of the heading; fitText makes it smaller where needed.
function headingSize(heading) {
  const longestWord = Math.max(...heading.split(/\s+/).map((word) => word.length));
  const length = heading.length;
  if (longestWord > 22 || length > 48) return 52;
  if (longestWord > 16 || length > 30) return 64;
  if (longestWord > 12 || length > 20) return 76;
  return 88;
}

export function cardHtml(card, fonts) {
  const motif = Array.isArray(card.motif) ? card.motif : MOTIFS[card.motif] ?? MOTIFS.start;
  const details = (card.details ?? []).map((line) => `<div class="detail">${escapeHtml(line)}</div>`).join('');
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><style>
  ${fonts}
  * { margin: 0; box-sizing: border-box; }
  body { width: ${WIDTH}px; height: ${HEIGHT}px; background: ${WHITE}; color: ${BLACK}; font-family: Inter, sans-serif;
         display: flex; flex-direction: column; overflow: hidden; }
  .flag { display: flex; height: 12px; flex: none; }
  .flag span { flex: 1; }
  main { flex: 1; display: flex; align-items: center; gap: 64px; padding: 0 80px; min-height: 0; }
  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 24px; }
  .site { font-size: 28px; font-weight: 600; color: ${DARK_GOLD}; letter-spacing: 0.01em; }
  .site span { color: ${GREY}; font-weight: 400; }
  h1 { font-size: ${headingSize(card.heading)}px; font-weight: 800; line-height: 1.05; letter-spacing: -0.02em;
       hyphens: manual; overflow-wrap: normal; }
  h1.squeezed { overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: ${MAX_HEADING_LINES};
                -webkit-box-orient: vertical; overflow: hidden; }
  p { font-size: 30px; line-height: 1.3; color: ${GREY}; }
  .details { display: flex; flex-direction: column; gap: 6px; }
  .detail { font-size: 26px; line-height: 1.3; color: ${GREY}; }
  .text.squeezed .detail { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .chart { flex: none; display: flex; flex-direction: column; gap: 12px; padding-top: 40px; }
  .chart svg { border-bottom: 3px solid #a1a1aa; }
  .chart-label { font-size: 20px; color: ${GREY}; text-align: right; }
</style></head><body>
  <div class="flag"><span style="background:${BLACK}"></span>
    <span style="background:${RED}"></span><span style="background:${GOLD}"></span></div>
  <main>
    <div class="text">
      <div class="site">${SITE_NAME}${card.label ? ` <span>· ${escapeHtml(card.label)}</span>` : ''}</div>
      <h1>${escapeHtml(hyphenateSync(card.heading))}</h1>
      <p>${escapeHtml(card.caption)}</p>
      ${details ? `<div class="details">${details}</div>` : ''}
    </div>
    <div class="chart">${bars(motif)}${card.chartLabel ? `<div class="chart-label">${escapeHtml(card.chartLabel)}</div>` : ''}</div>
  </main>
</body></html>`;
}

// images: [[file without extension, card], ...]
export async function renderCards(images, outputDirectory) {
  const fonts = fontFaces();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  let next = 0;
  async function worker() {
    const page = await context.newPage();
    while (next < images.length) {
      const [name, card] = images[next];
      next += 1;
      const file = path.join(outputDirectory, `${name}.png`);
      mkdirSync(path.dirname(file), { recursive: true });
      await page.setContent(cardHtml(card, fonts));
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(fitText, {
        maxLines: MAX_HEADING_LINES, smallSize: SMALL_HEADING_SIZE, minSize: MIN_HEADING_SIZE,
        hyphenateBelow: SHRINK_BEFORE_HYPHENATING, minScale: MIN_TEXT_SCALE,
      });
      // A palette of 64 colours keeps the image at about a quarter of the size without visible loss.
      const screenshot = await page.screenshot();
      await sharp(screenshot).png({ palette: true, colours: 64, compressionLevel: 9, effort: 10 }).toFile(file);
    }
    await page.close();
  }
  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PAGES, images.length) }, worker));
  } finally {
    await browser.close();
  }
}

function fixedImages() {
  const images = new Map();
  for (const page of [...PAGES, ...TEMPLATE_IMAGES]) {
    if (page.heading && !images.has(page.image)) {
      images.set(page.image, { heading: page.heading, caption: page.caption, motif: page.image });
    }
  }
  return [...images];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const distIndex = process.argv.indexOf('--dist');
  if (distIndex === -1) {
    const images = fixedImages();
    await renderCards(images, path.join(ROOT, 'public', 'og'));
    console.log(`${images.length} Vorschaubilder in public/og geschrieben.`);
  } else {
    const dist = process.argv[distIndex + 1];
    const images = pagesFromData(path.join(dist, 'data')).map((page) => [page.image, page.card]);
    const started = Date.now();
    await renderCards(images, path.join(dist, 'og'));
    console.log(`${images.length} Vorschaubilder für Personen und Wörter in ${Math.round((Date.now() - started) / 1000)} s geschrieben.`);
  }
}
