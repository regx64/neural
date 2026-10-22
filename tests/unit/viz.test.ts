import { describe, expect, it } from 'vitest';
import { buildLayout, weightIndex } from '@core/nn/model';
import {
  boundaryRGBA,
  COLORS,
  formatNumber,
  edgeStyle,
  formatSigned,
  neuronColor,
  signedActivation,
  EDGE_MAX_WIDTH,
  EDGE_MIN_WIDTH,
} from '@viz/encoding';
import { computeLayout } from '@viz/layout';
import { History } from '@state/history';
import { isoLines } from '@viz/contour';

describe('encoding', () => {
  it('maps activations to signed display values', () => {
    expect(signedActivation(-0.5, 'tanh', 1)).toBe(-0.5);
    expect(signedActivation(0.5, 'sigmoid', 1)).toBe(0);
    expect(signedActivation(1, 'sigmoid', 1)).toBe(1);
    expect(signedActivation(3, 'relu', 2)).toBe(1);
    expect(signedActivation(1, 'relu', 2)).toBe(0.5);
    expect(signedActivation(NaN, 'linear', 1)).toBe(0);
  });

  it('colours: full magnitude reaches the sign colour', () => {
    neuronColor(1).forEach((c, k) => expect(c).toBeCloseTo(COLORS.positive[k], 9));
    neuronColor(-1).forEach((c, k) => expect(c).toBeCloseTo(COLORS.negative[k], 9));
    neuronColor(0).forEach((c, k) => expect(c).toBeCloseTo(COLORS.idle[k], 9));
  });

  it('edges scale monotonically with |v| and clamp to the max', () => {
    expect(edgeStyle(0, 1).width).toBe(EDGE_MIN_WIDTH);
    expect(edgeStyle(-2, 1)).toMatchObject({ t: 1, width: EDGE_MAX_WIDTH, positive: false });
    expect(edgeStyle(0.5, 1).alpha).toBeGreaterThan(edgeStyle(0.2, 1).alpha);
    expect(edgeStyle(1, 0).t).toBe(0);
  });

  it('decision boundary colour is neutral at p = 0.5 and tinted toward the predicted class', () => {
    const px = new Uint8ClampedArray(12);
    boundaryRGBA(0.5, px, 0);
    boundaryRGBA(1, px, 4);
    boundaryRGBA(0, px, 8);
    expect(Array.from(px.slice(0, 4))).toEqual([255, 255, 255, 255]);
    expect(px[4]).toBeLessThan(px[6]); // p = 1 → tinted blue (less red than blue)
    expect(px[10]).toBeLessThan(px[8]); // p = 0 → tinted orange (less blue than red)
  });

  it('formats signed numbers', () => {
    expect(formatNumber(1 / 3)).toBe('0.333');
    expect(formatNumber(NaN)).toBe('—');
    expect(formatSigned(0.82)).toBe('+0.820');
    expect(formatSigned(-0.41)).toBe('−0.410');
    expect(formatSigned(-0.0001)).toBe(' 0.000');
  });
});

describe('layout', () => {
  it('orders edges exactly like weights in the parameter buffer', () => {
    const sizes = [2, 3, 12, 1];
    const layout = computeLayout(sizes);
    const { layers } = buildLayout({ inputSize: 2, hidden: [3, 12], activation: 'tanh' });
    for (let l = 1; l < sizes.length; l++) {
      for (let j = 0; j < sizes[l]; j++) {
        for (let i = 0; i < sizes[l - 1]; i++) {
          const edge = layout.edgeOffsets[l] + j * sizes[l - 1] + i;
          const layer = layers[l - 1];
          // Weight index minus preceding biases equals the edge index.
          const biasesBefore = layers.slice(0, l - 1).reduce((s, v) => s + v.outSize, 0);
          expect(weightIndex(layer, j, i) - biasesBefore).toBe(edge);
        }
      }
    }
    expect(layout.edgeCount).toBe(2 * 3 + 3 * 12 + 12);
  });

  it('uses a column up to 8 neurons and a grid above', () => {
    const layout = computeLayout([2, 8, 16, 1]);
    const zOf = (g: number) => layout.positions[g * 3 + 2];
    for (let j = 0; j < 8; j++) expect(zOf(layout.neuronOffsets[1] + j)).toBe(0);
    const zs = new Set(Array.from({ length: 16 }, (_, j) => zOf(layout.neuronOffsets[2] + j)));
    expect(zs.size).toBe(4);
    expect(layout.positions[0]).toBe(-layout.width / 2);
  });
});

describe('History', () => {
  const m = (epoch: number) => ({ epoch, trainLoss: 1, testLoss: 1, trainAccuracy: 0, testAccuracy: 0 });

  it('downsamples but keeps the newest point', () => {
    const h = new History();
    for (let e = 1; e <= 5000; e++) h.push(m(e), new Float64Array(2));
    expect(h.epochs.length).toBeLessThanOrEqual(2001);
    expect(h.epochs[h.epochs.length - 1]).toBe(5000);
    expect(h.params.length).toBeLessThanOrEqual(201);
  });

  it('clears on reset and replaces duplicate epochs', () => {
    const h = new History();
    h.push(m(10), new Float64Array(1));
    h.push(m(10), new Float64Array(1));
    expect(h.epochs).toEqual([10]);
    h.push(m(0), new Float64Array(1));
    expect(h.epochs).toEqual([0]);
  });
});

describe('isoLines', () => {
  it('traces a vertical boundary between columns', () => {
    const res = 4;
    const g = Array.from({ length: res * res }, (_, k) => (k % res < 2 ? 0 : 1));
    const segs = isoLines(g, res, 0.5);
    expect(segs.length).toBe(3 * 4);
    for (let k = 0; k < segs.length; k += 2) expect(segs[k]).toBeCloseTo(2);
  });
});

describe('History.truncate', () => {
  const m = (epoch: number) => ({ epoch, trainLoss: 1, testLoss: 1, trainAccuracy: 0, testAccuracy: 0 });
  it('rewinds to a past epoch and continues from there', () => {
    const h = new History();
    for (const e of [0, 10, 20, 30]) h.push(m(e), new Float64Array(1));
    h.push(m(15), new Float64Array(1)); // resumed from a snapshot at epoch 15
    expect(h.epochs).toEqual([0, 10, 15]);
    expect(h.paramEpochs).toEqual([0, 10, 15]);
  });
});
