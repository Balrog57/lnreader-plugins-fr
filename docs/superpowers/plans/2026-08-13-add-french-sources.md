# French Novel Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Phenix Scans permanently and add working LNReader plugins for J-Garden, Trad-Index, and LightNovelVF.

**Architecture:** Implement three independent `Plugin.PluginBase` classes because the targets use incompatible platforms. J-Garden consumes public WordPress JSON, Trad-Index parses server-rendered Next.js pages, and LightNovelVF combines server-rendered Laravel pages with its public chapter-pagination JSON endpoint.

**Tech Stack:** TypeScript, LNReader `PluginBase`, `fetchApi`, Cheerio, Node.js test runner, esbuild fixture harness, Prettier, ESLint.

## Global Constraints

- Publish novels only; never expose manga, manhwa, or scans.
- All catalogue, metadata, chapter-list, and chapter-text operations must work without authentication.
- Icons must be PNG files exactly 96 × 96 pixels under `public/static/src/fr/<id>/icon.png`.
- Do not add dependencies or bypass authentication, paywalls, or anti-bot protections.
- Preserve the automatic upstream synchronization and its permanent exclusion list.
- Push directly to `master` only after all local tests pass, then verify the GitHub publication and remote catalogue.

---

### Task 1: Remove Phenix Scans permanently

**Files:**
- Modify: `scripts/tests/french-projection.test.js`
- Modify: `scripts/lib/french-projection.js`
- Delete: `plugins/french/phenixscans.broken.ts`
- Delete: `public/static/src/fr/phenixscans/icon.png`

**Interfaces:**
- Consumes: `filterFrenchSources(sources)` and `EXCLUDED_FRENCH_SOURCE_IDS` from `scripts/lib/french-projection.js`.
- Produces: a case-insensitive permanent exclusion for the source id `phenixscans`.

- [ ] **Step 1: Extend the failing projection test**

Add a French Phenix record to `excludes permanently unsupported French sources` and keep only `allowed`:

```js
const sources = [
  { id: 'allowed', options: { lang: 'French' } },
  { id: 'worldnovel', options: { lang: 'French' } },
  { id: 'MassNovel', options: { lang: 'French' } },
  { id: 'mtlnovel-fr', options: { lang: 'French' } },
  { id: 'PhenixScans', options: { lang: 'French' } },
];

assert.deepEqual(
  filterFrenchSources(sources).map(source => source.id),
  ['allowed'],
);
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run: `npm run test:projection`

Expected: FAIL because `PhenixScans` is still returned.

- [ ] **Step 3: Add the exclusion and remove the dead source**

Add the normalized id to the existing set:

```js
export const EXCLUDED_FRENCH_SOURCE_IDS = new Set([
  'massnovel',
  'mtlnovel-fr',
  'phenixscans',
  'worldnovel',
]);
```

Delete the broken TypeScript file and its icon directory.

- [ ] **Step 4: Verify the projection and absence invariants**

Run: `npm run test:projection`

Expected: all projection tests PASS.

Run: `rg -n -i "phenixscans|phenix scans" plugins public scripts/lib scripts/tests`

Expected: only the intentional exclusion and its test remain.

- [ ] **Step 5: Commit the removal**

```bash
git add scripts/lib/french-projection.js scripts/tests/french-projection.test.js plugins/french/phenixscans.broken.ts public/static/src/fr/phenixscans/icon.png
git commit -m "fix: remove Phenix Scans from French catalog"
```

---

### Task 2: Add the J-Garden plugin with fixture-driven tests

**Files:**
- Create: `scripts/tests/helpers/load-plugin.js`
- Create: `scripts/tests/jgarden.test.js`
- Create: `plugins/french/jgarden.ts`
- Create: `public/static/src/fr/jgarden/icon.png`

**Interfaces:**
- Consumes: WordPress endpoints `wp-json/wp/v2/pages` and `wp-json/wp/v2/posts`.
- Produces: plugin id `jgarden` implementing every required `PluginBase` method.
- Produces: `loadPluginForTest(pluginPath, fetchImpl)` for fixture-loading later plugins.

- [ ] **Step 1: Create the reusable fixture loader**

Implement `loadPluginForTest` by bundling the requested TypeScript plugin with the same aliases as `scripts/live-check-plugin.js`. Use this complete structure so cleanup restores the process even when several fixture tests run:

```js
import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

export async function loadPluginForTest(pluginPath, fetchImpl) {
  const result = await esbuild.build({
    entryPoints: [path.resolve(repoRoot, pluginPath)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    write: false,
    logLevel: 'silent',
    alias: {
      '@libs': path.join(repoRoot, 'src', 'libs'),
      '@': path.join(repoRoot, 'src'),
    },
  });
  const tmpFile = path.join(
    os.tmpdir(),
    `plugin-fixture-${Date.now()}-${Math.random().toString(36).slice(2)}.cjs`,
  );
  await fs.writeFile(tmpFile, result.outputFiles[0].text, 'utf8');

  const previousFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const mod = require(tmpFile);
    return {
      plugin: mod.default ?? mod,
      restore: async () => {
        globalThis.fetch = previousFetch;
        delete require.cache[require.resolve(tmpFile)];
        await fs.unlink(tmpFile).catch(() => undefined);
      },
    };
  } catch (error) {
    globalThis.fetch = previousFetch;
    await fs.unlink(tmpFile).catch(() => undefined);
    throw error;
  }
}
```

- [ ] **Step 2: Write the failing J-Garden fixture test**

Mock these exact routes with `Response` objects:

```js
const fixtures = new Map([
  [
    '/wp-json/wp/v2/pages?slug=jg-ln&_fields=content',
    [{ content: { rendered: '<a href="/love-unseen/">Love Unseen</a>' } }],
  ],
  [
    '/wp-json/wp/v2/pages?slug=jg-web-novel&_fields=content',
    [{ content: { rendered: '<a href="/orv/">Omniscient Reader</a>' } }],
  ],
  [
    '/wp-json/wp/v2/pages?slug=love-unseen&_fields=slug,link,title,content',
    [{
      slug: 'love-unseen',
      link: 'https://j-garden.fr/love-unseen/',
      title: { rendered: 'Love Unseen' },
      content: {
        rendered: '<img src="https://j-garden.fr/cover.webp"><p>Synopsis du roman.</p><a href="/love-unseen-t1-chapitre-1/">Chapitre 1</a>',
      },
    }],
  ],
  [
    '/wp-json/wp/v2/posts?slug=love-unseen-t1-chapitre-1&_fields=content,title,link',
    [{
      title: { rendered: 'Chapitre 1' },
      link: 'https://j-garden.fr/love-unseen-t1-chapitre-1/',
      content: { rendered: '<div class="elementor-widget-theme-post-content"><p>Texte public du chapitre.</p></div>' },
    }],
  ],
]);
```

Assert that:

```js
assert.deepEqual(
  (await plugin.popularNovels(1, { filters: undefined })).map(n => n.path),
  ['love-unseen', 'orv'],
);
const novel = await plugin.parseNovel('love-unseen');
assert.equal(novel.name, 'Love Unseen');
assert.equal(novel.chapters.length, 1);
assert.equal(novel.chapters[0].path, 'love-unseen-t1-chapitre-1');
assert.match(await plugin.parseChapter(novel.chapters[0].path), /Texte public/);
assert.equal((await plugin.searchNovels('love unseen', 1)).length, 1);
```

- [ ] **Step 3: Run the J-Garden test and confirm the red state**

Run: `node --test scripts/tests/jgarden.test.js`

Expected: FAIL because `plugins/french/jgarden.ts` does not exist.

- [ ] **Step 4: Implement the J-Garden plugin**

Use these stable fields and endpoints:

```ts
class JGardenPlugin implements Plugin.PluginBase {
  id = 'jgarden';
  name = 'J-Garden';
  icon = 'src/fr/jgarden/icon.png';
  site = 'https://j-garden.fr/';
  version = '1.0.0';

  private async fetchJson<T>(path: string): Promise<T>;
  private async fetchSection(slug: 'jg-ln' | 'jg-web-novel'): Promise<Plugin.NovelItem[]>;
  async popularNovels(pageNo: number): Promise<Plugin.NovelItem[]>;
  async searchNovels(searchTerm: string, pageNo: number): Promise<Plugin.NovelItem[]>;
  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel>;
  async parseChapter(chapterPath: string): Promise<string>;
  resolveUrl: (path: string) => string;
}
```

Implementation rules:

- `popularNovels` returns an empty array after page 1 and merges `jg-ln` with `jg-web-novel`.
- `fetchSection` parses only same-origin links present in those two section pages and deduplicates by normalized slug.
- `parseNovel` fetches the page by slug, uses the first content image as cover, derives summary from prose before the first valid chapter link, and accepts chapter slugs containing `chapitre`, `prologue`, `epilogue`, `interlude`, `bonus`, `postface`, or `preface`.
- Chapter URLs must remain on `j-garden.fr`; external Clictune, Mega, MediaFire, and MangaDex links are ignored.
- `parseChapter` loads the matching WordPress post, selects `.elementor-widget-theme-post-content` when present, otherwise uses `content.rendered`, removes `script`, `style`, `nav`, sharing links, and empty elements, and throws `No readable chapter content found` if the remaining text is shorter than 200 characters.
- `searchNovels` normalizes case and diacritics over the page-1 catalogue.

- [ ] **Step 5: Add and verify the J-Garden icon**

Download `https://j-garden.fr/wp-content/uploads/2025/04/cropped-JG-logo-original-1-300x300.webp`, convert it to an undistorted 96 × 96 PNG, and save it at the declared path. Verify with:

```bash
node -e "const fs=require('fs'),{imageSize}=require('image-size');const s=imageSize(fs.readFileSync('public/static/src/fr/jgarden/icon.png'));if(s.width!==96||s.height!==96)process.exit(1);console.log(s)"
```

- [ ] **Step 6: Run focused tests and the real-site check**

Run: `node --test scripts/tests/jgarden.test.js`

Expected: PASS.

Run: `npm run check:plugin -- plugins/french/jgarden.ts`

Expected: `popularNovels`, `searchNovels`, `parseNovel`, and `parseChapter` PASS with non-empty chapter text.

- [ ] **Step 7: Commit J-Garden**

```bash
git add scripts/tests/helpers/load-plugin.js scripts/tests/jgarden.test.js plugins/french/jgarden.ts public/static/src/fr/jgarden/icon.png
git commit -m "feat: add J-Garden French novels"
```

---

### Task 3: Add the Trad-Index plugin and prose-only filtering

**Files:**
- Create: `scripts/tests/tradindex.test.js`
- Create: `plugins/french/tradindex.ts`
- Create: `public/static/src/fr/tradindex/icon.png`

**Interfaces:**
- Consumes: `loadPluginForTest` from Task 2.
- Consumes: public SSR routes `/catalogue`, `/oeuvre/<slug>`, and `/oeuvre/<slug>/chapitre/<number>`.
- Produces: plugin id `tradindex` exposing Web Novel and Light Novel records only.

- [ ] **Step 1: Write the failing Trad-Index fixture test**

Return catalogue fixtures for `type=Web+Novel` and `type=Light+Novel`, each containing one `a[href^="/oeuvre/"]` card. Add a `type=Manhwa` card only to an unfiltered fixture and assert it is never requested or returned.

The novel fixture must contain:

```html
<h1>Dungeon Hunter</h1>
<div>Light Novel · En cours</div>
<h2>Synopsis</h2><p>Synopsis public.</p>
<a href="/oeuvre/dungeon-hunter/chapitre/2">2 Chapitre 2</a>
<a href="/oeuvre/dungeon-hunter/chapitre/1">1 Chapitre 1</a>
<a href="?onglet=chapitres&tri=desc&page=2">2</a>
```

The chapter fixture must contain a `main` element with a heading, metadata, at least two prose paragraphs, a comments heading, and a comments form. Assert:

```js
assert.deepEqual(
  (await plugin.popularNovels(1, { filters: undefined })).map(n => n.name),
  ['Roman Web', 'Dungeon Hunter'],
);
assert.equal((await plugin.searchNovels('Dungeon', 1))[0].path, 'dungeon-hunter');
const novel = await plugin.parseNovel('dungeon-hunter');
assert.deepEqual(novel.chapters.map(c => c.chapterNumber), [1, 2, 3]);
const chapter = await plugin.parseChapter('dungeon-hunter/1');
assert.match(chapter, /Premier paragraphe/);
assert.doesNotMatch(chapter, /Commentaires|Publier/);
```

- [ ] **Step 2: Run the Trad-Index test and confirm the red state**

Run: `node --test scripts/tests/tradindex.test.js`

Expected: FAIL because `plugins/french/tradindex.ts` does not exist.

- [ ] **Step 3: Implement the Trad-Index plugin**

Use this public shape:

```ts
class TradIndexPlugin implements Plugin.PluginBase {
  id = 'tradindex';
  name = 'Trad-Index';
  icon = 'src/fr/tradindex/icon.png';
  site = 'https://trad-index.com/';
  version = '1.0.0';

  private async fetchHtml(path: string): Promise<CheerioAPI>;
  private parseCards($: CheerioAPI): Plugin.NovelItem[];
  private async fetchChapterPages(novelPath: string): Promise<Plugin.ChapterItem[]>;
  async popularNovels(pageNo: number, options: Plugin.PopularNovelsOptions): Promise<Plugin.NovelItem[]>;
  async searchNovels(searchTerm: string, pageNo: number): Promise<Plugin.NovelItem[]>;
  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel>;
  async parseChapter(chapterPath: string): Promise<string>;
  resolveUrl: (path: string, isNovel?: boolean) => string;
}
```

Implementation rules:

- Fetch `/catalogue?type=Web+Novel&page=N` and `/catalogue?type=Light+Novel&page=N`; add `q=<term>` for search.
- Parse only anchors matching `a[href^="/oeuvre/"]`; derive the slug from the path and deduplicate it across both responses.
- Never fetch the Manhwa or scan catalogue routes.
- `parseNovel` reads `h1`, cover `img[alt^="Couverture de"]`, the format/status line, synopsis following the `Synopsis` heading, author/translator text, genres, and all chapter anchors.
- Detect the maximum chapter-list page from `onglet=chapitres` pagination links, fetch pages 2 through the maximum, then sort and deduplicate chapters by `<novel-slug>/<chapter-number>`.
- `parseChapter` starts after the chapter header/metadata within `main`, stops before the translator attribution, navigation, sharing, report, or comments section, and throws on fewer than 200 readable characters.
- `resolveUrl(path, true)` returns `/oeuvre/<slug>`; chapter paths return `/oeuvre/<slug>/chapitre/<number>`.

- [ ] **Step 4: Add and verify the Trad-Index icon**

Render `https://trad-index.com/icon.svg?icon.3d442a7f.svg` on a transparent square canvas, export it as a 96 × 96 PNG, and verify dimensions with the `image-size` command from Task 2 using the Trad-Index path.

- [ ] **Step 5: Run focused tests and the real-site check**

Run: `node --test scripts/tests/tradindex.test.js`

Expected: PASS, including the Manhwa exclusion and chapter pagination assertions.

Run: `npm run check:plugin -- plugins/french/tradindex.ts`

Expected: every live step PASS without authentication.

- [ ] **Step 6: Commit Trad-Index**

```bash
git add scripts/tests/tradindex.test.js plugins/french/tradindex.ts public/static/src/fr/tradindex/icon.png
git commit -m "feat: add prose-only Trad-Index source"
```

---

### Task 4: Add the LightNovelVF plugin and JSON chapter pagination

**Files:**
- Create: `scripts/tests/lightnovelvf.test.js`
- Create: `plugins/french/lightnovelvf.ts`
- Create: `public/static/src/fr/lightnovelvf/icon.png`

**Interfaces:**
- Consumes: `loadPluginForTest` from Task 2.
- Consumes: `/novels-list`, `/novel/<slug>`, `/novel/<slug>/chapitres`, and `/novel/<slug>/<chapter>`.
- Produces: plugin id `lightnovelvf` with complete public chapter pagination.

- [ ] **Step 1: Write the failing LightNovelVF fixture test**

Create a catalogue fixture containing two `a[href^="/novel/"]` cards. Create a novel fixture with `h1`, `.lnv-synopsis__body`, cover image, author/status metadata, and `#lnv-novel[data-novel-slug="supreme-magus"]`.

Return two JSON pages for:

```text
/novel/supreme-magus/chapitres?p=1&order=asc&q=
/novel/supreme-magus/chapitres?p=2&order=asc&q=
```

Each JSON object follows the real contract:

```js
{
  chapters: [{ number: '114', slug: '114', name_fr: 'Leçon', name: 'Lesson', created_at: '2026-06-16T00:15:40.000000Z' }],
  current_page: 1,
  last_page: 2,
  total: 2,
}
```

Assert catalogue pagination/search query construction, metadata, ascending chapters `[114, 115]`, release dates, and that `.lnv-reader-content` is returned without header/footer controls.

- [ ] **Step 2: Run the LightNovelVF test and confirm the red state**

Run: `node --test scripts/tests/lightnovelvf.test.js`

Expected: FAIL because `plugins/french/lightnovelvf.ts` does not exist.

- [ ] **Step 3: Implement the LightNovelVF plugin**

Use this public shape:

```ts
type ChapterPage = {
  chapters: Array<{
    number: string;
    slug: string;
    name_fr?: string | null;
    name?: string | null;
    created_at?: string | null;
  }>;
  current_page: number;
  last_page: number;
  total: number;
};

class LightNovelVFPlugin implements Plugin.PluginBase {
  id = 'lightnovelvf';
  name = 'LightNovelVF';
  icon = 'src/fr/lightnovelvf/icon.png';
  site = 'https://www.lightnovelvf.com/';
  version = '1.0.0';
}
```

Implementation rules:

- Catalogue route: `/novels-list?page=N`; search route: `/novels-list?page=N&search=<term>`.
- Parse cards from `a[href^="/novel/"]`, title from the card heading/text after removing chapter-count and rating labels, cover from the first `img` URL, and deduplicate by slug.
- Parse synopsis from `.lnv-synopsis__body`, title from `h1`, cover from the hero image, and metadata from the labelled author/category/status areas.
- Fetch chapter page 1 with `order=asc`, then pages 2 through `last_page`, with a hard maximum of 500 pages. Map `name_fr || name || "Chapitre <number>"`, numeric `chapterNumber`, slug path `<novel>/<chapter-slug>`, and `created_at` release time.
- Extract `.lnv-reader-content`, remove script/style/navigation/advertising elements, and throw on fewer than 200 readable characters.
- `resolveUrl(path, true)` and chapter resolution both use `/novel/<path>` because chapter paths already contain the novel slug.

- [ ] **Step 4: Add and verify the LightNovelVF icon**

Download `https://www.lightnovelvf.com/apple-touch-icon.png`, resize to an undistorted 96 × 96 PNG, and verify dimensions with `image-size`.

- [ ] **Step 5: Run focused tests and the real-site check**

Run: `node --test scripts/tests/lightnovelvf.test.js`

Expected: PASS, including both JSON chapter pages.

Run: `npm run check:plugin -- plugins/french/lightnovelvf.ts`

Expected: every live step PASS without authentication.

- [ ] **Step 6: Commit LightNovelVF**

```bash
git add scripts/tests/lightnovelvf.test.js plugins/french/lightnovelvf.ts public/static/src/fr/lightnovelvf/icon.png
git commit -m "feat: add LightNovelVF source"
```

---

### Task 5: Validate the complete French catalogue and publish

**Files:**
- Modify only if validation exposes a defect: files introduced in Tasks 1–4.
- Generated and verified: `.js/plugins/french/*`, `.dist/plugins.json`, `.dist/plugins.min.json`.

**Interfaces:**
- Consumes: the three new plugin ids and the permanent exclusion set.
- Produces: a published French-only catalogue containing 14 plugins and no Phenix Scans or previously excluded sources.

- [ ] **Step 1: Format and run all deterministic tests**

Run:

```bash
npx prettier --write scripts/lib/french-projection.js scripts/tests/french-projection.test.js scripts/tests/helpers/load-plugin.js scripts/tests/jgarden.test.js scripts/tests/tradindex.test.js scripts/tests/lightnovelvf.test.js plugins/french/jgarden.ts plugins/french/tradindex.ts plugins/french/lightnovelvf.ts
npm run lint:french
npm run test:unit
```

Expected: Prettier makes no further changes on a second check, lint exits 0, and every Node test passes.

- [ ] **Step 2: Rebuild from a clean generated state**

Run:

```bash
npm run clean:multisrc
npm run build:full
npm run check:french-manifest
```

Expected: compile and manifest succeed; the manifest reports exactly 14 French plugins.

- [ ] **Step 3: Verify catalogue invariants**

Run:

```bash
node -e "const p=require('./.dist/plugins.json');const ids=p.map(x=>x.id.toLowerCase());for(const id of ['jgarden','tradindex','lightnovelvf'])if(!ids.includes(id))throw Error('missing '+id);for(const id of ['phenixscans','worldnovel','massnovel','mtlnovel-fr'])if(ids.includes(id))throw Error('excluded '+id);console.log(ids.length, ids)"
```

Expected: 14 ids, all three additions present, all four exclusions absent.

- [ ] **Step 4: Run the three focused live checks together**

Run:

```bash
npm run check:plugin -- plugins/french/jgarden.ts plugins/french/tradindex.ts plugins/french/lightnovelvf.ts
```

Expected: all methods PASS for all three plugins. A hard parser failure must be fixed and retested; a network-only `INCONCLUSIVE` must be reported separately and retried once.

- [ ] **Step 5: Run the complete French live check**

Run: `npm run check:french-live`

Expected: no hard failures across the catalogue.

- [ ] **Step 6: Inspect scope and commit validation fixes if needed**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: only planned files are changed and no generated cache or unrelated file is tracked. If Tasks 1–4 already committed cleanly, no additional commit is required.

- [ ] **Step 7: Push master and watch publication**

Run:

```bash
git push origin master
gh run list --repo Balrog57/lnreader-plugins-fr --limit 5
gh run watch <publish-run-id> --repo Balrog57/lnreader-plugins-fr --exit-status
```

Expected: `Publish Plugins` succeeds for the pushed HEAD SHA.

- [ ] **Step 8: Verify the remote catalogue**

Fetch `https://raw.githubusercontent.com/Balrog57/lnreader-plugins-fr/plugins/v3.0.0/.dist/plugins.min.json` with a cache-busting query parameter and enforce the same three-presence/four-absence checks as Step 3.

Expected: HTTP 200, 14 entries, `jgarden`, `tradindex`, and `lightnovelvf` present, with `phenixscans`, `worldnovel`, `massnovel`, and `mtlnovel-fr` absent.
