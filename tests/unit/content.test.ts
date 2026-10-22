import { describe, expect, it } from 'vitest';
import { narrate, type NarrationInput } from '../../src/content/narration';
import { LESSONS } from '../../src/content/lessons';

const base: NarrationInput = {
  running: true,
  epoch: 50,
  trainLoss: 0.5,
  trainAccuracy: 0.6,
  testAccuracy: 0.6,
  sampleCount: 200,
};

describe('narrate', () => {
  it('guides before the first epoch', () => {
    expect(narrate({ ...base, epoch: 0, running: false }).text).toContain('▶');
  });
  it('flags a diverging run', () => {
    expect(narrate({ ...base, trainLoss: 3 }).tone).toBe('warn');
    expect(narrate({ ...base, trainLoss: NaN }).text).toContain('학습률');
  });
  it('flags overfitting before celebrating', () => {
    expect(narrate({ ...base, trainAccuracy: 1, testAccuracy: 0.75 }).text).toContain('과적합');
    expect(narrate({ ...base, trainAccuracy: 1, testAccuracy: 0.98 }).tone).toBe('good');
  });
  it('suggests more capacity when stuck', () => {
    const r = narrate({ ...base, epoch: 300, trainAccuracy: 0.65, trainLoss: 0.664, pastLoss: 0.665 });
    expect(r.text).toContain('은닉층');
  });
  it('says when a past snapshot is on screen', () => {
    expect(narrate({ ...base, previewEpoch: 40 }).text).toContain('Epoch 40');
  });
  it('asks for points on an empty drawing', () => {
    expect(narrate({ ...base, sampleCount: 0 }).text).toContain('점');
  });
});

describe('lessons', () => {
  it('have unique ids and at least one step each', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) expect(l.steps.length).toBeGreaterThan(1);
  });
});
