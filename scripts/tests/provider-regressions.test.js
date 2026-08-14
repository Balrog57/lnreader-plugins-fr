import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPluginForTest } from './helpers/load-plugin.js';

function htmlResponse(body) {
  return Promise.resolve(
    new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }),
  );
}

test('Warrior Legend search includes original creations from page two', async t => {
  const fixtureFetch = url => {
    const pathname = new URL(url).pathname;
    if (pathname === '/light-novel')
      return htmlResponse(
        '<div><div><div><article><div class="entry-wrapper"><h2><a href="https://warriorlegendtrad.wordpress.com/light-one/">Light One</a></h2></div></article></div></div></div>',
      );
    if (pathname === '/crea')
      return htmlResponse(
        '<div><div><div><article><div class="entry-wrapper"><h2><a href="https://warriorlegendtrad.wordpress.com/original-one/">Original One</a></h2></div></article></div></div></div>',
      );
    return htmlResponse('');
  };
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/warriorlegendtrad.ts',
    fixtureFetch,
  );
  t.after(restore);

  const results = await plugin.searchNovels('Original One', 1);
  assert.deepEqual(
    results.map(novel => novel.path),
    ['/original-one/'],
  );
});

test('Novhell removes repeated chapter links from a novel page', async t => {
  const chapter =
    '<p><a href="https://novhell.org/chapter-1/">Chapitre 1</a></p>';
  const fixture = `<main><div><article><div><div><section><div><div><div><div><div>${chapter}${chapter}</div></div></div></div></div></section></div></div></article></div></main>`;
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/novhell.ts',
    () => htmlResponse(fixture),
  );
  t.after(restore);

  const novel = await plugin.parseNovel('/sample/');
  assert.equal(novel.chapters.length, 1);
  assert.equal(novel.chapters[0].path, '/chapter-1/');
});

test('Xiaowaz removes repeated chapter links from a novel page', async t => {
  const fixture = `
    <h1 class="card_title">Sample</h1>
    <div class="entry-content"><ul>
      <li><a href="https://xiaowaz.fr/articles/chapter-1/">Chapitre 1</a></li>
      <li><a href="https://xiaowaz.fr/articles/chapter-1/">Chapitre 1 bis</a></li>
    </ul></div>`;
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/xiaowaz.ts',
    () => htmlResponse(fixture),
  );
  t.after(restore);

  const novel = await plugin.parseNovel('/series-en-cours/sample/');
  assert.equal(novel.chapters.length, 1);
  assert.equal(novel.chapters[0].path, '/articles/chapter-1/');
});

test('Xiaowaz does not expose PDF downloads as readable chapters', async t => {
  const fixture = `
    <h1 class="card_title">Sample</h1>
    <div class="entry-content"><p>
      <a href="https://xiaowaz.fr/wp-content/uploads/book.pdf">Tome complet PDF</a>
      <a href="https://xiaowaz.fr/articles/chapter-1/">Chapitre 1</a>
    </p></div>`;
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/xiaowaz.ts',
    () => htmlResponse(fixture),
  );
  t.after(restore);

  const novel = await plugin.parseNovel('/series-en-cours/sample/');
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.path),
    ['/articles/chapter-1/'],
  );
});

test('KissWood preserves image-only illustration chapters', async t => {
  const fixture = `
    <div class="entry-content">
      <p><strong>Illustrations</strong><img src="https://kisswood.eu/image.webp"><a href="/summary/">Sommaire</a></p>
      <div class="sharedaddy">Partager</div>
    </div>`;
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/kisswood.ts',
    () => htmlResponse(fixture),
  );
  t.after(restore);

  const chapter = await plugin.parseChapter('/illustrations/');
  assert.match(chapter, /image\.webp/);
  assert.doesNotMatch(chapter, /sharedaddy/);
});

test('KissWood recovers a moved chapter from WordPress search', async t => {
  const fixtureFetch = url => {
    const parsed = new URL(url);
    if (parsed.pathname === '/kioresse/jashin-average-chapitre-94/')
      return Promise.resolve(new Response('Not found', { status: 404 }));
    if (parsed.pathname === '/wp-json/wp/v2/search')
      return Promise.resolve(
        Response.json([
          {
            title: 'Jashin Average - chapitre 94',
            url: 'https://kisswood.eu/kioresse/jashin-average-chapitre-93/',
          },
        ]),
      );
    if (parsed.pathname === '/kioresse/jashin-average-chapitre-93/')
      return htmlResponse(
        `<div class="entry-content"><p>${'Contenu restaurÃ© du chapitre 94. '.repeat(12)}</p></div>`,
      );
    return Promise.resolve(new Response('Not found', { status: 404 }));
  };
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/kisswood.ts',
    fixtureFetch,
  );
  t.after(restore);

  const chapter = await plugin.parseChapter(
    '/kioresse/jashin-average-chapitre-94/',
  );
  assert.match(chapter, /chapitre 94/);
});

test('WuxiaLnScantrad recovers a moved chapter from WordPress.com search', async t => {
  const fixtureFetch = url => {
    const parsed = new URL(url);
    if (
      parsed.pathname.endsWith(
        '/2020/12/07/kotb-chapitre-78--letoile-de-labsolu-3/',
      )
    )
      return Promise.resolve(new Response('Not found', { status: 404 }));
    if (parsed.hostname === 'public-api.wordpress.com')
      return Promise.resolve(
        Response.json([
          {
            title: "KOTB Chapitre 78 : L'Ã©toile de l'absolu (3)",
            url: 'https://wuxialnscantrad.wordpress.com/2021/01/16/kotb-chapitre-78-letoile-de-labsolu-3/',
          },
        ]),
      );
    if (
      parsed.pathname.endsWith(
        '/2021/01/16/kotb-chapitre-78-letoile-de-labsolu-3/',
      )
    )
      return htmlResponse(
        `<div class="entry-content"><p>${'Contenu restaurÃ© du chapitre 78. '.repeat(12)}</p></div>`,
      );
    return Promise.resolve(new Response('Not found', { status: 404 }));
  };
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/wuxialnscantrad.ts',
    fixtureFetch,
  );
  t.after(restore);

  const chapter = await plugin.parseChapter(
    '/2020/12/07/kotb-chapitre-78--letoile-de-labsolu-3/',
  );
  assert.match(chapter, /chapitre 78/);
});

test('HarkenEliwood exposes detail covers in the catalogue', async t => {
  const fixtureFetch = url => {
    const pathname = new URL(url).pathname;
    if (pathname === '/projets/')
      return htmlResponse(
        '<div id="content"><div class="entry-content"><a href="https://harkeneliwood.wordpress.com/sample/">Sample</a></div></div>',
      );
    return htmlResponse(
      '<div id="content"><div class="entry-content"><p><img src="https://harkeneliwood.wordpress.com/cover.webp"></p></div></div>',
    );
  };
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/harkeneliwood.ts',
    fixtureFetch,
  );
  t.after(restore);

  const novels = await plugin.popularNovels(1);
  assert.equal(
    novels[0].cover,
    'https://harkeneliwood.wordpress.com/cover.webp',
  );
});

test('WuxiaLnScantrad exposes detail covers in the catalogue', async t => {
  const fixtureFetch = url => {
    const pathname = new URL(url).pathname;
    if (pathname === '/')
      return htmlResponse(
        '<div id="menu-item-2210"><ul><li><a href="https://wuxialnscantrad.wordpress.com/sample/">Sample</a></li></ul></div>',
      );
    return htmlResponse(
      '<div class="entry-content"><p><img src="https://wuxialnscantrad.wordpress.com/cover.webp"></p></div>',
    );
  };
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/wuxialnscantrad.ts',
    fixtureFetch,
  );
  t.after(restore);

  const novels = await plugin.popularNovels(1);
  assert.equal(
    novels[0].cover,
    'https://wuxialnscantrad.wordpress.com/cover.webp',
  );
});
