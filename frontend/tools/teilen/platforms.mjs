// Posting to Instagram and LinkedIn, used by the local share tool (tools/teilen/server.mjs). Every function takes the
// fetch to use, so the tests can answer in place of the platforms.

import { readFileSync } from 'node:fs';
import { CAPTION_LIMITS } from '../../src/share/content.js';

const RELEASE_TAG = 'teilen';

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

// Instagram downloads each image from a public address; the release "teilen" of the repository provides one.
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
        body: 'Bilder, die auf Instagram veröffentlicht wurden.',
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

async function waitUntilReady(base, id, config, request, wait) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await checkedJson(
      await request(`${base}/${id}?fields=status_code&access_token=${encodeURIComponent(config.token)}`),
      'Instagram: Status abfragen',
    );
    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error(`Instagram: Das Bild wurde nicht angenommen (${status.status_code}).`);
    }
    await wait(5000);
  }
  throw new Error('Instagram: Das Bild wurde nicht rechtzeitig verarbeitet.');
}

async function createContainer(base, config, fields, request) {
  const body = new URLSearchParams({ ...fields, access_token: config.token });
  return (await checkedJson(await request(`${base}/${config.userId}/media`, { method: 'POST', body }),
    'Instagram: Beitrag vorbereiten')).id;
}

async function publishContainer(base, config, id, request) {
  return (await checkedJson(await request(`${base}/${config.userId}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ creation_id: id, access_token: config.token }),
  }), 'Instagram: Veröffentlichen')).id;
}

// One image as a post, or as a story (stories have no caption); several images as a carousel (2 to 10).
export async function postToInstagram({ imageUrls, caption, story = false, config, fetch: request = fetch, wait = sleep }) {
  const base = `https://${config.host}/${config.version}`;
  const text = caption.slice(0, CAPTION_LIMITS.instagram);
  if (imageUrls.length === 1) {
    const fields = story ? { image_url: imageUrls[0], media_type: 'STORIES' } : { image_url: imageUrls[0], caption: text };
    const id = await createContainer(base, config, fields, request);
    await waitUntilReady(base, id, config, request, wait);
    return publishContainer(base, config, id, request);
  }
  if (story) throw new Error('Instagram: Eine Story zeigt nur ein Bild.');
  if (imageUrls.length > 10) throw new Error('Instagram: Ein Karussell hat höchstens zehn Bilder.');
  const children = [];
  for (const imageUrl of imageUrls) {
    const id = await createContainer(base, config, { image_url: imageUrl, is_carousel_item: 'true' }, request);
    await waitUntilReady(base, id, config, request, wait);
    children.push(id);
  }
  const carousel = await createContainer(base, config, { media_type: 'CAROUSEL', children: children.join(','), caption: text }, request);
  await waitUntilReady(base, carousel, config, request, wait);
  return publishContainer(base, config, carousel, request);
}

async function uploadLinkedInImage(file, config, headers, request) {
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
  return upload.value.image;
}

// One image, or several (2 to 20) as a post with multiple images.
export async function postToLinkedIn({ files, caption, altTexts, config, fetch: request = fetch }) {
  const headers = {
    Authorization: `Bearer ${config.token}`,
    'LinkedIn-Version': config.version,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
  if (files.length > 20) throw new Error('LinkedIn: Ein Beitrag hat höchstens 20 Bilder.');
  const images = [];
  for (const file of files) images.push(await uploadLinkedInImage(file, config, headers, request));
  const alt = (index) => String(altTexts?.[index] ?? '').slice(0, 4086);
  const content = images.length === 1
    ? { media: { id: images[0], altText: alt(0) } }
    : { multiImage: { images: images.map((id, index) => ({ id, altText: alt(index) })) } };
  const response = await request('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      author: config.author,
      commentary: linkedInCommentary(caption.slice(0, CAPTION_LIMITS.linkedin)),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content,
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  await checkedJson(response, 'LinkedIn: Beitrag veröffentlichen');
  return response.headers.get('x-restli-id');
}
