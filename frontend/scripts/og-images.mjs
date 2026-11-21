// Renders the preview images in public/og/ (1200 × 630 pixels) from the texts in src/pageMeta.js.
// The images are part of the repository; run this after changing a text or the design:
//   node scripts/og-images.mjs
// Needs Playwright with Chromium and the font Inter on the machine that runs it.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PAGES, SITE_NAME, TEMPLATE_IMAGES } from '../src/pageMeta.js';

// Loaded with require so that a Playwright installed outside the project (NODE_PATH) is found as well.
const { chromium } = createRequire(import.meta.url)('playwright');

const OUTPUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og');

const BLACK = '#0a0a0a';
const GOLD = '#ffcc00';
const RED = '#dd0000';
const GREY = '#a3a3a3';

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

function bars(values) {
  const width = 360;
  const height = 300;
  const paired = Array.isArray(values[0]);
  const columns = values.length;
  const gap = paired ? 14 : 8;
  const columnWidth = (width - gap * (columns - 1)) / columns;
  const unit = height / 16;
  const rects = values.map((value, index) => {
    const x = index * (columnWidth + gap);
    if (paired) {
      const half = (columnWidth - 4) / 2;
      return [
        `<rect x="${x}" y="${height - value[0] * unit}" width="${half}" height="${value[0] * unit}" fill="${GOLD}" rx="3"/>`,
        `<rect x="${x + half + 4}" y="${height - value[1] * unit}" width="${half}" height="${value[1] * unit}" fill="${RED}" rx="3"/>`,
      ].join('');
    }
    const highlighted = index === values.lastIndexOf(Math.max(...values));
    const barHeight = Math.max(value * unit, 4);
    return `<rect x="${x}" y="${height - barHeight}" width="${columnWidth}" height="${barHeight}" ` +
      `fill="${highlighted ? GOLD : '#3f3f46'}" rx="3"/>`;
  });
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rects.join('')}</svg>`;
}

function html({ image, heading, caption }) {
  const motif = MOTIFS[image] ?? MOTIFS.start;
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: ${BLACK}; color: #fafafa; font-family: Inter, sans-serif;
         display: flex; flex-direction: column; overflow: hidden; }
  .flag { display: flex; height: 12px; }
  .flag span { flex: 1; }
  main { flex: 1; display: flex; align-items: center; gap: 64px; padding: 0 80px; }
  .text { flex: 1; display: flex; flex-direction: column; gap: 28px; }
  .site { font-size: 30px; font-weight: 600; color: ${GOLD}; letter-spacing: 0.01em; }
  h1 { font-size: ${heading.length > 24 ? 64 : 80}px; font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; }
  p { font-size: 32px; line-height: 1.3; color: ${GREY}; }
  .chart { flex: none; padding-top: 40px; border-bottom: 3px solid #52525b; }
</style></head><body>
  <div class="flag"><span style="background:#000;border-bottom:1px solid #27272a"></span>
    <span style="background:${RED}"></span><span style="background:${GOLD}"></span></div>
  <main>
    <div class="text">
      <div class="site">${SITE_NAME}</div>
      <h1>${heading}</h1>
      <p>${caption}</p>
    </div>
    <div class="chart">${bars(motif)}</div>
  </main>
</body></html>`;
}

const images = new Map();
for (const page of [...PAGES, ...TEMPLATE_IMAGES]) {
  if (page.heading && !images.has(page.image)) images.set(page.image, page);
}

mkdirSync(OUTPUT, { recursive: true });
const browser = await chromium.launch();
const browserPage = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const [name, page] of images) {
  await browserPage.setContent(html(page));
  await browserPage.evaluate(() => document.fonts.ready);
  await browserPage.screenshot({ path: path.join(OUTPUT, `${name}.png`) });
  console.log(`og/${name}.png`);
}
await browser.close();
