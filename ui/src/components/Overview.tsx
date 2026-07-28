import { formatDuration, formatPercent } from '../lib/format';
import type { AthenaSettings } from '../lib/settings';
import type { StatusGroup } from '../lib/tests';
import type { AthenaReport, AthenaTest } from '../types';
import { HeatStrip } from './HeatStrip';
import { TestList, TestRow } from './TestList';

export function Overview({
  report,
  failures,
  visible,
  filter,
  query,
  settings,
  onFilter,
  onQuery,
  onOpen,
}: {
  report: AthenaReport;
  failures: AthenaTest[];
  visible: AthenaTest[];
  filter: StatusGroup;
  query: string;
  settings: AthenaSettings;
  onFilter: (next: StatusGroup) => void;
  onQuery: (next: string) => void;
  onOpen: (id: string) => void;
}) {
  const { stats } = report;
  const failedCount = stats.failed + stats.timedOut + stats.interrupted;
  const slowest = [...report.tests].sort((a, b) => b.duration - a.duration).slice(0, 8);
  const slowestMax = slowest[0]?.duration || 1;

  return (
    <div className="stage">
      <section className="glass card hero">
        <div className="hero-rate">
          <span className="hero-value">{formatPercent(stats.passRate)}</span>
          <span className="hero-label">pass rate</span>
          <div className="meter">
            <div className="meter-fill" style={{ width: `${Math.min(100, stats.passRate)}%` }} />
          </div>
          <span className="hero-run">
            {stats.total} tests · {formatDuration(stats.duration)} ·{' '}
            {new Date(report.generatedAt).toLocaleString()}
          </span>
        </div>

        <div className="chips">
          <button
            type="button"
            className="chip failed"
            data-active={filter === 'failed'}
            onClick={() => onFilter('failed')}
          >
            <span className="chip-value">{failedCount}</span>
            <span className="chip-label">failed</span>
          </button>
          <button
            type="button"
            className="chip flaky"
            data-active={filter === 'flaky'}
            onClick={() => onFilter('flaky')}
          >
            <span className="chip-value">{stats.flaky}</span>
            <span className="chip-label">flaky</span>
          </button>
          <button
            type="button"
            className="chip passed"
            data-active={filter === 'passed'}
            onClick={() => onFilter('passed')}
          >
            <span className="chip-value">{stats.passed}</span>
            <span className="chip-label">passed</span>
          </button>
          <button
            type="button"
            className="chip skipped"
            data-active={filter === 'skipped'}
            onClick={() => onFilter('skipped')}
          >
            <span className="chip-value">{stats.skipped}</span>
            <span className="chip-label">skipped</span>
          </button>
        </div>

        <HeatStrip tests={report.tests} onSelect={onOpen} />
      </section>

      {failures.length && filter !== 'passed' && filter !== 'skipped' && filter !== 'flaky' ? (
        <section className="glass card alert-card">
          <header className="card-head">
            <h2>Failed</h2>
            <span className="muted-inline">{failures.length}</span>
          </header>
          <div className="rows">
            {failures.map((test) => (
              <TestRow key={test.id} test={test} emphasis onOpen={onOpen} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="glass card">
        <header className="card-head list-head">
          <h2>{filter === 'all' ? 'All tests' : filter}</h2>
          <div className="list-tools">
            {filter !== 'all' ? (
              <button type="button" className="pill pill-sm" onClick={() => onFilter('all')}>
                Clear filter
              </button>
            ) : null}
            <input
              className="search"
              value={query}
              placeholder="Search tests"
              onChange={(e) => onQuery(e.target.value)}
            />
          </div>
        </header>
        <TestList tests={visible} settings={settings} onOpen={onOpen} />
      </section>

      <section className="glass card">
        <header className="card-head">
          <h2>Performance</h2>
          <span className="muted-inline">
            slowest {slowest.length} of {stats.total} · {formatDuration(stats.duration)} total
          </span>
        </header>
        <div className="slow-list">
          {slowest.map((test) => (
            <button key={test.id} type="button" className="slow-row" onClick={() => onOpen(test.id)}>
              <span className="slow-title">{test.title}</span>
              <span className="slow-dur">{formatDuration(test.duration)}</span>
              <span className="slow-bar">
                <i style={{ width: `${(test.duration / slowestMax) * 100}%` }} />
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
