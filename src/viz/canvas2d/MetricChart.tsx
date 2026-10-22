import { useEffect, useRef } from 'react';
import { useLab } from '@state/store';
import type { SnapshotMeta } from '@core/timeline';
import type { History } from '@state/history';
import type { Pinned } from '@state/store';
import styles from './canvas2d.module.css';

export type ChartKind = 'loss' | 'accuracy';

const TRAIN = '#1d1d1f';
const TEST = '#86868b';
const PAD = { left: 34, right: 4, top: 6, bottom: 16 };

function niceEpochTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  return ticks;
}

/** Horizontal mapping shared by drawing and scrubbing. */
function epochRange(h: History, pinned?: Pinned | null): [number, number] {
  const n = h.epochs.length;
  const pinnedLast = pinned?.history.epochs.at(-1) ?? 0;
  return [0, Math.max(10, n ? h.epochs[n - 1] : 0, pinnedLast)];
}

function draw(
  canvas: HTMLCanvasElement,
  h: History,
  kind: ChartKind,
  log: boolean,
  timeline: SnapshotMeta[],
  previewEpoch: number | null,
  pinned: Pinned | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = canvas.width / Math.max(1, canvas.clientWidth);
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  if (plotW <= 0 || plotH <= 0) return;

  const series = kind === 'loss' ? [h.trainLoss, h.testLoss] : [h.trainAccuracy, h.testAccuracy];
  const n = h.epochs.length;
  const [minEpoch, maxEpoch] = epochRange(h, pinned);

  let lo = 0;
  let hi = 1;
  if (kind === 'loss') {
    const pinnedVals = pinned ? pinned.history.trainLoss : [];
    const vals = [...series.flat(), ...pinnedVals].filter((v) => Number.isFinite(v) && v > 0);
    const max = vals.length ? Math.max(...vals) : 1;
    const min = vals.length ? Math.min(...vals) : 0.001;
    if (log) {
      lo = Math.log10(Math.max(1e-6, min * 0.8));
      hi = Math.log10(Math.max(max * 1.2, 10 ** (lo + 1)));
    } else {
      hi = Math.max(0.1, max * 1.1);
    }
  }
  const yOf = (v: number) => {
    const t = kind === 'loss' && log ? Math.log10(Math.max(1e-6, v)) : v;
    return PAD.top + (1 - (t - lo) / (hi - lo)) * plotH;
  };
  const xOf = (e: number) => PAD.left + ((e - minEpoch) / (maxEpoch - minEpoch)) * plotW;

  // Grid and labels.
  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
  ctx.fillStyle = '#707075';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const yTicks =
    kind === 'accuracy'
      ? [0, 0.5, 1]
      : log
        ? Array.from({ length: Math.floor(hi) - Math.ceil(lo) + 1 }, (_, k) => 10 ** (Math.ceil(lo) + k))
        : [0, hi / 2, hi];
  for (const t of yTicks) {
    const y = yOf(t);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(W - PAD.right, y);
    ctx.stroke();
    const label =
      kind === 'accuracy' ? `${Math.round(t * 100)}%` : t >= 0.01 ? t.toFixed(2) : t.toExponential(0);
    ctx.fillText(label, PAD.left - 6, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of niceEpochTicks(maxEpoch)) ctx.fillText(String(t), xOf(t), H - PAD.bottom + 4);

  // The pinned run "A", behind the live curves.
  if (pinned) {
    const values = kind === 'loss' ? pinned.history.trainLoss : pinned.history.trainAccuracy;
    ctx.strokeStyle = 'rgba(0, 102, 204, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    let started = false;
    pinned.history.epochs.forEach((ep, k) => {
      const v = values[k];
      if (!Number.isFinite(v)) return;
      if (started) ctx.lineTo(xOf(ep), yOf(v));
      else {
        ctx.moveTo(xOf(ep), yOf(v));
        started = true;
      }
    });
    ctx.stroke();
  }

  // Series.
  series.forEach((values, s) => {
    ctx.strokeStyle = s === 0 ? TRAIN : TEST;
    ctx.lineWidth = s === 0 ? 1.75 : 1.25;
    ctx.setLineDash(s === 0 ? [] : [3, 3]);
    ctx.beginPath();
    let started = false;
    for (let k = 0; k < n; k++) {
      const v = values[k];
      if (!Number.isFinite(v)) continue;
      const x = xOf(h.epochs[k]);
      const y = yOf(v);
      if (started) ctx.lineTo(x, y);
      else {
        ctx.moveTo(x, y);
        started = true;
      }
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Time Travel: recorded snapshots along the axis, and the one being viewed.
  const axisY = H - PAD.bottom;
  for (const m of timeline) {
    if (m.epoch > maxEpoch) continue;
    ctx.fillStyle = m.event ? '#1d1d1f' : '#c7c7cc';
    ctx.beginPath();
    ctx.arc(xOf(m.epoch), axisY, m.event ? 2.2 : 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (previewEpoch !== null) {
    const x = xOf(previewEpoch);
    ctx.strokeStyle = '#0066cc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, PAD.top);
    ctx.lineTo(x, axisY);
    ctx.stroke();
    ctx.fillStyle = '#0066cc';
    ctx.beginPath();
    ctx.arc(x, axisY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Training/validation curve for loss or accuracy, redrawn as history arrives. */
export function MetricChart({ kind, log = false }: { kind: ChartKind; log?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    const request = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const st = useLab.getState();
        draw(canvas, st.history, kind, log, st.timeline, st.live.preview?.epoch ?? null, st.compareA);
      });
    };
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      request();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const unsub = useLab.subscribe((s, p) => {
      if (s.historyTick !== p.historyTick || s.timeline !== p.timeline || s.compareA !== p.compareA)
        request();
    });
    resize();
    return () => {
      ro.disconnect();
      unsub();
      cancelAnimationFrame(raf);
    };
  }, [kind, log]);

  // Scrubbing: press and drag across the chart to view the nearest recorded snapshot.
  const scrub = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = useLab.getState();
    if (st.timeline.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const [lo, hi] = epochRange(st.history, st.compareA);
    const t = (e.clientX - rect.left - PAD.left) / (rect.width - PAD.left - PAD.right);
    const epoch = lo + Math.max(0, Math.min(1, t)) * (hi - lo);
    let best = st.timeline[0];
    for (const m of st.timeline) if (Math.abs(m.epoch - epoch) < Math.abs(best.epoch - epoch)) best = m;
    if (st.live.preview?.id !== best.id) st.previewSnapshot(best.id);
  };

  return (
    <canvas
      ref={ref}
      className={styles.chart}
      aria-label={
        kind === 'loss' ? '손실 곡선 — 눌러서 과거 시점 보기' : '정확도 곡선 — 눌러서 과거 시점 보기'
      }
      data-testid="metric-chart"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        scrub(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons) scrub(e);
      }}
    />
  );
}

export const CHART_COLORS = { train: TRAIN, test: TEST, pinned: 'rgba(0, 102, 204, 0.45)' };
