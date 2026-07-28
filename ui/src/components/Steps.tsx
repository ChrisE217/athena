import { formatDuration } from '../lib/format';
import type { AthenaStep } from '../types';

function StepNode({ step, depth }: { step: AthenaStep; depth: number }) {
  const hidden = !step.failed && depth > 1;
  if (hidden) return null;

  return (
    <li className="step" data-failed={step.failed}>
      <div className="step-line">
        <span className="step-title">{step.title}</span>
        <span className="step-dur">{formatDuration(step.duration)}</span>
      </div>
      {step.steps.length ? (
        <ul className="step-kids">
          {step.steps.map((child, i) => (
            <StepNode key={`${child.title}-${i}`} step={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function Steps({ steps }: { steps: AthenaStep[] }) {
  if (!steps.length) return <p className="muted">No steps recorded.</p>;

  return (
    <ul className="steps">
      {steps.map((step, i) => (
        <StepNode key={`${step.title}-${i}`} step={step} depth={0} />
      ))}
    </ul>
  );
}
