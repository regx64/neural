import { Rng, deriveSeed } from '../rng';
import type { Samples } from '../nn/model';
import { applyFeatures, type FeatureId } from './features';

export type DatasetId = 'xor' | 'gaussian' | 'circle' | 'moons' | 'spiral' | 'custom';

/** Generated datasets (the user-drawn `custom` one is listed separately in the UI). */
export const DATASETS: { id: Exclude<DatasetId, 'custom'>; label: string }[] = [
  { id: 'xor', label: 'XOR' },
  { id: 'gaussian', label: 'Gaussian' },
  { id: 'circle', label: 'Circle' },
  { id: 'moons', label: 'Moons' },
  { id: 'spiral', label: 'Spiral' },
];

export interface DatasetConfig {
  id: DatasetId;
  /** Total sample count (train + test). */
  samples: number;
  /** 0 … 0.5 — scales the Gaussian jitter added to every point. */
  noise: number;
  /** Fraction of samples used for training, 0.5 … 0.9. */
  trainRatio: number;
  /** `custom` only: user-drawn points as flat [x₁, x₂, …] and their 0/1 labels. */
  points?: number[];
  labels?: number[];
}

/** Raw 2D points in [−1, 1]² with 0/1 labels and a deterministic train/test split. */
export interface Dataset {
  points: Float64Array;
  labels: Uint8Array;
  count: number;
  train: Uint32Array;
  test: Uint32Array;
}

export const DOMAIN = 1;

type Generator = (rng: Rng, n: number, noise: number) => { points: Float64Array; labels: Uint8Array };

const clamp = (v: number) => Math.max(-DOMAIN, Math.min(DOMAIN, v));

const generators: Record<Exclude<DatasetId, 'custom'>, Generator> = {
  xor(rng, n, noise) {
    const points = new Float64Array(n * 2);
    const labels = new Uint8Array(n);
    const pad = 0.06;
    for (let s = 0; s < n; s++) {
      let x = rng.uniform(-1, 1);
      let y = rng.uniform(-1, 1);
      x += x > 0 ? pad : -pad;
      y += y > 0 ? pad : -pad;
      labels[s] = x * y > 0 ? 1 : 0;
      points[2 * s] = clamp(x + rng.normal() * noise * 0.3);
      points[2 * s + 1] = clamp(y + rng.normal() * noise * 0.3);
    }
    return { points, labels };
  },
  gaussian(rng, n, noise) {
    const points = new Float64Array(n * 2);
    const labels = new Uint8Array(n);
    const std = 0.15 + noise * 0.5;
    for (let s = 0; s < n; s++) {
      const label = s % 2;
      const c = label === 1 ? 0.45 : -0.45;
      labels[s] = label;
      points[2 * s] = clamp(c + rng.normal() * std);
      points[2 * s + 1] = clamp(c + rng.normal() * std);
    }
    return { points, labels };
  },
  circle(rng, n, noise) {
    const points = new Float64Array(n * 2);
    const labels = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      const label = s % 2;
      const r = label === 1 ? rng.uniform(0, 0.4) : rng.uniform(0.6, 0.95);
      const t = rng.uniform(0, 2 * Math.PI);
      labels[s] = label;
      points[2 * s] = clamp(r * Math.cos(t) + rng.normal() * noise * 0.3);
      points[2 * s + 1] = clamp(r * Math.sin(t) + rng.normal() * noise * 0.3);
    }
    return { points, labels };
  },
  moons(rng, n, noise) {
    const points = new Float64Array(n * 2);
    const labels = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      const label = s % 2;
      const t = rng.uniform(0, Math.PI);
      const x = label === 1 ? Math.cos(t) : 1 - Math.cos(t);
      const y = label === 1 ? Math.sin(t) : 0.5 - Math.sin(t);
      labels[s] = label;
      // Raw moons span x ∈ [−1, 2], y ∈ [−0.5, 1]; rescale into the domain.
      points[2 * s] = clamp((x - 0.5) * 0.6 + rng.normal() * noise * 0.3);
      points[2 * s + 1] = clamp((y - 0.25) * 0.8 + rng.normal() * noise * 0.3);
    }
    return { points, labels };
  },
  spiral(rng, n, noise) {
    const points = new Float64Array(n * 2);
    const labels = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      const label = s % 2;
      const k = Math.floor(s / 2) / Math.ceil(n / 2);
      const r = 0.9 * k + 0.05;
      const t = 1.75 * k * 2 * Math.PI + label * Math.PI;
      labels[s] = label;
      points[2 * s] = clamp(r * Math.sin(t) + rng.normal() * noise * 0.15);
      points[2 * s + 1] = clamp(r * Math.cos(t) + rng.normal() * noise * 0.15);
    }
    return { points, labels };
  },
};

export function generateDataset(config: DatasetConfig, seed: number): Dataset {
  if (config.id === 'custom') return customDataset(config);
  const rng = new Rng(deriveSeed(seed, 1));
  const count = Math.max(4, Math.round(config.samples));
  const { points, labels } = generators[config.id](rng, count, config.noise);
  const order = rng.shuffle(Uint32Array.from({ length: count }, (_, i) => i));
  const nTrain = Math.min(count - 1, Math.max(1, Math.round(count * config.trainRatio)));
  return { points, labels, count, train: order.slice(0, nTrain), test: order.slice(nTrain) };
}

/**
 * User-drawn points. The split is by position (every 4th point is held out once there are at
 * least 8) so adding a point never reshuffles which existing points are train or test.
 */
function customDataset(config: DatasetConfig): Dataset {
  const labels = Uint8Array.from(config.labels ?? []);
  const count = labels.length;
  const points = Float64Array.from((config.points ?? []).slice(0, count * 2));
  const train: number[] = [];
  const test: number[] = [];
  for (let i = 0; i < count; i++) (count >= 8 && i % 4 === 3 ? test : train).push(i);
  return { points, labels, count, train: Uint32Array.from(train), test: Uint32Array.from(test) };
}

/** Feature-transformed samples for the given subset of a dataset. */
export function toSamples(dataset: Dataset, indices: ArrayLike<number>, features: FeatureId[]): Samples {
  const n = indices.length;
  const d = features.length;
  const x = new Float64Array(n * d);
  const y = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const s = indices[k];
    applyFeatures(features, dataset.points[2 * s], dataset.points[2 * s + 1], x, k * d);
    y[k] = dataset.labels[s];
  }
  return { x, y, count: n };
}
