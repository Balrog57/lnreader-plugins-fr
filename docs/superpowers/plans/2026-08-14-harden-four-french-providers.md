# French Provider Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LightNovelVF, Trad-Index, Chireads, and J-Garden resilient to throttling, partial outages, malformed responses, duplicate chapters, and unsafe URLs.

**Architecture:** Keep each provider autonomous and add only small private helpers for validated fetching and bounded transient retries. Catalogue aggregation may retain fulfilled independent sections, while chapter pagination remains complete-or-error.

**Tech Stack:** TypeScript, LNReader `PluginBase`, `fetchApi`, Cheerio, Node.js test runner, esbuild fixture harness, ESLint, Prettier.

## Global Constraints

- No new dependency.
- Keep the current sites, catalogue scope, and chapter ordering behavior.
- Retry only HTTP 429 and 5xx responses, with bounded attempts.
- Never publish a silently partial chapter list.
- Push the validated result directly to `origin/master` as requested.

---

### Task 1: LightNovelVF throttling and unbounded server pagination

**Files:**

- Modify: `scripts/tests/lightnovelvf.test.js`
- Modify: `plugins/french/lightnovelvf.ts`

**Interfaces:**

- Consumes: Laravel chapter pages with `chapters`, `current_page`, `last_page`, and `total`.
- Produces: `fetchChapterPage(url): Promise<ChapterPage>` that validates JSON and retries the same URL after throttling.

- [ ] **Step 1: Write failing regression tests**

Add a fixture where page 2 returns `429` once with `Retry-After: 0`, then returns a valid page. Assert that `parseNovel` returns both chapters. Add a first page declaring `last_page: 501` and dynamically return valid empty pages 2–501; assert that page 501 is requested.

```js
assert.deepEqual(
  (await plugin.parseNovel('retry-novel')).chapters.map(c => c.chapterNumber),
  [1, 2],
);
assert.ok(requests.includes('/novel/long-novel/chapitres?p=501&order=asc&q='));
```

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/tests/lightnovelvf.test.js`

Expected: retry test rejects on HTTP 429 and the long-pagination test never requests page 501.

- [ ] **Step 3: Implement minimal retry and validation**

Add helpers equivalent to:

```ts
private retryDelay(response: Response, attempt: number): number;
private isChapterPage(value: unknown): value is ChapterPage;
private async fetchChapterPage(url: string): Promise<ChapterPage>;
```

Use at most six attempts, respect numeric or date-form `Retry-After`, retry the same URL, validate `application/json`, remove the 500-page cap, and update the terminal page from every valid response.

- [ ] **Step 4: Verify GREEN**

Run: `node --test scripts/tests/lightnovelvf.test.js`

Expected: all LightNovelVF tests pass.

---

### Task 2: Trad-Index partial catalogue and chapter retry semantics

**Files:**

- Modify: `scripts/tests/tradindex.test.js`
- Modify: `plugins/french/tradindex.ts`

**Interfaces:**

- Consumes: two independent catalogue sections and paginated HTML chapter lists.
- Produces: partial catalogue success only when at least one section fulfills; complete chapter list or explicit error.

- [ ] **Step 1: Write failing regression tests**

Retain the existing one-section failure test. Add a test where both section fetches reject and assert rejection. Add a chapter-page fixture returning HTTP 503 once before success and assert all chapters are present.

```js
await assert.rejects(plugin.searchNovels('Dungeon', 1), /catalogue/i);
assert.deepEqual(
  (await plugin.parseNovel('dungeon-hunter')).chapters.map(
    c => c.chapterNumber,
  ),
  [1, 2, 3],
);
```

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/tests/tradindex.test.js`

Expected: total catalogue failure currently resolves to `[]`; transient chapter failure rejects immediately.

- [ ] **Step 3: Implement minimal aggregation and retry**

Add:

```ts
private async fetchHtml(path: string, retry = false): Promise<string>;
private async catalogueSections(paths: string[]): Promise<string[]>;
```

Use `Promise.allSettled`, throw when no section fulfills, and retry chapter pages up to three times on 429/5xx. Preserve full-list failure after retries.

- [ ] **Step 4: Verify GREEN**

Run: `node --test scripts/tests/tradindex.test.js`

Expected: all Trad-Index tests pass.

---

### Task 3: Chireads HTTP validation, metadata, deduplication, and content

**Files:**

- Modify: `scripts/tests/chireads.test.js`
- Modify: `plugins/french/chireads.ts`

**Interfaces:**

- Consumes: catalogue HTML, WordPress category JSON, legacy dated chapter links, and compact chapter HTML.
- Produces: unique compact chapter items with number/date metadata and cleaned readable HTML.

- [ ] **Step 1: Write failing regression tests**

Duplicate one compact chapter through two legacy URLs, add dates and numeric names, and assert one item with `chapterNumber` and ISO `releaseTime`. Add tests for one-parent search failure, both-parent failure, non-OK HTML, and short chapter content.

```js
assert.deepEqual(
  novel.chapters.map(c => c.chapterNumber),
  [1, 2, 3, 4],
);
assert.equal(novel.chapters[0].releaseTime, '2025-01-13');
await assert.rejects(plugin.parseChapter('/c/short/'), /readable/i);
```

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/tests/chireads.test.js`

Expected: missing metadata, duplicate item, silent HTTP parsing, or short content cause failures.

- [ ] **Step 3: Implement minimal hardening**

Validate HTTP in `getCheerio`; aggregate independent catalogues and parents through `Promise.allSettled`; use a `Map` keyed by compact path; extract numbers and URL date suffixes before compacting; absolutize covers; remove non-reader elements and enforce 200 readable characters.

- [ ] **Step 4: Verify GREEN**

Run: `node --test scripts/tests/chireads.test.js`

Expected: all Chireads tests pass.

---

### Task 4: J-Garden section tolerance and metadata normalization

**Files:**

- Modify: `scripts/tests/jgarden.test.js`
- Modify: `plugins/french/jgarden.ts`

**Interfaces:**

- Consumes: same-origin WordPress pages and posts.
- Produces: safe absolute URLs, evidence-based status, and monotone chapter numbering after the existing special-order sort.

- [ ] **Step 1: Write failing regression tests**

Add one-section and both-section failure cases, a relative novel cover, a completed status label, monotone number assertions, malformed JSON content type, and a foreign chapter path rejection before any foreign fetch.

```js
assert.deepEqual(
  novel.chapters.map(c => c.chapterNumber),
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
);
assert.equal(novel.cover, 'https://j-garden.fr/cover.webp');
assert.equal(novel.status, 'Completed');
await assert.rejects(
  plugin.parseChapter('https://example.com/chapter'),
  /foreign/i,
);
```

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/tests/jgarden.test.js`

Expected: current `Promise.all`, raw relative cover, unconditional ongoing status, and unsafe fallback fail the new contracts.

- [ ] **Step 3: Implement minimal normalization**

Make `resolveUrl` enforce the site origin, validate JSON responses, aggregate sections with `Promise.allSettled` and total-failure detection, infer completed/hiatus/ongoing status from rendered text or use unknown, absolutize the cover, then assign `chapterNumber = index + 1` after sorting.

- [ ] **Step 4: Verify GREEN**

Run: `node --test scripts/tests/jgarden.test.js`

Expected: all J-Garden tests pass.

---

### Task 5: Full verification and publication

**Files:**

- Inspect and stage only the specification, plan, four providers, and four corresponding test files.

**Interfaces:**

- Produces: one validated commit pushed to `origin/master`.

- [ ] **Step 1: Format and run deterministic checks**

```powershell
npx prettier --write plugins/french/chireads.ts plugins/french/jgarden.ts plugins/french/tradindex.ts plugins/french/lightnovelvf.ts scripts/tests/chireads.test.js scripts/tests/jgarden.test.js scripts/tests/tradindex.test.js scripts/tests/lightnovelvf.test.js docs/superpowers/specs/2026-08-14-harden-four-french-providers-design.md docs/superpowers/plans/2026-08-14-harden-four-french-providers.md
node --test scripts/tests/chireads.test.js scripts/tests/jgarden.test.js scripts/tests/tradindex.test.js scripts/tests/lightnovelvf.test.js
npm run build:compile
npx eslint plugins/french/chireads.ts plugins/french/jgarden.ts plugins/french/tradindex.ts plugins/french/lightnovelvf.ts scripts/tests/chireads.test.js scripts/tests/jgarden.test.js scripts/tests/tradindex.test.js scripts/tests/lightnovelvf.test.js
npx prettier --check plugins/french/chireads.ts plugins/french/jgarden.ts plugins/french/tradindex.ts plugins/french/lightnovelvf.ts scripts/tests/chireads.test.js scripts/tests/jgarden.test.js scripts/tests/tradindex.test.js scripts/tests/lightnovelvf.test.js
```

Expected: zero test failures, compile exit 0, lint exit 0, format check exit 0.

- [ ] **Step 2: Run live checks**

Run: `node scripts/live-check-plugin.js plugins/french/chireads.ts plugins/french/jgarden.ts plugins/french/tradindex.ts plugins/french/lightnovelvf.ts`

Run a focused bundled `parseNovel('supreme-magus')` and assert 2,456 chapters.

- [ ] **Step 3: Inspect and publish**

```powershell
git diff --check
git status -sb
git diff --stat
git add docs/superpowers/specs/2026-08-14-harden-four-french-providers-design.md docs/superpowers/plans/2026-08-14-harden-four-french-providers.md plugins/french/chireads.ts plugins/french/jgarden.ts plugins/french/tradindex.ts plugins/french/lightnovelvf.ts scripts/tests/chireads.test.js scripts/tests/jgarden.test.js scripts/tests/tradindex.test.js scripts/tests/lightnovelvf.test.js
git commit -m "fix: harden French novel providers"
git push origin master
```

Expected: `.codex-remote-attachments/` remains untracked and remote `master` advances to the new commit.
