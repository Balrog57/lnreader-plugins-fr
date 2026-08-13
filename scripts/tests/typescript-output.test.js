import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

test('keeps the French language directory in production output', () => {
  const configPath = path.resolve('tsconfig.production.json');
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(error, undefined);
  assert.equal(config.compilerOptions.rootDir, './plugins');
});
