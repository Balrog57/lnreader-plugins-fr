import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPluginForTest } from './helpers/load-plugin.js';

const prose = `Premier paragraphe. ${'Texte public lisible. '.repeat(12)}`;
const moreProse = `Second paragraphe. ${'Suite du chapitre public. '.repeat(12)}`;
const fixtures = {
  '/catalogue?type=Web+Novel&page=1': `
    <a href="/oeuvre/roman-web"><img src="/roman.webp"><span class="font-mono">12 ch.</span><span class="line-clamp-3 font-display">Roman Web</span><span class="truncate font-mono">Wuxia France</span></a>
    <a href="/oeuvre/scan-interdit" data-source-type="Manhwa"><img src="/scan.webp"><span class="font-mono">8 ch.</span><span class="line-clamp-3 font-display">Scan interdit</span><span class="truncate font-mono">Scan</span></a>
    <a href="/oeuvre/dungeon-hunter"><span class="font-mono">35 ch.</span><span class="line-clamp-3 font-display">Dungeon Hunter</span><span class="truncate font-mono">Slimegate</span></a>
    <a href="?type=Web+Novel&page=2">2</a>
  `,
  '/catalogue?type=Web+Novel&page=2': `
    <a href="/oeuvre/second-web"><span class="line-clamp-3 font-display">Second Web</span></a>
  `,
  '/catalogue?type=Light+Novel&page=1': `
    <a href="/oeuvre/dungeon-hunter"><img src="/dungeon.webp"><span class="font-mono">35 ch.</span><span class="line-clamp-3 font-display">Dungeon Hunter</span><span class="truncate font-mono">Slimegate</span></a>
  `,
  '/catalogue?type=Web+Novel&q=Dungeon&page=1': `
    <a href="/oeuvre/dungeon-hunter"><img src="/dungeon.webp"><span class="font-mono">35 ch.</span><span class="line-clamp-3 font-display">Dungeon Hunter</span><span class="truncate font-mono">Slimegate</span></a>
  `,
  '/catalogue?type=Light+Novel&q=Dungeon&page=1': `
    <a href="/oeuvre/dungeon-hunter"><img src="/dungeon.webp"><span class="font-mono">35 ch.</span><span class="line-clamp-3 font-display">Dungeon Hunter</span><span class="truncate font-mono">Slimegate</span></a>
  `,
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

  assert.equal(plugin.version, '1.0.3');

  const popular = await plugin.popularNovels(1, {});
  assert.deepEqual(
    popular.map(novel => novel.name),
    ['Roman Web', 'Dungeon Hunter', 'Second Web'],
  );
  assert.equal(
    requests.some(path => /Manhwa|scan/i.test(path)),
    false,
  );
  assert.equal((await plugin.popularNovels(0, {})).length, popular.length);
  assert.equal(
    popular.some(novel => novel.path === 'scan-interdit'),
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
