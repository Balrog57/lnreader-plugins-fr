import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { listPublishablePlugins } from '../check-french-plugins.js';

test('lists direct and generated French plugins but excludes broken files', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-live-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const french = path.join(root, 'plugins', 'french');
  fs.mkdirSync(french, { recursive: true });
  for (const file of [
    'a.ts',
    'b.broken.ts',
    'generated[theme].ts',
    'notes.txt',
  ]) {
    fs.writeFileSync(path.join(french, file), 'fixture');
  }

  assert.deepEqual(listPublishablePlugins(root).map(file => path.basename(file)), [
    'a.ts',
    'generated[theme].ts',
  ]);
});
