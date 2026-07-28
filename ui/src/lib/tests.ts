import type { AthenaAttempt, AthenaError, AthenaStep, AthenaSuiteNode, AthenaTest, TestOutcome } from '../types';

export type StatusGroup = 'all' | 'failed' | 'flaky' | 'passed' | 'skipped';

export const FAILING: TestOutcome[] = ['failed', 'timedOut', 'interrupted'];

export const GROUP_OUTCOMES: Record<StatusGroup, TestOutcome[]> = {
  all: ['failed', 'timedOut', 'interrupted', 'flaky', 'passed', 'skipped'],
  failed: FAILING,
  flaky: ['flaky'],
  passed: ['passed'],
  skipped: ['skipped'],
};

export function isFailing(test: AthenaTest): boolean {
  return FAILING.includes(test.outcome);
}

export function collectTests(suites: AthenaSuiteNode[]): AthenaTest[] {
  const out: AthenaTest[] = [];
  const walk = (nodes: AthenaSuiteNode[]) => {
    for (const node of nodes) {
      out.push(...node.tests);
      walk(node.suites);
    }
  };
  walk(suites);
  return out;
}

export function matchesQuery(test: AthenaTest, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${test.titlePath.join(' ')} ${test.file} ${test.projectName}`.toLowerCase().includes(q);
}

export function findFailedStep(steps: AthenaStep[]): AthenaStep | undefined {
  for (const step of steps) {
    if (step.failed) return findFailedStep(step.steps) ?? step;
    const nested = findFailedStep(step.steps);
    if (nested) return nested;
  }
  return undefined;
}

export function primaryError(attempt: AthenaAttempt): AthenaError | undefined {
  return attempt.errors[0] ?? findFailedStep(attempt.steps)?.error;
}

export function headline(error?: AthenaError): string {
  if (!error) return '';
  return error.message.split('\n')[0].trim();
}

export interface TestGroup {
  label: string;
  tests: AthenaTest[];
  duration: number;
}

/** Playwright titlePath → suite label (describe blocks), not file / project / test title. */
export function suiteLabel(test: AthenaTest): string {
  const parts = [...test.titlePath];
  if (parts.at(-1) === test.title) parts.pop();
  if (test.projectName && parts[0] === test.projectName) parts.shift();

  const fileBase = test.file.split(/[\\/]/).pop() || test.file;
  if (
    parts[0] === test.file ||
    parts[0] === fileBase ||
    parts[0]?.endsWith(fileBase)
  ) {
    parts.shift();
  }

  return parts.join(' › ') || fileBase;
}

export function groupTests(
  tests: AthenaTest[],
  mode: 'suite' | 'file',
): TestGroup[] {
  const map = new Map<string, AthenaTest[]>();
  for (const test of tests) {
    const key = mode === 'file' ? test.file : suiteLabel(test);
    const list = map.get(key);
    if (list) list.push(test);
    else map.set(key, [test]);
  }
  return [...map.entries()]
    .map(([label, list]) => ({
      label,
      tests: list,
      duration: list.reduce((sum, t) => sum + t.duration, 0),
    }))
    .sort((a, b) => {
      const aFail = a.tests.filter(isFailing).length;
      const bFail = b.tests.filter(isFailing).length;
      if (aFail !== bFail) return bFail - aFail;
      return b.duration - a.duration;
    });
}

export function describeOutcome(outcome: TestOutcome): string {
  if (outcome === 'timedOut') return 'timed out';
  return outcome;
}
