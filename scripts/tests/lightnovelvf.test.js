import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPluginForTest } from './helpers/load-plugin.js';

const readableText = 'Texte du chapitre visible et lisible. '.repeat(12);
const requests = [];
let retryChapterPageRequests = 0;
let serverErrorChapterPageRequests = 0;
const fixtures = {
  '/novels-list?page=1': `
    <a href="/novel/supreme-magus"><img src="/covers/supreme-magus.webp"><span>Supreme Magus</span><span>114 chapitres</span><span>4.8</span></a>
    <a href="/novel/lord-of-mysteries"><img src="/covers/lord-of-mysteries.webp"><span>Lord of Mysteries</span><span>1 432 ch.</span><span>4.9</span></a>
  `,
  '/novels-list?page=2&search=Supreme%20Magus': `
    <a href="/novel/supreme-magus"><img src="/covers/supreme-magus.webp"><span>Supreme Magus</span><span>114 chapitres</span><span>4.8</span></a>
  `,
  '/novels-list?page=1&search=100%25%20DROP%20RATE%20%3A%20Why%20is%20My%20Inventory%20Always%20so%20Full%3F': `
    <a href="/novel/100-drop-rate-why-is-my-inventory-always-so-full"><span>100\\% DROP RATE : Why is My Inventory Always so Full?</span><span>20 ch.</span></a>
  `,
  '/novel/supreme-magus': `
    <h1>Supreme Magus</h1>
    <img class="lnv-novel-cover" src="/covers/supreme-magus.webp">
    <div class="lnv-synopsis__body">Un mage survit dans un nouveau monde.</div>
    <p><a itemprop="author">Legion20</a><span>En cours</span></p>
    <p><a itemprop="genre">Action</a><a itemprop="genre">Fantaisie</a></p>
    <div id="lnv-novel" data-novel-slug="supreme-magus"></div>
  `,
  '/novel/retry-novel': `
    <h1>Retry Novel</h1>
    <div id="lnv-novel" data-novel-slug="retry-novel"></div>
  `,
  '/novel/retry-novel/chapitres?p=1&order=asc&q=': {
    chapters: [{ number: '1', slug: '1', name: 'First', created_at: null }],
    current_page: 1,
    last_page: 2,
    total: 2,
  },
  '/novel/retry-novel/chapitres?p=2&order=asc&q=': {
    chapters: [{ number: '2', slug: '2', name: 'Second', created_at: null }],
    current_page: 2,
    last_page: 2,
    total: 2,
  },
  '/novel/server-error-novel': `
    <h1>Server Error Novel</h1>
    <div id="lnv-novel" data-novel-slug="server-error-novel"></div>
  `,
  '/novel/server-error-novel/chapitres?p=1&order=asc&q=': {
    chapters: [{ number: '1', slug: '1', name: 'First', created_at: null }],
    current_page: 1,
    last_page: 2,
    total: 2,
  },
  '/novel/server-error-novel/chapitres?p=2&order=asc&q=': {
    chapters: [{ number: '2', slug: '2', name: 'Second', created_at: null }],
    current_page: 2,
    last_page: 2,
    total: 2,
  },
  '/novel/long-novel': `
    <h1>Long Novel</h1>
    <div id="lnv-novel" data-novel-slug="long-novel"></div>
  `,
  '/novel/supreme-magus/chapitres?p=1&order=asc&q=': {
    chapters: [
      {
        number: '114',
        slug: '114',
        name_fr: 'Leçon',
        name: 'Lesson',
        created_at: '2026-06-16T00:15:40.000000Z',
      },
    ],
    current_page: 1,
    last_page: 2,
    total: 2,
  },
  '/novel/supreme-magus/chapitres?p=2&order=asc&q=': {
    chapters: [
      {
        number: '115',
        slug: '115',
        name: 'Second lesson',
        created_at: '2026-06-17T00:15:40.000000Z',
      },
    ],
    current_page: 2,
    last_page: 2,
    total: 2,
  },
  '/novel/supreme-magus/114': `
    <div class="lnv-reader-content">
      <header>Supreme Magus - Chapitre 114</header>
      <nav>Chapitre précédent</nav>
      <div class="advertising">Publicité</div>
      <p>${readableText}</p>
      <footer>Chapitre suivant</footer>
    </div>
  `,
};

function fixtureFetch(url) {
  const parsed = new URL(url);
  const key = parsed.pathname + parsed.search;
  requests.push(key);
  if (
    key === '/novel/retry-novel/chapitres?p=2&order=asc&q=' &&
    retryChapterPageRequests++ === 0
  ) {
    return Promise.resolve(
      new Response(JSON.stringify({ message: 'Too many requests' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '0' },
      }),
    );
  }
  if (
    key === '/novel/server-error-novel/chapitres?p=2&order=asc&q=' &&
    serverErrorChapterPageRequests++ === 0
  ) {
    return Promise.resolve(
      new Response(JSON.stringify({ message: 'Service unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json', 'retry-after': '0' },
      }),
    );
  }
  const longPage = key.match(
    /^\/novel\/long-novel\/chapitres\?p=(\d+)&order=asc&q=$/,
  );
  if (longPage) {
    const pageNo = Number(longPage[1]);
    return Promise.resolve(
      new Response(
        JSON.stringify({
          chapters: [],
          current_page: pageNo,
          last_page: 501,
          total: 0,
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
  }
  const body = fixtures[key];
  return Promise.resolve(
    new Response(
      typeof body === 'string'
        ? body
        : JSON.stringify(body ?? { message: 'Not found' }),
      {
        status: body ? 200 : 404,
        headers: {
          'content-type':
            typeof body === 'string' ? 'text/html' : 'application/json',
        },
      },
    ),
  );
}

function chapterFixtureFetch(slug, chapterResponse) {
  let chapterRequests = 0;
  return {
    fetch(url) {
      const parsed = new URL(url);
      const key = parsed.pathname + parsed.search;
      if (key === `/novel/${slug}`) {
        return Promise.resolve(
          new Response(`<h1>${slug}</h1>`, {
            headers: { 'content-type': 'text/html' },
          }),
        );
      }
      const match = key.match(
        new RegExp(`^/novel/${slug}/chapitres\\?p=(\\d+)&order=asc&q=$`),
      );
      if (match) {
        const response = chapterResponse(Number(match[1]), chapterRequests++);
        return Promise.resolve(
          response instanceof Response
            ? response
            : new Response(JSON.stringify(response), {
                headers: { 'content-type': 'application/json' },
              }),
        );
      }
      return fixtureFetch(url);
    },
    get requests() {
      return chapterRequests;
    },
  };
}

test('LightNovelVF builds catalogue and search routes and returns clean cards', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    fixtureFetch,
  );
  t.after(restore);

  const popular = await plugin.popularNovels(1, {});
  assert.deepEqual(
    popular.map(novel => ({ name: novel.name, path: novel.path })),
    [
      { name: 'Supreme Magus', path: 'supreme-magus' },
      { name: 'Lord of Mysteries', path: 'lord-of-mysteries' },
    ],
  );
  assert.equal(
    popular[0].cover,
    'https://www.lightnovelvf.com/covers/supreme-magus.webp',
  );

  const search = await plugin.searchNovels('Supreme Magus', 2);
  assert.deepEqual(
    search.map(novel => novel.path),
    ['supreme-magus'],
  );
  assert.ok(requests.includes('/novels-list?page=1'));
  assert.ok(requests.includes('/novels-list?page=2&search=Supreme%20Magus'));
});

test('LightNovelVF removes the site escape before searching percent titles', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    fixtureFetch,
  );
  t.after(restore);

  const search = await plugin.searchNovels(
    '100\\% DROP RATE : Why is My Inventory Always so Full?',
    1,
  );
  assert.deepEqual(
    search.map(novel => novel.path),
    ['100-drop-rate-why-is-my-inventory-always-so-full'],
  );
});

test('LightNovelVF parses metadata, paginated JSON chapters, and readable content', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    fixtureFetch,
  );
  t.after(restore);

  assert.equal(plugin.id, 'lightnovelvf');
  assert.equal(plugin.name, 'LightNovelVF');
  assert.equal(plugin.icon, 'src/fr/lightnovelvf/icon.png');
  assert.equal(plugin.site, 'https://www.lightnovelvf.com/');
  assert.equal(plugin.version, '1.0.3');

  const novel = await plugin.parseNovel('supreme-magus');
  assert.equal(novel.name, 'Supreme Magus');
  assert.equal(novel.summary, 'Un mage survit dans un nouveau monde.');
  assert.equal(
    novel.cover,
    'https://www.lightnovelvf.com/covers/supreme-magus.webp',
  );
  assert.equal(novel.author, 'Legion20');
  assert.equal(novel.genres, 'Action, Fantaisie');
  assert.equal(novel.status, 'Ongoing');
  for (const path of [
    '/novel/supreme-magus',
    'https://www.lightnovelvf.com/novel/supreme-magus',
  ]) {
    assert.equal((await plugin.parseNovel(path)).path, 'supreme-magus');
  }
  await assert.rejects(
    plugin.parseNovel('https://example.com/novel/supreme-magus'),
    /foreign origin/,
  );
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.chapterNumber),
    [114],
  );
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.name),
    ['Leçon'],
  );
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.releaseTime),
    ['2026-06-16T00:15:40.000000Z'],
  );
  assert.equal(novel.totalPages, 2);
  const secondPage = await plugin.parsePage('supreme-magus', '2');
  assert.deepEqual(
    secondPage.chapters.map(chapter => chapter.chapterNumber),
    [115],
  );
  assert.ok(
    requests.includes('/novel/supreme-magus/chapitres?p=1&order=asc&q='),
  );
  assert.ok(
    requests.includes('/novel/supreme-magus/chapitres?p=2&order=asc&q='),
  );

  const chapter = await plugin.parseChapter('supreme-magus/114');
  assert.match(chapter, /Texte du chapitre visible/);
  assert.doesNotMatch(
    chapter,
    /Supreme Magus|Chapitre précédent|Publicité|Chapitre suivant/,
  );
  assert.equal(
    plugin.resolveUrl('supreme-magus', true),
    'https://www.lightnovelvf.com/novel/supreme-magus',
  );
  assert.equal(
    plugin.resolveUrl('supreme-magus/114'),
    'https://www.lightnovelvf.com/novel/supreme-magus/114',
  );
  assert.equal(
    plugin.resolveUrl('/novel/supreme-magus', true),
    'https://www.lightnovelvf.com/novel/supreme-magus',
  );
  assert.equal(
    plugin.resolveUrl('https://www.lightnovelvf.com/novel/supreme-magus/114'),
    'https://www.lightnovelvf.com/novel/supreme-magus/114',
  );
  assert.throws(
    () => plugin.resolveUrl('https://example.com/novel/supreme-magus', true),
    /foreign origin/,
  );
});

test('LightNovelVF retries a throttled chapter page', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    fixtureFetch,
  );
  t.after(restore);

  const novel = await plugin.parseNovel('retry-novel');
  assert.deepEqual(
    novel.chapters.map(c => c.chapterNumber),
    [1],
  );
  assert.equal(novel.totalPages, 2);
  assert.deepEqual(
    (await plugin.parsePage('retry-novel', '2')).chapters.map(
      c => c.chapterNumber,
    ),
    [2],
  );
});

test('LightNovelVF retries a transient server-error chapter page', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    fixtureFetch,
  );
  t.after(restore);

  const novel = await plugin.parseNovel('server-error-novel');
  assert.deepEqual(
    novel.chapters.map(c => c.chapterNumber),
    [1],
  );
  assert.deepEqual(
    (await plugin.parsePage('server-error-novel', '2')).chapters.map(
      c => c.chapterNumber,
    ),
    [2],
  );
});

test('LightNovelVF retries a chapter page after a network failure', async t => {
  let networkFailures = 0;
  const base = chapterFixtureFetch('network-retry', pageNo => ({
    chapters: [
      { number: String(pageNo), slug: String(pageNo), name: `Page ${pageNo}` },
    ],
    current_page: pageNo,
    last_page: 2,
    total: 2,
  }));
  const source = {
    fetch(url) {
      if (String(url).includes('p=2') && networkFailures++ === 0)
        return Promise.reject(new TypeError('fetch failed'));
      return base.fetch(url);
    },
    get requests() {
      return base.requests;
    },
  };
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    source.fetch,
  );
  t.after(restore);

  assert.deepEqual(
    (await plugin.parseNovel('network-retry')).chapters.map(
      chapter => chapter.chapterNumber,
    ),
    [1],
  );
  assert.deepEqual(
    (await plugin.parsePage('network-retry', '2')).chapters.map(
      chapter => chapter.chapterNumber,
    ),
    [2],
  );
});

test('LightNovelVF requests every server-declared chapter page', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    fixtureFetch,
  );
  t.after(restore);

  const novel = await plugin.parseNovel('long-novel');
  assert.equal(novel.totalPages, 501);
  assert.ok(
    !requests.includes('/novel/long-novel/chapitres?p=501&order=asc&q='),
  );
  await plugin.parsePage('long-novel', '501');
  assert.ok(
    requests.includes('/novel/long-novel/chapitres?p=501&order=asc&q='),
  );
});

test('LightNovelVF paginates chapters on demand in reading order', async t => {
  const source = chapterFixtureFetch('batched', pageNo => ({
    chapters: [
      { number: String(pageNo), slug: String(pageNo), name: `Page ${pageNo}` },
    ],
    current_page: pageNo,
    last_page: 12,
    total: 12,
  }));
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    source.fetch,
  );
  t.after(restore);

  const novel = await plugin.parseNovel('batched');
  assert.equal(novel.totalPages, 12);
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.chapterNumber),
    [1],
  );
  const lastPage = await plugin.parsePage('batched', '12');
  assert.deepEqual(
    lastPage.chapters.map(chapter => chapter.chapterNumber),
    [12],
  );
  await assert.rejects(plugin.parsePage('batched', '0'), /Invalid page/);
  await assert.rejects(plugin.parsePage('batched', '1.5'), /Invalid page/);
});

test('LightNovelVF fails the page when it stays down after retries', async t => {
  const source = chapterFixtureFetch('broken-batch', pageNo =>
    pageNo === 3
      ? new Response('Unavailable', {
          status: 503,
          headers: { 'retry-after': '0' },
        })
      : {
          chapters: [
            {
              number: String(pageNo),
              slug: String(pageNo),
              name: `Page ${pageNo}`,
            },
          ],
          current_page: pageNo,
          last_page: 5,
          total: 5,
        },
  );
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    source.fetch,
  );
  t.after(restore);

  await assert.rejects(plugin.parsePage('broken-batch', '3'), /Failed to load/);
});

test('LightNovelVF rejects a chapter response for the wrong requested page', async t => {
  const source = chapterFixtureFetch('wrong-page', pageNo => ({
    chapters: [
      { number: String(pageNo), slug: String(pageNo), name: `Page ${pageNo}` },
    ],
    current_page: 2,
    last_page: 2,
    total: 2,
  }));
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    source.fetch,
  );
  t.after(restore);

  await assert.rejects(
    plugin.parseNovel('wrong-page'),
    /invalid chapter page/i,
  );
});

test('LightNovelVF rejects non-integer pagination metadata', async t => {
  const source = chapterFixtureFetch('invalid-pagination', () => ({
    chapters: [],
    current_page: 1,
    last_page: 1.5,
    total: 0,
  }));
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    source.fetch,
  );
  t.after(restore);

  await assert.rejects(
    plugin.parseNovel('invalid-pagination'),
    /invalid chapter page/i,
  );
});

test('LightNovelVF rejects a malformed chapter entry', async t => {
  const source = chapterFixtureFetch('malformed-entry', () => ({
    chapters: [null],
    current_page: 1,
    last_page: 1,
    total: 1,
  }));
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    source.fetch,
  );
  t.after(restore);

  await assert.rejects(
    plugin.parseNovel('malformed-entry'),
    /invalid chapter entry/i,
  );
});

test('LightNovelVF accepts a past HTTP-date Retry-After without sleeping', async t => {
  const source = chapterFixtureFetch('date-retry', (_pageNo, request) =>
    request === 0
      ? new Response('Unavailable', {
          status: 503,
          headers: { 'retry-after': 'Wed, 21 Oct 2015 07:28:00 GMT' },
        })
      : {
          chapters: [{ number: '1', slug: '1', name: 'First' }],
          current_page: 1,
          last_page: 1,
          total: 1,
        },
  );
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/lightnovelvf.ts',
    source.fetch,
  );
  t.after(restore);

  assert.deepEqual(
    (await plugin.parseNovel('date-retry')).chapters.map(
      chapter => chapter.chapterNumber,
    ),
    [1],
  );
  assert.equal(source.requests, 2);
});
