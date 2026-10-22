import { weightIndex, type Model } from '@core/nn/model';
import type { Trace } from '@core/nn/trace';
import type { EdgeMode } from '@state/store';

/**
 * The value an edge displays in each mode (product spec §5):
 * weight → w, contribution → w·a for the probe input, gradient → −∂L/∂w of the last epoch
 * (the direction the weight is being pushed: + growing, − shrinking).
 */
export function edgeValue(
  mode: EdgeMode,
  model: Model,
  trace: Trace | null,
  gradMean: Float32Array | null,
  l: number,
  to: number,
  from: number,
): number {
  const k = weightIndex(model.layers[l - 1], to, from);
  switch (mode) {
    case 'weight':
      return model.params[k];
    case 'contribution':
      return trace ? model.params[k] * trace.a[l - 1][from] : model.params[k];
    case 'gradient':
      return gradMean && gradMean.length === model.params.length ? -gradMean[k] : 0;
  }
}

/** Largest |edgeValue| over the network — the normalization shown in the legend. */
export function edgeMax(
  mode: EdgeMode,
  model: Model,
  trace: Trace | null,
  gradMean: Float32Array | null,
): number {
  let max = 0;
  for (const L of model.layers)
    for (let j = 0; j < L.outSize; j++)
      for (let i = 0; i < L.inSize; i++)
        max = Math.max(max, Math.abs(edgeValue(mode, model, trace, gradMean, L.index, j, i)));
  return max;
}
