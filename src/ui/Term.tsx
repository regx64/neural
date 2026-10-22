import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY, type GlossaryId } from '../content/glossary';
import styles from './Term.module.css';

const WIDTH = 260;

/**
 * A term with a dotted underline that explains itself in plain language on hover or focus.
 * The popover is portalled so scrolling panels never clip it.
 */
export function Term({ id, children }: { id: GlossaryId; children?: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const entry = GLOSSARY[id];
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(window.innerWidth - WIDTH - 12, Math.max(12, r.left + r.width / 2 - WIDTH / 2));
    const above = r.bottom + 140 > window.innerHeight;
    setPos({ x, y: above ? r.top - 8 : r.bottom + 8, above });
  };
  const hide = () => setPos(null);
  return (
    <span
      ref={ref}
      className={styles.term}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={pos ? `term-${id}` : undefined}
    >
      {children ?? entry.term}
      {pos &&
        createPortal(
          <span
            id={`term-${id}`}
            role="tooltip"
            className={styles.pop}
            style={{
              left: pos.x,
              top: pos.y,
              width: WIDTH,
              transform: pos.above ? 'translateY(-100%)' : undefined,
            }}
          >
            <b>{entry.term}</b>
            {entry.text}
          </span>,
          document.body,
        )}
    </span>
  );
}
