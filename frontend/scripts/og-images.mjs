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
import { PAGES, SHARE_FORMATS, TEMPLATE_IMAGES } from '../src/pageMeta.js';
import { cardHtml, fitOptions, fitText } from '../src/share/card.js';
import { pagesFromData } from './page-html.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');
const { hyphenateSync } = require('hyphen/de');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARALLEL_PAGES = 6;

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
      const file = path.join(outputDirectory, `${name}${format.suffix}.png`);
      mkdirSync(path.dirname(file), { recursive: true });
      await page.setViewportSize({ width: format.width, height: format.height });
      await page.setContent(cardHtml(card, { fonts, hyphenate: hyphenateSync, formatKey: format.key }));
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(fitText, fitOptions(format.key));
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
