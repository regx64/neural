import { useEffect, useReducer, useRef, useState } from 'react';
import { useLab } from '@state/store';

/**
 * Re-renders the calling component when new training state arrives, at most `hz` times per
 * second. For readouts that would be wasteful to re-render at the full 30 Hz.
 */
export function useLiveTick(hz = 10): number {
  const [n, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    let pending = false;
    let last = 0;
    let raf = 0;
    const unsub = useLab.subscribe((s, p) => {
      if (s.live.tick !== p.live.tick || s.probe !== p.probe) pending = true;
    });
    const loop = (t: number) => {
      if (pending && t - last >= 1000 / hz) {
        pending = false;
        last = t;
        force();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, [hz]);
  return n;
}

/** CSS size of an element, tracked with ResizeObserver. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}
