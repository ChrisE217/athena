import { formatDuration } from '../lib/format';
import type { AthenaSettings } from '../lib/settings';
import { groupTests, headline, primaryError } from '../lib/tests';
import type { AthenaTest } from '../types';

function failureNote(test: AthenaTest): string {
  const attempt = test.attempts[test.attempts.length - 1];
  if (!attempt) return '';
  return headline(primaryError(attempt));
}

export function TestRow({
  test,
  emphasis,
  onOpen,
}: {
  test: AthenaTest;
  emphasis?: boolean;
  onOpen: (id: string) => void;
}) {
  const note = emphasis ? failureNote(test) : '';

  return (
    <button type="button" className="row" data-emphasis={emphasis} onClick={() => onOpen(test.id)}>
      <span className={`tick ${test.outcome}`} />
      <span className="row-main">
        <span className="row-title">{test.title}</span>
        {note ? <span className="row-note">{note}</span> : null}
      </span>
      <span className="row-meta">
        {test.retries > 0 ? <span className="row-retry">{test.retries + 1}x</span> : null}
        <span className="row-dur">{formatDuration(test.duration)}</span>
      </span>
    </button>
  );
}

export function TestList({
  tests,
  settings,
  onOpen,
}: {
  tests: AthenaTest[];
  settings: AthenaSettings;
  onOpen: (id: string) => void;
}) {
  if (!tests.length) {
    return <p className="muted center">Nothing matches this filter.</p>;
  }

  const groups = groupTests(tests, settings.rawFileNames ? 'file' : 'suite');

  return (
    <div className="groups">
      {groups.map((group) => (
        <section className="group" key={group.label}>
          <header className="group-head">
            <h3 data-mono={settings.rawFileNames}>{group.label}</h3>
            <span>
              {group.tests.length} · {formatDuration(group.duration)}
            </span>
          </header>
          <div className="rows">
            {group.tests.map((test) => (
              <TestRow key={test.id} test={test} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
