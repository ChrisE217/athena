import type { FullConfig, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import type {
  AthenaAttempt,
  AthenaReport,
  AthenaStats,
  AthenaSuiteNode,
  AthenaTest,
  TestOutcome,
} from '../types.js';
import { copyAttachments } from './attachments.js';
import { normalizeError, normalizeSteps } from './steps.js';

export interface CollectedAttempt {
  test: TestCase;
  result: TestResult;
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

function mapOutcome(test: TestCase): TestOutcome {
  const outcome = test.outcome();
  if (outcome === 'expected') return 'passed';
  if (outcome === 'unexpected') {
    const last = test.results[test.results.length - 1];
    if (last?.status === 'timedOut') return 'timedOut';
    if (last?.status === 'interrupted') return 'interrupted';
    return 'failed';
  }
  if (outcome === 'flaky') return 'flaky';
  return 'skipped';
}

function relativeFile(config: FullConfig, file: string): string {
  const root = config.rootDir.replace(/\\/g, '/');
  const normalized = file.replace(/\\/g, '/');
  if (normalized.startsWith(root)) {
    return normalized.slice(root.length).replace(/^\//, '');
  }
  return normalized;
}

function buildAttempt(
  result: TestResult,
  destRoot: string,
  testId: string,
): AthenaAttempt {
  const relativeBase = `data/tests/${testId}/attempt-${result.retry}`;
  const destDir = `${destRoot}/${relativeBase}`;
  const attachments = copyAttachments(result, destDir, relativeBase);

  return {
    retry: result.retry,
    status: result.status,
    duration: result.duration,
    startTime: result.startTime.toISOString(),
    errors: (result.errors || []).map((e) => normalizeError(e)!).filter(Boolean),
    steps: normalizeSteps(result.steps || []),
    attachments,
    stdout: result.stdout?.map(String).join('') || undefined,
    stderr: result.stderr?.map(String).join('') || undefined,
  };
}

function buildTest(test: TestCase, config: FullConfig, destRoot: string): AthenaTest {
  const id = test.id;
  const attempts = test.results.map((result) => buildAttempt(result, destRoot, id));
  const outcome = mapOutcome(test);
  const duration = attempts.reduce((sum, a) => sum + a.duration, 0);

  return {
    id,
    title: test.title,
    titlePath: test.titlePath().filter(Boolean),
    file: relativeFile(config, test.location.file),
    line: test.location.line,
    column: test.location.column,
    projectName: test.parent.project()?.name || '',
    outcome,
    duration,
    retries: Math.max(0, attempts.length - 1),
    tags: [...(test.tags || [])],
    annotations: (test.annotations || []).map((a) => ({
      type: a.type,
      description: a.description,
    })),
    attempts,
  };
}

function buildSuiteNode(
  suite: Suite,
  config: FullConfig,
  destRoot: string,
  testsOut: AthenaTest[],
): AthenaSuiteNode {
  const childSuites = suite.suites.map((s) => buildSuiteNode(s, config, destRoot, testsOut));
  const tests = suite.tests.map((t) => {
    const built = buildTest(t, config, destRoot);
    testsOut.push(built);
    return built;
  });

  const counts = emptyCounts();
  for (const t of tests) counts[t.outcome]++;
  for (const s of childSuites) {
    for (const key of Object.keys(counts) as TestOutcome[]) {
      counts[key] += s.counts[key];
    }
  }

  const duration =
    tests.reduce((sum, t) => sum + t.duration, 0) +
    childSuites.reduce((sum, s) => sum + s.duration, 0);

  return {
    id: suite.title || suite.location?.file || 'root',
    title: suite.title || (suite.location ? relativeFile(config, suite.location.file) : 'Root'),
    file: suite.location ? relativeFile(config, suite.location.file) : undefined,
    duration,
    counts,
    suites: childSuites,
    tests,
  };
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

export function buildReport(options: {
  config: FullConfig;
  rootSuite: Suite;
  status: AthenaReport['status'];
  startTime: Date;
  duration: number;
  destRoot: string;
  title: string;
}): AthenaReport {
  const tests: AthenaTest[] = [];
  const suites = options.rootSuite.suites.map((s) =>
    buildSuiteNode(s, options.config, options.destRoot, tests),
  );

  // Also include tests hanging directly on root (rare)
  for (const t of options.rootSuite.tests) {
    tests.push(buildTest(t, options.config, options.destRoot));
  }

  return {
    version: 1,
    title: options.title,
    generatedAt: new Date().toISOString(),
    startTime: options.startTime.toISOString(),
    duration: options.duration,
    status: options.status,
    stats: computeStats(tests, options.duration),
    config: {
      rootDir: options.config.rootDir,
      projects: options.config.projects.map((p) => p.name).filter(Boolean),
      workers: options.config.workers,
    },
    suites,
    tests,
  };
}
