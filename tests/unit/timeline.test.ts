import { describe, expect, it } from 'vitest';
import { Timeline } from '@core/timeline';
import { DEFAULT_CONFIG } from '@core/train/config';
import { Trainer } from '@core/train/trainer';

const meta = (epoch: number, loss = 1, event = false) => ({
  epoch,
  trainLoss: loss,
  trainAccuracy: 0,
  testAccuracy: 0,
  event,
});

describe('Timeline', () => {
  it('records on schedule and on sharp loss drops', () => {
    const t = new Timeline<number>();
    expect(t.wants(5, 1)).toBe('scheduled');
    expect(t.wants(7, 1)).toBeNull();
    t.add(meta(5, 1), 5);
    expect(t.wants(6, 0.5)).toBeNull(); // too soon
    expect(t.wants(7, 0.5)).toBe('event');
    expect(t.wants(8, 0.9)).toBeNull();
  });

  it('stays within its budget, keeps first/last/events and spreads coverage', () => {
    const t = new Timeline<number>(20);
    t.add(meta(0), 0);
    for (let e = 1; e <= 5000; e++) {
      const why = t.wants(e, 1);
      if (why) t.add(meta(e, 1, why === 'event'), e);
      if (e === 123) t.add(meta(e, 0.1, true), e);
    }
    const ms = t.metas();
    expect(ms.length).toBeLessThanOrEqual(21);
    expect(ms[0].epoch).toBe(0);
    expect(ms.some((m) => m.event && m.epoch === 123)).toBe(true);
    expect(t.interval).toBeGreaterThan(5);
  });

  it('truncates after a branch point', () => {
    const t = new Timeline<number>();
    const a = t.add(meta(5), 5);
    t.add(meta(10), 10);
    t.truncateAfter(a.id);
    expect(t.metas().map((m) => m.epoch)).toEqual([5]);
    expect(t.get(a.id)).toBe(5);
  });
});

describe('Trainer snapshots', () => {
  it('resuming from a snapshot equals training straight through', () => {
    const straight = new Trainer(DEFAULT_CONFIG);
    for (let e = 0; e < 40; e++) straight.trainEpoch();

    const t = new Trainer(DEFAULT_CONFIG);
    for (let e = 0; e < 20; e++) t.trainEpoch();
    const snap = t.snapshot();
    for (let e = 0; e < 15; e++) t.trainEpoch(); // wander off…
    t.restore(snap); // …and come back
    expect(t.epoch).toBe(20);
    for (let e = 0; e < 20; e++) t.trainEpoch();

    expect(Array.from(t.model.params)).toEqual(Array.from(straight.model.params));
  });

  it('metricsFor does not disturb the run', () => {
    const t = new Trainer(DEFAULT_CONFIG);
    const early = t.snapshot();
    for (let e = 0; e < 30; e++) t.trainEpoch();
    const before = Array.from(t.model.params);
    const m = t.metricsFor(early.params);
    expect(m.trainAccuracy).toBeLessThan(t.metrics().trainAccuracy);
    expect(Array.from(t.model.params)).toEqual(before);
  });

  it('records the mean gradient of the last epoch', () => {
    const t = new Trainer({ ...DEFAULT_CONFIG, hyper: { ...DEFAULT_CONFIG.hyper, batchSize: 0 } });
    expect(t.gradMean.every((g) => g === 0)).toBe(true);
    t.trainEpoch();
    expect(t.gradMean.some((g) => g !== 0)).toBe(true);
  });
});
