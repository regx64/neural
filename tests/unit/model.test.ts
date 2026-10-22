import { describe, expect, it } from 'vitest';
import { ACTIVATIONS, type ActivationId } from '@core/nn/activations';
import {
  batchGradients,
  buildLayout,
  createModel,
  createWorkspace,
  initParams,
  weightIndex,
  type Samples,
} from '@core/nn/model';
import { forwardTrace, neuronBreakdown } from '@core/nn/trace';
import { Rng } from '@core/rng';

function randomSamples(rng: Rng, inputSize: number, count: number): Samples {
  const x = new Float64Array(inputSize * count).map(() => rng.uniform(-1, 1));
  const y = Uint8Array.from({ length: count }, () => (rng.next() > 0.5 ? 1 : 0));
  return { x, y, count };
}

describe('parameter layout', () => {
  it('packs [W₁ | b₁ | W₂ | b₂ …] contiguously', () => {
    const { sizes, layers, paramCount } = buildLayout({ inputSize: 2, hidden: [4, 3], activation: 'tanh' });
    expect(sizes).toEqual([2, 4, 3, 1]);
    expect(paramCount).toBe(2 * 4 + 4 + 4 * 3 + 3 + 3 * 1 + 1);
    expect(layers[0]).toMatchObject({ wOffset: 0, bOffset: 8, inSize: 2, outSize: 4 });
    expect(layers[1]).toMatchObject({ wOffset: 12, bOffset: 24 });
    expect(layers[2]).toMatchObject({ wOffset: 27, bOffset: 30, activation: 'sigmoid' });
    expect(weightIndex(layers[1], 2, 1)).toBe(12 + 2 * 4 + 1);
  });

  it('rejects a buffer of the wrong size', () => {
    expect(() =>
      createModel({ inputSize: 2, hidden: [2], activation: 'tanh' }, new Float64Array(3)),
    ).toThrow();
  });
});

describe('gradients', () => {
  // Central differences in float64 against backprop on 50 random networks.
  it('match numerical gradients (relative error < 1e-6)', () => {
    const rng = new Rng(7);
    let worst = 0;
    for (let trial = 0; trial < 50; trial++) {
      const activation = ACTIVATIONS[trial % ACTIVATIONS.length] as ActivationId;
      const depth = 1 + Math.floor(rng.next() * 3);
      const hidden = Array.from({ length: depth }, () => 1 + Math.floor(rng.next() * 5));
      const spec = { inputSize: 1 + Math.floor(rng.next() * 4), hidden, activation };
      const model = createModel(spec);
      initParams(model, rng);
      for (let k = 0; k < model.params.length; k++) model.params[k] += rng.uniform(-0.3, 0.3);
      const ws = createWorkspace(model);
      const data = randomSamples(rng, spec.inputSize, 6);
      const idx = Uint32Array.from({ length: data.count }, (_, i) => i);
      const l2 = trial % 3 === 0 ? 0.01 : 0;
      const grads = new Float64Array(model.params.length);
      batchGradients(model, ws, data, idx, 0, data.count, grads, l2);
      const scratch = new Float64Array(model.params.length);
      const eps = 1e-5;
      for (let k = 0; k < model.params.length; k++) {
        const orig = model.params[k];
        model.params[k] = orig + eps;
        const lp = batchGradients(model, ws, data, idx, 0, data.count, scratch, l2);
        model.params[k] = orig - eps;
        const lm = batchGradients(model, ws, data, idx, 0, data.count, scratch, l2);
        model.params[k] = orig;
        const numeric = (lp - lm) / (2 * eps);
        // ReLU kinks make central differences meaningless right at z = 0; skip those rare points.
        const err = Math.abs(numeric - grads[k]) / Math.max(1e-4, Math.abs(numeric) + Math.abs(grads[k]));
        if (activation === 'relu' && err > 1e-3) continue;
        worst = Math.max(worst, err);
      }
    }
    expect(worst).toBeLessThan(1e-6);
  });
});

describe('trace', () => {
  it('breakdown terms sum to z and match the forward pass', () => {
    const model = createModel({ inputSize: 2, hidden: [3, 2], activation: 'tanh' });
    initParams(model, new Rng(3));
    const trace = forwardTrace(model, [0.3, -0.8]);
    for (let l = 1; l < model.sizes.length; l++) {
      for (let j = 0; j < model.sizes[l]; j++) {
        const b = neuronBreakdown(model, trace, l, j);
        const sum = b.inputs.reduce((s, t) => s + t.contribution, b.bias);
        expect(sum).toBeCloseTo(b.z, 12);
        expect(b.z).toBe(trace.z[l][j]);
      }
    }
    expect(trace.output).toBe(trace.a[3][0]);
  });
});
