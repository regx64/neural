export const LAYER_SPACING = 4;
export const NEURON_SPACING = 1.25;
/** Layers with more neurons than this are laid out as a grid in the YZ plane. */
export const COLUMN_MAX = 8;

export interface NetworkLayout {
  sizes: number[];
  /** xyz per neuron, layers in order. */
  positions: Float32Array;
  /** Global index of the first neuron of each layer. */
  neuronOffsets: number[];
  /** Global index of the first edge into each layer (index 0 unused, = 0). */
  edgeOffsets: number[];
  neuronCount: number;
  edgeCount: number;
  width: number;
  height: number;
}

/**
 * Layers along +X (input left → output right), centred on the origin. Neuron j of layer l is
 * global neuron `neuronOffsets[l] + j`; the edge from i (layer l−1) to j (layer l) is global edge
 * `edgeOffsets[l] + j * sizes[l−1] + i` — the same order as the weights in the parameter buffer.
 */
export function computeLayout(sizes: number[]): NetworkLayout {
  const neuronOffsets: number[] = [];
  const edgeOffsets: number[] = [0];
  let neuronCount = 0;
  let edgeCount = 0;
  sizes.forEach((n, l) => {
    neuronOffsets.push(neuronCount);
    neuronCount += n;
    if (l > 0) {
      edgeOffsets.push(edgeCount);
      edgeCount += sizes[l - 1] * n;
    }
  });
  const positions = new Float32Array(neuronCount * 3);
  const width = (sizes.length - 1) * LAYER_SPACING;
  let height = 0;
  sizes.forEach((n, l) => {
    const x = l * LAYER_SPACING - width / 2;
    const grid = n > COLUMN_MAX;
    const cols = grid ? Math.ceil(Math.sqrt(n)) : 1;
    const rows = Math.ceil(n / cols);
    height = Math.max(height, (rows - 1) * NEURON_SPACING);
    for (let j = 0; j < n; j++) {
      const row = grid ? Math.floor(j / cols) : j;
      const col = grid ? j % cols : 0;
      const k = (neuronOffsets[l] + j) * 3;
      positions[k] = x;
      positions[k + 1] = ((rows - 1) / 2 - row) * NEURON_SPACING;
      positions[k + 2] = grid ? (col - (cols - 1) / 2) * NEURON_SPACING : 0;
    }
  });
  return { sizes, positions, neuronOffsets, edgeOffsets, neuronCount, edgeCount, width, height };
}
