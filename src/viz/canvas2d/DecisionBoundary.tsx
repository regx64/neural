import { useEffect, useRef } from 'react';
import { useLab, type LabState } from '@state/store';
import { boundaryRGBA, CSS_COLORS } from '../encoding';
import { isoLines } from '../contour';
import styles from './canvas2d.module.css';

function draw(canvas: HTMLCanvasElement, s: LabState, scratch: { img?: HTMLCanvasElement }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const dpr = W / canvas.clientWidth || 1;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const { boundary, boundaryRes: res } = s.live;
  if (boundary && res > 0) {
    // Probability heatmap, upscaled with bilinear smoothing.
    const img = (scratch.img ??= document.createElement('canvas'));
    img.width = res;
    img.height = res;
    const ictx = img.getContext('2d')!;
    const data = ictx.createImageData(res, res);
    for (let k = 0; k < res * res; k++) boundaryRGBA(boundary[k], data.data, k * 4);
    ictx.putImageData(data, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, W, H);

    // p = 0.5 decision boundary.
    const segs = isoLines(boundary, res, 0.5);
    ctx.strokeStyle = 'rgba(29, 29, 31, 0.5)';
    ctx.lineWidth = 1.25 * dpr;
    ctx.beginPath();
    const sx = W / res;
    const sy = H / res;
    for (let k = 0; k < segs.length; k += 4) {
      ctx.moveTo(segs[k] * sx, segs[k + 1] * sy);
      ctx.lineTo(segs[k + 2] * sx, segs[k + 3] * sy);
    }
    ctx.stroke();
  }

  // Axes through the origin.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  const { dataset } = s;
  const px = (x: number) => ((x + 1) / 2) * W;
  const py = (y: number) => ((1 - y) / 2) * H;
  const r = 3 * dpr;
  const drawPoint = (idx: number, filled: boolean) => {
    const color = dataset.labels[idx] === 1 ? CSS_COLORS.positive : CSS_COLORS.negative;
    ctx.beginPath();
    ctx.arc(px(dataset.points[2 * idx]), py(dataset.points[2 * idx + 1]), r, 0, Math.PI * 2);
    if (filled) {
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = dpr;
      ctx.stroke();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
    }
  };
  for (const idx of dataset.test) drawPoint(idx, false);
  for (const idx of dataset.train) drawPoint(idx, true);

  const pt = s.probe.point;
  if (pt) {
    const x = px(pt[0]);
    const y = py(pt[1]);
    ctx.strokeStyle = 'rgba(29, 29, 31, 0.2)';
    ctx.lineWidth = dpr;
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = CSS_COLORS.ink;
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** 2D data plot with the model's decision boundary. Clicking sets the probe input. */
export function DecisionBoundary({ size }: { size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const scratch = {};
    let raf = 0;
    const request = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        draw(canvas, useLab.getState(), scratch);
      });
    };
    request();
    const unsub = useLab.subscribe((s, p) => {
      if (s.live.boundary !== p.live.boundary || s.dataset !== p.dataset || s.probe !== p.probe) request();
    });
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, [size]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
    useLab.getState().setProbePoint([Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))]);
  };

  return (
    <canvas
      ref={ref}
      className={styles.boundary}
      style={{ width: size, height: size }}
      onClick={onClick}
      aria-label="데이터와 결정 경계. 클릭하면 해당 좌표를 네트워크에 입력합니다."
      data-testid="boundary-canvas"
    />
  );
}
