import { activateDerivative, sigmoid } from './activations';
import { createWorkspace, forward, weightIndex, type Model } from './model';

/** Every intermediate value of one forward pass — what the inspector and 3D view display. */
export interface Trace {
  /** Activations per neuron layer; `a[0]` is the (feature-transformed) input. */
  a: Float64Array[];
  /** Pre-activations per neuron layer; `z[0]` is unused. */
  z: Float64Array[];
  output: number;
}

export function forwardTrace(model: Model, x: ArrayLike<number>): Trace {
  const ws = createWorkspace(model);
  const output = forward(model, x, ws);
  return { a: ws.a, z: ws.z, output };
}

/** w·a of the edge from neuron `from` (layer l−1) to neuron `to` (layer l). */
export function contribution(model: Model, trace: Trace, l: number, to: number, from: number): number {
  const layer = model.layers[l - 1];
  return model.params[weightIndex(layer, to, from)] * trace.a[l - 1][from];
}

export interface NeuronBreakdown {
  inputs: { from: number; value: number; weight: number; contribution: number }[];
  bias: number;
  z: number;
  a: number;
}

/** z = Σ wᵢaᵢ + b broken into its terms, for neuron `to` of layer `l` (l ≥ 1). */
export function neuronBreakdown(model: Model, trace: Trace, l: number, to: number): NeuronBreakdown {
  const layer = model.layers[l - 1];
  const prev = trace.a[l - 1];
  const inputs = [];
  for (let i = 0; i < layer.inSize; i++) {
    const weight = model.params[weightIndex(layer, to, i)];
    inputs.push({ from: i, value: prev[i], weight, contribution: weight * prev[i] });
  }
  return {
    inputs,
    bias: model.params[layer.bOffset + to],
    z: trace.z[l][to],
    a: trace.a[l][to],
  };
}

/**
 * Backpropagation for a single sample with label `y`: δ = ∂L/∂z for every neuron (index 0
 * unused). The weight gradient of edge i→j into layer l is then δ[l][j] · a[l−1][i].
 */
export function backwardTrace(model: Model, trace: Trace, y: number): Float64Array[] {
  const L = model.layers.length;
  const delta = model.sizes.map((n) => new Float64Array(n));
  delta[L][0] = sigmoid(trace.z[L][0]) - y;
  for (let l = L; l > 1; l--) {
    const layer = model.layers[l - 1];
    const below = model.layers[l - 2];
    for (let i = 0; i < layer.inSize; i++) {
      let sum = 0;
      for (let j = 0; j < layer.outSize; j++) sum += model.params[weightIndex(layer, j, i)] * delta[l][j];
      delta[l - 1][i] = sum * activateDerivative(below.activation, trace.z[l - 1][i], trace.a[l - 1][i]);
    }
  }
  return delta;
}
