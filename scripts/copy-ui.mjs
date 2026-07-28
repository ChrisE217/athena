import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'dist-ui');
const to = join(root, 'dist', 'ui');

if (!existsSync(from)) {
  console.error('UI build missing at dist-ui. Run build:ui first.');
  process.exit(1);
}

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });

// Runtime report assets only — skip Vite demo report.json / public fixtures.
cpSync(join(from, 'index.html'), join(to, 'index.html'));
const assetsFrom = join(from, 'assets');
if (existsSync(assetsFrom)) {
  cpSync(assetsFrom, join(to, 'assets'), { recursive: true });
}
for (const name of ['favicon.svg', 'vite.svg']) {
  const src = join(from, name);
  if (existsSync(src)) cpSync(src, join(to, name));
}

console.log('Copied UI assets → dist/ui');
