import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPluginForTest } from './helpers/load-plugin.js';

const prose = 'Contenu lisible du chapitre. '.repeat(20);

function htmlResponse(html, status = 200) {
  return Promise.resolve(
    new Response(html, {
      status,
      headers: { 'content-type': 'text/html' },
    }),
  );
}

test('French HTML loading exposes HTTP and bot challenge failures', async t => {
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/kisswood.ts',
    url =>
      htmlResponse(
        String(url).includes('challenge')
          ? '<title>  Just a moment... </title>'
          : 'Forbidden',
        String(url).includes('challenge') ? 200 : 403,
      ),
  );
  t.after(restore);

  await assert.rejects(plugin.getCheerio('https://test.invalid/'), /HTTP 403/);
  await assert.rejects(
    plugin.getCheerio('https://test.invalid/challenge'),
    /Bot challenge/,
  );
});

test('KissWood keeps moved chapters and slices promotional separators', async t => {
  const chapter = `<div class="entry-content"><p>Avant</p><hr><p>${prose}</p><hr><p>Après</p></div>`;
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/kisswood.ts',
    url => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/wp-json/wp/v2/search'))
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                title: 'Série chapitre 7',
                url: 'https://kisswood.eu/chapitre-retrouve/',
              },
            ]),
          ),
        );
      if (parsed.pathname === '/chapitre-retrouve/')
        return htmlResponse(chapter);
      if (parsed.pathname === '/serie-chapitre-7/')
        return htmlResponse('Not found', 404);
      return htmlResponse(chapter);
    },
  );
  t.after(restore);

  assert.equal(plugin.version, '1.0.3');
  const current = await plugin.parseChapter('/chapitre-courant/');
  assert.match(current, /Contenu lisible/);
  assert.doesNotMatch(current, /Avant|Après/);
  const moved = await plugin.parseChapter('/serie-chapitre-7/');
  assert.match(moved, /Contenu lisible/);
});

test('short chapters fail visibly in guarded French providers', async t => {
  const cases = [
    ['plugins/french/kisswood.ts', '<div class="entry-content">Court</div>'],
    [
      'plugins/french/novhell.ts',
      '<main><article><section>Court</section></article></main>',
    ],
    [
      'plugins/french/wuxialnscantrad.ts',
      '<div class="entry-content"><p>Court</p></div>',
    ],
    [
      'plugins/french/noveldeglace.ts',
      '<div class="chapter-content">Court</div>',
    ],
  ];

  for (const [provider, html] of cases) {
    await t.test(provider, async t => {
      const { plugin, restore } = await loadPluginForTest(provider, () =>
        htmlResponse(html),
      );
      t.after(restore);
      await assert.rejects(
        plugin.parseChapter('/court/'),
        /No readable chapter content found/,
      );
    });
  }
});

test('chapter cleanup removes executable and advertising elements', async t => {
  const cases = [
    ['plugins/french/harkeneliwood.ts', 'div.entry-content'],
    ['plugins/french/warriorlegendtrad.ts', '.entry-content'],
    ['plugins/french/rezerowebnovelfr.ts', 'div.entry-content'],
    ['plugins/french/noveldeglace.ts', '.chapter-content'],
  ];

  for (const [provider, selector] of cases) {
    await t.test(provider, async t => {
      const className = selector.replace(/^div\.|^\./, '');
      const html = `<h1 class="entry-title">Titre</h1><div class="${className}"><p>${prose}</p><script>bad()</script><style>.bad{}</style><ins>pub</ins><iframe>pub</iframe><div class="ads">pub</div></div>`;
      const { plugin, restore } = await loadPluginForTest(provider, () =>
        htmlResponse(html),
      );
      t.after(restore);
      const content = await plugin.parseChapter('/chapitre/');
      assert.match(content, /Contenu lisible/);
      assert.doesNotMatch(content, /<script|<style|<ins|<iframe|class="ads"/);
    });
  }
});

test('WuxiaLnScanTrad uses Unknown, ISO dates and unique chapter paths', async t => {
  const html = `<h1 class="entry-title">Série</h1><div class="entry-content"><ul>
    <li><a href="https://wuxialnscantrad.wordpress.com/2026/08/14/chapitre-1/">Chapitre 1</a></li>
    <li><a href="https://wuxialnscantrad.wordpress.com/2026/08/14/chapitre-1/">Chapitre 1 doublon</a></li>
  </ul></div>`;
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/wuxialnscantrad.ts',
    () => htmlResponse(html),
  );
  t.after(restore);

  const novel = await plugin.parseNovel('/serie/');
  assert.equal(plugin.version, '1.0.4');
  assert.equal(novel.status, 'Unknown');
  assert.equal(novel.chapters.length, 1);
  assert.equal(novel.chapters[0].releaseTime, '2026-08-14');
});

test('Harken Eliwood and Warrior Legend use Unknown and ISO dates', async t => {
  const providers = [
    [
      'plugins/french/harkeneliwood.ts',
      '<h1 class="entry-title">Série</h1><div id="content"><div class="entry-content"><p><a href="https://harkeneliwood.wordpress.com/2026/08/14/chapitre/">Chapitre</a></p></div></div>',
    ],
    [
      'plugins/french/warriorlegendtrad.ts',
      '<main class="site-main"><div><div><article><header><h1>Série</h1></header><div class="entry-content"><h2><a href="https://warriorlegendtrad.wordpress.com/2026/08/14/chapitre/">Chapitre</a></h2></div></article></div></div></main>',
    ],
  ];

  for (const [provider, html] of providers) {
    await t.test(provider, async t => {
      const { plugin, restore } = await loadPluginForTest(provider, () =>
        htmlResponse(html),
      );
      t.after(restore);
      const novel = await plugin.parseNovel('/serie/');
      assert.equal(novel.status, 'Unknown');
      assert.equal(novel.chapters[0].releaseTime, '2026-08-14');
    });
  }
});

test('Re:Zero keeps duplicate paths out and does not invent a status', async t => {
  const html = `<h1 class="entry-title">IF</h1><div class="entry-content">
    <a href="https://rezerowebnovelfr.wordpress.com/2026/08/14/chapitre/">Lire Chapitre</a>
    <a href="https://rezerowebnovelfr.wordpress.com/2026/08/14/chapitre/">Lire Chapitre doublon</a>
  </div>`;
  const { plugin, restore } = await loadPluginForTest(
    'plugins/french/rezerowebnovelfr.ts',
    () => htmlResponse(html),
  );
  t.after(restore);

  const novel = await plugin.parseNovel('/if-stories/');
  assert.equal(plugin.version, '1.0.3');
  assert.equal(novel.status, 'Unknown');
  assert.equal(novel.chapters.length, 1);
});
