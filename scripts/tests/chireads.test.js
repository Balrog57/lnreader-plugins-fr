import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPluginForTest } from './helpers/load-plugin.js';

const myriadPath =
  '/category/translatedtales/la-tribulation-des-myriades-de-races_%e4%b8%87%e6%97%8f%e4%b9%8b%e5%8a%ab/';
const fixtures = {
  '/wp-json/wp/v2/categories?parent=2&search=Panlong&per_page=100&page=1':
    JSON.stringify([
      {
        name: "L'Anneau du Dragon Panlong | Coiling Dragon | 盘龙",
        link: 'https://chireads.com/category/translatedtales/panlong-coiling-dragon/',
      },
    ]),
  [myriadPath]: `
    <h1 class="refresh-detail-title">La Tribulation des Myriades de Races_万族之劫</h1>
    <div class="refresh-detail-cover"><img src="https://chireads.com/myriad.jpg"></div>
    <div class="refresh-detail-summary-content">Synopsis public.</div>
    <dl class="refresh-detail-meta"><div><dt>Auteur</dt><dd>Eagle Eats Chicken</dd></div></dl>
    <ul class="refresh-detail-chapter-list">
      <li><a href="https://chireads.com/translatedtales/myriad/chapitre-1/2025/01/13/">Chapitre 1 – Père et Fils</a></li>
      <li><a href="https://chireads.com/translatedtales/myriad/chapitre-2/2025/01/14/">Chapitre 2 – Les académies</a></li>
    </ul>
  `,
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
  assert.equal(plugin.version, '2.0.1');
});

test('Chireads parses all visible Myriad of the Races chapters', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/chireads.ts',
    fixtureFetch,
  );
  t.after(restore);

  const novel = await plugin.parseNovel(myriadPath);
  assert.equal(novel.name, 'La Tribulation des Myriades de Races_万族之劫');
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.name),
    ['Chapitre 1 – Père et Fils', 'Chapitre 2 – Les académies'],
  );
});
