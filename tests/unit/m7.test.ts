import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@core/train/config';
import { createModel, createWorkspace, batchGradients, initParams } from '@core/nn/model';
import { backwardTrace, forwardTrace } from '@core/nn/trace';
import { Rng } from '@core/rng';
import { decodeConfig, encodeConfig } from '../../src/state/share';
import { describeChanges } from '../../src/content/diff';

describe('backwardTrace', () => {
  it('δ·a reproduces the single-sample weight gradients', () => {
    const model = createModel({ inputSize: 2, hidden: [3, 2], activation: 'tanh' });
    initParams(model, new Rng(11));
    const x = [0.4, -0.7];
    const y = 1;
    const trace = forwardTrace(model, x);
    const delta = backwardTrace(model, trace, y);
    const grads = new Float64Array(model.params.length);
    batchGradients(
      model,
      createWorkspace(model),
      { x: Float64Array.from(x), y: Uint8Array.of(y), count: 1 },
      [0],
      0,
      1,
      grads,
    );
    for (const L of model.layers) {
      for (let j = 0; j < L.outSize; j++) {
        expect(grads[L.bOffset + j]).toBeCloseTo(delta[L.index][j], 12);
        for (let i = 0; i < L.inSize; i++)
          expect(grads[L.wOffset + j * L.inSize + i]).toBeCloseTo(
            delta[L.index][j] * trace.a[L.index - 1][i],
            12,
          );
      }
    }
  });
});

describe('share links', () => {
  it('round-trip a config, including drawn points', async () => {
    const c = {
      ...DEFAULT_CONFIG,
      network: { ...DEFAULT_CONFIG.network, hidden: [6, 3] },
      dataset: {
        id: 'custom' as const,
        samples: 0,
        noise: 0,
        trainRatio: 0.7,
        points: [0.12345, -0.5, 0.9, 0.1],
        labels: [1, 0],
      },
    };
    const back = await decodeConfig(await encodeConfig(c));
    expect(back?.network.hidden).toEqual([6, 3]);
    expect(back?.dataset.points).toEqual([0.123, -0.5, 0.9, 0.1]);
    expect(back?.dataset.labels).toEqual([1, 0]);
  });

  it('rejects garbage and impossible configs', async () => {
    expect(await decodeConfig('zzzz')).toBeNull();
    const bad = { ...DEFAULT_CONFIG, network: { ...DEFAULT_CONFIG.network, hidden: [99] } };
    expect(await decodeConfig(await encodeConfig(bad))).toBeNull();
  });
});

describe('describeChanges', () => {
  it('lists only what changed, in plain words', () => {
    const b = {
      ...DEFAULT_CONFIG,
      network: { ...DEFAULT_CONFIG.network, hidden: [4, 4] },
      hyper: { ...DEFAULT_CONFIG.hyper, learningRate: 0.3 },
    };
    expect(describeChanges(DEFAULT_CONFIG, b)).toEqual(['은닉층 4 → 4, 4', '학습률 0.03 → 0.3']);
    expect(describeChanges(DEFAULT_CONFIG, DEFAULT_CONFIG)).toEqual([]);
  });
});
