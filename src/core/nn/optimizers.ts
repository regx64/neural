export type OptimizerId = 'sgd' | 'momentum' | 'adam';

export const OPTIMIZERS: OptimizerId[] = ['sgd', 'momentum', 'adam'];

/** Serializable optimizer state so a run can be snapshotted and resumed exactly. */
export interface OptimizerState {
  id: OptimizerId;
  t: number;
  m: Float64Array;
  v: Float64Array;
}

const MOMENTUM = 0.9;
const BETA1 = 0.9;
const BETA2 = 0.999;
const EPS = 1e-8;

export function createOptimizerState(id: OptimizerId, paramCount: number): OptimizerState {
  return {
    id,
    t: 0,
    m: new Float64Array(id === 'sgd' ? 0 : paramCount),
    v: new Float64Array(id === 'adam' ? paramCount : 0),
  };
}

export function optimizerStep(
  state: OptimizerState,
  params: Float64Array,
  grads: Float64Array,
  lr: number,
): void {
  state.t++;
  const n = params.length;
  switch (state.id) {
    case 'sgd':
      for (let k = 0; k < n; k++) params[k] -= lr * grads[k];
      return;
    case 'momentum': {
      const m = state.m;
      for (let k = 0; k < n; k++) {
        m[k] = MOMENTUM * m[k] + grads[k];
        params[k] -= lr * m[k];
      }
      return;
    }
    case 'adam': {
      const { m, v, t } = state;
      const c1 = 1 - BETA1 ** t;
      const c2 = 1 - BETA2 ** t;
      for (let k = 0; k < n; k++) {
        const g = grads[k];
        m[k] = BETA1 * m[k] + (1 - BETA1) * g;
        v[k] = BETA2 * v[k] + (1 - BETA2) * g * g;
        params[k] -= (lr * (m[k] / c1)) / (Math.sqrt(v[k] / c2) + EPS);
      }
      return;
    }
  }
}
