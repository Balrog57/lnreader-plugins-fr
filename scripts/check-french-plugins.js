import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function listPublishablePlugins(root) {
  const frenchRoot = path.join(root, 'plugins', 'french');
  return fs
    .readdirSync(frenchRoot, { withFileTypes: true })
    .filter(
      entry =>
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.broken.ts'),
    )
    .map(entry => path.join('plugins', 'french', entry.name))
    .sort((a, b) => a.localeCompare(b));
}

export function runLiveChecks(root) {
  const pluginPaths = listPublishablePlugins(root);
  if (pluginPaths.length === 0) {
    console.error('No publishable French plugins found');
    return 1;
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    console.log(`French live check attempt ${attempt}/2`);
    const result = spawnSync(
      process.execPath,
      ['scripts/live-check-plugin.js', ...pluginPaths],
      { cwd: root, stdio: 'inherit' },
    );
    if (result.status === 0) return 0;
  }
  return 1;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) process.exitCode = runLiveChecks(process.cwd());
