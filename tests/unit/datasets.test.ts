import { describe, expect, it } from 'vitest';
import { DATASETS, generateDataset, toSamples } from '@core/data/datasets';
import { Rng } from '@core/rng';

describe('datasets', () => {
  for (const { id } of DATASETS) {
    it(`${id}: points stay in the domain, both classes present, split covers all`, () => {
      const d = generateDataset({ id, samples: 200, noise: 0.5, trainRatio: 0.7 }, 1);
      expect(d.count).toBe(200);
      for (const v of d.points) expect(Math.abs(v)).toBeLessThanOrEqual(1);
      const ones = d.labels.reduce((s, l) => s + l, 0);
      expect(ones).toBeGreaterThan(50);
      expect(ones).toBeLessThan(150);
      expect(d.train.length).toBe(140);
      expect(new Set([...d.train, ...d.test]).size).toBe(200);
    });
  }

  it('is deterministic per seed', () => {
    const c = { id: 'spiral' as const, samples: 100, noise: 0.2, trainRatio: 0.5 };
    expect(generateDataset(c, 5)).toEqual(generateDataset(c, 5));
    expect(generateDataset(c, 5).points).not.toEqual(generateDataset(c, 6).points);
  });

  it('applies feature transforms', () => {
    const d = generateDataset({ id: 'circle', samples: 10, noise: 0, trainRatio: 0.5 }, 1);
    const s = toSamples(d, [0], ['x1', 'x2', 'x1x2']);
    const [x1, x2] = [d.points[0], d.points[1]];
    expect(Array.from(s.x)).toEqual([x1, x2, x1 * x2]);
    expect(s.y[0]).toBe(d.labels[0]);
  });
});

describe('Rng', () => {
  it('reproduces the sequence after restoring state', () => {
    const r = new Rng(9);
    r.next();
    const st = r.getState();
    const a = [r.next(), r.normal()];
    r.setState(st);
    expect([r.next(), r.normal()]).toEqual(a);
  });
});
