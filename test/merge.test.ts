import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import {
  allShardsPresent,
  expectedShardCount,
  listShardReportDirs,
  mergeAthenaReports,
  mergeReportDirectories,
  mergeShardsIntoOutput,
  resolveMergeInputs,
  shardDirName,
  shardReportDir,
  tryAutoMergeShards,
  writeShardMeta,
} from '../src/reporter/merge.js';
import {
  cleanup,
  makeReport,
  makeSuite,
  makeTest,
  tempDir,
  writeMiniReport,
} from './helpers.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) {
    const d = dirs.pop();
    if (d) cleanup(d);
  }
});

function scratch(): string {
  const d = tempDir();
  dirs.push(d);
  return d;
}

describe('shard paths', () => {
  test('shardDirName / shardReportDir', () => {
    assert.equal(shardDirName({ current: 2, total: 5 }), '2-of-5');
    assert.equal(
      shardReportDir('/tmp/athena-report', { current: 1, total: 3 }),
      join('/tmp/athena-report', 'shards', '1-of-3'),
    );
  });
});

describe('mergeAthenaReports', () => {
  test('merges tests and recomputes stats', () => {
    const a = makeReport({
      startTime: '2026-07-28T12:00:00.000Z',
      duration: 1000,
      status: 'passed',
      tests: [
        makeTest({ id: 't1', outcome: 'passed' }),
        makeTest({ id: 't2', outcome: 'skipped' }),
      ],
      suites: [
        makeSuite({
          id: 'file-a',
          title: 'a.spec.ts',
          file: 'tests/a.spec.ts',
          tests: [
            makeTest({ id: 't1', outcome: 'passed', file: 'tests/a.spec.ts' }),
            makeTest({ id: 't2', outcome: 'skipped', file: 'tests/a.spec.ts' }),
          ],
        }),
      ],
    });
    const b = makeReport({
      startTime: '2026-07-28T12:00:00.500Z',
      duration: 2000,
      status: 'failed',
      config: { rootDir: '/repo', projects: ['firefox'], workers: 1 },
      tests: [
        makeTest({ id: 't3', outcome: 'failed', file: 'tests/b.spec.ts' }),
        makeTest({ id: 't4', outcome: 'flaky', file: 'tests/b.spec.ts' }),
      ],
      suites: [
        makeSuite({
          id: 'file-b',
          title: 'b.spec.ts',
          file: 'tests/b.spec.ts',
          tests: [
            makeTest({ id: 't3', outcome: 'failed', file: 'tests/b.spec.ts' }),
            makeTest({ id: 't4', outcome: 'flaky', file: 'tests/b.spec.ts' }),
          ],
        }),
      ],
    });

    const merged = mergeAthenaReports([a, b], { title: 'Merged' });
    assert.equal(merged.title, 'Merged');
    assert.equal(merged.status, 'failed');
    assert.equal(merged.stats.total, 4);
    assert.equal(merged.stats.passed, 1);
    assert.equal(merged.stats.failed, 1);
    assert.equal(merged.stats.flaky, 1);
    assert.equal(merged.stats.skipped, 1);
    assert.equal(merged.duration, 2500); // 12:00:00 → 12:00:02.5
    assert.deepEqual(merged.config.projects.sort(), ['chromium', 'firefox']);
    assert.equal(merged.suites.length, 2);
  });

  test('duplicate test id keeps worse outcome', () => {
    const a = makeReport({
      tests: [makeTest({ id: 'dup', outcome: 'passed' })],
    });
    const b = makeReport({
      status: 'failed',
      tests: [makeTest({ id: 'dup', outcome: 'failed', duration: 99 })],
    });
    const merged = mergeAthenaReports([a, b]);
    assert.equal(merged.tests.length, 1);
    assert.equal(merged.tests[0].outcome, 'failed');
    assert.equal(merged.tests[0].duration, 99);
  });

  test('merges nested suites by file+title', () => {
    const shared = makeSuite({
      id: 'root',
      title: 'Checkout',
      file: 'tests/checkout.spec.ts',
      tests: [makeTest({ id: 'c1', outcome: 'passed', file: 'tests/checkout.spec.ts' })],
    });
    const a = makeReport({
      tests: shared.tests,
      suites: [shared],
    });
    const b = makeReport({
      tests: [makeTest({ id: 'c2', outcome: 'failed', file: 'tests/checkout.spec.ts' })],
      suites: [
        makeSuite({
          id: 'root',
          title: 'Checkout',
          file: 'tests/checkout.spec.ts',
          tests: [
            makeTest({ id: 'c2', outcome: 'failed', file: 'tests/checkout.spec.ts' }),
          ],
        }),
      ],
    });
    const merged = mergeAthenaReports([a, b]);
    assert.equal(merged.suites.length, 1);
    assert.equal(merged.suites[0].tests.length, 2);
    assert.equal(merged.suites[0].counts.passed, 1);
    assert.equal(merged.suites[0].counts.failed, 1);
  });

  test('rejects empty input', () => {
    assert.throws(() => mergeAthenaReports([]), /No reports to merge/);
  });

  test('single report passthrough with title override', () => {
    const one = makeReport({
      title: 'A',
      tests: [makeTest({ id: 't1', outcome: 'passed' })],
    });
    const merged = mergeAthenaReports([one], { title: 'B' });
    assert.equal(merged.title, 'B');
    assert.equal(merged.tests.length, 1);
  });
});

describe('shard discovery', () => {
  test('listShardReportDirs sorts and ignores incomplete dirs', () => {
    const root = scratch();
    writeMiniReport(
      join(root, 'shards', '2-of-2'),
      makeReport({ tests: [makeTest({ id: 'b', outcome: 'passed' })] }),
    );
    writeMiniReport(
      join(root, 'shards', '1-of-2'),
      makeReport({ tests: [makeTest({ id: 'a', outcome: 'passed' })] }),
    );
    mkdirSync(join(root, 'shards', '3-of-3'), { recursive: true }); // no report.json
    writeFileSync(join(root, 'shards', 'notes.txt'), 'x');

    const listed = listShardReportDirs(root).map((d) => d.split('/').pop());
    assert.deepEqual(listed, ['1-of-2', '2-of-2']);
  });

  test('allShardsPresent uses meta.json total', () => {
    const root = scratch();
    writeShardMeta(root, { current: 1, total: 3 }, 'Athena');
    writeMiniReport(
      join(root, 'shards', '1-of-3'),
      makeReport({ tests: [makeTest({ id: 'a', outcome: 'passed' })] }),
    );
    writeMiniReport(
      join(root, 'shards', '2-of-3'),
      makeReport({ tests: [makeTest({ id: 'b', outcome: 'passed' })] }),
    );
    assert.equal(expectedShardCount(root), 3);
    assert.equal(allShardsPresent(root), false);

    writeMiniReport(
      join(root, 'shards', '3-of-3'),
      makeReport({ tests: [makeTest({ id: 'c', outcome: 'passed' })] }),
    );
    assert.equal(allShardsPresent(root), true);
  });

  test('allShardsPresent false when a middle shard is missing', () => {
    const root = scratch();
    writeShardMeta(root, { current: 1, total: 3 }, 'Athena');
    writeMiniReport(
      join(root, 'shards', '1-of-3'),
      makeReport({ tests: [makeTest({ id: 'a', outcome: 'passed' })] }),
    );
    writeMiniReport(
      join(root, 'shards', '3-of-3'),
      makeReport({ tests: [makeTest({ id: 'c', outcome: 'passed' })] }),
    );
    assert.equal(allShardsPresent(root), false);
  });
});

describe('resolveMergeInputs', () => {
  test('detects shards/ layout', () => {
    const root = scratch();
    writeMiniReport(
      join(root, 'shards', '1-of-2'),
      makeReport({ tests: [makeTest({ id: 'a', outcome: 'passed' })] }),
    );
    const resolved = resolveMergeInputs([root]);
    assert.equal(resolved.mode, 'shards');
    assert.equal(resolved.outputFolder, root);
    assert.equal(resolved.inputDirs.length, 1);
  });

  test('detects artifact child dirs → merged-athena-report', () => {
    const root = scratch();
    writeMiniReport(
      join(root, 'shard-1'),
      makeReport({ tests: [makeTest({ id: 'a', outcome: 'passed' })] }),
    );
    writeMiniReport(
      join(root, 'shard-2'),
      makeReport({ tests: [makeTest({ id: 'b', outcome: 'failed' })] }),
    );
    const resolved = resolveMergeInputs([root]);
    assert.equal(resolved.mode, 'dirs');
    assert.equal(resolved.outputFolder, join(root, 'merged-athena-report'));
    assert.equal(resolved.inputDirs.length, 2);
  });

  test('multiple explicit dirs', () => {
    const a = scratch();
    const b = scratch();
    writeMiniReport(a, makeReport({ tests: [makeTest({ id: 'a', outcome: 'passed' })] }));
    writeMiniReport(b, makeReport({ tests: [makeTest({ id: 'b', outcome: 'passed' })] }));
    const resolved = resolveMergeInputs([a, b]);
    assert.equal(resolved.mode, 'dirs');
    assert.deepEqual(resolved.inputDirs, [a, b]);
  });
});

describe('merge on disk', () => {
  test('mergeReportDirectories copies attachments and writes UI', () => {
    const a = scratch();
    const b = scratch();
    const out = scratch();

    writeMiniReport(
      a,
      makeReport({
        tests: [
          makeTest({
            id: 't1',
            outcome: 'failed',
            attempts: [
              {
                retry: 0,
                status: 'failed',
                duration: 10,
                startTime: '2026-07-28T12:00:00.000Z',
                errors: [],
                steps: [],
                attachments: [
                  {
                    name: 'screenshot',
                    contentType: 'image/png',
                    path: 'data/tests/t1/attempt-0/shot.png',
                    kind: 'screenshot',
                  },
                ],
              },
            ],
          }),
        ],
      }),
      { 'data/tests/t1/attempt-0/shot.png': 'png-a' },
    );
    writeMiniReport(
      b,
      makeReport({
        status: 'passed',
        tests: [
          makeTest({
            id: 't2',
            outcome: 'passed',
            attempts: [
              {
                retry: 0,
                status: 'passed',
                duration: 5,
                startTime: '2026-07-28T12:00:00.000Z',
                errors: [],
                steps: [],
                attachments: [
                  {
                    name: 'trace',
                    contentType: 'application/zip',
                    path: 'data/tests/t2/attempt-0/trace.zip',
                    kind: 'trace',
                  },
                ],
              },
            ],
          }),
        ],
      }),
      { 'data/tests/t2/attempt-0/trace.zip': 'zip-b' },
    );

    const merged = mergeReportDirectories([a, b], out, { title: 'Disk Merge' });
    assert.equal(merged.stats.total, 2);
    assert.equal(merged.title, 'Disk Merge');
    assert.equal(existsSync(join(out, 'report.json')), true);
    assert.equal(existsSync(join(out, 'index.html')), true);
    assert.equal(readFileSync(join(out, 'data/tests/t1/attempt-0/shot.png'), 'utf-8'), 'png-a');
    assert.equal(readFileSync(join(out, 'data/tests/t2/attempt-0/trace.zip'), 'utf-8'), 'zip-b');
  });

  test('mergeShardsIntoOutput requires all shards unless allowPartial', () => {
    const root = scratch();
    writeShardMeta(root, { current: 1, total: 2 }, 'Athena');
    writeMiniReport(
      join(root, 'shards', '1-of-2'),
      makeReport({ tests: [makeTest({ id: 'a', outcome: 'passed' })] }),
    );

    assert.throws(() => mergeShardsIntoOutput(root), /Expected 2 shard reports/);

    const partial = mergeShardsIntoOutput(root, { allowPartial: true });
    assert.equal(partial.stats.total, 1);
    assert.equal(existsSync(join(root, 'report.json')), true);
  });

  test('tryAutoMergeShards merges only when complete', () => {
    const root = scratch();
    writeShardMeta(root, { current: 1, total: 2 }, 'Athena');
    writeMiniReport(
      join(root, 'shards', '1-of-2'),
      makeReport({ tests: [makeTest({ id: 'a', outcome: 'passed' })] }),
    );
    assert.equal(tryAutoMergeShards(root, { total: 2 }), null);

    writeMiniReport(
      join(root, 'shards', '2-of-2'),
      makeReport({
        status: 'failed',
        tests: [makeTest({ id: 'b', outcome: 'failed' })],
      }),
    );
    const merged = tryAutoMergeShards(root, { total: 2, title: 'Auto' });
    assert.ok(merged);
    assert.equal(merged!.stats.total, 2);
    assert.equal(merged!.status, 'failed');
    assert.equal(merged!.title, 'Auto');
    assert.equal(existsSync(join(root, 'index.html')), true);
  });
});
