import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShotWindow } from './ShotWindow';

export function Lightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div className="lightbox" role="dialog" aria-label={alt} onClick={onClose}>
      <ShotWindow src={src} title={alt} zoom />
      <span className="lightbox-hint">Click anywhere or press Esc to close</span>
    </div>,
    document.body,
  );
}
