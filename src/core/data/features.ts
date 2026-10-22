/** Input feature transforms applied to a raw 2D point (x₁, x₂) ∈ [−1, 1]². */
export type FeatureId = 'x1' | 'x2' | 'x1sq' | 'x2sq' | 'x1x2' | 'sin1' | 'sin2';

export const FEATURES: { id: FeatureId; label: string; fn: (x1: number, x2: number) => number }[] = [
  { id: 'x1', label: 'x₁', fn: (x1) => x1 },
  { id: 'x2', label: 'x₂', fn: (_x1, x2) => x2 },
  { id: 'x1sq', label: 'x₁²', fn: (x1) => x1 * x1 },
  { id: 'x2sq', label: 'x₂²', fn: (_x1, x2) => x2 * x2 },
  { id: 'x1x2', label: 'x₁x₂', fn: (x1, x2) => x1 * x2 },
  { id: 'sin1', label: 'sin(πx₁)', fn: (x1) => Math.sin(Math.PI * x1) },
  { id: 'sin2', label: 'sin(πx₂)', fn: (_x1, x2) => Math.sin(Math.PI * x2) },
];

const byId = new Map(FEATURES.map((f) => [f.id, f]));

export function featureLabel(id: FeatureId): string {
  return byId.get(id)!.label;
}

/** Writes the selected features of (x₁, x₂) into `out` starting at `offset`. */
export function applyFeatures(
  features: FeatureId[],
  x1: number,
  x2: number,
  out: Float64Array,
  offset = 0,
): void {
  for (let k = 0; k < features.length; k++) out[offset + k] = byId.get(features[k])!.fn(x1, x2);
}
