import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPluginForTest } from './helpers/load-plugin.js';

const prose = `Premier paragraphe. ${'Texte public lisible. '.repeat(12)}`;
const moreProse = `Second paragraphe. ${'Suite du chapitre public. '.repeat(12)}`;
const fixtures = {
  '/catalogue?type=Web+Novel&page=1': `
    <a href="/oeuvre/roman-web"><img src="/roman.webp"><span class="font-mono">12 ch.</span><span class="line-clamp-3 font-display">Roman Web</span><span class="truncate font-mono">Wuxia France</span></a>
    <a href="/oeuvre/dungeon-hunter"><span class="font-mono">35 ch.</span><span class="line-clamp-3 font-display">Dungeon Hunter</span><span class="truncate font-mono">Slimegate</span></a>
    <a href="?type=Web+Novel&page=2">2</a>
  `,
  '/catalogue?type=Web+Novel&page=2': `
    <a href="/oeuvre/second-web"><span class="line-clamp-3 font-display">Second Web</span></a>
  `,
  '/catalogue?type=Light+Novel&page=1': `
    <a href="/oeuvre/dungeon-hunter"><img src="/dungeon.webp"><span class="font-mono">35 ch.</span><span class="line-clamp-3 font-display">Dungeon Hunter</span><span class="truncate font-mono">Slimegate</span></a>
  `,
  '/catalogue?type=Manhwa&page=1': `
    <a href="/oeuvre/the-wolf-and-the-delinquent"><img src="/wolf.webp"><span class="font-mono">À paraître</span><span class="line-clamp-3 font-display">The Wolf and the Delinquent</span><span class="truncate font-mono">Demonic Wolf Twins</span></a>
  `,
  '/catalogue?type=Web+Novel&page=3': '',
  '/catalogue?type=Light+Novel&page=3': '',
  '/catalogue?type=Manhwa&page=3': '',
  '/catalogue?type=Web+Novel&q=Dungeon&page=1': `
    <a href="/oeuvre/dungeon-hunter"><img src="/dungeon.webp"><span class="font-mono">35 ch.</span><span class="line-clamp-3 font-display">Dungeon Hunter</span><span class="truncate font-mono">Slimegate</span></a>
  `,
  '/catalogue?type=Light+Novel&q=Dungeon&page=1': `
    <a href="/oeuvre/dungeon-hunter"><img src="/dungeon.webp"><span class="font-mono">35 ch.</span><span class="line-clamp-3 font-display">Dungeon Hunter</span><span class="truncate font-mono">Slimegate</span></a>
  `,
  '/catalogue?type=Manhwa&q=Dungeon&page=1': '',
  '/oeuvre/dungeon-hunter': `
    <h1>Dungeon Hunter</h1>
    <img alt="Couverture de Dungeon Hunter" src="/cover.webp">
    <div>Light Novel · En cours</div>
    <h2>Synopsis</h2><p>Synopsis public.</p>
    <div>Auteur : Auteur public</div><div>Traducteur : Traducteur public</div>
    <div>Genres : Action, Fantaisie</div>
    <a href="/oeuvre/dungeon-hunter/chapitre/2">2 Chapitre 2</a>
    <a href="/oeuvre/dungeon-hunter/chapitre/1">1 Chapitre 1</a>
    <a href="?onglet=chapitres&tri=desc&page=2">2</a>
  `,
  '/oeuvre/dungeon-hunter?onglet=chapitres&tri=desc&page=2': `
    <a href="/oeuvre/dungeon-hunter/chapitre/3">3 Chapitre 3</a>
    <a href="/oeuvre/dungeon-hunter/chapitre/2">2 Chapitre 2</a>
  `,
  '/oeuvre/dungeon-hunter/chapitre/1': `
    <main>
      <div><p class="text-xs text-warm-gray truncate">Dungeon Hunter</p><p class="text-sm font-medium text-warm-white truncate">Chapitre 1 — Le départ</p></div>
      <h1>Chapitre 1 — Le départ</h1>
      <p class="text-xs text-warm-gray">Publié le 1 janvier</p>
      <p class="narration">${prose}</p><p class="dialogue">${moreProse}</p>
      <p>Traduit par L'équipe publique</p>
      <h2>Commentaires</h2><form><textarea>Publier</textarea></form>
    </main>
  `,
  '/oeuvre/the-wolf-and-the-delinquent': `
    <h1>The Wolf and the Delinquent</h1>
    <div>Manhwa · À paraître</div>
  `,
};

const requests = [];
function fixtureFetch(url) {
  const parsed = new URL(url);
  const key = parsed.pathname + parsed.search;
  requests.push(key);
  const body = fixtures[key];
  const found = Object.hasOwn(fixtures, key);
  return Promise.resolve(
    new Response(body ?? 'Not found', {
      status: found ? 200 : 404,
      headers: { 'content-type': 'text/html' },
    }),
  );
}

test('Trad-Index lists and searches every tracked work type', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/tradindex.ts',
    fixtureFetch,
  );
  t.after(restore);

  assert.equal(plugin.version, '1.0.6');

  const popular = await plugin.popularNovels(1, {});
  assert.deepEqual(
    popular.map(novel => novel.name),
    ['Roman Web', 'Dungeon Hunter', 'The Wolf and the Delinquent'],
  );
  assert.equal(requests.includes('/catalogue?type=Web+Novel&page=2'), false);
  assert.deepEqual(
    (await plugin.popularNovels(2, {})).map(novel => novel.name),
    ['Second Web'],
  );
  assert.equal(requests.includes('/catalogue?type=Manhwa&page=1'), true);
  assert.deepEqual(await plugin.popularNovels(3, {}), []);
  assert.equal((await plugin.popularNovels(0, {})).length, popular.length);

  const search = await plugin.searchNovels('Dungeon', 1);
  assert.deepEqual(
    search.map(novel => novel.path),
    ['dungeon-hunter'],
  );
  assert.equal(
    requests.includes('/catalogue?type=Manhwa&q=Dungeon&page=1'),
    true,
  );
});

test('Trad-Index keeps a forthcoming Manhwa with no chapters', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/tradindex.ts',
    fixtureFetch,
  );
  t.after(restore);

  const novel = await plugin.parseNovel('the-wolf-and-the-delinquent');
  assert.equal(novel.name, 'The Wolf and the Delinquent');
  assert.deepEqual(novel.chapters, []);
});

test('Trad-Index rejects a successful first page with no work cards', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/tradindex.ts',
    () => Promise.resolve(new Response('<title>Just a moment...</title>')),
  );
  t.after(restore);

  await assert.rejects(plugin.popularNovels(1, {}), /no work cards/i);
});

test('Trad-Index loads paginated chapters and strips comments from prose', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/tradindex.ts',
    fixtureFetch,
  );
  t.after(restore);

  const novel = await plugin.parseNovel('dungeon-hunter');
  assert.equal(novel.name, 'Dungeon Hunter');
  assert.equal(novel.summary, 'Synopsis public.');
  assert.equal(novel.author, 'Auteur public');
  assert.equal(novel.artist, 'Traducteur public');
  assert.equal(novel.genres, 'Action, Fantaisie');
  assert.equal(novel.status, 'Ongoing');
  for (const path of [
    '/oeuvre/dungeon-hunter',
    'https://trad-index.com/oeuvre/dungeon-hunter',
  ]) {
    assert.equal((await plugin.parseNovel(path)).path, 'dungeon-hunter');
  }
  await assert.rejects(
    plugin.parseNovel('https://example.com/oeuvre/dungeon-hunter'),
    /foreign origin/,
  );
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.chapterNumber),
    [1, 2, 3],
  );

  const chapter = await plugin.parseChapter('dungeon-hunter/1');
  assert.match(chapter, /Premier paragraphe/);
  assert.doesNotMatch(
    chapter,
    /Dungeon Hunter|Chapitre 1 — Le départ|Publié le/,
  );
  assert.doesNotMatch(chapter, /Commentaires|Publier/);
  assert.equal(
    plugin.resolveUrl('dungeon-hunter', true),
    'https://trad-index.com/oeuvre/dungeon-hunter',
  );
  assert.equal(
    plugin.resolveUrl('dungeon-hunter/1'),
    'https://trad-index.com/oeuvre/dungeon-hunter/chapitre/1',
  );
  assert.equal(
    plugin.resolveUrl('/oeuvre/dungeon-hunter', true),
    'https://trad-index.com/oeuvre/dungeon-hunter',
  );
  assert.equal(
    plugin.resolveUrl(
      'https://trad-index.com/oeuvre/dungeon-hunter/chapitre/1',
    ),
    'https://trad-index.com/oeuvre/dungeon-hunter/chapitre/1',
  );
  assert.throws(
    () => plugin.resolveUrl('https://example.com/oeuvre/dungeon-hunter', true),
    /foreign origin/,
  );
});

test('Trad-Index keeps search results when one catalogue is unavailable', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/tradindex.ts',
    url =>
      url.includes('type=Light+Novel&q=')
        ? Promise.reject(new Error('Temporary catalogue failure'))
        : fixtureFetch(url),
  );
  t.after(restore);

  assert.deepEqual(
    (await plugin.searchNovels('Dungeon', 1)).map(novel => novel.path),
    ['dungeon-hunter'],
  );
});

test('Trad-Index rejects search when every catalogue is unavailable', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/tradindex.ts',
    () => Promise.reject(new Error('Temporary catalogue failure')),
  );
  t.after(restore);

  await assert.rejects(plugin.searchNovels('Dungeon', 1), /catalogue/i);
});

test('Trad-Index retries an unavailable chapter page before returning all chapters', async t => {
  let unavailableResponses = 1;
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/tradindex.ts',
    url => {
      const parsed = new URL(url);
      const key = parsed.pathname + parsed.search;
      if (
        key === '/oeuvre/dungeon-hunter?onglet=chapitres&tri=desc&page=2' &&
        unavailableResponses-- > 0
      )
        return Promise.resolve(
          new Response('Unavailable', {
            status: 503,
            headers: { 'retry-after': '0' },
          }),
        );
      return fixtureFetch(url);
    },
  );
  t.after(restore);

  assert.deepEqual(
    (await plugin.parseNovel('dungeon-hunter')).chapters.map(
      chapter => chapter.chapterNumber,
    ),
    [1, 2, 3],
  );
});

test('Trad-Index retries an unavailable initial chapter-list page', async t => {
  let unavailableResponses = 1;
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/tradindex.ts',
    url => {
      const parsed = new URL(url);
      const key = parsed.pathname + parsed.search;
      if (key === '/oeuvre/dungeon-hunter' && unavailableResponses-- > 0)
        return Promise.resolve(
          new Response('Unavailable', {
            status: 503,
            headers: { 'retry-after': '0' },
          }),
        );
      return fixtureFetch(url);
    },
  );
  t.after(restore);

  assert.deepEqual(
    (await plugin.parseNovel('dungeon-hunter')).chapters.map(
      chapter => chapter.chapterNumber,
    ),
    [1, 2, 3],
  );
});

test('Trad-Index honors numeric and HTTP-date Retry-After values', async t => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalNow = Date.now;
  const now = Date.parse('2030-01-01T00:00:00Z');
  const delays = [];
  globalThis.setTimeout = (resolve, delay) => {
    delays.push(delay);
    resolve();
    return 0;
  };
  Date.now = () => now;
  t.after(() => {
    globalThis.setTimeout = originalSetTimeout;
    Date.now = originalNow;
  });

  for (const { retryAfter, expectedDelay } of [
    { retryAfter: '2', expectedDelay: 2000 },
    {
      retryAfter: new Date(now + 3000).toUTCString(),
      expectedDelay: 3000,
    },
  ]) {
    let initialAttempts = 0;
    const { plugin, restore } = await loadPluginForTest(
      'plugins/french/tradindex.ts',
      url => {
        const key = new URL(url).pathname + new URL(url).search;
        if (key === '/oeuvre/dungeon-hunter' && initialAttempts++ === 0) {
          return Promise.resolve(
            new Response('Unavailable', {
              status: 503,
              headers: { 'retry-after': retryAfter },
            }),
          );
        }
        return fixtureFetch(url);
      },
    );
    try {
      delays.length = 0;
      assert.equal(
        (await plugin.parseNovel('dungeon-hunter')).name,
        'Dungeon Hunter',
      );
      assert.deepEqual(delays, [expectedDelay]);
    } finally {
      await restore();
    }
  }
});

test('Trad-Index exhausts bounded same-URL retries without a partial novel', async t => {
  const originalSetTimeout = globalThis.setTimeout;
  const delays = [];
  globalThis.setTimeout = (resolve, delay) => {
    delays.push(delay);
    resolve();
    return 0;
  };
  t.after(() => {
    globalThis.setTimeout = originalSetTimeout;
  });

  const attemptedUrls = [];
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/tradindex.ts',
    url => {
      attemptedUrls.push(url);
      return Promise.resolve(new Response('Unavailable', { status: 503 }));
    },
  );
  t.after(restore);

  await assert.rejects(plugin.parseNovel('dungeon-hunter'), /failed to load/i);
  assert.equal(attemptedUrls.length, 4);
  assert.deepEqual(
    new Set(attemptedUrls),
    new Set(['https://trad-index.com/oeuvre/dungeon-hunter']),
  );
  assert.deepEqual(delays, [100, 200, 300]);
});
