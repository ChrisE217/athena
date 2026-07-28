import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type {
  AttemptStatus,
  AthenaReport,
  AthenaSuiteNode,
  AthenaTest,
  TestOutcome,
} from '../src/types.js';

function attemptStatusFor(outcome: TestOutcome): AttemptStatus {
  if (outcome === 'flaky') return 'passed';
  if (outcome === 'timedOut') return 'timedOut';
  if (outcome === 'interrupted') return 'interrupted';
  if (outcome === 'skipped') return 'skipped';
  if (outcome === 'failed') return 'failed';
  return 'passed';
}

export function makeTest(
  partial: Partial<AthenaTest> & Pick<AthenaTest, 'id' | 'outcome'>,
): AthenaTest {
  const {
    id,
    outcome,
    title = id,
    titlePath = [title],
    file = 'tests/a.spec.ts',
    line = 1,
    column = 1,
    projectName = 'chromium',
    duration = 10,
    retries = 0,
    tags = [],
    annotations = [],
    attempts = [
      {
        retry: 0,
        status: attemptStatusFor(outcome),
        duration,
        startTime: '2026-07-28T12:00:00.000Z',
        errors: [],
        steps: [],
        attachments: [],
      },
    ],
  } = partial;

  return {
    id,
    outcome,
    title,
    titlePath,
    file,
    line,
    column,
    projectName,
    duration,
    retries,
    tags,
    annotations,
    attempts,
  };
}

export function makeSuite(
  partial: Partial<AthenaSuiteNode> & Pick<AthenaSuiteNode, 'id' | 'title'>,
): AthenaSuiteNode {
  const tests = partial.tests ?? [];
  const suites = partial.suites ?? [];
  const counts = {
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    timedOut: 0,
    interrupted: 0,
  };
  for (const t of tests) counts[t.outcome]++;
  for (const s of suites) {
    for (const key of Object.keys(counts) as TestOutcome[]) {
      counts[key] += s.counts[key];
    }
  }
  return {
    id: partial.id,
    title: partial.title,
    file: partial.file,
    duration: partial.duration ?? tests.reduce((n, t) => n + t.duration, 0),
    counts: partial.counts ?? counts,
    suites,
    tests,
  };
}

export function makeReport(
  partial: Partial<AthenaReport> & Pick<AthenaReport, 'tests'>,
): AthenaReport {
  const tests = partial.tests;
  const stats = {
    total: tests.length,
    passed: tests.filter((t) => t.outcome === 'passed').length,
    failed: tests.filter((t) => t.outcome === 'failed').length,
    flaky: tests.filter((t) => t.outcome === 'flaky').length,
    skipped: tests.filter((t) => t.outcome === 'skipped').length,
    timedOut: tests.filter((t) => t.outcome === 'timedOut').length,
    interrupted: tests.filter((t) => t.outcome === 'interrupted').length,
    passRate: 0,
    duration: partial.duration ?? 1000,
  };
  const considered = stats.total - stats.skipped;
  stats.passRate =
    considered > 0 ? ((stats.passed + stats.flaky) / considered) * 100 : 100;

  return {
    version: 1,
    title: partial.title ?? 'Athena',
    generatedAt: partial.generatedAt ?? '2026-07-28T12:00:01.000Z',
    startTime: partial.startTime ?? '2026-07-28T12:00:00.000Z',
    duration: partial.duration ?? 1000,
    status: partial.status ?? (stats.failed || stats.timedOut ? 'failed' : 'passed'),
    stats: partial.stats ?? stats,
    config: partial.config ?? {
      rootDir: '/repo',
      projects: ['chromium'],
      workers: 2,
    },
    suites: partial.suites ?? [],
    tests,
  };
}

export function tempDir(prefix = 'athena-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function writeMiniReport(
  dir: string,
  report: AthenaReport,
  files: Record<string, string> = {},
): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
}

export function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
