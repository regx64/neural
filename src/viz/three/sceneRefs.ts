import type { InstancedMesh } from 'three';
import type { NetworkLayout } from '../layout';

/**
 * Mutable per-frame scene data shared between the renderer, picking and camera code without
 * going through React. `positions` holds the animated (displayed) neuron positions.
 */
export const sceneRefs: {
  layout: NetworkLayout | null;
  positions: Float32Array;
  spheres: InstancedMesh | null;
} = { layout: null, positions: new Float32Array(0), spheres: null };

export function layerName(l: number, layerCount: number): string {
  if (l === 0) return '입력';
  if (l === layerCount - 1) return '출력';
  return `은닉 ${l}`;
}

/** (layer, index) of a global neuron index. */
export function neuronAt(layout: NetworkLayout, g: number): { layer: number; index: number } {
  let l = layout.sizes.length - 1;
  while (l > 0 && layout.neuronOffsets[l] > g) l--;
  return { layer: l, index: g - layout.neuronOffsets[l] };
}
