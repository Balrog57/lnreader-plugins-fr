import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPluginForTest } from './helpers/load-plugin.js';

const chapterText = 'Texte public du chapitre. '.repeat(12);
const fixtures = {
  '/wp-json/wp/v2/pages?slug=jg-ln&_fields=content': [
    { content: { rendered: '<a href="/love-unseen/">Love Unseen</a>' } },
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
          '<img src="https://j-garden.fr/cover.webp"><p>Synopsis du roman.</p><a href="/love-unseen-t2-chapitre-1/">Tome 2 - Chapitre 1</a><a href="https://j-garden.fr/love-unseen-t1-chapitre-2/">Tome 1 - Chapitre 2</a><a href="/love-unseen-t1-chapitre-1/">Tome 1 - Chapitre 1</a><a href="/love-unseen-t1-chapitre-2/">Tome 1 - Chapitre 2</a>',
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
  assert.deepEqual(
    popular.map(novel => novel.path),
    ['love-unseen', 'orv'],
  );

  const novel = await plugin.parseNovel('love-unseen');
  assert.equal(novel.name, 'Love Unseen');
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.path),
    [
      'love-unseen-t1-chapitre-1',
      'love-unseen-t1-chapitre-2',
      'love-unseen-t2-chapitre-1',
    ],
  );

  const chapter = await plugin.parseChapter('love-unseen-t1-chapitre-1');
  assert.match(chapter, /Texte public/);

  const search = await plugin.searchNovels('love unseen', 1);
  assert.equal(search.length, 1);
  assert.equal(search[0].path, 'love-unseen');
});
