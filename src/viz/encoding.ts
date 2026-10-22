/**
 * The single visual-encoding table (product spec §5) as code. The 3D view, 2D canvases, legend
 * and inspector all go through these functions so the same value always looks the same.
 */
import type { ActivationId } from '@core/nn/activations';

export type RGB = [number, number, number];

const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

export const COLORS = {
  positive: hex(0x0071e3),
  negative: hex(0xf56300),
  neutral: hex(0x86868b),
  /** Resting neuron colour (|a| = 0) on the light background. */
  idle: hex(0xe8e8ed),
  ink: hex(0x1d1d1f),
};

export const CSS_COLORS = {
  positive: '#0071e3',
  negative: '#f56300',
  neutral: '#86868b',
  ink: '#1d1d1f',
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

/** Neuron colour: light grey at 0, blending to blue (+) / orange (−) with |s|. */
export function neuronColor(s: number, out: RGB = [0, 0, 0]): RGB {
  const t = Math.abs(clamp1(s));
  const target = s >= 0 ? COLORS.positive : COLORS.negative;
  for (let k = 0; k < 3; k++) out[k] = COLORS.idle[k] + (target[k] - COLORS.idle[k]) * t;
  return out;
}

/** Mixes `color` toward white by (1 − t) — how faded elements are drawn on the light background. */
export function fadeToWhite(color: RGB, t: number, out: RGB = [0, 0, 0]): RGB {
  for (let k = 0; k < 3; k++) out[k] = 1 + (color[k] - 1) * t;
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
    alpha: t < 0.05 ? 0.04 + t * 2 : 0.12 + 0.83 * t,
    positive: v >= 0,
  };
}

/** Background colour of the decision-boundary plot for output probability p, as RGBA bytes. */
export function boundaryRGBA(p: number, out: Uint8ClampedArray, offset: number): void {
  const s = clamp1((p - 0.5) * 2);
  const target = s >= 0 ? COLORS.positive : COLORS.negative;
  const bg = [1, 1, 1];
  const t = Math.abs(s) * 0.22;
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
