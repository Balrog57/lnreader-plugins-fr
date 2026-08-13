import assert from 'node:assert/strict';
import test from 'node:test';

import { assertFrenchManifest } from '../assert-french-manifest.js';

const valid = {
  id: 'chireads',
  lang: 'Français',
  url: 'https://example.test/chireads.js',
};

test('accepts a non-empty French-only manifest', () => {
  assert.doesNotThrow(() => assertFrenchManifest([valid]));
});

test('rejects an empty manifest', () => {
  assert.throws(() => assertFrenchManifest([]), /empty/);
});

test('rejects a non-French entry', () => {
  assert.throws(
    () => assertFrenchManifest([{ ...valid, lang: 'English' }]),
    /Non-French plugin/,
  );
});

test('rejects duplicate plugin ids', () => {
  assert.throws(() => assertFrenchManifest([valid, valid]), /Duplicate plugin/);
});

test('rejects broken plugin artifacts', () => {
  assert.throws(
    () =>
      assertFrenchManifest([
        { ...valid, id: 'phenixscans.broken', url: 'https://example.test/a.js' },
      ]),
    /Broken plugin/,
  );
  assert.throws(
    () =>
      assertFrenchManifest([
        { ...valid, url: 'https://example.test/a.broken.js' },
      ]),
    /Broken plugin/,
  );
});
