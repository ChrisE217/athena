import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AthenaSettings } from '../lib/settings';

function CogIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.4 1.4h3.2l.35 1.55a4.9 4.9 0 0 1 1.2.7l1.5-.55 1.6 2.75-1.15 1.1c.08.4.12.8.12 1.2s-.04.8-.12 1.2l1.15 1.1-1.6 2.75-1.5-.55a4.9 4.9 0 0 1-1.2.7L9.6 14.6H6.4l-.35-1.55a4.9 4.9 0 0 1-1.2-.7l-1.5.55L1.75 9.15l1.15-1.1A4.6 4.6 0 0 1 2.8 6.85c0-.4.04-.8.12-1.2l-1.15-1.1 1.6-2.75 1.5.55c.37-.28.77-.52 1.2-.7L6.4 1.4Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function SettingsMenu({
  settings,
  onChange,
}: {
  settings: AthenaSettings;
  onChange: (next: AthenaSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      setPos({
        top: rect.bottom + 10,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle<K extends keyof AthenaSettings>(key: K) {
    onChange({ ...settings, [key]: !settings[key] });
  }

  return (
    <div className="settings">
      <button
        ref={buttonRef}
        type="button"
        className="settings-cog"
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="menu"
        data-open={open}
        onClick={() => setOpen((v) => !v)}
      >
        <CogIcon />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="settings-menu glass"
              role="menu"
              style={{ top: pos.top, right: pos.right }}
            >
              <button
                type="button"
                className="settings-item"
                role="menuitemcheckbox"
                aria-checked={settings.rawFileNames}
                onClick={() => toggle('rawFileNames')}
              >
                <span className="settings-check" data-on={settings.rawFileNames} />
                <span>Raw file names</span>
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
