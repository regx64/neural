import { DOMAIN } from '../data/datasets';
import { applyFeatures, type FeatureId } from '../data/features';
import { createWorkspace, forward, type Model } from './model';

/** Domain coordinate of cell `k` (0 … res−1) along one axis — the cell centre. */
export function cellCenter(k: number, res: number): number {
  return -DOMAIN + ((k + 0.5) * 2 * DOMAIN) / res;
}

/**
 * Model output probability over a res×res grid covering the input domain.
 * Row-major, row 0 is the top of the plot (x₂ = +1), column 0 is the left (x₁ = −1).
 */
export function predictGrid(model: Model, features: FeatureId[], res: number): Float32Array {
  const out = new Float32Array(res * res);
  const ws = createWorkspace(model);
  const x = new Float64Array(features.length);
  for (let r = 0; r < res; r++) {
    const x2 = -cellCenter(r, res);
    for (let c = 0; c < res; c++) {
      applyFeatures(features, cellCenter(c, res), x2, x);
      out[r * res + c] = forward(model, x, ws);
    }
  }
  return out;
}

/**
 * Activation of one neuron (layer ≥ 1) over the input domain — its "response map".
 * Same orientation as `predictGrid`.
 */
export function neuronGrid(
  model: Model,
  features: FeatureId[],
  layer: number,
  neuron: number,
  res: number,
): Float32Array {
  const out = new Float32Array(res * res);
  const ws = createWorkspace(model);
  const x = new Float64Array(features.length);
  for (let r = 0; r < res; r++) {
    const x2 = -cellCenter(r, res);
    for (let c = 0; c < res; c++) {
      applyFeatures(features, cellCenter(c, res), x2, x);
      forward(model, x, ws);
      out[r * res + c] = ws.a[layer][neuron];
    }
  }
  return out;
}
