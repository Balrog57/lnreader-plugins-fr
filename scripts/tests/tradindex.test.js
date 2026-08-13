import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPluginForTest } from './helpers/load-plugin.js';

const prose = `Premier paragraphe. ${'Texte public lisible. '.repeat(12)}`;
const moreProse = `Second paragraphe. ${'Suite du chapitre public. '.repeat(12)}`;
const fixtures = {
  '/catalogue?type=Web+Novel&page=1': `
    <a href="/oeuvre/roman-web"><img src="/roman.webp">Roman Web</a>
    <a href="/oeuvre/dungeon-hunter">Dungeon Hunter</a>
  `,
  '/catalogue?type=Light+Novel&page=1': `
    <a href="/oeuvre/dungeon-hunter"><img src="/dungeon.webp">Dungeon Hunter</a>
  `,
  '/catalogue?type=Web+Novel&q=Dungeon&page=1': `
    <a href="/oeuvre/dungeon-hunter"><img src="/dungeon.webp">Dungeon Hunter</a>
  `,
  '/catalogue?type=Light+Novel&q=Dungeon&page=1': `
    <a href="/oeuvre/dungeon-hunter"><img src="/dungeon.webp">Dungeon Hunter</a>
  `,
  '/oeuvre/dungeon-hunter': `
    <h1>Dungeon Hunter</h1>
    <img alt="Couverture de Dungeon Hunter" src="/cover.webp">
    <div>Light Novel Â· En cours</div>
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
      <h1>Chapitre 1</h1><div>Publié le 1 janvier</div>
      <p>${prose}</p><p>${moreProse}</p>
      <p>Traduit par L'équipe publique</p>
      <h2>Commentaires</h2><form><textarea>Publier</textarea></form>
    </main>
  `,
};

const requests = [];
function fixtureFetch(url) {
  const parsed = new URL(url);
  const key = parsed.pathname + parsed.search;
  requests.push(key);
  const body = fixtures[key];
  return Promise.resolve(
    new Response(body ?? 'Not found', {
      status: body ? 200 : 404,
      headers: { 'content-type': 'text/html' },
    }),
  );
}

test('Trad-Index lists only prose sources and searches the two novel catalogues', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/tradindex.ts',
    fixtureFetch,
  );
  t.after(restore);

  const popular = await plugin.popularNovels(1, {});
  assert.deepEqual(
    popular.map(novel => novel.name),
    ['Roman Web', 'Dungeon Hunter'],
  );
  assert.equal(
    requests.some(path => /Manhwa|scan/i.test(path)),
    false,
  );

  const search = await plugin.searchNovels('Dungeon', 1);
  assert.deepEqual(
    search.map(novel => novel.path),
    ['dungeon-hunter'],
  );
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
  assert.deepEqual(
    novel.chapters.map(chapter => chapter.chapterNumber),
    [1, 2, 3],
  );

  const chapter = await plugin.parseChapter('dungeon-hunter/1');
  assert.match(chapter, /Premier paragraphe/);
  assert.doesNotMatch(chapter, /Commentaires|Publier/);
  assert.equal(
    plugin.resolveUrl('dungeon-hunter', true),
    'https://trad-index.com/oeuvre/dungeon-hunter',
  );
  assert.equal(
    plugin.resolveUrl('dungeon-hunter/1'),
    'https://trad-index.com/oeuvre/dungeon-hunter/chapitre/1',
  );
});
