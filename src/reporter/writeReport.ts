import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AthenaReport } from '../types.js';

function packageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // Bundled as dist/reporter/index.js → ../..
  // Bundled as dist/cli.js → ..
  const candidates = [join(here, '..', '..'), join(here, '..'), here];
  for (const root of candidates) {
    if (existsSync(join(root, 'dist', 'ui', 'index.html'))) return root;
  }
  return join(here, '..', '..');
}

function uiAssetsDir(): string {
  return join(packageRoot(), 'dist', 'ui');
}

export function writeReportFolder(outputFolder: string, report: AthenaReport): void {
  mkdirSync(outputFolder, { recursive: true });

  writeFileSync(join(outputFolder, 'report.json'), JSON.stringify(report, null, 2), 'utf-8');

  const uiDir = uiAssetsDir();
  if (!existsSync(uiDir)) {
    throw new Error(
      `Athena UI assets not found at ${uiDir}. Run "npm run build" in athena-playwright.`,
    );
  }

  const assetsFrom = join(uiDir, 'assets');
  if (existsSync(assetsFrom)) {
    const assetsTo = join(outputFolder, 'assets');
    rmSync(assetsTo, { recursive: true, force: true });
    cpSync(assetsFrom, assetsTo, { recursive: true });
  }

  const indexSrc = join(uiDir, 'index.html');
  const html = readFileSync(indexSrc, 'utf-8');
  writeFileSync(join(outputFolder, 'index.html'), html, 'utf-8');

  for (const name of ['favicon.svg', 'vite.svg']) {
    const from = join(uiDir, name);
    if (existsSync(from)) cpSync(from, join(outputFolder, name));
  }
}
