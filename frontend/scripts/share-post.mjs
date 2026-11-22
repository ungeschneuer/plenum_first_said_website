// Renders the share images of one request from the admin view and posts them to Instagram and LinkedIn. Run by the
// workflow .github/workflows/share.yml; the request comes from the admin view (src/components/pages/Admin.jsx).
//
// Environment:
//   SHARE_REQUEST          JSON {name, card, caption, targets: ["instagram-post", "instagram-story", "linkedin"],
//                          altText}
//   DRY_RUN                "true": only render the images, post nothing
//   OUTPUT_DIR             where the images are written (default share-images)
//   GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID
//                          for the release "teilen", which gives Instagram a public address of each image
//   INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID, INSTAGRAM_API_HOST (default graph.facebook.com),
//   INSTAGRAM_API_VERSION (default v23.0)
//   LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR (urn:li:person:… or urn:li:organization:…),
//   LINKEDIN_VERSION (YYYYMM, default 202510)

import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SHARE_FORMATS } from '../src/pageMeta.js';
import { CAPTION_LIMITS } from '../src/share/content.js';

export const TARGETS = {
  'instagram-post': { format: 'post', label: 'Instagram-Post' },
  'instagram-story': { format: 'story', label: 'Instagram-Story' },
  linkedin: { format: 'link', label: 'LinkedIn' },
};

const RELEASE_TAG = 'teilen';

export function parseRequest(text) {
  const request = JSON.parse(text);
  if (!request.card?.heading) throw new Error('Die Anfrage enthält kein Bild (card.heading fehlt).');
  if (!/^[a-z0-9-]{1,200}$/.test(request.name ?? '')) throw new Error('Ungültiger Name in der Anfrage.');
  const targets = request.targets ?? [];
  const unknown = targets.filter((target) => !TARGETS[target]);
  if (unknown.length) throw new Error(`Unbekannte Ziele: ${unknown.join(', ')}`);
  return { ...request, targets, caption: String(request.caption ?? ''), altText: String(request.altText ?? '') };
}

// LinkedIn reads the commentary as "little text": these characters must be escaped, hashtags become templates.
export function linkedInCommentary(text) {
  return text
    .replace(/[\\|{}@[\]()<>*_~]/g, (character) => `\\${character}`)
    .replace(/#([\p{L}\p{N}_]+)|#/gu, (match, tag) => (tag ? `{hashtag|\\#|${tag}}` : '\\#'));
}

async function checkedJson(response, what) {
  const text = await response.text();
  if (!response.ok) throw new Error(`${what}: HTTP ${response.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

// The release "teilen" holds the images Instagram downloads; release assets have a public address.
export async function uploadToRelease({ file, assetName, token, repository, fetch: request = fetch }) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  const api = `https://api.github.com/repos/${repository}`;
  let response = await request(`${api}/releases/tags/${RELEASE_TAG}`, { headers });
  let release;
  if (response.status === 404) {
    release = await checkedJson(await request(`${api}/releases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tag_name: RELEASE_TAG,
        name: 'Bilder zum Teilen',
        body: 'Bilder, die über die Admin-Ansicht auf Instagram veröffentlicht wurden.',
        prerelease: true,
      }),
    }), 'Release anlegen');
  } else {
    release = await checkedJson(response, 'Release lesen');
  }
  const uploadUrl = release.upload_url.replace(/\{.*\}$/, '');
  response = await request(`${uploadUrl}?name=${encodeURIComponent(assetName)}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/png' },
    body: readFileSync(file),
  });
  return (await checkedJson(response, 'Bild hochladen')).browser_download_url;
}

const sleep = (milliseconds) => new Promise((resolve) => { setTimeout(resolve, milliseconds); });

export async function postToInstagram({ imageUrl, caption, story, config, fetch: request = fetch, wait = sleep }) {
  const base = `https://${config.host}/${config.version}`;
  const parameters = new URLSearchParams({ image_url: imageUrl, access_token: config.token });
  if (story) parameters.set('media_type', 'STORIES');
  else parameters.set('caption', caption.slice(0, CAPTION_LIMITS.instagram));
  const container = await checkedJson(
    await request(`${base}/${config.userId}/media`, { method: 'POST', body: parameters }),
    'Instagram: Beitrag vorbereiten',
  );
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await checkedJson(
      await request(`${base}/${container.id}?fields=status_code&access_token=${encodeURIComponent(config.token)}`),
      'Instagram: Status abfragen',
    );
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error(`Instagram: Das Bild wurde nicht angenommen (${status.status_code}).`);
    }
    await wait(5000);
  }
  const published = await checkedJson(await request(`${base}/${config.userId}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ creation_id: container.id, access_token: config.token }),
  }), 'Instagram: Veröffentlichen');
  return published.id;
}

export async function postToLinkedIn({ file, caption, altText, config, fetch: request = fetch }) {
  const headers = {
    Authorization: `Bearer ${config.token}`,
    'LinkedIn-Version': config.version,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
  const upload = await checkedJson(await request('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers,
    body: JSON.stringify({ initializeUploadRequest: { owner: config.author } }),
  }), 'LinkedIn: Upload vorbereiten');
  const put = await request(upload.value.uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/octet-stream' },
    body: readFileSync(file),
  });
  if (!put.ok) throw new Error(`LinkedIn: Bild hochladen: HTTP ${put.status} ${(await put.text()).slice(0, 500)}`);
  const response = await request('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      author: config.author,
      commentary: linkedInCommentary(caption.slice(0, CAPTION_LIMITS.linkedin)),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: upload.value.image, altText: altText.slice(0, 4086) } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  await checkedJson(response, 'LinkedIn: Beitrag veröffentlichen');
  return response.headers.get('x-restli-id');
}

function requireSettings(environment, names, platform) {
  const missing = names.filter((name) => !environment[name]);
  if (missing.length) {
    throw new Error(`${platform}: Es fehlen die Secrets oder Variablen ${missing.join(', ')}.`);
  }
}

async function main(environment) {
  const request = parseRequest(environment.SHARE_REQUEST ?? '');
  const dryRun = environment.DRY_RUN === 'true';
  const outputDirectory = environment.OUTPUT_DIR || 'share-images';
  const { renderCards } = await import('./og-images.mjs');
  await renderCards([[request.name, request.card]], outputDirectory);
  const fileOf = (formatKey) => {
    const format = SHARE_FORMATS.find((candidate) => candidate.key === formatKey);
    return path.join(outputDirectory, `${request.name}${format.suffix}.png`);
  };
  const results = [];
  if (!dryRun) {
    for (const target of request.targets) {
      const { format, label } = TARGETS[target];
      try {
        if (target.startsWith('instagram')) {
          requireSettings(environment, ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_USER_ID', 'GITHUB_TOKEN'], 'Instagram');
          const imageUrl = await uploadToRelease({
            file: fileOf(format),
            assetName: `${request.name}-${environment.GITHUB_RUN_ID ?? Date.now()}-${format}.png`,
            token: environment.GITHUB_TOKEN,
            repository: environment.GITHUB_REPOSITORY,
          });
          const id = await postToInstagram({
            imageUrl,
            caption: request.caption,
            story: target === 'instagram-story',
            config: {
              host: environment.INSTAGRAM_API_HOST || 'graph.facebook.com',
              version: environment.INSTAGRAM_API_VERSION || 'v23.0',
              token: environment.INSTAGRAM_ACCESS_TOKEN,
              userId: environment.INSTAGRAM_USER_ID,
            },
          });
          results.push(`${label}: veröffentlicht (ID ${id})`);
        } else {
          requireSettings(environment, ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_AUTHOR'], 'LinkedIn');
          const id = await postToLinkedIn({
            file: fileOf(format),
            caption: request.caption,
            altText: request.altText,
            config: {
              token: environment.LINKEDIN_ACCESS_TOKEN,
              author: environment.LINKEDIN_AUTHOR,
              version: environment.LINKEDIN_VERSION || '202510',
            },
          });
          results.push(`${label}: veröffentlicht (${id})`);
        }
      } catch (error) {
        results.push(`${label}: fehlgeschlagen. ${error.message}`);
        process.exitCode = 1;
      }
    }
  }
  const summary = [
    `### ${request.card.heading}`,
    dryRun ? 'Nur Bilder erzeugt, nichts veröffentlicht.' : '',
    ...results.map((line) => `- ${line}`),
    'Die Bilder liegen im Artefakt „bilder“ dieses Laufs.',
  ].filter(Boolean).join('\n');
  console.log(summary);
  if (environment.GITHUB_STEP_SUMMARY) appendFileSync(environment.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.env).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
