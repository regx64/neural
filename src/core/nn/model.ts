import type { Rng } from '../rng';
import { activate, activateDerivative, sigmoid, type ActivationId } from './activations';
import { bceFromLogit } from './loss';

/** Fully connected binary classifier: inputs → hidden layers (shared activation) → 1 sigmoid output. */
export interface ModelSpec {
  inputSize: number;
  hidden: number[];
  activation: ActivationId;
}

/**
 * View into the flat parameter buffer for one weight layer `index` (1-based: layer 1 connects
 * neuron layer 0 → 1). Weight from neuron `i` of layer index−1 to neuron `j` of layer index lives
 * at `wOffset + j * inSize + i`; bias of neuron `j` at `bOffset + j`.
 */
export interface LayerView {
  index: number;
  inSize: number;
  outSize: number;
  wOffset: number;
  bOffset: number;
  activation: ActivationId;
}

export interface Model {
  spec: ModelSpec;
  /** Neuron count per layer, input layer first, output layer (1) last. */
  sizes: number[];
  /** Weight layers; `layers[k]` has index k + 1. */
  layers: LayerView[];
  /** All weights and biases, laid out layer by layer as [W₁ | b₁ | W₂ | b₂ | …]. */
  params: Float64Array;
}

export function layerSizes(spec: ModelSpec): number[] {
  return [spec.inputSize, ...spec.hidden, 1];
}

export function buildLayout(spec: ModelSpec): { sizes: number[]; layers: LayerView[]; paramCount: number } {
  const sizes = layerSizes(spec);
  const layers: LayerView[] = [];
  let offset = 0;
  for (let l = 1; l < sizes.length; l++) {
    const inSize = sizes[l - 1];
    const outSize = sizes[l];
    const wOffset = offset;
    const bOffset = wOffset + inSize * outSize;
    offset = bOffset + outSize;
    layers.push({
      index: l,
      inSize,
      outSize,
      wOffset,
      bOffset,
      activation: l === sizes.length - 1 ? 'sigmoid' : spec.activation,
    });
  }
  return { sizes, layers, paramCount: offset };
}

/** Wraps (or allocates) a parameter buffer with the layout for `spec`. Does not copy `params`. */
export function createModel(spec: ModelSpec, params?: Float64Array): Model {
  const { sizes, layers, paramCount } = buildLayout(spec);
  if (params && params.length !== paramCount) {
    throw new Error(`Parameter buffer has ${params.length} values, spec needs ${paramCount}`);
  }
  return { spec, sizes, layers, params: params ?? new Float64Array(paramCount) };
}

export function weightIndex(layer: LayerView, to: number, from: number): number {
  return layer.wOffset + to * layer.inSize + from;
}

/** Glorot-normal for tanh/sigmoid/linear, He-normal for ReLU. Biases start at 0. */
export function initParams(model: Model, rng: Rng): void {
  const p = model.params;
  for (const layer of model.layers) {
    const std =
      layer.activation === 'relu'
        ? Math.sqrt(2 / layer.inSize)
        : Math.sqrt(2 / (layer.inSize + layer.outSize));
    for (let k = 0; k < layer.inSize * layer.outSize; k++) p[layer.wOffset + k] = rng.normal() * std;
    for (let j = 0; j < layer.outSize; j++) p[layer.bOffset + j] = 0;
  }
}

/** Preallocated per-sample buffers so the training loop never allocates. */
export interface Workspace {
  /** Pre-activations per neuron layer (index 0 unused). */
  z: Float64Array[];
  /** Activations per neuron layer; `a[0]` is the input. */
  a: Float64Array[];
  /** ∂L/∂z per neuron layer (index 0 unused). */
  delta: Float64Array[];
}

export function createWorkspace(model: Model): Workspace {
  return {
    z: model.sizes.map((n) => new Float64Array(n)),
    a: model.sizes.map((n) => new Float64Array(n)),
    delta: model.sizes.map((n) => new Float64Array(n)),
  };
}

/** Forward pass for one sample; fills `ws` and returns the output probability. */
export function forward(model: Model, x: ArrayLike<number>, ws: Workspace, xOffset = 0): number {
  const p = model.params;
  const a0 = ws.a[0];
  for (let i = 0; i < a0.length; i++) a0[i] = x[xOffset + i];
  for (const layer of model.layers) {
    const prev = ws.a[layer.index - 1];
    const z = ws.z[layer.index];
    const a = ws.a[layer.index];
    for (let j = 0; j < layer.outSize; j++) {
      let sum = p[layer.bOffset + j];
      const row = layer.wOffset + j * layer.inSize;
      for (let i = 0; i < layer.inSize; i++) sum += p[row + i] * prev[i];
      z[j] = sum;
      a[j] = activate(layer.activation, sum);
    }
  }
  return ws.a[ws.a.length - 1][0];
}

/** Output logit of the last forward pass. */
export function outputLogit(ws: Workspace): number {
  return ws.z[ws.z.length - 1][0];
}

/**
 * Backpropagates one sample after `forward` and adds its gradients into `grads`.
 * Returns the sample's cross-entropy loss.
 */
export function backwardAccumulate(model: Model, ws: Workspace, y: number, grads: Float64Array): number {
  const p = model.params;
  const L = model.layers.length;
  const zOut = outputLogit(ws);
  ws.delta[L][0] = sigmoid(zOut) - y;
  for (let k = L - 1; k >= 0; k--) {
    const layer = model.layers[k];
    const l = layer.index;
    const prev = ws.a[l - 1];
    const delta = ws.delta[l];
    for (let j = 0; j < layer.outSize; j++) {
      const d = delta[j];
      const row = layer.wOffset + j * layer.inSize;
      for (let i = 0; i < layer.inSize; i++) grads[row + i] += d * prev[i];
      grads[layer.bOffset + j] += d;
    }
    if (l > 1) {
      const below = model.layers[k - 1];
      const prevDelta = ws.delta[l - 1];
      const prevZ = ws.z[l - 1];
      for (let i = 0; i < layer.inSize; i++) {
        let sum = 0;
        for (let j = 0; j < layer.outSize; j++) sum += p[layer.wOffset + j * layer.inSize + i] * delta[j];
        prevDelta[i] = sum * activateDerivative(below.activation, prevZ[i], prev[i]);
      }
    }
  }
  return bceFromLogit(zOut, y);
}

/** Flat sample storage: `x` has `inputSize` values per sample, `y` is 0/1. */
export interface Samples {
  x: Float64Array;
  y: Uint8Array;
  count: number;
}

/**
 * Mean loss and gradients over `indices[start..end)`, including L2 on weights (not biases).
 * Overwrites `grads`.
 */
export function batchGradients(
  model: Model,
  ws: Workspace,
  data: Samples,
  indices: ArrayLike<number>,
  start: number,
  end: number,
  grads: Float64Array,
  l2 = 0,
): number {
  grads.fill(0);
  const n = end - start;
  const stride = model.spec.inputSize;
  let loss = 0;
  for (let k = start; k < end; k++) {
    const s = indices[k];
    forward(model, data.x, ws, s * stride);
    loss += backwardAccumulate(model, ws, data.y[s], grads);
  }
  for (let k = 0; k < grads.length; k++) grads[k] /= n;
  loss /= n;
  if (l2 > 0) loss += l2Penalty(model, l2, grads);
  return loss;
}

/** Adds λ·w to weight gradients and returns λ/2·Σw². */
function l2Penalty(model: Model, l2: number, grads: Float64Array): number {
  const p = model.params;
  let sum = 0;
  for (const layer of model.layers) {
    const end = layer.wOffset + layer.inSize * layer.outSize;
    for (let k = layer.wOffset; k < end; k++) {
      sum += p[k] * p[k];
      grads[k] += l2 * p[k];
    }
  }
  return 0.5 * l2 * sum;
}

export interface Evaluation {
  loss: number;
  accuracy: number;
}

export function evaluate(model: Model, ws: Workspace, data: Samples): Evaluation {
  if (data.count === 0) return { loss: NaN, accuracy: NaN };
  const stride = model.spec.inputSize;
  let loss = 0;
  let correct = 0;
  for (let s = 0; s < data.count; s++) {
    const prob = forward(model, data.x, ws, s * stride);
    const y = data.y[s];
    loss += bceFromLogit(outputLogit(ws), y);
    if ((prob >= 0.5 ? 1 : 0) === y) correct++;
  }
  return { loss: loss / data.count, accuracy: correct / data.count };
}
