import { useEffect, useRef } from 'react';
import { predictGrid } from '@core/nn/grid';
import { weightIndex } from '@core/nn/model';
import { DEFAULT_CONFIG, type ExperimentConfig } from '@core/train/config';
import { Trainer } from '@core/train/trainer';
import { boundaryRGBA, CSS_COLORS } from '@viz/encoding';
import { computeLayout } from '@viz/layout';
import styles from './Landing.module.css';

const CONFIG: ExperimentConfig = {
  ...DEFAULT_CONFIG,
  dataset: { id: 'circle', samples: 160, noise: 0.05, trainRatio: 0.9 },
  network: { features: ['x1', 'x2'], hidden: [5, 4], activation: 'tanh' },
  hyper: { ...DEFAULT_CONFIG.hyper, learningRate: 0.01 },
};
const RES = 48;
const HOLD_MS = 2500;

/**
 * A real network learning the Circle dataset on the landing page (no pre-rendered animation):
 * the boundary and the edge colours are drawn from the live parameters every frame.
 */
export function HeroDemo() {
  const plotRef = useRef<HTMLCanvasElement>(null);
  const netRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const plot = plotRef.current!;
    const net = netRef.current!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seed = 1;
    let trainer = new Trainer({ ...CONFIG, seed });
    let doneAt = 0;
    let raf = 0;
    const img = document.createElement('canvas');
    img.width = RES;
    img.height = RES;
    const layout = computeLayout(trainer.model.sizes);

    const drawPlot = () => {
      const ctx = plot.getContext('2d')!;
      const W = plot.width;
      const grid = predictGrid(trainer.model, CONFIG.network.features, RES);
      const ictx = img.getContext('2d')!;
      const data = ictx.createImageData(RES, RES);
      for (let k = 0; k < RES * RES; k++) boundaryRGBA(grid[k], data.data, k * 4);
      ictx.putImageData(data, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, W, W);
      const d = trainer.dataset;
      for (let s = 0; s < d.count; s++) {
        ctx.beginPath();
        ctx.arc(
          ((d.points[2 * s] + 1) / 2) * W,
          ((1 - d.points[2 * s + 1]) / 2) * W,
          W / 110,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = d.labels[s] ? CSS_COLORS.positive : CSS_COLORS.negative;
        ctx.fill();
      }
    };

    const drawNet = () => {
      const ctx = net.getContext('2d')!;
      const W = net.width;
      const H = net.height;
      ctx.clearRect(0, 0, W, H);
      const { model } = trainer;
      const sx = (x: number) => W / 2 + (x / (layout.width + 2)) * W;
      const sy = (y: number) => H / 2 - (y / 6) * H;
      const pos = layout.positions;
      let max = 0;
      for (const v of model.params) max = Math.max(max, Math.abs(v));
      ctx.globalCompositeOperation = 'lighter';
      for (const L of model.layers) {
        for (let j = 0; j < L.outSize; j++)
          for (let i = 0; i < L.inSize; i++) {
            const w = model.params[weightIndex(L, j, i)];
            const a = layout.neuronOffsets[L.index - 1] + i;
            const b = layout.neuronOffsets[L.index] + j;
            ctx.strokeStyle = w >= 0 ? CSS_COLORS.positive : CSS_COLORS.negative;
            ctx.globalAlpha = 0.08 + 0.85 * Math.min(1, Math.abs(w) / max);
            ctx.lineWidth = (0.5 + 3 * Math.min(1, Math.abs(w) / max)) * (W / 400);
            ctx.beginPath();
            ctx.moveTo(sx(pos[a * 3]), sy(pos[a * 3 + 1]));
            ctx.lineTo(sx(pos[b * 3]), sy(pos[b * 3 + 1]));
            ctx.stroke();
          }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      for (let g = 0; g < layout.neuronCount; g++) {
        ctx.beginPath();
        ctx.arc(sx(pos[g * 3]), sy(pos[g * 3 + 1]), W / 60, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = W / 400;
        ctx.stroke();
      }
    };

    const frame = (t: number) => {
      if (doneAt === 0) {
        for (let k = 0; k < 2; k++) trainer.trainEpoch();
        if (trainer.epoch > 600 || (trainer.epoch % 20 === 0 && trainer.metrics().trainAccuracy >= 0.99))
          doneAt = t;
      } else if (t - doneAt > HOLD_MS) {
        trainer = new Trainer({ ...CONFIG, seed: ++seed });
        doneAt = 0;
      }
      drawPlot();
      drawNet();
      if (!reduced) raf = requestAnimationFrame(frame);
    };

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [plot, net]) {
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
    }
    if (reduced) {
      for (let k = 0; k < 400; k++) trainer.trainEpoch();
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={styles.demo} aria-label="실시간으로 원형 데이터를 학습하는 신경망">
      <canvas ref={netRef} className={styles.demoNet} />
      <canvas ref={plotRef} className={styles.demoPlot} />
      <div className={styles.demoCaption}>
        <span className={styles.live} /> 지금 이 브라우저에서 실제로 학습 중 · 2–5–4–1 tanh · Adam
      </div>
    </div>
  );
}
