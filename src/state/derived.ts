import { applyFeatures } from '@core/data/features';
import { createModel, createWorkspace, forward, type Model } from '@core/nn/model';
import { forwardTrace, type Trace } from '@core/nn/trace';
import { toModelSpec } from '@core/train/config';
import type { LabState } from './store';

/**
 * Main-thread inference derived from the latest worker snapshot. Memoized on the params buffer
 * identity so the 3D view, inspector and tooltip all read the exact same numbers each frame.
 */
let modelCache: { params: Float64Array; model: Model } | null = null;

export function liveModel(s: LabState): Model | null {
  const params = s.live.params;
  if (!params) return null;
  if (modelCache?.params !== params) {
    const spec = toModelSpec(s.config.network);
    try {
      modelCache = { params, model: createModel(spec, params) };
    } catch {
      return null; // snapshot from a previous structure still in flight
    }
  }
  return modelCache.model;
}

let traceCache: { params: Float64Array; x1: number; x2: number; trace: Trace } | null = null;

export function probeInput(s: LabState): Float64Array | null {
  const pt = s.probe.point;
  if (!pt) return null;
  const x = new Float64Array(s.config.network.features.length);
  applyFeatures(s.config.network.features, pt[0], pt[1], x);
  return x;
}

export function liveTrace(s: LabState): Trace | null {
  const model = liveModel(s);
  const pt = s.probe.point;
  if (!model || !pt || !s.live.params) return null;
  const c = traceCache;
  if (c && c.params === s.live.params && c.x1 === pt[0] && c.x2 === pt[1]) return c.trace;
  const trace = forwardTrace(model, probeInput(s)!);
  traceCache = { params: s.live.params, x1: pt[0], x2: pt[1], trace };
  return trace;
}

let scaleCache: { params: Float64Array; scales: number[] } | null = null;

/**
 * Per-layer activation scale (95th percentile of |a| over up to 64 training samples), used to
 * normalize unbounded activations (ReLU, linear) for display. Bounded ones use their range.
 */
export function activationScales(s: LabState): number[] {
  const model = liveModel(s);
  if (!model || !s.live.params) return [];
  if (scaleCache?.params === s.live.params) return scaleCache.scales;
  const ws = createWorkspace(model);
  const { dataset } = s;
  const features = s.config.network.features;
  const n = Math.min(64, dataset.train.length);
  const values: number[][] = model.sizes.map(() => []);
  const x = new Float64Array(features.length);
  for (let k = 0; k < n; k++) {
    const idx = dataset.train[Math.floor((k * dataset.train.length) / n)];
    applyFeatures(features, dataset.points[2 * idx], dataset.points[2 * idx + 1], x);
    forward(model, x, ws);
    for (let l = 0; l < model.sizes.length; l++) for (const a of ws.a[l]) values[l].push(Math.abs(a));
  }
  const scales = values.map((v) => {
    v.sort((a, b) => a - b);
    return Math.max(1e-6, v[Math.floor(0.95 * (v.length - 1))] ?? 1);
  });
  scaleCache = { params: s.live.params, scales };
  return scales;
}
