import type { ExperimentConfig, Hyper } from '@core/train/config';
import type { Metrics } from '@core/train/trainer';

/** Training speed in epochs per second, or as fast as the worker can go. */
export type Speed = number | 'max';

/** Main thread → worker. */
export type Command =
  | { type: 'init'; config: ExperimentConfig; version: number; running: boolean }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'step'; epochs: number }
  | { type: 'reset' }
  | { type: 'setHyper'; hyper: Partial<Hyper> }
  | { type: 'setSpeed'; speed: Speed };

/** Worker → main thread. `version` lets the main thread drop states from a superseded config. */
export type WorkerEvent =
  | {
      type: 'state';
      version: number;
      running: boolean;
      metrics: Metrics;
      params: Float64Array;
      boundary: Float32Array | null;
      boundaryRes: number;
    }
  | { type: 'error'; message: string };

export const STATE_INTERVAL_MS = 1000 / 30;
export const BOUNDARY_INTERVAL_MS = 100;
export const BOUNDARY_RES = 64;
