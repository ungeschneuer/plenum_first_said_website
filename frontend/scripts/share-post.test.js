import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { linkedInCommentary, parseRequest, postToInstagram, postToLinkedIn, uploadToRelease } from './share-post.mjs';

function response(status, body, headers = {}) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers });
}

// Answers requests in order and records them.
function fakeFetch(answers) {
  const calls = [];
  const request = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method ?? 'GET', body: options.body, headers: options.headers });
    const answer = answers.shift();
    if (!answer) throw new Error(`Unerwartete Anfrage ${url}`);
    return answer;
  };
  return { request, calls };
}

function imageFile() {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'share-')), 'bild.png');
  writeFileSync(file, 'png');
  return file;
}

describe('share-post', () => {
  it('checks the request', () => {
    const request = parseRequest(JSON.stringify({ name: 'wort-a', card: { heading: 'A' }, targets: ['linkedin'] }));
    expect(request.targets).toEqual(['linkedin']);
    expect(() => parseRequest(JSON.stringify({ name: '../x', card: { heading: 'A' } }))).toThrow('Name');
    expect(() => parseRequest(JSON.stringify({ name: 'a', card: { heading: 'A' }, targets: ['x'] }))).toThrow('x');
    expect(() => parseRequest(JSON.stringify({ name: 'a', card: {} }))).toThrow('heading');
  });

  it('escapes LinkedIn commentary and keeps hashtags', () => {
    expect(linkedInCommentary('Sitzung (21/50) mit plenum_first_said #Bundestag #OpenData'))
      .toBe('Sitzung \\(21/50\\) mit plenum\\_first\\_said {hashtag|\\#|Bundestag} {hashtag|\\#|OpenData}');
    expect(linkedInCommentary('Nr. # 5 @x')).toBe('Nr. \\# 5 \\@x');
  });

  it('creates the release once and uploads the image', async () => {
    const { request, calls } = fakeFetch([
      response(404, { message: 'Not Found' }),
      response(201, { upload_url: 'https://uploads.github.com/repos/o/r/releases/1/assets{?name,label}' }),
      response(201, { browser_download_url: 'https://github.com/o/r/releases/download/teilen/a.png' }),
    ]);
    const url = await uploadToRelease({ file: imageFile(), assetName: 'a.png', token: 't', repository: 'o/r', fetch: request });
    expect(url).toBe('https://github.com/o/r/releases/download/teilen/a.png');
    expect(calls[1]).toMatchObject({ url: 'https://api.github.com/repos/o/r/releases', method: 'POST' });
    expect(calls[2].url).toBe('https://uploads.github.com/repos/o/r/releases/1/assets?name=a.png');
  });

  it('posts a story to Instagram after the container is ready', async () => {
    const { request, calls } = fakeFetch([
      response(200, { id: 'c1' }),
      response(200, { status_code: 'IN_PROGRESS' }),
      response(200, { status_code: 'FINISHED' }),
      response(200, { id: 'm1' }),
    ]);
    const id = await postToInstagram({
      imageUrl: 'https://example.org/a.png',
      caption: 'Text',
      story: true,
      config: { host: 'graph.facebook.com', version: 'v23.0', token: 't', userId: '42' },
      fetch: request,
      wait: async () => {},
    });
    expect(id).toBe('m1');
    expect(calls[0].url).toBe('https://graph.facebook.com/v23.0/42/media');
    expect(calls[0].body.get('media_type')).toBe('STORIES');
    expect(calls[0].body.get('caption')).toBeNull();
    expect(calls[3].body.get('creation_id')).toBe('c1');
  });

  it('stops when Instagram rejects the image', async () => {
    const { request } = fakeFetch([response(200, { id: 'c1' }), response(200, { status_code: 'ERROR' })]);
    await expect(postToInstagram({
      imageUrl: 'u', caption: '', story: false, config: { host: 'h', version: 'v', token: 't', userId: '1' }, fetch: request,
    })).rejects.toThrow('ERROR');
  });

  it('uploads the image to LinkedIn and posts it', async () => {
    const { request, calls } = fakeFetch([
      response(200, { value: { uploadUrl: 'https://upload.example/1', image: 'urn:li:image:1' } }),
      new Response('', { status: 201 }),
      response(201, undefined, { 'x-restli-id': 'urn:li:share:9' }),
    ]);
    const id = await postToLinkedIn({
      file: imageFile(),
      caption: 'Hallo #Bundestag',
      altText: 'Bild',
      config: { token: 't', author: 'urn:li:person:abc', version: '202510' },
      fetch: request,
    });
    expect(id).toBe('urn:li:share:9');
    expect(calls[0].headers['LinkedIn-Version']).toBe('202510');
    expect(calls[1]).toMatchObject({ url: 'https://upload.example/1', method: 'PUT' });
    const post = JSON.parse(calls[2].body);
    expect(post).toMatchObject({ author: 'urn:li:person:abc', content: { media: { id: 'urn:li:image:1', altText: 'Bild' } } });
    expect(post.commentary).toBe('Hallo {hashtag|\\#|Bundestag}');
  });
});
