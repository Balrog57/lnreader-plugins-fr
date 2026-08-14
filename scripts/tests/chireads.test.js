import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPluginForTest } from './helpers/load-plugin.js';

const myriadPath =
  '/category/translatedtales/la-tribulation-des-myriades-de-races_%e4%b8%87%e6%97%8f%e4%b9%8b%e5%8a%ab/';
const myriadSlug = decodeURIComponent(
  myriadPath.split('/').filter(Boolean).at(-1),
);
const myriadCategoryPath = `/wp-json/wp/v2/categories?slug=${encodeURIComponent(myriadSlug)}&per_page=100&_fields=id,link,parent`;
const myriadPostsPath =
  '/wp-json/wp/v2/posts?categories=123&per_page=100&page=1&orderby=date&order=asc&_fields=slug,title,date';
const fixtures = {
  '/wp-json/wp/v2/categories?parent=2&search=Panlong&per_page=100&page=1':
    JSON.stringify([
      {
        name: "L'Anneau du Dragon Panlong | Coiling Dragon | 盘龙",
        link: 'https://chireads.com/category/translatedtales/panlong-coiling-dragon/',
      },
    ]),
  '/wp-json/wp/v2/categories?parent=811&search=Panlong&per_page=100&page=1':
    '[]',
  '/wp-json/wp/v2/categories?parent=2&search=Across%20the%20Wall&per_page=100&page=1':
    '[]',
  '/wp-json/wp/v2/categories?parent=811&search=Across%20the%20Wall&per_page=100&page=1':
    JSON.stringify([
      {
        name: 'Au-delÃ  du Mur | Across the Wall',
        link: 'https://chireads.com/category/original/au-dela-du-mur/',
      },
    ]),
  [myriadPath]: `
    <h1 class="refresh-detail-title">La Tribulation des Myriades de Races_万族之劫</h1>
    <div class="refresh-detail-cover"><img src="/myriad.jpg"></div>
    <div class="refresh-detail-summary-content">Synopsis public.</div>
    <dl class="refresh-detail-meta"><div><dt>Auteur</dt><dd>Eagle Eats Chicken</dd></div></dl>
    <ul class="refresh-detail-chapter-list">
      <li><a href="https://chireads.com/translatedtales/myriad/chapitre-1/2025/01/13/">Chapitre 1 – Père et Fils</a></li>
      <li><a href="https://chireads.com/legacy/chapitre-1/2025/01/13/">Chapitre 1 – Père et Fils</a></li>
      <li><a href="https://chireads.com/translatedtales/myriad/chapitre-2/2025/01/14/">Chapitre 2 – Les académies</a></li>
      <li><a href="https://chireads.com/original/chapitre-3-original/2025/01/15/">Chapitre 3 – Original</a></li>
      <li><a href="https://chireads.com/uncategorized/chapitre-4-archive/2025/01/16/">Chapitre 4 – Archive</a></li>
    </ul>
  `,
  [myriadCategoryPath]: JSON.stringify([
    { id: 123, link: `https://chireads.com${myriadPath}`, parent: 2 },
  ]),
  [myriadPostsPath]: JSON.stringify([
    {
      date: '2025-01-13T17:00:00',
      slug: 'chapitre-1',
      title: { rendered: 'Chapitre 1 &#8211; Père et Fils' },
    },
    {
      date: '2025-01-14T17:00:00',
      slug: 'chapitre-2',
      title: { rendered: 'Chapitre 2 &#8211; Les académies' },
    },
    {
      date: '2025-01-15T17:00:00',
      slug: 'chapitre-3-original',
      title: { rendered: 'Chapitre 3 &#8211; Original' },
    },
    {
      date: '2025-01-16T17:00:00',
      slug: 'chapitre-4-archive',
      title: { rendered: 'Chapitre 4 &#8211; Archive' },
    },
  ]),
  '/c/chapitre-3-original/': `<main id="content"><div class="sharedaddy">Share this chapter</div><p>${'Chapitre original. '.repeat(20)}</p><script>tracking()</script></main>`,
};

function fixtureFetch(url) {
  const parsed = new URL(url);
  const key = parsed.pathname + parsed.search;
  const body = fixtures[key];
  return Promise.resolve(
    new Response(body ?? 'Not found', {
      status: body ? 200 : 404,
      headers: {
        'content-type': key.startsWith('/wp-json/')
          ? 'application/json'
          : 'text/html',
        ...(key === myriadPostsPath ? { 'x-wp-totalpages': '1' } : {}),
      },
    }),
  );
}

test('Chireads finds Panlong through translated novel categories', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    fixtureFetch,
  );
  t.after(restore);

  const results = await plugin.searchNovels('Panlong', 1);
  assert.deepEqual(
    results.map(({ name, path }) => ({ name, path })),
    [
      {
        name: "L'Anneau du Dragon Panlong | Coiling Dragon | 盘龙",
        path: '/category/translatedtales/panlong-coiling-dragon/',
      },
    ],
  );
  assert.equal(plugin.version, '2.1.0');
});

test('Chireads pages large chapter lists through WordPress', async t => {
  const largePath = '/category/translatedtales/large-series/';
  const posts = Array.from({ length: 205 }, (_, index) => ({
    date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T17:00:00`,
    slug: `chapitre-${index + 1}`,
    title: { rendered: `Chapitre ${index + 1}` },
  }));
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    url => {
      const parsed = new URL(url);
      const key = parsed.pathname + parsed.search;
      let body;
      let totalPages;
      if (key === largePath)
        body = '<h1 class="refresh-detail-title">Large series</h1>';
      else if (parsed.pathname.endsWith('/categories'))
        body = JSON.stringify([
          {
            id: 900,
            link: `https://chireads.com${largePath}`,
            parent: 2,
          },
        ]);
      else if (parsed.pathname.endsWith('/posts')) {
        const page = Number(parsed.searchParams.get('page'));
        body = JSON.stringify(posts.slice((page - 1) * 100, page * 100));
        totalPages = '3';
      }
      return Promise.resolve(
        new Response(body ?? 'Not found', {
          status: body ? 200 : 404,
          headers: totalPages ? { 'x-wp-totalpages': totalPages } : {},
        }),
      );
    },
  );
  t.after(restore);

  const firstPage = await plugin.parseNovel(largePath);
  assert.equal(firstPage.totalPages, 3);
  assert.equal(firstPage.chapters.length, 100);
  assert.equal(firstPage.chapters[0].path, '/c/chapitre-1/');
  const chapters = [
    ...firstPage.chapters,
    ...(await plugin.parsePage(largePath, '2')).chapters,
    ...(await plugin.parsePage(largePath, '3')).chapters,
  ];
  assert.equal(chapters.length, 205);
  assert.equal(new Set(chapters.map(chapter => chapter.path)).size, 205);
  assert.equal(chapters[100].path, '/c/chapitre-101/');
  assert.equal(chapters.at(-1).path, '/c/chapitre-205/');
});

test('Chireads search also finds original novels', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    fixtureFetch,
  );
  t.after(restore);

  const results = await plugin.searchNovels('Across the Wall', 1);
  assert.deepEqual(
    results.map(({ name, path }) => ({ name, path })),
    [
      {
        name: 'Au-delÃ  du Mur | Across the Wall',
        path: '/category/original/au-dela-du-mur/',
      },
    ],
  );
});

test('Chireads parses all visible Myriad of the Races chapters', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    fixtureFetch,
  );
  t.after(restore);

  const novel = await plugin.parseNovel(myriadPath);
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.path),
    [
      '/c/chapitre-1/',
      '/c/chapitre-2/',
      '/c/chapitre-3-original/',
      '/c/chapitre-4-archive/',
    ],
  );
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.chapterNumber),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.releaseTime),
    ['2025-01-13', '2025-01-14', '2025-01-15', '2025-01-16'],
  );
  assert.equal(novel.name, 'La Tribulation des Myriades de Races_万族之劫');
  assert.equal(novel.cover, 'https://chireads.com/myriad.jpg');
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.name),
    ['1 - Père et Fils', '2 - Les académies', '3 - Original', '4 - Archive'],
  );
});

test('Chireads resolves compact chapter paths through the compact endpoint', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    fixtureFetch,
  );
  t.after(restore);

  assert.match(
    await plugin.parseChapter('/c/chapitre-3-original/'),
    /Chapitre original/,
  );
  assert.doesNotMatch(
    await plugin.parseChapter('/c/chapitre-3-original/'),
    /Share this chapter|tracking/,
  );
});

test('Chireads keeps successful category results when the other parent fails', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    url => {
      if (url.includes('parent=2')) return Promise.reject(new Error('offline'));
      return fixtureFetch(url);
    },
  );
  t.after(restore);

  const results = await plugin.searchNovels('Across the Wall', 1);
  assert.deepEqual(
    results.map(novel => novel.path),
    ['/category/original/au-dela-du-mur/'],
  );
});

test('Chireads reports search failure when neither category parent is valid', async t => {
  const failures = [
    {
      name: 'rejected fetches',
      fetch: () => Promise.reject(new Error('offline')),
    },
    {
      name: 'non-OK responses',
      fetch: () =>
        Promise.resolve(new Response('Unavailable', { status: 503 })),
    },
    {
      name: 'invalid JSON',
      fetch: () => Promise.resolve(new Response('{', { status: 200 })),
    },
  ];

  for (const failure of failures) {
    await t.test(failure.name, async t => {
      const { plugin, restore } = await loadPluginForTest(
        'plugins/french/chireads.ts',
        failure.fetch,
      );
      t.after(restore);

      await assert.rejects(plugin.searchNovels('Panlong', 1), /search/i);
    });
  }
});

test('Chireads replaces non-HTTP cover schemes with the default cover', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    url => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/categories'))
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 901,
                link: 'https://chireads.com/category/original/unsafe-cover/',
                parent: 811,
              },
            ]),
          ),
        );
      if (parsed.pathname.endsWith('/posts'))
        return Promise.resolve(
          new Response('[]', { headers: { 'x-wp-totalpages': '1' } }),
        );
      return Promise.resolve(
        new Response(`
          <h1 class="refresh-detail-title">Unsafe cover</h1>
          <div class="refresh-detail-cover"><img src="javascript:alert(1)"></div>
        `),
      );
    },
  );
  t.after(restore);

  assert.equal(
    (await plugin.parseNovel('/category/original/unsafe-cover/')).cover,
    'https://github.com/LNReader/lnreader-plugins/blob/main/icons/src/coverNotAvailable.jpg?raw=true',
  );
});

test('Chireads rejects non-OK catalogue HTML responses', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    () => Promise.resolve(new Response('Unavailable', { status: 503 })),
  );
  t.after(restore);

  await assert.rejects(plugin.parseNovel(myriadPath), /HTTP.*503/i);
});

test('Chireads rejects chapter content that is too short to read', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    url => {
      if (url.endsWith('/c/short/')) {
        return Promise.resolve(
          new Response('<main id="content"><p>Brief.</p></main>'),
        );
      }
      return fixtureFetch(url);
    },
  );
  t.after(restore);

  await assert.rejects(plugin.parseChapter('/c/short/'), /readable/i);
});

test('Chireads keeps original catalogue results when translated catalogue fails', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    url => {
      if (url.includes('/category/translatedtales/page/1')) {
        return Promise.resolve(new Response('Unavailable', { status: 503 }));
      }
      if (url.includes('/category/original/page/1')) {
        return Promise.resolve(
          new Response(`
            <ul class="refresh-card-grid">
              <li class="refresh-card">
                <div class="refresh-card-title"><a href="https://chireads.com/category/original/survivor/">Survivor</a></div>
                <div class="refresh-card-cover"><img src="/survivor.jpg"></div>
              </li>
            </ul>
          `),
        );
      }
      return fixtureFetch(url);
    },
  );
  t.after(restore);

  const novels = await plugin.popularNovels(1, {});
  assert.deepEqual(novels, [
    {
      name: 'Survivor',
      cover: 'https://chireads.com/survivor.jpg',
      path: '/category/original/survivor/',
    },
  ]);
});

test('Chireads signals failure when both all-category catalogues fail', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    () => Promise.resolve(new Response('Unavailable', { status: 503 })),
  );
  t.after(restore);

  await assert.rejects(plugin.popularNovels(1, {}), /catalogue/i);
});

test('Chireads keeps single-tag catalogue failures visible', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    () => Promise.resolve(new Response('Unavailable', { status: 503 })),
  );
  t.after(restore);

  await assert.rejects(
    plugin.popularNovels(1, { filters: { tag: { value: 'action' } } }),
    /HTTP.*503/i,
  );
});
