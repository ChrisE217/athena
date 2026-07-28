import {
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  closeSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type {
  AthenaReport,
  AthenaStats,
  AthenaSuiteNode,
  AthenaTest,
  TestOutcome,
} from '../types.js';
import { writeReportFolder } from './writeReport.js';

const OUTCOME_RANK: Record<TestOutcome, number> = {
  failed: 5,
  timedOut: 4,
  interrupted: 3,
  flaky: 2,
  passed: 1,
  skipped: 0,
};

const STATUS_RANK: Record<AthenaReport['status'], number> = {
  failed: 3,
  timedout: 2,
  interrupted: 1,
  passed: 0,
};

export interface ShardInfo {
  current: number;
  total: number;
}

export function shardDirName(shard: ShardInfo): string {
  return `${shard.current}-of-${shard.total}`;
}

export function shardReportDir(outputFolder: string, shard: ShardInfo): string {
  return join(outputFolder, 'shards', shardDirName(shard));
}

export function writeShardMeta(
  outputFolder: string,
  shard: ShardInfo,
  title: string,
): void {
  const shardsRoot = join(outputFolder, 'shards');
  mkdirSync(shardsRoot, { recursive: true });
  writeFileSync(
    join(shardsRoot, 'meta.json'),
    JSON.stringify(
      {
        version: 1,
        total: shard.total,
        title,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf-8',
  );
}

function emptyCounts(): Record<TestOutcome, number> {
  return {
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    timedOut: 0,
    interrupted: 0,
  };
}

function pickWorseTest(a: AthenaTest, b: AthenaTest): AthenaTest {
  return OUTCOME_RANK[a.outcome] >= OUTCOME_RANK[b.outcome] ? a : b;
}

function suiteKey(suite: AthenaSuiteNode): string {
  return `${suite.file ?? ''}::${suite.title}`;
}

function recomputeSuite(suite: AthenaSuiteNode): AthenaSuiteNode {
  const counts = emptyCounts();
  for (const t of suite.tests) counts[t.outcome]++;
  for (const child of suite.suites) {
    for (const key of Object.keys(counts) as TestOutcome[]) {
      counts[key] += child.counts[key];
    }
  }
  const duration =
    suite.tests.reduce((sum, t) => sum + t.duration, 0) +
    suite.suites.reduce((sum, s) => sum + s.duration, 0);
  return { ...suite, counts, duration };
}

function mergeSuiteLists(lists: AthenaSuiteNode[][]): AthenaSuiteNode[] {
  const map = new Map<string, AthenaSuiteNode>();

  for (const list of lists) {
    for (const node of list) {
      const key = suiteKey(node);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          ...node,
          suites: node.suites.map((s) => ({ ...s })),
          tests: [...node.tests],
        });
        continue;
      }

      existing.suites = mergeSuiteLists([existing.suites, node.suites]);
      const byId = new Map(existing.tests.map((t) => [t.id, t]));
      for (const t of node.tests) {
        const prev = byId.get(t.id);
        byId.set(t.id, prev ? pickWorseTest(prev, t) : t);
      }
      existing.tests = [...byId.values()];
    }
  }

  return [...map.values()].map((s) =>
    recomputeSuite({
      ...s,
      suites: s.suites.map((child) => recomputeSuite(child)),
    }),
  );
}

function computeStats(tests: AthenaTest[], duration: number): AthenaStats {
  const stats: AthenaStats = {
    total: tests.length,
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    timedOut: 0,
    interrupted: 0,
    passRate: 0,
    duration,
  };

  for (const t of tests) {
    if (t.outcome === 'passed') stats.passed++;
    else if (t.outcome === 'failed') stats.failed++;
    else if (t.outcome === 'flaky') stats.flaky++;
    else if (t.outcome === 'skipped') stats.skipped++;
    else if (t.outcome === 'timedOut') stats.timedOut++;
    else if (t.outcome === 'interrupted') stats.interrupted++;
  }

  const considered = stats.total - stats.skipped;
  stats.passRate =
    considered > 0 ? ((stats.passed + stats.flaky) / considered) * 100 : 100;

  return stats;
}

function mergeStatus(statuses: AthenaReport['status'][]): AthenaReport['status'] {
  return statuses.reduce((worst, s) =>
    STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst,
  );
}

export function loadReport(reportDir: string): AthenaReport {
  const path = join(reportDir, 'report.json');
  if (!existsSync(path)) {
    throw new Error(`No report.json in ${reportDir}`);
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as AthenaReport;
}

export function listShardReportDirs(outputFolder: string): string[] {
  const shardsRoot = join(outputFolder, 'shards');
  if (!existsSync(shardsRoot)) return [];
  return readdirSync(shardsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d+-of-\d+$/.test(d.name))
    .map((d) => join(shardsRoot, d.name))
    .filter((dir) => existsSync(join(dir, 'report.json')))
    .sort((a, b) => {
      const an = Number(a.match(/(\d+)-of-/)?.[1] || 0);
      const bn = Number(b.match(/(\d+)-of-/)?.[1] || 0);
      return an - bn;
    });
}

export function expectedShardCount(outputFolder: string, fallbackTotal?: number): number | null {
  const metaPath = join(outputFolder, 'shards', 'meta.json');
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as { total?: number };
      if (meta.total && meta.total > 0) return meta.total;
    } catch {
      // ignore
    }
  }
  const dirs = listShardReportDirs(outputFolder);
  if (dirs.length) {
    const total = Number(dirs[0].match(/-of-(\d+)$/)?.[1] || 0);
    if (total > 0) return total;
  }
  return fallbackTotal ?? null;
}

export function allShardsPresent(outputFolder: string, total?: number): boolean {
  const expected = expectedShardCount(outputFolder, total);
  if (!expected) return false;
  const dirs = listShardReportDirs(outputFolder);
  if (dirs.length < expected) return false;
  const have = new Set(
    dirs.map((d) => Number(d.match(/(\d+)-of-/)?.[1] || 0)),
  );
  for (let i = 1; i <= expected; i++) {
    if (!have.has(i)) return false;
  }
  return true;
}

export function mergeAthenaReports(
  reports: AthenaReport[],
  options: { title?: string } = {},
): AthenaReport {
  if (!reports.length) {
    throw new Error('No reports to merge');
  }
  if (reports.length === 1) {
    return {
      ...reports[0],
      title: options.title ?? reports[0].title,
      generatedAt: new Date().toISOString(),
    };
  }

  const testsById = new Map<string, AthenaTest>();
  for (const report of reports) {
    for (const t of report.tests) {
      const prev = testsById.get(t.id);
      testsById.set(t.id, prev ? pickWorseTest(prev, t) : t);
    }
  }
  const tests = [...testsById.values()];

  const suites = mergeSuiteLists(reports.map((r) => r.suites));

  const starts = reports.map((r) => new Date(r.startTime).getTime());
  const ends = reports.map(
    (r) => new Date(r.startTime).getTime() + (r.duration || 0),
  );
  const startMs = Math.min(...starts);
  const endMs = Math.max(...ends);
  const duration = Math.max(0, endMs - startMs);

  const projects = [
    ...new Set(reports.flatMap((r) => r.config.projects || [])),
  ];

  return {
    version: 1,
    title: options.title ?? reports[0].title,
    generatedAt: new Date().toISOString(),
    startTime: new Date(startMs).toISOString(),
    duration,
    status: mergeStatus(reports.map((r) => r.status)),
    stats: computeStats(tests, duration),
    config: {
      rootDir: reports[0].config.rootDir,
      projects,
      workers: reports[0].config.workers,
    },
    suites,
    tests,
  };
}

function copyReportData(fromDir: string, toDir: string): void {
  const dataFrom = join(fromDir, 'data');
  if (!existsSync(dataFrom)) return;
  const dataTo = join(toDir, 'data');
  mkdirSync(dataTo, { recursive: true });
  cpSync(dataFrom, dataTo, { recursive: true });
}

function clearMergedRoot(outputFolder: string): void {
  for (const name of ['report.json', 'index.html', 'favicon.svg', 'vite.svg', 'assets', 'data']) {
    rmSync(join(outputFolder, name), { recursive: true, force: true });
  }
}

export function mergeReportDirectories(
  inputDirs: string[],
  outputFolder: string,
  options: { title?: string } = {},
): AthenaReport {
  const uniqueDirs = [...new Set(inputDirs.map((d) => join(d)))];
  if (!uniqueDirs.length) {
    throw new Error('No report directories to merge');
  }

  const reports = uniqueDirs.map((dir) => loadReport(dir));
  const merged = mergeAthenaReports(reports, options);

  const tmp = join(outputFolder, `.athena-merge-${process.pid}-${Date.now()}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });

  try {
    for (const dir of uniqueDirs) {
      copyReportData(dir, tmp);
    }
    writeReportFolder(tmp, merged);

    mkdirSync(outputFolder, { recursive: true });
    clearMergedRoot(outputFolder);

    for (const name of ['report.json', 'index.html', 'favicon.svg', 'vite.svg']) {
      const from = join(tmp, name);
      if (existsSync(from)) {
        renameSync(from, join(outputFolder, name));
      }
    }
    for (const name of ['assets', 'data']) {
      const from = join(tmp, name);
      if (existsSync(from)) {
        rmSync(join(outputFolder, name), { recursive: true, force: true });
        renameSync(from, join(outputFolder, name));
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  return merged;
}

export function mergeShardsIntoOutput(
  outputFolder: string,
  options: { title?: string; allowPartial?: boolean } = {},
): AthenaReport {
  const dirs = listShardReportDirs(outputFolder);
  if (!dirs.length) {
    throw new Error(`No shard reports found under ${join(outputFolder, 'shards')}`);
  }
  if (!options.allowPartial && !allShardsPresent(outputFolder)) {
    const expected = expectedShardCount(outputFolder);
    throw new Error(
      `Expected ${expected ?? '?'} shard reports, found ${dirs.length}. Pass --allow-partial to merge anyway.`,
    );
  }
  return mergeReportDirectories(dirs, outputFolder, options);
}

/** Attempt merge when every shard report is present. Concurrent-safe via lockfile. */
export function tryAutoMergeShards(
  outputFolder: string,
  options: { title?: string; total?: number } = {},
): AthenaReport | null {
  if (!allShardsPresent(outputFolder, options.total)) return null;

  const lockPath = join(outputFolder, 'shards', '.merge.lock');
  mkdirSync(join(outputFolder, 'shards'), { recursive: true });
  let fd: number;
  try {
    fd = openSync(lockPath, 'wx');
  } catch {
    return null;
  }

  try {
    // Re-check under lock
    if (!allShardsPresent(outputFolder, options.total)) return null;
    if (existsSync(join(outputFolder, 'report.json'))) {
      // Already merged by another shard; refresh if shard set is complete
    }
    return mergeShardsIntoOutput(outputFolder, {
      title: options.title,
      allowPartial: false,
    });
  } finally {
    try {
      closeSync(fd);
    } catch {
      // ignore
    }
    try {
      unlinkSync(lockPath);
    } catch {
      // ignore
    }
  }
}

export function resolveMergeInputs(args: string[]): {
  mode: 'shards' | 'dirs';
  outputFolder: string;
  inputDirs: string[];
} {
  if (!args.length) {
    return {
      mode: 'shards',
      outputFolder: 'athena-report',
      inputDirs: listShardReportDirs('athena-report'),
    };
  }

  if (args.length === 1) {
    const root = args[0];
    const shardDirs = listShardReportDirs(root);
    if (shardDirs.length) {
      return { mode: 'shards', outputFolder: root, inputDirs: shardDirs };
    }

    // Directory of report folders (e.g. downloaded artifacts)
    if (existsSync(root)) {
      const childReports = readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => join(root, d.name))
        .filter((dir) => existsSync(join(dir, 'report.json')));
      if (childReports.length) {
        return {
          mode: 'dirs',
          outputFolder: join(root, 'merged-athena-report'),
          inputDirs: childReports,
        };
      }
    }

    if (existsSync(join(root, 'report.json'))) {
      return { mode: 'dirs', outputFolder: root, inputDirs: [root] };
    }

    throw new Error(`No Athena shard/reports found in ${root}`);
  }

  return {
    mode: 'dirs',
    outputFolder: 'athena-report',
    inputDirs: args,
  };
}
