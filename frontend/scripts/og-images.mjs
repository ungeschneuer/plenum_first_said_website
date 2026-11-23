// Renders the preview and share images with Playwright, each in the formats of SHARE_FORMATS (src/pageMeta.js):
// 1200 × 630 for link previews and LinkedIn, 1080 × 1350 for Instagram posts, 1080 × 1920 for Instagram stories.
//
//   node scripts/og-images.mjs              images of the fixed pages into public/og/, from src/pageMeta.js;
//                                           they are part of the repository, run this after changing a text
//   node scripts/og-images.mjs --dist dist [--cache dir]
//                                           one image per person and per new word into dist/og/, from dist/data;
//                                           run by the publishing workflow after the build; with --cache only
//                                           new or changed images are rendered
//
// The font Inter comes from @fontsource/inter, so the images look the same on every machine.

import { createHash } from 'node:crypto';
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
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

const FONT_HOST = 'https://fonts.og.invalid';
const FONT_FILES = ['latin', 'latin-ext'].flatMap((subset) =>
  [400, 600, 800].map((weight) => ({ weight, file: `inter-${subset}-${weight}-normal.woff2` })));

// The fonts are served to the pages through a route instead of data addresses, so the browser loads each file once
// per run and not once per image.
function fontFaces() {
  return FONT_FILES.map(({ weight, file }) =>
    `@font-face { font-family: Inter; font-weight: ${weight}; font-style: normal; ` +
    `src: url(${FONT_HOST}/${file}) format('woff2'); }`).join('\n');
}

async function serveFonts(context) {
  const directory = path.join(path.dirname(require.resolve('@fontsource/inter/package.json')), 'files');
  const files = new Map(FONT_FILES.map(({ file }) => [file, readFileSync(path.join(directory, file))]));
  await context.route(`${FONT_HOST}/**`, (route) => {
    const body = files.get(route.request().url().split('/').pop());
    return body
      ? route.fulfill({ status: 200, contentType: 'font/woff2', body, headers: { 'Cache-Control': 'max-age=86400' } })
      : route.fulfill({ status: 404 });
  });
}

// Images change only when their content or the way they are drawn changes. The fingerprint covers both: the card
// and the source of this script and of src/share/card.js.
const RENDER_VERSION = createHash('sha256')
  .update(readFileSync(fileURLToPath(import.meta.url)))
  .update(readFileSync(path.join(ROOT, 'src', 'share', 'card.js')))
  .digest('hex');

function fingerprint(card) {
  return createHash('sha256').update(RENDER_VERSION).update(JSON.stringify(card)).digest('hex').slice(0, 32);
}

function readManifest(cacheDirectory) {
  try {
    return JSON.parse(readFileSync(path.join(cacheDirectory, 'manifest.json'), 'utf8'));
  } catch {
    return {};
  }
}

// Copies the images of the run into the cache, which then holds exactly these images.
function updateCache(cacheDirectory, outputDirectory, images, formats) {
  const manifest = {};
  const keep = new Set(['manifest.json']);
  for (const [name, card] of images) {
    for (const format of formats) {
      const relative = `${name}${format.suffix}.png`;
      const target = path.join(cacheDirectory, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(path.join(outputDirectory, relative), target);
      keep.add(relative);
    }
    manifest[name] = fingerprint(card);
  }
  for (const file of readdirSync(cacheDirectory, { recursive: true })) {
    const full = path.join(cacheDirectory, file);
    if (!keep.has(file.split(path.sep).join('/')) && statSync(full).isFile()) rmSync(full);
  }
  writeFileSync(path.join(cacheDirectory, 'manifest.json'), JSON.stringify(manifest));
}

// Chromium sometimes returns a screenshot that repeats the top of the image from about 1,260 pixels on. The flag
// strip (black, red, gold) is the only full-width row with these three colours, so a second one below it shows the
// fault.
async function repeatsTop(png) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3);
  const near = (pixel, [r, g, b]) => Math.abs(pixel[0] - r) + Math.abs(pixel[1] - g) + Math.abs(pixel[2] - b) < 30;
  const third = Math.floor(info.width / 6);
  for (let y = 40; y < info.height; y += 1) {
    if (near(at(third, y), [0, 0, 0]) && near(at(3 * third, y), [221, 0, 0]) && near(at(5 * third, y), [255, 204, 0])) {
      return true;
    }
  }
  return false;
}

// images: [[file without extension, card], ...]; every image is written in each format, with its suffix. With a
// cache directory, images whose fingerprint is unchanged are copied from there instead of rendered.
export async function renderCards(images, outputDirectory, formats = SHARE_FORMATS, { cacheDirectory } = {}) {
  const fonts = fontFaces();
  const cached = cacheDirectory ? readManifest(cacheDirectory) : {};
  const toRender = [];
  for (const [name, card] of images) {
    const files = formats.map((format) => `${name}${format.suffix}.png`);
    if (cached[name] === fingerprint(card) && files.every((file) => existsSync(path.join(cacheDirectory, file)))) {
      for (const file of files) {
        mkdirSync(path.dirname(path.join(outputDirectory, file)), { recursive: true });
        copyFileSync(path.join(cacheDirectory, file), path.join(outputDirectory, file));
      }
    } else {
      toRender.push([name, card]);
    }
  }
  const jobs = toRender.flatMap(([name, card]) => formats.map((format) => [name, card, format]));
  if (jobs.length) await renderJobs(jobs, outputDirectory, fonts);
  if (cacheDirectory) updateCache(cacheDirectory, outputDirectory, images, formats);
  return { rendered: jobs.length, copied: (images.length - toRender.length) * formats.length };
}

async function renderJobs(jobs, outputDirectory, fonts) {
  const browser = await chromium.launch();
  // Every format gets its own context with a fixed viewport. Resizing a page between images made Chromium return
  // screenshots that repeated the top of the image from some height on.
  const contexts = new Map();
  for (const format of new Set(jobs.map(([, , jobFormat]) => jobFormat))) {
    const context = await browser.newContext({ viewport: { width: format.width, height: format.height }, deviceScaleFactor: 1 });
    await serveFonts(context);
    contexts.set(format, context);
  }
  let next = 0;
  async function worker() {
    const pages = new Map();
    while (next < jobs.length) {
      const [name, card, format] = jobs[next];
      next += 1;
      const file = path.join(outputDirectory, `${name}${format.suffix}.png`);
      mkdirSync(path.dirname(file), { recursive: true });
      if (!pages.has(format)) pages.set(format, await contexts.get(format).newPage());
      const page = pages.get(format);
      await page.setContent(cardHtml(card, { fonts, hyphenate: hyphenateSync, formatKey: format.key }));
      // document.fonts.ready does not wait for fonts the page has not requested yet; loading every face first makes
      // fitText measure with Inter.
      await page.evaluate(() => Promise.all([...document.fonts].map((face) => face.load())));
      await page.evaluate(fitText, fitOptions(format.key));
      await page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }));
      let screenshot = await page.screenshot();
      for (let attempt = 1; attempt < 4 && await repeatsTop(screenshot); attempt += 1) {
        await page.evaluate(() => new Promise((resolve) => { setTimeout(resolve, 100); }));
        screenshot = await page.screenshot();
      }
      if (await repeatsTop(screenshot)) throw new Error(`Bild ${name}${format.suffix}: Aufnahme fehlerhaft`);
      // A palette of 64 colours keeps the image at about a quarter of the size without visible loss.
      await sharp(screenshot).png({ palette: true, colours: 64, compressionLevel: 9, effort: 10 }).toFile(file);
    }
    await Promise.all([...pages.values()].map((page) => page.close()));
  }
  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PAGES, jobs.length) }, worker));
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
    const { rendered } = await renderCards(fixedImages(), path.join(ROOT, 'public', 'og'));
    console.log(`${rendered} Bilder in public/og geschrieben.`);
  } else {
    const dist = process.argv[distIndex + 1];
    const cacheIndex = process.argv.indexOf('--cache');
    const cacheDirectory = cacheIndex === -1 ? undefined : process.argv[cacheIndex + 1];
    const images = pagesFromData(path.join(dist, 'data')).map((page) => [page.image, page.card]);
    const started = Date.now();
    const { rendered, copied } = await renderCards(images, path.join(dist, 'og'), SHARE_FORMATS, { cacheDirectory });
    console.log(`${images.length} Personen und Wörter: ${rendered} Bilder erzeugt, ${copied} aus dem Cache, ` +
      `${Math.round((Date.now() - started) / 1000)} s.`);
  }
}
