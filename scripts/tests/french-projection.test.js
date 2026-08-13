import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  filterFrenchSources,
  isFrenchSource,
  pruneRepository,
} from '../lib/french-projection.js';

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

  assert.deepEqual(
    filterFrenchSources(sources).map(source => source.id),
    ['fr-one', 'fr-two'],
  );
});

test('excludes permanently unsupported French sources', () => {
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
});

test('prunes foreign plugin directories and empty multi-source themes', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-fr-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.mkdirSync(path.join(root, 'plugins', 'french'), { recursive: true });
  fs.mkdirSync(path.join(root, 'plugins', 'english'), { recursive: true });
  fs.mkdirSync(path.join(root, 'plugins', 'multisrc', 'madara'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, 'plugins', 'multisrc', 'readwn'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, 'public', 'static', 'src', 'fr'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, 'public', 'static', 'src', 'en'), {
    recursive: true,
  });
  fs.mkdirSync(
    path.join(root, 'public', 'static', 'multisrc', 'madara', 'fr-one'),
    { recursive: true },
  );
  fs.mkdirSync(
    path.join(root, 'public', 'static', 'multisrc', 'madara', 'en-one'),
    { recursive: true },
  );
  fs.mkdirSync(
    path.join(root, 'public', 'static', 'multisrc', 'madara', 'worldnovel'),
    { recursive: true },
  );
  fs.mkdirSync(
    path.join(root, 'public', 'static', 'multisrc', 'readwn', 'en-two'),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(root, 'plugins', 'multisrc', 'madara', 'sources.json'),
    JSON.stringify([
      { id: 'fr-one', options: { lang: 'French' } },
      { id: 'worldnovel', options: { lang: 'French' } },
      { id: 'en-one', options: { lang: 'English' } },
    ]),
  );
  fs.writeFileSync(
    path.join(root, 'plugins', 'multisrc', 'readwn', 'sources.json'),
    JSON.stringify([{ id: 'en-two', options: { lang: 'English' } }]),
  );

  pruneRepository(root);

  assert.equal(fs.existsSync(path.join(root, 'plugins', 'english')), false);
  assert.equal(
    fs.existsSync(path.join(root, 'plugins', 'multisrc', 'readwn')),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(root, 'public', 'static', 'src', 'en')),
    false,
  );
  assert.equal(
    fs.existsSync(
      path.join(root, 'public', 'static', 'multisrc', 'madara', 'en-one'),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(
      path.join(root, 'public', 'static', 'multisrc', 'madara', 'worldnovel'),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(root, 'public', 'static', 'multisrc', 'readwn')),
    false,
  );
  assert.equal(
    fs.existsSync(
      path.join(root, 'public', 'static', 'multisrc', 'madara', 'fr-one'),
    ),
    true,
  );
  assert.deepEqual(
    JSON.parse(
      fs.readFileSync(
        path.join(root, 'plugins', 'multisrc', 'madara', 'sources.json'),
      ),
    ).map(source => source.id),
    ['fr-one'],
  );
});
