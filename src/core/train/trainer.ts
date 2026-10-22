import { generateDataset, toSamples, type Dataset } from '../data/datasets';
import {
  batchGradients,
  createModel,
  createWorkspace,
  evaluate,
  initParams,
  type Model,
  type Samples,
  type Workspace,
} from '../nn/model';
import { createOptimizerState, optimizerStep, type OptimizerState } from '../nn/optimizers';
import { Rng, deriveSeed } from '../rng';
import { toModelSpec, type ExperimentConfig, type Hyper } from './config';

export interface TrainerState {
  epoch: number;
  params: Float64Array;
  opt: OptimizerState;
  rng: number;
  order: Uint32Array;
  gradMean: Float64Array;
}

export interface Metrics {
  epoch: number;
  trainLoss: number;
  testLoss: number;
  trainAccuracy: number;
  testAccuracy: number;
}

/** Pure training state machine. Runs in the worker in the app and directly in unit tests. */
export class Trainer {
  config: ExperimentConfig;
  dataset!: Dataset;
  train!: Samples;
  test!: Samples;
  readonly model: Model;
  hyper: Hyper;
  epoch = 0;
  private ws: Workspace;
  private grads: Float64Array;
  /**
   * Mean gradient ∂L/∂θ over the batches of the most recent epoch — "where learning happens".
   * Its negative is the direction each parameter was just moved in (for plain SGD).
   */
  readonly gradMean: Float64Array;
  private opt!: OptimizerState;
  private batchRng!: Rng;
  private order: Uint32Array;

  constructor(config: ExperimentConfig) {
    this.config = config;
    this.hyper = { ...config.hyper };
    this.loadData();
    this.model = createModel(toModelSpec(config.network));
    this.ws = createWorkspace(this.model);
    this.grads = new Float64Array(this.model.params.length);
    this.gradMean = new Float64Array(this.model.params.length);
    this.order = new Uint32Array(this.train.count);
    this.reset();
  }

  private loadData(): void {
    const { dataset, network, seed } = this.config;
    this.dataset = generateDataset(dataset, seed);
    this.train = toSamples(this.dataset, this.dataset.train, network.features);
    this.test = toSamples(this.dataset, this.dataset.test, network.features);
  }

  /** Swaps the training data but keeps the current weights and optimizer state (live data editing). */
  setData(dataset: ExperimentConfig['dataset']): void {
    this.config = { ...this.config, dataset };
    this.loadData();
    this.order = Uint32Array.from({ length: this.train.count }, (_, i) => i);
  }

  /** Re-initializes weights, optimizer and batch order from the config seed. */
  reset(): void {
    initParams(this.model, new Rng(deriveSeed(this.config.seed, 2)));
    this.batchRng = new Rng(deriveSeed(this.config.seed, 3));
    for (let i = 0; i < this.order.length; i++) this.order[i] = i;
    this.opt = createOptimizerState(this.hyper.optimizer, this.model.params.length);
    this.epoch = 0;
    this.gradMean.fill(0);
  }

  setHyper(hyper: Partial<Hyper>): void {
    const next = { ...this.hyper, ...hyper };
    if (next.optimizer !== this.hyper.optimizer) {
      this.opt = createOptimizerState(next.optimizer, this.model.params.length);
    }
    this.hyper = next;
  }

  /** One pass over the shuffled training set. Returns the mean mini-batch loss. */
  trainEpoch(): number {
    const n = this.train.count;
    if (n === 0) return NaN;
    const bs = this.hyper.batchSize > 0 ? Math.min(this.hyper.batchSize, n) : n;
    this.batchRng.shuffle(this.order);
    let loss = 0;
    let batches = 0;
    const gm = this.gradMean;
    gm.fill(0);
    for (let start = 0; start < n; start += bs) {
      const end = Math.min(n, start + bs);
      loss += batchGradients(
        this.model,
        this.ws,
        this.train,
        this.order,
        start,
        end,
        this.grads,
        this.hyper.l2,
      );
      for (let k = 0; k < gm.length; k++) gm[k] += this.grads[k];
      optimizerStep(this.opt, this.model.params, this.grads, this.hyper.learningRate);
      batches++;
    }
    for (let k = 0; k < gm.length; k++) gm[k] /= batches;
    this.epoch++;
    return loss / batches;
  }

  /** Everything needed to continue this run exactly from here (copies). */
  snapshot(): TrainerState {
    return {
      epoch: this.epoch,
      params: this.model.params.slice(),
      opt: { id: this.opt.id, t: this.opt.t, m: this.opt.m.slice(), v: this.opt.v.slice() },
      rng: this.batchRng.getState(),
      order: this.order.slice(),
      gradMean: this.gradMean.slice(),
    };
  }

  /** Rewinds to a snapshot. The current hyperparameters are kept so a branch can try new ones. */
  restore(st: TrainerState): void {
    this.model.params.set(st.params);
    this.opt =
      st.opt.id === this.hyper.optimizer
        ? { id: st.opt.id, t: st.opt.t, m: st.opt.m.slice(), v: st.opt.v.slice() }
        : createOptimizerState(this.hyper.optimizer, this.model.params.length);
    this.batchRng.setState(st.rng);
    if (st.order.length === this.order.length) this.order.set(st.order);
    else for (let i = 0; i < this.order.length; i++) this.order[i] = i;
    this.gradMean.set(st.gradMean);
    this.epoch = st.epoch;
  }

  /** Metrics as if the model had `params`, without changing the run. */
  metricsFor(params: Float64Array): Metrics {
    const saved = this.model.params.slice();
    this.model.params.set(params);
    const m = this.metrics();
    this.model.params.set(saved);
    return m;
  }

  metrics(): Metrics {
    const tr = evaluate(this.model, this.ws, this.train);
    const te = evaluate(this.model, this.ws, this.test);
    return {
      epoch: this.epoch,
      trainLoss: tr.loss,
      testLoss: te.loss,
      trainAccuracy: tr.accuracy,
      testAccuracy: te.accuracy,
    };
  }
}
