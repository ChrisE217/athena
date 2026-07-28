import { useEffect, useMemo, useState } from 'react';
import { formatDuration } from '../lib/format';
import { describeOutcome } from '../lib/tests';
import type { AthenaTest } from '../types';
import { ErrorCard } from './ErrorCard';
import { Lightbox } from './Lightbox';
import { ShotWindow } from './ShotWindow';
import { Steps } from './Steps';

async function openTrace(path: string, onToast: (message: string) => void) {
  try {
    const meta = await fetch('./__athena/meta');
    if (meta.ok) {
      const res = await fetch(`./__athena/open-trace?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        onToast('Launching Playwright trace viewer');
        return;
      }
    }
  } catch {
    // static hosting — fall back to download
  }
  onToast(`Run: npx athena trace ${path}`);
  window.open(path, '_blank', 'noopener,noreferrer');
}

export function TestPanel({
  test,
  onBack,
  onToast,
}: {
  test: AthenaTest;
  onBack: () => void;
  onToast: (message: string) => void;
}) {
  const [index, setIndex] = useState(Math.max(0, test.attempts.length - 1));
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setIndex(Math.max(0, test.attempts.length - 1));
    setZoomed(false);
  }, [test.id, test.attempts.length]);

  const attempt = test.attempts[Math.min(index, test.attempts.length - 1)];

  const artifacts = useMemo(() => {
    const find = (kind: string) => attempt?.attachments.find((a) => a.kind === kind);
    return {
      trace: find('trace'),
      screenshot: find('screenshot'),
      video: find('video'),
      snapshot: find('snapshot'),
    };
  }, [attempt]);

  if (!attempt) {
    return (
      <div className="stage">
        <button type="button" className="back" onClick={onBack}>
          Back to run
        </button>
        <p className="muted">No attempts recorded.</p>
      </div>
    );
  }

  const showError = attempt.status !== 'passed' || attempt.errors.length > 0;

  return (
    <div className="stage detail">
      <button type="button" className="back" onClick={onBack}>
        Back to run
      </button>

      <header className="detail-head">
        <span className={`chip-status ${test.outcome}`}>{describeOutcome(test.outcome)}</span>
        <h1>{test.title}</h1>
        <p className="detail-sub">
          {test.titlePath.slice(0, -1).join(' › ') || test.file}
        </p>
        <p className="detail-meta">
          {test.file}:{test.line} · {formatDuration(test.duration)}
          {test.projectName ? ` · ${test.projectName}` : ''}
        </p>
      </header>

      <div className="artifact-row">
        {artifacts.trace ? (
          <button
            type="button"
            className="pill pill-solid pill-lg"
            onClick={() => openTrace(artifacts.trace!.path, onToast)}
          >
            Open trace
          </button>
        ) : null}
        {artifacts.video ? (
          <a className="pill pill-lg" href={artifacts.video.path} target="_blank" rel="noreferrer">
            Video
          </a>
        ) : null}
        {artifacts.snapshot ? (
          <a className="pill pill-lg" href={artifacts.snapshot.path} target="_blank" rel="noreferrer">
            Snapshot
          </a>
        ) : null}
      </div>

      {test.attempts.length > 1 ? (
        <div className="attempts">
          {test.attempts.map((a, i) => (
            <button
              key={a.retry}
              type="button"
              className="pill pill-sm"
              data-active={i === index}
              onClick={() => setIndex(i)}
            >
              Attempt {a.retry + 1} · {a.status}
            </button>
          ))}
        </div>
      ) : null}

      {showError ? <ErrorCard test={test} attempt={attempt} onToast={onToast} /> : null}

      {artifacts.screenshot ? (
        <section className="glass card">
          <header className="card-head">
            <h2>Failure screenshot</h2>
            <span className="muted-inline">click to enlarge</span>
          </header>
          <button type="button" className="shot-zoom" onClick={() => setZoomed(true)}>
            <ShotWindow src={artifacts.screenshot.path} title={`${test.title} — failure`} />
          </button>
        </section>
      ) : null}

      {zoomed && artifacts.screenshot ? (
        <Lightbox
          src={artifacts.screenshot.path}
          alt={`${test.title} — failure`}
          onClose={() => setZoomed(false)}
        />
      ) : null}

      <section className="glass card">
        <header className="card-head">
          <h2>Steps</h2>
          <span className="muted-inline">{formatDuration(attempt.duration)}</span>
        </header>
        <Steps steps={attempt.steps} />
      </section>
    </div>
  );
}
