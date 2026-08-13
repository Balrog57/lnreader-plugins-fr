import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { removeGeneratedPlugins } from '../lib/clean-generated-plugins.js';

test('removes only generated multi-source plugin files on every platform', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-clean-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const french = path.join(root, 'plugins', 'french');
  fs.mkdirSync(french, { recursive: true });
  fs.writeFileSync(path.join(french, 'direct.ts'), 'direct');
  fs.writeFileSync(path.join(french, 'generated[theme].ts'), 'generated');
  fs.writeFileSync(path.join(french, 'generated[theme].js'), 'generated');

  removeGeneratedPlugins(root);

  assert.equal(fs.existsSync(path.join(french, 'direct.ts')), true);
  assert.equal(fs.existsSync(path.join(french, 'generated[theme].ts')), false);
  assert.equal(fs.existsSync(path.join(french, 'generated[theme].js')), false);
});
