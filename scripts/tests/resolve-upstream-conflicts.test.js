import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyConflict,
  mergeFrenchSourceLists,
} from '../resolve-upstream-conflicts.js';

test('auto-removes conflicts that belong only to foreign plugins', () => {
  assert.equal(classifyConflict('plugins/english/site.ts'), 'remove');
  assert.equal(classifyConflict('plugins/spanish/site.ts'), 'remove');
  assert.equal(
    classifyConflict('public/static/src/en/site/icon.png'),
    'remove',
  );
  assert.equal(
    classifyConflict('public/static/multisrc/readwn/site/icon.png'),
    'remove',
  );
  assert.equal(
    classifyConflict('public/static/multisrc/madara/foreign/icon.png'),
    'remove',
  );
});

test('requires semantic or manual resolution for retained paths', () => {
  assert.equal(classifyConflict('plugins/french/chireads.ts'), 'manual');
  assert.equal(
    classifyConflict('plugins/multisrc/madara/sources.json'),
    'sources',
  );
  assert.equal(classifyConflict('scripts/build-plugin-manifest.js'), 'manual');
  assert.equal(
    classifyConflict('public/static/multisrc/madara/worldnovel/icon.png'),
    'manual',
  );
});

test('merges independent French source changes by id', () => {
  const base = [
    { id: 'kept', sourceSite: 'https://old', options: { lang: 'French' } },
    { id: 'removed-locally', options: { lang: 'French' } },
  ];
  const ours = [
    { id: 'kept', sourceSite: 'https://local', options: { lang: 'French' } },
  ];
  const theirs = [
    { id: 'kept', sourceSite: 'https://old', options: { lang: 'French' } },
    { id: 'removed-locally', options: { lang: 'French' } },
    { id: 'added-upstream', options: { lang: 'French' } },
    { id: 'foreign', options: { lang: 'English' } },
  ];

  assert.deepEqual(mergeFrenchSourceLists(base, ours, theirs), [
    { id: 'kept', sourceSite: 'https://local', options: { lang: 'French' } },
    { id: 'added-upstream', options: { lang: 'French' } },
  ]);
});

test('rejects two different edits to the same French source', () => {
  const base = [{ id: 'same', value: 1, options: { lang: 'French' } }];
  const ours = [{ id: 'same', value: 2, options: { lang: 'French' } }];
  const theirs = [{ id: 'same', value: 3, options: { lang: 'French' } }];
  assert.throws(
    () => mergeFrenchSourceLists(base, ours, theirs),
    /Conflicting French source: same/,
  );
});
