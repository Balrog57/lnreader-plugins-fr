import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function assertFrenchManifest(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('French manifest is empty');
  }

  const ids = new Set();
  for (const entry of entries) {
    if (entry.lang !== 'Français') {
      throw new Error(`Non-French plugin: ${entry.id}`);
    }
    if (ids.has(entry.id)) {
      throw new Error(`Duplicate plugin id: ${entry.id}`);
    }
    if (`${entry.id} ${entry.url}`.includes('.broken')) {
      throw new Error(`Broken plugin published: ${entry.id}`);
    }
    ids.add(entry.id);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const manifestPath = path.resolve('.dist', 'plugins.json');
  const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assertFrenchManifest(entries);
  console.log(`Validated ${entries.length} French plugins`);
}
