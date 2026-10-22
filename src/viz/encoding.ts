/**
 * The single visual-encoding table (product spec §5) as code. The 3D view, 2D canvases, legend
 * and inspector all go through these functions so the same value always looks the same.
 */
import type { ActivationId } from '@core/nn/activations';

export type RGB = [number, number, number];

const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

export const COLORS = {
  positive: hex(0x22d3ee),
  negative: hex(0xf97316),
  neutral: hex(0x64748b),
  brand: hex(0x7c3aed),
};

export const CSS_COLORS = {
  positive: '#22d3ee',
  negative: '#f97316',
  neutral: '#64748b',
  brand: '#7c3aed',
};

const clamp1 = (v: number) => (v > 1 ? 1 : v < -1 ? -1 : Number.isFinite(v) ? v : 0);

/**
 * Maps an activation to a signed display value in [−1, 1].
 * tanh: as is; sigmoid: centred on 0.5; ReLU / linear / inputs: divided by the layer scale.
 */
export function signedActivation(a: number, activation: ActivationId | 'input', scale: number): number {
  switch (activation) {
    case 'tanh':
      return clamp1(a);
    case 'sigmoid':
      return clamp1((a - 0.5) * 2);
    default:
      return clamp1(a / (scale > 0 ? scale : 1));
  }
}

/** Neuron colour: dim neutral at 0, blending to cyan (+) / orange (−) with |s|. */
export function neuronColor(s: number, out: RGB = [0, 0, 0]): RGB {
  const t = Math.abs(clamp1(s));
  const target = s >= 0 ? COLORS.positive : COLORS.negative;
  for (let k = 0; k < 3; k++) {
    const base = COLORS.neutral[k] * 0.35;
    out[k] = base + (target[k] - base) * t;
  }
  return out;
}

export interface EdgeStyle {
  /** Normalized magnitude 0 … 1. */
  t: number;
  width: number;
  alpha: number;
  positive: boolean;
}

/** Edge widths in CSS pixels. */
export const EDGE_MIN_WIDTH = 0.75;
export const EDGE_MAX_WIDTH = 5;

/** Edge width and opacity grow with |v| / max|v|; the bottom 5% is nearly invisible. */
export function edgeStyle(v: number, maxAbs: number): EdgeStyle {
  const t = maxAbs > 0 && Number.isFinite(v) ? Math.min(1, Math.abs(v) / maxAbs) : 0;
  return {
    t,
    width: EDGE_MIN_WIDTH + (EDGE_MAX_WIDTH - EDGE_MIN_WIDTH) * t,
    alpha: t < 0.05 ? 0.03 + t * 2 : 0.08 + 0.92 * t,
    positive: v >= 0,
  };
}

/** Background colour of the decision-boundary plot for output probability p, as RGBA bytes. */
export function boundaryRGBA(p: number, out: Uint8ClampedArray, offset: number): void {
  const s = clamp1((p - 0.5) * 2);
  const target = s >= 0 ? COLORS.positive : COLORS.negative;
  const bg = [0.043, 0.059, 0.102]; // panel background #0B0F1A
  const t = Math.abs(s) * 0.55;
  for (let k = 0; k < 3; k++) out[offset + k] = Math.round((bg[k] + (target[k] - bg[k]) * t) * 255);
  out[offset + 3] = 255;
}

/** Fixed-point display with an explicit sign, e.g. +0.820 / −0.410. */
export function formatSigned(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '—';
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return ` ${s}`;
  return (v < 0 ? '−' : '+') + s;
}

export function formatNumber(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}
