import type { DatasetConfig } from '../data/datasets';
import type { FeatureId } from '../data/features';
import type { ActivationId } from '../nn/activations';
import type { ModelSpec } from '../nn/model';
import type { OptimizerId } from '../nn/optimizers';

export interface NetworkConfig {
  features: FeatureId[];
  hidden: number[];
  activation: ActivationId;
}

export interface Hyper {
  learningRate: number;
  optimizer: OptimizerId;
  /** 0 means full batch. */
  batchSize: number;
  l2: number;
}

/** Everything needed to reproduce a run bit for bit. */
export interface ExperimentConfig {
  dataset: DatasetConfig;
  network: NetworkConfig;
  hyper: Hyper;
  seed: number;
}

export const LIMITS = {
  maxHiddenLayers: 6,
  maxNeurons: 16,
  minSamples: 50,
  maxSamples: 500,
};

export const DEFAULT_CONFIG: ExperimentConfig = {
  dataset: { id: 'xor', samples: 200, noise: 0.1, trainRatio: 0.7 },
  network: { features: ['x1', 'x2'], hidden: [4], activation: 'tanh' },
  hyper: { learningRate: 0.03, optimizer: 'adam', batchSize: 10, l2: 0 },
  seed: 42,
};

export function toModelSpec(network: NetworkConfig): ModelSpec {
  return { inputSize: network.features.length, hidden: network.hidden, activation: network.activation };
}
