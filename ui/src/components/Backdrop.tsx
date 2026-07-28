export function Backdrop({ tone }: { tone: 'calm' | 'alert' }) {
  return (
    <div className="backdrop" data-tone={tone} aria-hidden="true">
      <span className="orb orb-a" />
      <span className="orb orb-b" />
      <span className="orb orb-c" />
      <span className="grain" />
    </div>
  );
}
