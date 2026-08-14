import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPluginForTest } from './helpers/load-plugin.js';

const chapterText = 'Texte public du chapitre. '.repeat(12);
const fixtures = {
  '/wp-json/wp/v2/pages?slug=jg-ln&_fields=content': [
    {
      content: {
        rendered:
          '<a href="/love-unseen/"><img src="https://j-garden.fr/love-unseen.webp" alt="Love Unseen"></a><a href="http://[">Lien invalide</a><a href="https://example.com/foreign/">Lien externe</a>',
      },
    },
  ],
  '/wp-json/wp/v2/pages?slug=jg-web-novel&_fields=content': [
    { content: { rendered: '<a href="/orv/">Omniscient Reader</a>' } },
  ],
  '/wp-json/wp/v2/pages?slug=love-unseen&_fields=slug,link,title,content': [
    {
      slug: 'love-unseen',
      link: 'https://j-garden.fr/love-unseen/',
      title: { rendered: 'Love Unseen' },
      content: {
        rendered:
          '<img src="/cover.webp"><p>Synopsis du roman.</p><p>Statut : Terminé</p><a href="/love-unseen-t2-chapitre-1/">Tome 2 - Chapitre 1</a><a href="/love-unseen-t1-postface/">Tome 1 - Postface</a><a href="/love-unseen-t1-epilogue/">Tome 1 - Épilogue</a><a href="/love-unseen-t1-bonus/">Tome 1 - Bonus</a><a href="/love-unseen-t1-interlude/">Tome 1 - Interlude</a><a href="https://j-garden.fr/love-unseen-t1-chapitre-2/">Tome 1 - Chapitre 2</a><a href="/love-unseen-t1-chapitre-1/">Tome 1 - Chapitre 1</a><a href="/love-unseen-t1-prologue/">Tome 1 - Prologue</a><a href="/love-unseen-t1-preface/">Tome 1 - Préface</a><a href="/love-unseen-t1-chapitre-2/">Tome 1 - Chapitre 2</a>',
      },
    },
  ],
  '/wp-json/wp/v2/posts?slug=love-unseen-t1-chapitre-1&_fields=content,title,link':
    [
      {
        title: { rendered: 'Chapitre 1' },
        link: 'https://j-garden.fr/love-unseen-t1-chapitre-1/',
        content: {
          rendered: `<div class="elementor-widget-theme-post-content"><p>${chapterText}</p></div>`,
        },
      },
    ],
  '/wp-json/wp/v2/pages?slug=violet-evergarden&_fields=slug,link,title,content':
    [
      {
        slug: 'violet-evergarden',
        link: 'https://j-garden.fr/violet-evergarden/',
        title: { rendered: 'Violet Evergarden' },
        content: {
          rendered:
            '<img src="/ve.webp"><p>Statut : Terminé</p><a href="/violet-ever-v1-preface/">Préface</a><a href="/violet-ever-v1-chapitre-1/">Chapitre 1</a><a href="/violet-ever-v1-postface/">Postface</a><a href="/violet-ever-v2-preface/">Préface</a><a href="/violet-ever-v2-prologue/">Prologue</a><a href="/violet-ever-v2-chapitre-7/">Chapitre 7</a><a href="/ve-gaiden-chapitre-1/">Chapitre 1</a><a href="/ve-gaiden-postface/">Postface</a><a href="/ve-ever-after-prologue/">Prologue</a><a href="/ve-ever-after-chapitre-1/">Chapitre 1</a><a href="/ve-ever-after-postface/">Postface</a>',
        },
      },
    ],
};

function fixtureFetch(url) {
  const key = new URL(url).pathname + new URL(url).search;
  const body = fixtures[key];
  return Promise.resolve(
    new Response(JSON.stringify(body ?? []), {
      status: body ? 200 : 404,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

test('J-Garden lists, searches, and parses its public WordPress catalogue', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/jgarden.ts',
    fixtureFetch,
  );
  t.after(restore);

  const popular = await plugin.popularNovels(1);
  assert.equal(plugin.version, '1.0.3');
  assert.deepEqual(
    popular.map(novel => novel.path),
    ['love-unseen', 'orv'],
  );
  assert.equal(popular[0].name, 'Love Unseen');
  assert.equal(popular[0].cover, 'https://j-garden.fr/love-unseen.webp');

  const novel = await plugin.parseNovel('love-unseen');
  assert.equal(novel.name, 'Love Unseen');
  assert.equal(novel.cover, 'https://j-garden.fr/cover.webp');
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.path),
    [
      'love-unseen-t1-preface',
      'love-unseen-t1-prologue',
      'love-unseen-t1-chapitre-1',
      'love-unseen-t1-chapitre-2',
      'love-unseen-t1-interlude',
      'love-unseen-t1-bonus',
      'love-unseen-t1-epilogue',
      'love-unseen-t1-postface',
      'love-unseen-t2-chapitre-1',
    ],
  );

  const chapter = await plugin.parseChapter('love-unseen-t1-chapitre-1');
  assert.match(chapter, /Texte public/);

  const search = await plugin.searchNovels('love unseen', 1);
  assert.equal(search.length, 1);
  assert.equal(search[0].path, 'love-unseen');
});

test('J-Garden assigns monotone chapter numbers after special-order sorting', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/jgarden.ts',
    fixtureFetch,
  );
  t.after(restore);

  const novel = await plugin.parseNovel('love-unseen');
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.chapterNumber),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
});

test('J-Garden keeps site order when volumes are only partially tagged', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/jgarden.ts',
    fixtureFetch,
  );
  t.after(restore);

  const novel = await plugin.parseNovel('violet-evergarden');
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.path),
    [
      'violet-ever-v1-preface',
      'violet-ever-v1-chapitre-1',
      'violet-ever-v1-postface',
      'violet-ever-v2-preface',
      'violet-ever-v2-prologue',
      'violet-ever-v2-chapitre-7',
      've-gaiden-chapitre-1',
      've-gaiden-postface',
      've-ever-after-prologue',
      've-ever-after-chapitre-1',
      've-ever-after-postface',
    ],
  );
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.chapterNumber),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  );
});

test('J-Garden recognizes completed status labels', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/jgarden.ts',
    fixtureFetch,
  );
  t.after(restore);

  const novel = await plugin.parseNovel('love-unseen');
  assert.equal(novel.status, 'Completed');
});

test('J-Garden recognizes an isolated accented completed status', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/jgarden.ts',
    url => {
      const key = new URL(url).pathname + new URL(url).search;
      if (
        key ===
        '/wp-json/wp/v2/pages?slug=love-unseen&_fields=slug,link,title,content'
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                slug: 'love-unseen',
                link: 'https://j-garden.fr/love-unseen/',
                title: { rendered: 'Love Unseen' },
                content: { rendered: '<p>Terminé</p>' },
              },
            ]),
            { headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      return fixtureFetch(url);
    },
  );
  t.after(restore);

  assert.equal((await plugin.parseNovel('love-unseen')).status, 'Completed');
});

test('J-Garden retains an available catalogue section and reports a total outage', async t => {
  const oneSectionFetch = url => {
    if (new URL(url).searchParams.get('slug') === 'jg-ln')
      return Promise.reject(new Error('light novel section unavailable'));
    return fixtureFetch(url);
  };
  const oneSection = await loadPluginForTest(
    'plugins/french/jgarden.ts',
    oneSectionFetch,
  );
  t.after(oneSection.restore);

  const novels = await oneSection.plugin.popularNovels(1);
  assert.deepEqual(
    novels.map(novel => novel.path),
    ['orv'],
  );

  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/jgarden.ts',
    () => Promise.reject(new Error('site unavailable')),
  );
  t.after(restore);
  await assert.rejects(plugin.popularNovels(1), /catalogue/i);
});

test('J-Garden isolates malformed catalogue sections from valid siblings', async t => {
  for (const malformed of [
    { content: { rendered: '<a href="/invalid/">Invalid</a>' } },
    [{ content: {} }],
  ]) {
    const { plugin, restore } = await loadPluginForTest(
      'plugins/french/jgarden.ts',
      url => {
        if (new URL(url).searchParams.get('slug') === 'jg-ln') {
          return Promise.resolve(
            new Response(JSON.stringify(malformed), {
              headers: { 'content-type': 'application/json' },
            }),
          );
        }
        return fixtureFetch(url);
      },
    );
    t.after(restore);

    assert.deepEqual(
      (await plugin.popularNovels(1)).map(novel => novel.path),
      ['orv'],
    );
  }
});

test('J-Garden reports catalogue failure when every section is malformed', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/jgarden.ts',
    () =>
      Promise.resolve(
        new Response(JSON.stringify([{ content: { rendered: 42 } }]), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
  );
  t.after(restore);

  await assert.rejects(plugin.popularNovels(1), /catalogue/i);
});

test('J-Garden rejects non-JSON WordPress responses', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/jgarden.ts',
    url => {
      if (new URL(url).searchParams.get('slug') === 'love-unseen')
        return Promise.resolve(
          new Response(
            JSON.stringify(
              fixtures[
                '/wp-json/wp/v2/pages?slug=love-unseen&_fields=slug,link,title,content'
              ],
            ),
            {
              status: 200,
              headers: { 'content-type': 'text/html' },
            },
          ),
        );
      return fixtureFetch(url);
    },
  );
  t.after(restore);

  await assert.rejects(plugin.parseNovel('love-unseen'), /json/i);
});

test('J-Garden rejects foreign chapter paths before fetching them', async t => {
  const requested = [];
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/jgarden.ts',
    url => {
      requested.push(url);
      return fixtureFetch(url);
    },
  );
  t.after(restore);

  await assert.rejects(
    plugin.parseChapter('https://example.com/chapter'),
    /foreign/i,
  );
  assert.deepEqual(requested, []);
});
