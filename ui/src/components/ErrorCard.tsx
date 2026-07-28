import { useState } from 'react';
import {
  buildFixPrompt,
  chatGptUrl,
  claudeUrl,
  copyText,
  cursorDeeplink,
  truncateForUrl,
} from '../lib/prompt';
import { findFailedStep, primaryError } from '../lib/tests';
import type { AthenaAttempt, AthenaTest } from '../types';

type Target = 'copy' | 'cursor' | 'chatgpt' | 'claude';

export function ErrorCard({
  test,
  attempt,
  onToast,
}: {
  test: AthenaTest;
  attempt: AthenaAttempt;
  onToast: (message: string) => void;
}) {
  const [showSource, setShowSource] = useState(true);
  const error = primaryError(attempt);
  const failedStep = findFailedStep(attempt.steps);

  if (!error && attempt.status === 'passed') return null;

  const prompt = buildFixPrompt(test, attempt);

  async function send(target: Target) {
    if (target === 'copy') {
      const ok = await copyText(prompt);
      onToast(ok ? 'Fix prompt copied' : 'Clipboard blocked by browser');
      return;
    }

    const { urlPrompt, truncated } = truncateForUrl(prompt);
    if (truncated || target === 'cursor') await copyText(prompt);

    if (target === 'cursor') {
      window.location.href = cursorDeeplink(urlPrompt);
      onToast('Opening Cursor — prompt also copied');
      return;
    }

    const url = target === 'chatgpt' ? chatGptUrl(urlPrompt) : claudeUrl(urlPrompt);
    window.open(url, '_blank', 'noopener,noreferrer');
    onToast(truncated ? 'Opened — full prompt copied' : 'Opened');
  }

  return (
    <section className="glass card error-card">
      <header className="card-head">
        <h2>Error</h2>
        {failedStep ? <span className="failed-step">at “{failedStep.title}”</span> : null}
      </header>

      <pre className="error-text">
        {error?.message || `Attempt ${attempt.retry + 1} ${attempt.status}`}
      </pre>

      {error?.snippet ? (
        <div className="source">
          <button type="button" className="source-toggle" onClick={() => setShowSource((v) => !v)}>
            {showSource ? 'Hide source' : 'Show source'}
          </button>
          {showSource ? <pre className="source-code">{error.snippet}</pre> : null}
        </div>
      ) : null}

      <footer className="ai-row">
        <span className="ai-label">Fix</span>
        <button type="button" className="pill pill-solid" onClick={() => send('copy')}>
          Copy prompt
        </button>
        <span className="ai-or">or open in</span>
        <div className="ai-buttons">
          <button type="button" className="pill" onClick={() => send('cursor')}>
            Cursor
          </button>
          <button type="button" className="pill" onClick={() => send('chatgpt')}>
            ChatGPT
          </button>
          <button type="button" className="pill" onClick={() => send('claude')}>
            Claude
          </button>
        </div>
      </footer>
    </section>
  );
}
