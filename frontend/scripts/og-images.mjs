// Renders the preview and share images with Playwright, each in the formats of SHARE_FORMATS (src/pageMeta.js):
// 1200 × 630 for link previews and LinkedIn, 1080 × 1350 for Instagram posts, 1080 × 1920 for Instagram stories.
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
import { PAGES, SHARE_FORMATS, SITE_NAME, TEMPLATE_IMAGES } from '../src/pageMeta.js';
import { SITE_URL } from '../src/siteConfig.js';
import { pagesFromData } from './page-html.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');
// Chromium does not hyphenate long compounds on its own; soft hyphens from German patterns mark the break points.
const { hyphenateSync } = require('hyphen/de');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
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
function bars(values, width, height) {
  const paired = Array.isArray(values[0]);
  const columns = values.length;
  const scale = width / 360;
  const gap = (paired ? 14 : Math.max(2, Math.min(8, 96 / columns))) * scale;
  const columnWidth = (width - gap * (columns - 1)) / columns;
  const maximum = Math.max(1, ...values.flat());
  const unit = height / maximum;
  const highest = paired ? -1 : values.lastIndexOf(Math.max(...values));
  const radius = Math.min(3 * scale, columnWidth / 3);
  const rects = values.map((value, index) => {
    const x = index * (columnWidth + gap);
    if (paired) {
      const half = (columnWidth - 4 * scale) / 2;
      return [
        `<rect x="${x}" y="${height - value[0] * unit}" width="${half}" height="${value[0] * unit}" fill="${GOLD}" rx="${radius}"/>`,
        `<rect x="${x + half + 4 * scale}" y="${height - value[1] * unit}" width="${half}" height="${value[1] * unit}" fill="${RED}" rx="${radius}"/>`,
      ].join('');
    }
    const barHeight = Math.max(value * unit, 4 * scale);
    return `<rect x="${x}" y="${height - barHeight}" width="${columnWidth}" height="${barHeight}" ` +
      `fill="${index === highest ? GOLD : LIGHT_GREY}" rx="${radius}"/>`;
  });
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${rects.join('')}</svg>`;
}

// Layout of each format (SHARE_FORMATS in src/pageMeta.js). The link format puts text and chart side by side, the
// portrait formats one below the other with the address of the site at the bottom. The story keeps the top and bottom
// 250 pixels free, where Instagram shows its own controls. Sizes in pixels; scale enlarges the heading, textScale the
// other texts.
const LAYOUTS = {
  link: { portrait: false, padding: '0 80px', scale: 1, textScale: 1, chart: [360, 300], maxLines: 4 },
  post: { portrait: true, padding: '96px 80px 72px', scale: 1.6, textScale: 1.3, chart: [920, 380], maxLines: 4 },
  story: { portrait: true, padding: '250px 80px 250px', scale: 1.85, textScale: 1.4, chart: [920, 560], maxLines: 5 },
};

const SMALL_HEADING_SIZE = 44;
const MIN_HEADING_SIZE = 30;
const SHRINK_BEFORE_HYPHENATING = 44;
const MIN_TEXT_SCALE = 0.75;

// Fits the heading first by shrinking it with breaks only between words and at hyphens in the text, down to
// hyphenateBelow; if that is not enough, again from the start with hyphenation of long words, down to minSize.
// Large headings get one line less than maxLines. Then the chart and the smaller texts shrink until everything fits. Only text
// that does not fit even then is cut.
function fitText({ maxLines, smallSize, minSize, hyphenateBelow, minScale, portrait }) {
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
  const columnFits = () => (portrait
    ? main.scrollHeight <= main.clientHeight + 1
    : column.scrollHeight <= main.clientHeight - 48);
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
  // In the portrait formats the chart gives up to 40 percent of its height before the texts get smaller.
  const chart = document.querySelector('.chart svg');
  const chartHeight = chart.getBoundingClientRect().height;
  for (let share = 0.95; portrait && !columnFits() && share >= 0.6; share -= 0.05) {
    chart.style.height = `${chartHeight * share}px`;
  }
  for (let scale = 0.95; !columnFits() && scale >= minScale; scale -= 0.05) {
    small.forEach((element, index) => { element.style.fontSize = `${smallSizes[index] * scale}px`; });
  }
  if (!headingFits()) heading.classList.add('squeezed');
  if (!columnFits()) column.classList.add('squeezed');
}

// Starting size of the heading in the link format; fitText makes it smaller where needed.
function headingSize(heading) {
  const longestWord = Math.max(...heading.split(/\s+/).map((word) => word.length));
  const length = heading.length;
  if (longestWord > 22 || length > 48) return 52;
  if (longestWord > 16 || length > 30) return 64;
  if (longestWord > 12 || length > 20) return 76;
  return 88;
}

const SITE_ADDRESS = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

export function cardHtml(card, fonts, formatKey = 'link') {
  const format = SHARE_FORMATS.find((candidate) => candidate.key === formatKey);
  const layout = LAYOUTS[formatKey];
  const px = (size) => `${Math.round(size * layout.textScale)}px`;
  const motif = Array.isArray(card.motif) ? card.motif : MOTIFS[card.motif] ?? MOTIFS.start;
  const details = (card.details ?? []).map((line) => `<div class="detail">${escapeHtml(line)}</div>`).join('');
  const chartLabel = card.chartLabel ? `<div class="chart-label">${escapeHtml(card.chartLabel)}</div>` : '';
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><style>
  ${fonts}
  * { margin: 0; box-sizing: border-box; }
  body { width: ${format.width}px; height: ${format.height}px; background: ${WHITE}; color: ${BLACK};
         font-family: Inter, sans-serif; display: flex; flex-direction: column; overflow: hidden; }
  .flag { display: flex; height: ${px(12)}; flex: none; }
  .flag span { flex: 1; }
  main { flex: 1; display: flex; min-height: 0; padding: ${layout.padding};
         ${layout.portrait ? 'flex-direction: column; gap: 56px;' : 'align-items: center; gap: 64px;'} }
  .text { ${layout.portrait ? '' : 'flex: 1;'} min-width: 0; display: flex; flex-direction: column; gap: ${px(24)}; }
  .site { font-size: ${px(28)}; font-weight: 600; color: ${DARK_GOLD}; letter-spacing: 0.01em; }
  .site span { color: ${GREY}; font-weight: 400; }
  h1 { font-size: ${Math.round(headingSize(card.heading) * layout.scale)}px; font-weight: 800; line-height: 1.05; letter-spacing: -0.02em;
       hyphens: manual; overflow-wrap: normal; }
  h1.squeezed { overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: ${layout.maxLines};
                -webkit-box-orient: vertical; overflow: hidden; }
  p { font-size: ${px(30)}; line-height: 1.3; color: ${GREY}; }
  .details { display: flex; flex-direction: column; gap: ${px(6)}; }
  .detail { font-size: ${px(26)}; line-height: 1.3; color: ${GREY}; }
  .text.squeezed .detail { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .chart { flex: none; display: flex; flex-direction: column; gap: ${px(12)};
           ${layout.portrait ? 'margin-top: auto;' : 'padding-top: 40px;'} }
  .chart svg { border-bottom: ${px(3)} solid #a1a1aa; }
  .chart-label { font-size: ${px(20)}; color: ${GREY}; text-align: right; }
  .address { flex: none; font-size: 28px; font-weight: 600; color: ${GREY}; overflow-wrap: anywhere; }
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
    <div class="chart">${bars(motif, ...layout.chart)}${chartLabel}</div>
    ${layout.portrait ? `<div class="address">${escapeHtml(SITE_ADDRESS)}</div>` : ''}
  </main>
</body></html>`;
}

// images: [[file without extension, card], ...]; every image is written in each format, with its suffix.
export async function renderCards(images, outputDirectory, formats = SHARE_FORMATS) {
  const fonts = fontFaces();
  const jobs = images.flatMap(([name, card]) => formats.map((format) => [name, card, format]));
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  let next = 0;
  async function worker() {
    const page = await context.newPage();
    while (next < jobs.length) {
      const [name, card, format] = jobs[next];
      next += 1;
      const layout = LAYOUTS[format.key];
      const file = path.join(outputDirectory, `${name}${format.suffix}.png`);
      mkdirSync(path.dirname(file), { recursive: true });
      await page.setViewportSize({ width: format.width, height: format.height });
      await page.setContent(cardHtml(card, fonts, format.key));
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(fitText, {
        maxLines: layout.maxLines,
        smallSize: SMALL_HEADING_SIZE * layout.scale,
        minSize: MIN_HEADING_SIZE * layout.scale,
        hyphenateBelow: SHRINK_BEFORE_HYPHENATING * layout.scale,
        minScale: MIN_TEXT_SCALE,
        portrait: layout.portrait,
      });
      // A palette of 64 colours keeps the image at about a quarter of the size without visible loss.
      const screenshot = await page.screenshot();
      await sharp(screenshot).png({ palette: true, colours: 64, compressionLevel: 9, effort: 10 }).toFile(file);
    }
    await page.close();
  }
  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PAGES, jobs.length) }, worker));
  } finally {
    await browser.close();
  }
  return jobs.length;
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
    const written = await renderCards(fixedImages(), path.join(ROOT, 'public', 'og'));
    console.log(`${written} Bilder in public/og geschrieben.`);
  } else {
    const dist = process.argv[distIndex + 1];
    const images = pagesFromData(path.join(dist, 'data')).map((page) => [page.image, page.card]);
    const started = Date.now();
    const written = await renderCards(images, path.join(dist, 'og'));
    console.log(`${written} Bilder für ${images.length} Personen und Wörter in ${Math.round((Date.now() - started) / 1000)} s geschrieben.`);
  }
}
