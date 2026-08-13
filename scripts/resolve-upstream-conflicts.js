import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { filterFrenchSources } from './lib/french-projection.js';

const retainedMultisrcAssets = new Map([
  ['lightnovelwp', new Set(['lightnovelfr'])],
]);

export function classifyConflict(file) {
  const normalized = file.replaceAll('\\', '/');
  const pluginMatch = normalized.match(/^plugins\/([^/]+)\//);
  if (pluginMatch && !['french', 'multisrc'].includes(pluginMatch[1])) {
    return 'remove';
  }
  if (/^plugins\/multisrc\/[^/]+\/sources\.json$/.test(normalized)) {
    return 'sources';
  }
  const directAssetMatch = normalized.match(/^public\/static\/src\/([^/]+)\//);
  if (directAssetMatch && directAssetMatch[1] !== 'fr') return 'remove';

  const multisrcAssetMatch = normalized.match(
    /^public\/static\/multisrc\/([^/]+)\/([^/]+)\//,
  );
  if (multisrcAssetMatch) {
    const [, theme, sourceId] = multisrcAssetMatch;
    if (!retainedMultisrcAssets.get(theme)?.has(sourceId)) return 'remove';
  }
  return 'manual';
}

const stable = value =>
  value === undefined ? undefined : JSON.stringify(value);

export function mergeFrenchSourceLists(base, ours, theirs) {
  const filtered = [base, ours, theirs].map(filterFrenchSources);
  const maps = filtered.map(
    sources => new Map(sources.map(source => [source.id, source])),
  );
  const order = [
    ...maps[1].keys(),
    ...[...maps[2].keys()].filter(id => !maps[1].has(id)),
  ];
  const merged = [];

  for (const id of order) {
    const [baseSource, ourSource, theirSource] = maps.map(map => map.get(id));
    let selected;
    if (stable(ourSource) === stable(theirSource)) selected = ourSource;
    else if (stable(ourSource) === stable(baseSource)) selected = theirSource;
    else if (stable(theirSource) === stable(baseSource)) selected = ourSource;
    else throw new Error(`Conflicting French source: ${id}`);
    if (selected !== undefined) merged.push(selected);
  }
  return merged;
}

function git(root, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (!allowFailure && result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result;
}

function readStage(root, stage, file) {
  const result = git(root, ['show', `:${stage}:${file}`], {
    allowFailure: true,
  });
  return result.status === 0 ? JSON.parse(result.stdout) : [];
}

export function resolveUpstreamConflicts(root) {
  const output = git(root, [
    'diff',
    '--name-only',
    '--diff-filter=U',
    '-z',
  ]).stdout;
  const conflicts = output.split('\0').filter(Boolean);
  const manual = [];

  for (const file of conflicts) {
    const action = classifyConflict(file);
    if (action === 'remove') {
      git(root, ['rm', '-f', '--', file]);
    } else if (action === 'sources') {
      const merged = mergeFrenchSourceLists(
        readStage(root, 1, file),
        readStage(root, 2, file),
        readStage(root, 3, file),
      );
      fs.writeFileSync(
        path.join(root, file),
        `${JSON.stringify(merged, null, 2)}\n`,
      );
      git(root, ['add', '--', file]);
    } else {
      manual.push(file);
    }
  }

  if (manual.length > 0) {
    console.error('Manual upstream conflicts:');
    for (const file of manual) console.error(`- ${file}`);
    return 1;
  }
  return 0;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) process.exitCode = resolveUpstreamConflicts(process.cwd());
