#!/usr/bin/env node
/**
 * End-to-end: run examples/smoke as 2 Playwright shards and assert Athena
 * auto-merges into athena-report/.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const smoke = join(root, 'examples', 'smoke');
const reportRoot = join(smoke, 'athena-report');

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: smoke,
    encoding: 'utf-8',
    env: { ...process.env, FORCE_COLOR: '0' },
    ...opts,
  });
  return res;
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

console.log('→ ensure package build + smoke deps');
execSync('npm run build', { cwd: root, stdio: 'inherit' });
execSync('npm install', { cwd: smoke, stdio: 'inherit' });

rmSync(reportRoot, { recursive: true, force: true });

console.log('→ playwright --shard=1/2');
const s1 = run('npx', ['playwright', 'test', '--shard=1/2']);
assert(
  existsSync(join(reportRoot, 'shards', '1-of-2', 'report.json')),
  'shard 1 report missing',
);
assert(!existsSync(join(reportRoot, 'report.json')), 'merged too early after shard 1');
console.log(`   shard 1 exit=${s1.status}`);

console.log('→ playwright --shard=2/2');
const s2 = run('npx', ['playwright', 'test', '--shard=2/2']);
assert(
  existsSync(join(reportRoot, 'shards', '2-of-2', 'report.json')),
  'shard 2 report missing',
);
assert(existsSync(join(reportRoot, 'report.json')), 'auto-merge did not write report.json');
assert(existsSync(join(reportRoot, 'index.html')), 'auto-merge did not write index.html');
console.log(`   shard 2 exit=${s2.status}`);

const shard1 = JSON.parse(
  readFileSync(join(reportRoot, 'shards', '1-of-2', 'report.json'), 'utf-8'),
);
const shard2 = JSON.parse(
  readFileSync(join(reportRoot, 'shards', '2-of-2', 'report.json'), 'utf-8'),
);
const merged = JSON.parse(readFileSync(join(reportRoot, 'report.json'), 'utf-8'));

const expectedTotal = shard1.tests.length + shard2.tests.length;
assert(
  merged.tests.length === expectedTotal,
  `merged tests ${merged.tests.length} !== ${expectedTotal}`,
);
assert(merged.stats.total === expectedTotal, 'stats.total mismatch');

const ids = new Set(merged.tests.map((t) => t.id));
assert(ids.size === merged.tests.length, 'duplicate test ids in merged report');

let missing = 0;
for (const t of merged.tests) {
  for (const attempt of t.attempts || []) {
    for (const att of attempt.attachments || []) {
      if (!existsSync(join(reportRoot, att.path))) missing++;
    }
  }
}
assert(missing === 0, `${missing} attachment path(s) missing after merge`);

const shardDirs = readdirSync(join(reportRoot, 'shards')).filter((n) =>
  /^\d+-of-\d+$/.test(n),
);
assert(shardDirs.length === 2, `expected 2 shard dirs, got ${shardDirs.join(',')}`);

console.log('→ athena merge CLI (artifact-style)');
const arts = join(smoke, '.shard-artifacts');
rmSync(arts, { recursive: true, force: true });
execSync(`mkdir -p "${arts}" && cp -R "${join(reportRoot, 'shards', '1-of-2')}" "${join(arts, 'job-1')}" && cp -R "${join(reportRoot, 'shards', '2-of-2')}" "${join(arts, 'job-2')}"`);
const mergeCli = run('npx', ['athena', 'merge', arts]);
assert(mergeCli.status === 0, `athena merge failed: ${mergeCli.stderr || mergeCli.stdout}`);
const cliMerged = JSON.parse(
  readFileSync(join(arts, 'merged-athena-report', 'report.json'), 'utf-8'),
);
assert(cliMerged.tests.length === expectedTotal, 'CLI merge test count mismatch');

rmSync(arts, { recursive: true, force: true });

console.log(`OK — merged ${expectedTotal} tests from 2 shards (auto + CLI)`);
