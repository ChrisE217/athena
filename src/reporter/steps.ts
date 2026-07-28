import type { TestError, TestStep } from '@playwright/test/reporter';
import type { AthenaError, AthenaStep } from '../types.js';

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

export function normalizeError(error?: TestError): AthenaError | undefined {
  if (!error) return undefined;
  const message = stripAnsi(error.message || error.value || 'Error');
  return {
    message,
    stack: error.stack ? stripAnsi(error.stack) : undefined,
    snippet: error.snippet ? stripAnsi(error.snippet) : undefined,
    value: error.value ? stripAnsi(error.value) : undefined,
    location: error.location
      ? {
          file: error.location.file,
          line: error.location.line,
          column: error.location.column,
        }
      : undefined,
  };
}

export function normalizeSteps(steps: TestStep[]): AthenaStep[] {
  return steps.map((step) => {
    const error = normalizeError(step.error);
    const children = normalizeSteps(step.steps || []);
    const failed = Boolean(error) || children.some((c) => c.failed);
    return {
      title: step.title,
      category: step.category,
      duration: step.duration,
      error,
      failed,
      steps: children,
    };
  });
}
