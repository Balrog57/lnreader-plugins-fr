import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import * as esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

export async function loadPluginForTest(pluginPath, fetchImpl) {
  const result = await esbuild.build({
    entryPoints: [path.resolve(repoRoot, pluginPath)],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    write: false,
    logLevel: 'silent',
    alias: {
      '@libs': path.join(repoRoot, 'src/libs'),
      '@': path.join(repoRoot, 'src'),
    },
  });
  const bundlePath = path.join(
    os.tmpdir(),
    `plugin-test-${path.basename(pluginPath, '.ts')}-${Date.now()}.cjs`,
  );
  await fs.writeFile(bundlePath, result.outputFiles[0].text, 'utf8');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  const module = require(bundlePath);

  return {
    plugin: module.default ?? module,
    async restore() {
      globalThis.fetch = originalFetch;
      delete require.cache[require.resolve(bundlePath)];
      await fs.unlink(bundlePath).catch(() => undefined);
    },
  };
}
