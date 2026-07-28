import type { AthenaAttempt, AthenaError, AthenaStep, AthenaTest } from '../types.js';

function findFailedStep(steps: AthenaStep[]): AthenaStep | undefined {
  for (const step of steps) {
    if (step.failed) {
      const nested = findFailedStep(step.steps);
      return nested ?? step;
    }
    const nested = findFailedStep(step.steps);
    if (nested) return nested;
  }
  return undefined;
}

function primaryError(attempt: AthenaAttempt): AthenaError | undefined {
  if (attempt.errors[0]) return attempt.errors[0];
  const failed = findFailedStep(attempt.steps);
  return failed?.error;
}

function hasKind(attempt: AthenaAttempt, kind: AthenaAttachmentKind): boolean {
  return attempt.attachments.some((a) => a.kind === kind);
}

type AthenaAttachmentKind = AthenaAttempt['attachments'][number]['kind'];

function formatLocation(test: AthenaTest, error?: AthenaError): string {
  if (error?.location) {
    const col = error.location.column != null ? `:${error.location.column}` : '';
    return `${error.location.file}:${error.location.line}${col}`;
  }
  return `${test.file}:${test.line}:${test.column}`;
}

export function buildFixPrompt(test: AthenaTest, attempt?: AthenaAttempt): string {
  const att = attempt ?? test.attempts[test.attempts.length - 1];
  if (!att) {
    return `# Role\nYou are a senior Playwright engineer.\n\nNo attempt data available for: ${test.titlePath.join(' › ')}`;
  }

  const error = primaryError(att);
  const failedStep = findFailedStep(att.steps);
  const message = error?.message?.trim() || 'Unknown error';
  const snippet = error?.snippet?.trim();
  const location = formatLocation(test, error);

  const lines = [
    '# Role',
    'You are a senior Playwright engineer. Diagnose this failure and propose the smallest correct fix.',
    '',
    '# Constraints',
    '- Be concise (≤20 lines of prose before code).',
    '- Prefer Playwright best practices (auto-waiting, web-first assertions, no hard waits).',
    '- If the root cause is app/data/env (not the test), say so and stop — do not invent a flaky locator fix.',
    '- One primary fix; mention one alternative only if materially different.',
    '',
    '# Test',
    `- Title: ${test.titlePath.join(' › ')}`,
    `- File: ${location}`,
    `- Project / browser: ${test.projectName || 'default'}`,
    `- Attempt: ${att.retry + 1} / ${test.retries + 1}`,
    `- Duration: ${att.duration}ms`,
    `- Outcome: ${test.outcome}`,
    '',
    '# Failure',
    `- Error: ${message.split('\n')[0]}`,
  ];

  if (failedStep) {
    lines.push(`- Failed step: ${failedStep.title}`);
    if (failedStep.category) lines.push(`- Step category: ${failedStep.category}`);
  }

  const callLog = message.includes('Call log:')
    ? message.slice(message.indexOf('Call log:')).trim()
    : undefined;
  if (callLog) {
    lines.push('', '## Call log', '```', callLog, '```');
  } else if (message.includes('\n')) {
    lines.push('', '## Error details', '```', message, '```');
  }

  if (error?.value) {
    lines.push('', '# Expected vs actual', '```', error.value, '```');
  }

  if (snippet) {
    lines.push('', '# Surrounding source', '```ts', snippet, '```');
  } else if (error?.stack) {
    lines.push('', '# Stack', '```', error.stack.split('\n').slice(0, 12).join('\n'), '```');
  }

  lines.push(
    '',
    '# Artifacts available in report',
    `- screenshot: ${hasKind(att, 'screenshot') ? 'yes' : 'no'}`,
    `- trace: ${hasKind(att, 'trace') ? 'yes' : 'no'}`,
    `- video: ${hasKind(att, 'video') ? 'yes' : 'no'}`,
    '',
    '# Ask',
    '1. Root cause (1–2 sentences)',
    '2. Fix snippet (minimal)',
    '3. How to verify',
  );

  return lines.join('\n');
}
