import type { AthenaTest } from '../types';
import { describeOutcome } from '../lib/tests';

export function HeatStrip({
  tests,
  onSelect,
}: {
  tests: AthenaTest[];
  onSelect: (id: string) => void;
}) {
  if (!tests.length) return null;

  return (
    <div className="heat-strip" role="list" aria-label="Test outcomes">
      {tests.map((test) => (
        <button
          key={test.id}
          type="button"
          role="listitem"
          className={`heat-tick ${test.outcome}`}
          title={`${test.title} — ${describeOutcome(test.outcome)}`}
          onClick={() => onSelect(test.id)}
        />
      ))}
    </div>
  );
}
