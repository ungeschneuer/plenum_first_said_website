// The server side of the local share tool, as a Vite plugin: renders slides with Playwright (scripts/og-images.mjs)
// into the folder teilen-ausgabe/ and posts them. The access data come from frontend/.env.teilen and never reach the
// browser. Vite serves the tool on localhost only.
//
//   GET  /api/config           which platforms are set up
//   POST /api/render           {name, slides: [card, ...], formats: ["post", ...]} -> {folder, files: [{format, url}]}
//   POST /api/publish          {name, slides, caption, altTexts, targets: ["instagram-post" | "instagram-story" |
//                               "instagram-carousel" | "linkedin" | "linkedin-carousel"]} -> {results: [...]}
//   GET  /ausgabe/<folder>/<file>   a rendered image

import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { SHARE_FORMATS } from '../../src/pageMeta.js';
import { postToInstagram, postToLinkedIn, uploadToRelease } from './platforms.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const OUTPUT = path.join(ROOT, 'teilen-ausgabe');

// Which format each target uses, and whether it takes all slides or only the first.
export const TARGETS = {
  'instagram-post': { format: 'post', label: 'Instagram-Post', all: false },
  'instagram-story': { format: 'story', label: 'Instagram-Story', all: false },
  'instagram-carousel': { format: 'post', label: 'Instagram-Karussell', all: true },
  linkedin: { format: 'link', label: 'LinkedIn', all: false },
  'linkedin-carousel': { format: 'post', label: 'LinkedIn mit mehreren Bildern', all: true },
};

function settings(environment) {
  return {
    instagram: {
      ready: Boolean(environment.INSTAGRAM_ACCESS_TOKEN && environment.INSTAGRAM_USER_ID && environment.GITHUB_TOKEN),
      host: environment.INSTAGRAM_API_HOST || 'graph.facebook.com',
      version: environment.INSTAGRAM_API_VERSION || 'v23.0',
      token: environment.INSTAGRAM_ACCESS_TOKEN,
      userId: environment.INSTAGRAM_USER_ID,
    },
    linkedin: {
      ready: Boolean(environment.LINKEDIN_ACCESS_TOKEN && environment.LINKEDIN_AUTHOR),
      token: environment.LINKEDIN_ACCESS_TOKEN,
      author: environment.LINKEDIN_AUTHOR,
      version: environment.LINKEDIN_VERSION || '202510',
    },
    github: {
      token: environment.GITHUB_TOKEN,
      repository: environment.GITHUB_REPOSITORY || 'ungeschneuer/plenum_first_said_website',
    },
  };
}

export function checkRequest(body) {
  if (!/^[a-z0-9-]{1,200}$/.test(body.name ?? '')) throw new Error('Ungültiger Name.');
  if (!Array.isArray(body.slides) || !body.slides.length || body.slides.some((card) => !card?.heading)) {
    throw new Error('Keine Bilder ausgewählt.');
  }
  for (const target of body.targets ?? []) {
    if (!TARGETS[target]) throw new Error(`Unbekanntes Ziel: ${target}`);
  }
}

function folderName(name) {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  return `${stamp}-${name}`;
}

// Slides are numbered so that they sort in order: name-01, name-02, ...
async function render(name, slides, formatKeys) {
  const { renderCards } = await import('../../scripts/og-images.mjs');
  const folder = folderName(name);
  const directory = path.join(OUTPUT, folder);
  mkdirSync(directory, { recursive: true });
  const formats = SHARE_FORMATS.filter((format) => formatKeys.includes(format.key));
  const images = slides.map((card, index) => [slides.length === 1 ? name : `${name}-${String(index + 1).padStart(2, '0')}`, card]);
  await renderCards(images, directory, formats);
  const files = {};
  for (const format of formats) {
    files[format.key] = images.map(([imageName]) => path.join(directory, `${imageName}${format.suffix}.png`));
  }
  return { folder, files };
}

async function publish(body, environment) {
  const config = settings(environment);
  const targets = body.targets ?? [];
  const missing = targets.filter((target) => !config[target.startsWith('instagram') ? 'instagram' : 'linkedin'].ready);
  if (missing.length) {
    throw new Error(`Zugangsdaten fehlen in frontend/.env.teilen für: ${missing.map((target) => TARGETS[target].label).join(', ')}.`);
  }
  const formatKeys = [...new Set(targets.map((target) => TARGETS[target].format))];
  const { folder, files } = await render(body.name, body.slides, formatKeys);
  const results = [];
  for (const target of targets) {
    const { format, label, all } = TARGETS[target];
    const chosen = all ? files[format] : files[format].slice(0, 1);
    try {
      if (target.startsWith('instagram')) {
        const imageUrls = [];
        for (const file of chosen) {
          imageUrls.push(await uploadToRelease({
            file, assetName: `${folder}-${path.basename(file)}`, token: config.github.token, repository: config.github.repository,
          }));
        }
        const id = await postToInstagram({ imageUrls, caption: body.caption ?? '', story: target === 'instagram-story', config: config.instagram });
        results.push({ target: label, ok: true, text: `veröffentlicht (ID ${id})` });
      } else {
        const id = await postToLinkedIn({ files: chosen, caption: body.caption ?? '', altTexts: body.altTexts, config: config.linkedin });
        results.push({ target: label, ok: true, text: `veröffentlicht (${id})` });
      }
    } catch (error) {
      results.push({ target: label, ok: false, text: error.message });
    }
  }
  return { folder, results };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.on('data', (chunk) => { data += chunk; });
    request.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function send(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function fileUrl(file) {
  return `/ausgabe/${path.relative(OUTPUT, file).split(path.sep).map(encodeURIComponent).join('/')}`;
}

export function shareServer(environment) {
  return {
    name: 'teilen-server',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url, 'http://localhost');
        try {
          if (url.pathname === '/api/config' && request.method === 'GET') {
            const config = settings(environment);
            send(response, 200, { instagram: config.instagram.ready, linkedin: config.linkedin.ready, output: OUTPUT });
          } else if (url.pathname === '/api/render' && request.method === 'POST') {
            const body = await readBody(request);
            checkRequest(body);
            const { folder, files } = await render(body.name, body.slides, body.formats ?? ['post']);
            send(response, 200, {
              folder: path.join(OUTPUT, folder),
              files: Object.entries(files).flatMap(([format, list]) => list.map((file) => ({ format, url: fileUrl(file) }))),
            });
          } else if (url.pathname === '/api/publish' && request.method === 'POST') {
            const body = await readBody(request);
            checkRequest(body);
            send(response, 200, await publish(body, environment));
          } else if (url.pathname.startsWith('/ausgabe/')) {
            const file = path.resolve(OUTPUT, ...url.pathname.slice('/ausgabe/'.length).split('/').map(decodeURIComponent));
            if (!file.startsWith(OUTPUT + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
              send(response, 404, { error: 'Nicht gefunden' });
              return;
            }
            response.setHeader('Content-Type', 'image/png');
            createReadStream(file).pipe(response);
          } else {
            next();
          }
        } catch (error) {
          send(response, 400, { error: error.message });
        }
      });
    },
  };
}
