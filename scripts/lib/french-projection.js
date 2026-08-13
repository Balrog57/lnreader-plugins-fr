import fs from 'node:fs';
import path from 'node:path';

export const EXCLUDED_FRENCH_SOURCE_IDS = new Set([
  'massnovel',
  'mtlnovel-fr',
  'worldnovel',
]);

export const isFrenchSource = source =>
  source?.options?.lang === 'French' &&
  !EXCLUDED_FRENCH_SOURCE_IDS.has(source.id?.toLowerCase());

export const filterFrenchSources = sources => sources.filter(isFrenchSource);

function removeChildDirectoriesExcept(parent, keep) {
  if (!fs.existsSync(parent)) return;
  for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
    if (entry.isDirectory() && !keep.has(entry.name)) {
      fs.rmSync(path.join(parent, entry.name), {
        recursive: true,
        force: true,
      });
    }
  }
}

export function pruneRepository(root) {
  const pluginsRoot = path.join(root, 'plugins');
  removeChildDirectoriesExcept(pluginsRoot, new Set(['french', 'multisrc']));

  const multisrcRoot = path.join(pluginsRoot, 'multisrc');
  const keptSourcesByTheme = new Map();
  for (const entry of fs.readdirSync(multisrcRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const themeRoot = path.join(multisrcRoot, entry.name);
    const sourcesPath = path.join(themeRoot, 'sources.json');
    if (!fs.existsSync(sourcesPath)) continue;
    const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
    const french = filterFrenchSources(sources);
    if (french.length === 0) {
      fs.rmSync(themeRoot, { recursive: true, force: true });
      continue;
    }

    const sourceIds = new Set(french.map(source => source.id.toLowerCase()));
    keptSourcesByTheme.set(entry.name, sourceIds);
    fs.writeFileSync(sourcesPath, `${JSON.stringify(french, null, 2)}\n`);

    const filtersRoot = path.join(themeRoot, 'filters');
    if (fs.existsSync(filtersRoot)) {
      for (const filter of fs.readdirSync(filtersRoot, {
        withFileTypes: true,
      })) {
        const id = path.parse(filter.name).name.toLowerCase();
        if (filter.isFile() && !sourceIds.has(id)) {
          fs.rmSync(path.join(filtersRoot, filter.name), { force: true });
        }
      }
    }
  }

  removeChildDirectoriesExcept(
    path.join(root, 'public', 'static', 'src'),
    new Set(['fr']),
  );

  const multisrcAssets = path.join(root, 'public', 'static', 'multisrc');
  removeChildDirectoriesExcept(
    multisrcAssets,
    new Set(keptSourcesByTheme.keys()),
  );
  for (const [theme, sourceIds] of keptSourcesByTheme) {
    removeChildDirectoriesExcept(path.join(multisrcAssets, theme), sourceIds);
  }
}
