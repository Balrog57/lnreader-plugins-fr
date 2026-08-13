# Remove WorldNovel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove WorldNovel from the published French LNReader catalog and prevent scheduled upstream synchronization from restoring it.

**Architecture:** Put permanent source exclusions in the shared French projection layer so pruning and three-way upstream merges apply the same rule. Remove WorldNovel from the retained Madara asset set, then regenerate plugins and the manifest from their source inputs.

**Tech Stack:** Node.js 24, ES modules, Node test runner, TypeScript, ESLint, LNReader multi-source generator, GitHub Actions.

## Global Constraints

- Permanently exclude `worldnovel`, `massnovel`, and `mtlnovel-fr` from French multi-source projection.
- Keep `phenixscans.broken.ts` in source history but exclude it from publication through the existing `.broken.ts` rule.
- Do not store WorldNovel credentials, cookies, or tokens.
- Push and publish only after the complete validation pipeline passes.

---

### Task 1: Enforce permanent French source exclusions

**Files:**
- Modify: `scripts/lib/french-projection.js`
- Modify: `scripts/tests/french-projection.test.js`

**Interfaces:**
- Consumes: multi-source records shaped as `{ id: string, options?: { lang?: string } }`.
- Produces: `EXCLUDED_FRENCH_SOURCE_IDS: ReadonlySet<string>` and `filterFrenchSources(sources): Array<object>` with excluded IDs removed case-insensitively.

- [ ] **Step 1: Write the failing projection tests**

Add the excluded IDs to the existing fixture and assert that only allowed French records remain:

```js
test('excludes permanently unsupported French sources', () => {
  const sources = [
    { id: 'allowed', options: { lang: 'French' } },
    { id: 'worldnovel', options: { lang: 'French' } },
    { id: 'MassNovel', options: { lang: 'French' } },
    { id: 'mtlnovel-fr', options: { lang: 'French' } },
  ];

  assert.deepEqual(
    filterFrenchSources(sources).map(source => source.id),
    ['allowed'],
  );
});
```

Extend the pruning fixture with a WorldNovel asset and assert that pruning removes both its record and directory.

- [ ] **Step 2: Run the projection tests and verify failure**

Run: `npm run test:projection`

Expected: FAIL because `filterFrenchSources` still returns excluded French IDs.

- [ ] **Step 3: Implement the denylist in the projection layer**

Add:

```js
export const EXCLUDED_FRENCH_SOURCE_IDS = new Set([
  'massnovel',
  'mtlnovel-fr',
  'worldnovel',
]);

export const isFrenchSource = source =>
  source?.options?.lang === 'French' &&
  !EXCLUDED_FRENCH_SOURCE_IDS.has(source.id?.toLowerCase());
```

Keep `filterFrenchSources` as the single filtering entry point used by pruning and merge resolution.

- [ ] **Step 4: Run the projection tests and verify success**

Run: `npm run test:projection`

Expected: PASS.

- [ ] **Step 5: Commit the projection rule**

```bash
git add scripts/lib/french-projection.js scripts/tests/french-projection.test.js
git commit -m "fix: exclude unsupported French sources"
```

### Task 2: Remove WorldNovel source and retained assets

**Files:**
- Modify: `scripts/resolve-upstream-conflicts.js`
- Modify: `scripts/tests/resolve-upstream-conflicts.test.js`
- Modify: `plugins/multisrc/madara/sources.json`
- Delete: `plugins/french/WorldNovel[madara].ts`
- Delete: `public/static/multisrc/madara/worldnovel/icon.png`

**Interfaces:**
- Consumes: `filterFrenchSources` from Task 1.
- Produces: conflict classification that returns `remove` for WorldNovel's Madara assets and merge output that cannot contain `worldnovel`.

- [ ] **Step 1: Write failing conflict-resolution assertions**

Change the retained-path assertion to:

```js
assert.equal(
  classifyConflict('public/static/multisrc/madara/worldnovel/icon.png'),
  'remove',
);
```

Add a `worldnovel` record to `base`, `ours`, and `theirs` in the merge test and keep it absent from the expected result.

- [ ] **Step 2: Run the conflict tests and verify failure**

Run: `node --test scripts/tests/resolve-upstream-conflicts.test.js`

Expected: FAIL because the retained asset map still preserves WorldNovel.

- [ ] **Step 3: Remove WorldNovel from retained Madara assets**

Delete the Madara entry from `retainedMultisrcAssets`:

```js
const retainedMultisrcAssets = new Map([
  ['lightnovelwp', new Set(['lightnovelfr'])],
]);
```

Remove the `worldnovel` object from `plugins/multisrc/madara/sources.json`.

- [ ] **Step 4: Regenerate the projected sources and generated plugins**

Run:

```bash
npm run prune:french
npm run clean:multisrc
npm run build:multisrc
```

Expected: `plugins/french/WorldNovel[madara].ts` and the WorldNovel icon are absent.

- [ ] **Step 5: Run focused tests and verify success**

Run:

```bash
npm run test:projection
node --test scripts/tests/resolve-upstream-conflicts.test.js
npm run test:unit
```

Expected: PASS.

- [ ] **Step 6: Commit source removal and sync protection**

```bash
git add -A -- scripts/lib/french-projection.js scripts/tests/french-projection.test.js scripts/resolve-upstream-conflicts.js scripts/tests/resolve-upstream-conflicts.test.js plugins/multisrc/madara/sources.json plugins/french public/static/multisrc/madara
git commit -m "fix: remove WorldNovel from French catalog"
```

### Task 3: Validate and publish the reduced catalog

**Files:**
- Regenerate: `.dist/plugins.json`
- Regenerate: `.dist/plugins.min.json`
- Regenerate: `.js/plugins/french/*`
- No manual source edits expected.

**Interfaces:**
- Consumes: the exclusion and source changes from Tasks 1 and 2.
- Produces: a French-only manifest with no `worldnovel` entry and a successful publication workflow.

- [ ] **Step 1: Run formatting and lint validation**

Run:

```bash
npx prettier --check scripts/lib/french-projection.js scripts/tests/french-projection.test.js scripts/resolve-upstream-conflicts.js scripts/tests/resolve-upstream-conflicts.test.js
npm run lint:french
```

Expected: PASS.

- [ ] **Step 2: Run a clean production build and manifest validation**

Run:

```bash
npm run clean:multisrc
npm run build:full
npm run check:french-manifest
```

Expected: PASS and `worldnovel` absent from both manifest files.

- [ ] **Step 3: Run live checks for every remaining plugin**

Run: `npm run check:french-live`

Expected: no hard failures after the built-in bounded retry. Cloudflare-only checks may remain explicitly inconclusive if the checker reports no functional failure.

- [ ] **Step 4: Verify repository and catalog invariants**

Run:

```bash
git status --short
node -e "const p=require('./.dist/plugins.json'); if(p.some(x=>x.id==='worldnovel')) process.exit(1); console.log(p.length)"
git diff --check
```

Expected: no `worldnovel`, one fewer catalog entry, and no whitespace errors.

- [ ] **Step 5: Commit any generated tracked artifacts**

If the build changed tracked generated files:

```bash
git add -A
git commit -m "build: refresh French plugin catalog"
```

Otherwise, leave the worktree clean after the Task 2 commit.

- [ ] **Step 6: Push and verify publication**

Run:

```bash
git push origin master
gh run list --repo Balrog57/lnreader-plugins-fr --limit 5
```

Watch the matching publication workflow to completion. Confirm the raw catalog downloads successfully and contains no `worldnovel` ID.
