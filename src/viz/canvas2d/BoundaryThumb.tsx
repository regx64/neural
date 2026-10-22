import { useEffect, useRef } from 'react';
import type { Dataset } from '@core/data/datasets';
import { boundaryRGBA, CSS_COLORS } from '../encoding';
import { isoLines } from '../contour';
import styles from './canvas2d.module.css';

/** Small static decision-boundary plot (for comparisons). */
export function BoundaryThumb({
  grid,
  res,
  dataset,
  size,
  label,
}: {
  grid: Float32Array | null;
  res: number;
  dataset: Dataset;
  size: number;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    if (grid && res > 0) {
      const img = document.createElement('canvas');
      img.width = img.height = res;
      const ictx = img.getContext('2d')!;
      const data = ictx.createImageData(res, res);
      for (let k = 0; k < res * res; k++) boundaryRGBA(grid[k], data.data, k * 4);
      ictx.putImageData(data, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, size, size);
      const segs = isoLines(grid, res, 0.5);
      ctx.strokeStyle = 'rgba(29, 29, 31, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < segs.length; k += 4) {
        ctx.moveTo((segs[k] * size) / res, (segs[k + 1] * size) / res);
        ctx.lineTo((segs[k + 2] * size) / res, (segs[k + 3] * size) / res);
      }
      ctx.stroke();
    }
    for (let s = 0; s < dataset.count; s++) {
      ctx.fillStyle = dataset.labels[s] ? CSS_COLORS.positive : CSS_COLORS.negative;
      ctx.beginPath();
      ctx.arc(
        ((dataset.points[2 * s] + 1) / 2) * size,
        ((1 - dataset.points[2 * s + 1]) / 2) * size,
        1.6,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }, [grid, res, dataset, size]);
  return (
    <canvas ref={ref} className={styles.thumb} style={{ width: size, height: size }} aria-label={label} />
  );
}
