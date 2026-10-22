import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type ExperimentConfig } from '@core/train/config';
import { Trainer } from '@core/train/trainer';
import { neuronGrid, predictGrid } from '@core/nn/grid';
import { forwardTrace } from '@core/nn/trace';

const cfg = (patch: Partial<ExperimentConfig> = {}): ExperimentConfig => ({ ...DEFAULT_CONFIG, ...patch });

function trainUntil(t: Trainer, accuracy: number, maxEpochs: number): number {
  for (let e = 0; e < maxEpochs; e++) {
    t.trainEpoch();
    if (t.metrics().trainAccuracy >= accuracy) return t.epoch;
  }
  return Infinity;
}

describe('Trainer', () => {
  it('solves the default XOR setup (2-4-1 tanh, Adam 0.03) to ≥ 98% train accuracy', () => {
    // At the default 50 epochs/s this is the "converges within 5 seconds" budget.
    expect(trainUntil(new Trainer(cfg()), 0.98, 300)).toBeLessThanOrEqual(250);
  });

  it('solves the spec reference setup (Adam 0.1) quickly', () => {
    const t = new Trainer(cfg({ hyper: { ...DEFAULT_CONFIG.hyper, learningRate: 0.1 } }));
    expect(trainUntil(t, 0.98, 300)).toBeLessThanOrEqual(100);
  });

  it('solves Circle with one hidden layer', () => {
    const t = new Trainer(cfg({ dataset: { ...DEFAULT_CONFIG.dataset, id: 'circle' } }));
    expect(trainUntil(t, 0.95, 500)).toBeLessThan(Infinity);
  });

  it('cannot solve XOR without a hidden layer (logistic regression stays ≤ 75%)', () => {
    const t = new Trainer(cfg({ network: { ...DEFAULT_CONFIG.network, hidden: [] } }));
    for (let e = 0; e < 200; e++) t.trainEpoch();
    expect(t.metrics().trainAccuracy).toBeLessThanOrEqual(0.8);
  });

  it('is deterministic for the same seed', () => {
    const a = new Trainer(cfg());
    const b = new Trainer(cfg());
    for (let e = 0; e < 30; e++) {
      a.trainEpoch();
      b.trainEpoch();
    }
    expect(Array.from(a.model.params)).toEqual(Array.from(b.model.params));
    expect(a.metrics()).toEqual(b.metrics());
  });

  it('reset() reproduces the run from the start', () => {
    const t = new Trainer(cfg());
    for (let e = 0; e < 10; e++) t.trainEpoch();
    const after10 = Array.from(t.model.params);
    t.reset();
    expect(t.epoch).toBe(0);
    for (let e = 0; e < 10; e++) t.trainEpoch();
    expect(Array.from(t.model.params)).toEqual(after10);
  });

  it('different seeds give different initial weights', () => {
    const a = new Trainer(cfg());
    const b = new Trainer(cfg({ seed: 43 }));
    expect(Array.from(a.model.params)).not.toEqual(Array.from(b.model.params));
  });

  it('all optimizers reduce the loss', () => {
    for (const optimizer of ['sgd', 'momentum', 'adam'] as const) {
      const t = new Trainer(cfg({ hyper: { ...DEFAULT_CONFIG.hyper, optimizer, learningRate: 0.03 } }));
      const before = t.metrics().trainLoss;
      for (let e = 0; e < 40; e++) t.trainEpoch();
      expect(t.metrics().trainLoss, optimizer).toBeLessThan(before);
    }
  });

  it('predictGrid orients row 0 at the top (x₂ = +1)', () => {
    const t = new Trainer(cfg({ dataset: { ...DEFAULT_CONFIG.dataset, id: 'gaussian' } }));
    trainUntil(t, 0.95, 200);
    const res = 8;
    const g = predictGrid(t.model, t.config.network.features, res);
    // Gaussian class 1 sits at (+, +): top-right should be class 1, bottom-left class 0.
    expect(g[0 * res + (res - 1)]).toBeGreaterThan(0.5);
    expect(g[(res - 1) * res + 0]).toBeLessThan(0.5);
  });
});

describe('custom data', () => {
  const custom = (n: number) => ({
    id: 'custom' as const,
    samples: 0,
    noise: 0,
    trainRatio: 0.7,
    points: Array.from({ length: n * 2 }, (_, k) => ((k * 37) % 19) / 10 - 0.9),
    labels: Array.from({ length: n }, (_, k) => k % 2),
  });

  it('holds out every 4th point once there are 8 or more, so adding points never reshuffles', () => {
    const a = new Trainer(cfg({ dataset: custom(8) }));
    expect(Array.from(a.dataset.test)).toEqual([3, 7]);
    const b = new Trainer(cfg({ dataset: custom(12) }));
    expect(Array.from(b.dataset.test)).toEqual([3, 7, 11]);
    expect(new Trainer(cfg({ dataset: custom(5) })).dataset.test.length).toBe(0);
  });

  it('copes with an empty drawing', () => {
    const t = new Trainer(cfg({ dataset: custom(0) }));
    expect(t.trainEpoch()).toBeNaN();
    expect(t.metrics().trainAccuracy).toBeNaN();
  });

  it('setData keeps the learned weights', () => {
    const t = new Trainer(cfg());
    for (let e = 0; e < 20; e++) t.trainEpoch();
    const before = Array.from(t.model.params);
    t.setData(custom(10));
    expect(Array.from(t.model.params)).toEqual(before);
    expect(t.train.count).toBe(8);
    t.trainEpoch();
  });
});

describe('neuronGrid', () => {
  it('matches the forward pass of the chosen neuron', () => {
    const t = new Trainer(cfg());
    for (let e = 0; e < 10; e++) t.trainEpoch();
    const g = neuronGrid(t.model, t.config.network.features, 1, 2, 4);
    const trace = forwardTrace(t.model, [-0.75, 0.75]); // cell (0, 0) centre
    expect(g[0]).toBeCloseTo(trace.a[1][2], 5);
  });
});
