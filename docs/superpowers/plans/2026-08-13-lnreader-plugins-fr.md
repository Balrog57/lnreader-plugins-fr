# LNReader French-only Plugin Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish `Balrog57/lnreader-plugins-fr`, a self-updating LNReader catalog containing only tested French plugins.

**Architecture:** `master` is a French-only projection of `LNReader/lnreader-plugins` plus Balrog57's French fixes. A deterministic pruning script removes non-French plugin directories and multi-source records after initial import and every three-way upstream merge; CI pushes synchronized changes only after local build, catalog-invariant, and live-provider checks pass.

**Tech Stack:** Git, Node.js 24, ECMAScript modules, TypeScript, Node's built-in test runner, GitHub Actions, GitHub CLI.

## Global Constraints

- The public repository name is exactly `Balrog57/lnreader-plugins-fr`.
- The local checkout is exactly `C:\Users\Marc\Documents\1G1R\_Programmation\lnreader-plugins-fr`.
- The default branch is `master`.
- Published manifests contain only entries whose language label is `Français`.
- Keep standalone French plugins and working French records from `lightnovelwp` and `madara`; the approved fix removes dead MassNovel and MTL Novel (FR) records.
- Apply `Balrog57/lnreader-plugins:fix/french-plugins-2026` over the initial upstream snapshot.
- Keep `.broken.ts` source files out of compilation, live checks, and publication.
- Scheduled synchronization pushes directly only after every required test passes; conflicts or failures change nothing remotely.
- Publish to `plugins/v3.0.0` and support `https://raw.githubusercontent.com/Balrog57/lnreader-plugins-fr/plugins/v3.0.0/.dist/plugins.min.json`.
- GitHub workflows use repository-scoped `GITHUB_TOKEN`; do not add a personal token secret.

---

### Task 1: Import the upstream source and Balrog57 French fixes

**Files:**
- Preserve: `docs/superpowers/specs/2026-08-13-lnreader-plugins-fr-design.md`
- Preserve: `docs/superpowers/plans/2026-08-13-lnreader-plugins-fr.md`
- Import: upstream repository files from `LNReader/lnreader-plugins:master`
- Overlay: changed files from `Balrog57/lnreader-plugins:fix/french-plugins-2026`

**Interfaces:**
- Consumes: upstream `master` and commit `6d89efc0d69bfda4c7a7c8a2fa344f837d9004c9`.
- Produces: a local `master` whose history records the upstream parent and whose working tree includes the French fixes.

- [ ] **Step 1: Add and fetch source remotes**

```powershell
git remote add upstream https://github.com/LNReader/lnreader-plugins.git
git remote add balrog-plugins https://github.com/Balrog57/lnreader-plugins.git
git fetch upstream master
git fetch balrog-plugins fix/french-plugins-2026
```

Expected: both remote tips resolve with `git rev-parse`.

- [ ] **Step 2: Connect the design history to upstream without changing the current tree**

```powershell
git merge --allow-unrelated-histories -s ours --no-edit upstream/master
git checkout upstream/master -- .
git checkout HEAD -- docs/superpowers
```

Expected: upstream files are staged/modified while both design documents remain present.

- [ ] **Step 3: Overlay the approved French correction branch**

```powershell
git diff --name-only upstream/master..balrog-plugins/fix/french-plugins-2026
git diff --binary upstream/master..balrog-plugins/fix/french-plugins-2026 | git apply --index --3way
```

Expected changed plugin paths include `plugins/french/chireads.ts` and French records in multi-source `sources.json` files; `git diff --check` exits 0.

- [ ] **Step 4: Commit the imported baseline**

```powershell
git add -A
git commit -m "feat: import French plugin fixes"
```

Expected: clean status and the correction commit's patch is represented in `master`.

---

### Task 2: Implement and test the deterministic French projection

**Files:**
- Create: `scripts/lib/french-projection.js`
- Create: `scripts/prune-to-french.js`
- Create: `scripts/tests/french-projection.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: a repository root containing upstream's `plugins` tree.
- Produces: `isFrenchSource(source): boolean`, `filterFrenchSources(sources): object[]`, `pruneRepository(root): void`, and npm script `test:projection`.

- [ ] **Step 1: Write failing unit tests for language filtering**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { isFrenchSource, filterFrenchSources } from '../lib/french-projection.js';

test('recognizes only explicit French multi-source records', () => {
  assert.equal(isFrenchSource({ options: { lang: 'French' } }), true);
  assert.equal(isFrenchSource({ options: { lang: 'English' } }), false);
  assert.equal(isFrenchSource({}), false);
});

test('preserves order while removing non-French records', () => {
  const sources = [
    { id: 'fr-one', options: { lang: 'French' } },
    { id: 'en-one', options: { lang: 'English' } },
    { id: 'fr-two', options: { lang: 'French' } },
  ];
  assert.deepEqual(filterFrenchSources(sources).map(source => source.id), [
    'fr-one',
    'fr-two',
  ]);
});
```

- [ ] **Step 2: Run the tests and verify the missing module failure**

Run: `node --test scripts/tests/french-projection.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `french-projection.js`.

- [ ] **Step 3: Implement the projection functions**

```js
import fs from 'node:fs';
import path from 'node:path';

export const isFrenchSource = source => source?.options?.lang === 'French';
export const filterFrenchSources = sources => sources.filter(isFrenchSource);

export function pruneRepository(root) {
  const pluginsRoot = path.join(root, 'plugins');
  for (const entry of fs.readdirSync(pluginsRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && !['french', 'multisrc'].includes(entry.name)) {
      fs.rmSync(path.join(pluginsRoot, entry.name), { recursive: true, force: true });
    }
  }

  const multisrcRoot = path.join(pluginsRoot, 'multisrc');
  for (const entry of fs.readdirSync(multisrcRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const themeRoot = path.join(multisrcRoot, entry.name);
    const sourcesPath = path.join(themeRoot, 'sources.json');
    if (!fs.existsSync(sourcesPath)) continue;
    const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
    const french = filterFrenchSources(sources);
    if (french.length === 0) {
      fs.rmSync(themeRoot, { recursive: true, force: true });
    } else {
      fs.writeFileSync(sourcesPath, `${JSON.stringify(french, null, 2)}\n`);
    }
  }
}
```

`scripts/prune-to-french.js` calls `pruneRepository(process.cwd())`. Add `"prune:french": "node scripts/prune-to-french.js"` and `"test:projection": "node --test scripts/tests/french-projection.test.js"` to `package.json`.

- [ ] **Step 4: Add a temporary-directory integration test**

Create a fixture in `fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-fr-'))` with `plugins/french`, `plugins/english`, `plugins/multisrc/madara/sources.json`, and `plugins/multisrc/readwn/sources.json`. Call `pruneRepository(root)` and assert:

```js
assert.equal(fs.existsSync(path.join(root, 'plugins/english')), false);
assert.equal(fs.existsSync(path.join(root, 'plugins/multisrc/readwn')), false);
assert.deepEqual(
  JSON.parse(fs.readFileSync(path.join(root, 'plugins/multisrc/madara/sources.json'))).map(source => source.id),
  ['fr-one'],
);
```

- [ ] **Step 5: Run, apply, and verify the projection**

```powershell
npm run test:projection
npm run prune:french
node -e "const fs=require('fs'); console.log(fs.readdirSync('plugins'))"
```

Expected: tests pass and `plugins` contains only `french` and `multisrc`; multi-source theme directories with no French records are absent.

- [ ] **Step 6: Commit the French projection**

```powershell
git add package.json plugins scripts/lib/french-projection.js scripts/prune-to-french.js scripts/tests/french-projection.test.js
git commit -m "feat: project upstream plugins to French only"
```

---

### Task 3: Enforce a French-only generated catalog

**Files:**
- Modify: `scripts/languages.js`
- Modify: `scripts/build-plugin-manifest.js`
- Create: `scripts/assert-french-manifest.js`
- Create: `scripts/tests/assert-french-manifest.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `.dist/plugins.json` generated by the existing build.
- Produces: `assertFrenchManifest(entries): void`, npm script `check:french-manifest`, and a non-zero exit for empty, non-French, duplicate, or broken-plugin catalogs.

- [ ] **Step 1: Write failing manifest-contract tests**

Tests must assert that a one-entry `{ id: 'chireads', lang: 'Français', url: 'https://example/chireads.js' }` catalog passes and that each of these throws: an empty array, `lang: 'English'`, duplicate IDs, and an ID or URL containing `.broken`.

Run: `node --test scripts/tests/assert-french-manifest.test.js`

Expected: FAIL because `assertFrenchManifest` does not exist.

- [ ] **Step 2: Implement the manifest assertion**

```js
export function assertFrenchManifest(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('French manifest is empty');
  const ids = new Set();
  for (const entry of entries) {
    if (entry.lang !== 'Français') throw new Error(`Non-French plugin: ${entry.id}`);
    if (ids.has(entry.id)) throw new Error(`Duplicate plugin id: ${entry.id}`);
    if (`${entry.id} ${entry.url}`.includes('.broken')) throw new Error(`Broken plugin published: ${entry.id}`);
    ids.add(entry.id);
  }
}
```

The executable entry reads `.dist/plugins.json`, calls the exported function, and prints the validated plugin count.

- [ ] **Step 3: Restrict language discovery and broken outputs**

Change `scripts/languages.js` to:

```js
export default { French: 'Français' };
```

In `scripts/build-plugin-manifest.js`, skip compiled filenames containing `.broken.` before minification and metadata extraction. Keep `tsconfig.production.json`'s existing `./plugins/**/*.broken.ts` exclusion.

- [ ] **Step 4: Add scripts and run the full build**

Add:

```json
"test:manifest": "node --test scripts/tests/assert-french-manifest.test.js",
"check:french-manifest": "node scripts/assert-french-manifest.js"
```

Run:

```powershell
npm ci --ignore-scripts
npm run test:manifest
npm run build:full
npm run check:french-manifest
```

Expected: every command exits 0 and every object in `.dist/plugins.json` has `lang === "Français"`.

- [ ] **Step 5: Commit the catalog contract**

```powershell
git add package.json scripts/languages.js scripts/build-plugin-manifest.js scripts/assert-french-manifest.js scripts/tests/assert-french-manifest.test.js
git commit -m "test: enforce French-only plugin catalog"
```

---

### Task 4: Add bounded live checks for publishable French plugins

**Files:**
- Create: `scripts/check-french-plugins.js`
- Create: `scripts/tests/check-french-plugins.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: generated and standalone `.ts` files under `plugins/french`, excluding `*.broken.ts`.
- Produces: `listPublishablePlugins(root): string[]` and npm script `check:french-live` that retries the existing live checker once.

- [ ] **Step 1: Test deterministic plugin discovery**

Create a temporary `plugins/french` tree containing `a.ts`, `b.broken.ts`, `generated[theme].ts`, and `notes.txt`. Assert:

```js
assert.deepEqual(listPublishablePlugins(root).map(path.basename), [
  'a.ts',
  'generated[theme].ts',
]);
```

Run: `node --test scripts/tests/check-french-plugins.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement discovery and two-attempt execution**

Use `fs.readdirSync`, retain `.ts` files that do not end with `.broken.ts`, sort them, and invoke:

```js
spawnSync(process.execPath, ['scripts/live-check-plugin.js', ...pluginPaths], {
  cwd: root,
  stdio: 'inherit',
});
```

Run at most two attempts. Exit 0 on the first success; otherwise exit with the second attempt's non-zero status.

- [ ] **Step 3: Add the npm script and verify discovery plus live behavior**

Add `"check:french-live": "node scripts/check-french-plugins.js"`.

Run:

```powershell
npm run test:projection
npm run test:manifest
node --test scripts/tests/check-french-plugins.test.js
npm run clean:multisrc:windows
npm run build:multisrc
npm run check:french-live
```

Expected: unit tests pass; the live command checks only non-broken French files and reports either complete success or the exact failing provider after two attempts.

- [ ] **Step 4: Commit bounded live validation**

```powershell
git add package.json scripts/check-french-plugins.js scripts/tests/check-french-plugins.test.js
git commit -m "test: live-check French plugin catalog"
```

---

### Task 5: Automate safe three-way upstream synchronization

**Files:**
- Create: `scripts/resolve-upstream-conflicts.js`
- Create: `scripts/tests/resolve-upstream-conflicts.test.js`
- Create: `.github/workflows/sync-upstream.yml`

**Interfaces:**
- Consumes: paths returned by `git diff --name-only --diff-filter=U` during an upstream merge.
- Produces: `classifyConflict(path): 'remove' | 'manual'`; the workflow auto-removes non-French plugin conflicts and fails on shared/French conflicts.

- [ ] **Step 1: Write conflict-classification tests**

```js
assert.equal(classifyConflict('plugins/english/site.ts'), 'remove');
assert.equal(classifyConflict('plugins/spanish/site.ts'), 'remove');
assert.equal(classifyConflict('plugins/french/chireads.ts'), 'manual');
assert.equal(classifyConflict('plugins/multisrc/madara/sources.json'), 'manual');
assert.equal(classifyConflict('scripts/build-plugin-manifest.js'), 'manual');
```

Run: `node --test scripts/tests/resolve-upstream-conflicts.test.js`

Expected: FAIL because the classifier does not exist.

- [ ] **Step 2: Implement conflict classification and resolution**

Normalize separators to `/`. A path under `plugins/<language>/` is `remove` unless `<language>` is `french` or `multisrc`; every other conflict is `manual`. The command entrypoint runs `git rm -- <path>` for `remove` paths, prints all `manual` paths, and exits 1 while any manual conflict remains.

- [ ] **Step 3: Create the daily/manual sync workflow**

Use:

```yaml
name: Sync French plugins from upstream
on:
  schedule:
    - cron: '17 3 * * *'
  workflow_dispatch:
permissions:
  contents: write
concurrency:
  group: sync-french-upstream
  cancel-in-progress: false
```

The single Ubuntu job must checkout `master` with `fetch-depth: 0`, add/fetch `https://github.com/LNReader/lnreader-plugins.git`, configure the Actions bot identity, start `git merge --no-commit --no-ff upstream/master`, run the resolver when unmerged paths exist, run `npm ci --ignore-scripts`, `npm run prune:french`, all three Node unit-test files, `npm run build:full`, `npm run check:french-manifest`, `npm run check:french-live`, and `npm run format:check`.

Only after those commands pass:

```bash
git add -A
if git diff --cached --quiet && ! git rev-parse -q --verify MERGE_HEAD; then exit 0; fi
git commit -m "chore: sync French plugins from upstream"
git push origin HEAD:master
npm run publish:plugins
```

Any earlier non-zero command ends the job before both push commands.

- [ ] **Step 4: Test the classifier and statically inspect workflow permissions**

```powershell
node --test scripts/tests/resolve-upstream-conflicts.test.js
node -e "const s=require('fs').readFileSync('.github/workflows/sync-upstream.yml','utf8'); if(!s.includes('contents: write')||s.includes('REPO_SCOPED_TOKEN')) process.exit(1)"
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit upstream synchronization**

```powershell
git add scripts/resolve-upstream-conflicts.js scripts/tests/resolve-upstream-conflicts.test.js .github/workflows/sync-upstream.yml
git commit -m "ci: sync tested French plugins from upstream"
```

---

### Task 6: Publish French-only changes from master

**Files:**
- Modify: `.github/workflows/publish-plugins.yml`
- Modify: `scripts/publish-plugins.sh`
- Modify: `README.md`

**Interfaces:**
- Consumes: a validated `master` checkout and `package.json` version `3.0.0`.
- Produces: orphan branch `plugins/v3.0.0` and documented LNReader catalog URL.

- [ ] **Step 1: Simplify the publish workflow for one branch**

Set `permissions: contents: write`, checkout with the default repository-scoped token, remove `REPO_SCOPED_TOKEN`, and always run the single-branch command `npm run publish:plugins`. Keep triggers for `master` changes under `plugins/**`, `public/**`, `scripts/**`, `package.json`, and the workflow itself.

- [ ] **Step 2: Remove fork all-branches publication**

Delete the `--all-branches` branch loop from `scripts/publish-plugins.sh`. Preserve its single-branch flow: clean generated output, generate multi-source plugins, compile TypeScript, build and validate the manifest, copy `.js/plugins` to `.js/src/plugins`, commit only distribution artifacts, and force-push `plugins/v3.0.0`.

Insert `npm run check:french-manifest` immediately after `npm run build:manifest` so a non-French distribution can never be pushed.

- [ ] **Step 3: Replace README with French repository instructions**

Document the repository purpose, automatic sync behavior, how failures block publication, local validation commands, and the exact catalog URL:

```text
https://raw.githubusercontent.com/Balrog57/lnreader-plugins-fr/plugins/v3.0.0/.dist/plugins.min.json
```

- [ ] **Step 4: Run final local verification**

```powershell
npm ci --ignore-scripts
npm run prune:french
npm run test:projection
npm run test:manifest
node --test scripts/tests/check-french-plugins.test.js
node --test scripts/tests/resolve-upstream-conflicts.test.js
npm run build:full
npm run check:french-manifest
npm run format:check
npm run lint
git diff --check
```

Expected: all commands exit 0 and `.dist/plugins.json` is non-empty and French-only.

- [ ] **Step 5: Commit publication and documentation**

```powershell
git add .github/workflows/publish-plugins.yml scripts/publish-plugins.sh README.md
git commit -m "ci: publish the French-only plugin catalog"
```

---

### Task 7: Create the GitHub repository and verify the live catalog

**Files:**
- Verify: entire repository state
- Remote artifact: `Balrog57/lnreader-plugins-fr`

**Interfaces:**
- Consumes: clean, fully verified local `master`.
- Produces: public GitHub repository, successful Actions runs, and downloadable LNReader manifest.

- [ ] **Step 1: Confirm remote absence and local scope**

```powershell
gh repo view Balrog57/lnreader-plugins-fr
git status --short
git log --oneline --decorate -8
```

Expected: GitHub reports the repository is absent, local status is clean, and the log contains focused commits from Tasks 1-6.

- [ ] **Step 2: Create and push the public repository**

```powershell
gh repo create Balrog57/lnreader-plugins-fr --public --source . --remote origin --push --description "Dépôt communautaire de plugins français pour LNReader"
```

Expected: GitHub creates the repository with `master` pushed as its default branch.

- [ ] **Step 3: Run the manual synchronization and observe completion**

```powershell
gh workflow run sync-upstream.yml --repo Balrog57/lnreader-plugins-fr
gh run list --repo Balrog57/lnreader-plugins-fr --workflow sync-upstream.yml --limit 1
```

Watch the returned run with `gh run watch <run-id> --repo Balrog57/lnreader-plugins-fr --exit-status`. Expected: success or no-change success; failure requires diagnosis before proceeding.

- [ ] **Step 4: Verify publication and catalog contents**

```powershell
gh run list --repo Balrog57/lnreader-plugins-fr --workflow publish-plugins.yml --limit 1
node -e "fetch('https://raw.githubusercontent.com/Balrog57/lnreader-plugins-fr/plugins/v3.0.0/.dist/plugins.min.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(p=>{if(!p.length||p.some(x=>x.lang!=='Français'))process.exit(1);console.log(p.length)})"
```

Expected: the publish run succeeds and the raw manifest is non-empty with no non-French entry.

- [ ] **Step 5: Verify LNReader compatibility and hand off the URL**

Confirm the URL ends in `plugins.min.json`, returns JSON over HTTPS without authentication, and every plugin `url` points to `Balrog57/lnreader-plugins-fr/plugins/v3.0.0/.js/src/plugins/french/`.

Record the final commit, successful run IDs, plugin count, excluded broken providers, and the catalog URL in the completion report.
