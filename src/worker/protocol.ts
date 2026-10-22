import type { ExperimentConfig, Hyper } from '@core/train/config';
import type { SnapshotMeta } from '@core/timeline';
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
  | { type: 'setData'; dataset: ExperimentConfig['dataset'] }
  | { type: 'setSpeed'; speed: Speed }
  /** Show a recorded snapshot without changing the run (pauses training). */
  | { type: 'preview'; id: number }
  | { type: 'exitPreview' }
  /** Rewind the run to a snapshot, drop later snapshots, and optionally keep training. */
  | { type: 'resume'; id: number; play: boolean };

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
      /** Mean ∂L/∂θ over the last epoch, same layout as `params`. */
      gradMean: Float32Array;
      /** Set while showing a past snapshot instead of the live run. */
      preview: { id: number; epoch: number } | null;
      /** Present only when the recorded snapshots changed. */
      timeline?: SnapshotMeta[];
    }
  | { type: 'error'; message: string };

export const STATE_INTERVAL_MS = 1000 / 30;
export const BOUNDARY_INTERVAL_MS = 100;
export const BOUNDARY_RES = 64;
