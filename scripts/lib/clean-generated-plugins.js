import fs from 'node:fs';
import path from 'node:path';

export function removeGeneratedPlugins(root) {
  const pluginsRoot = path.join(root, 'plugins');
  if (!fs.existsSync(pluginsRoot)) return;

  for (const language of fs.readdirSync(pluginsRoot, { withFileTypes: true })) {
    if (!language.isDirectory() || language.name === 'multisrc') continue;
    const languageRoot = path.join(pluginsRoot, language.name);
    for (const file of fs.readdirSync(languageRoot, { withFileTypes: true })) {
      if (
        file.isFile() &&
        /\[[^\]]+\]\.(?:js|ts)$/.test(file.name)
      ) {
        fs.rmSync(path.join(languageRoot, file.name), { force: true });
      }
    }
  }
}
