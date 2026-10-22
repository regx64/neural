import { generateDataset } from '@core/data/datasets';
import { createModel } from '@core/nn/model';
import { LIMITS, toModelSpec, type ExperimentConfig } from '@core/train/config';

const KEY = 'neural.config.v1';

/** localStorage can be unavailable (private mode, blocked storage) — never let that break the app. */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveConfig(config: ExperimentConfig): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(config));
  } catch {
    // Quota or privacy settings — auto-save is a convenience only.
  }
}

/** The saved experiment, or null if there is none or it no longer fits the current app. */
export function loadSavedConfig(): ExperimentConfig | null {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as ExperimentConfig;
    if (
      !Array.isArray(c.network?.hidden) ||
      c.network.hidden.length > LIMITS.maxHiddenLayers ||
      c.network.hidden.some((n) => !(n >= 1 && n <= LIMITS.maxNeurons)) ||
      !c.network.features?.length ||
      typeof c.hyper?.learningRate !== 'number'
    )
      return null;
    createModel(toModelSpec(c.network));
    generateDataset(c.dataset, c.seed);
    return c;
  } catch {
    return null;
  }
}

export function readFlag(key: string): boolean {
  try {
    return storage()?.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function setFlag(key: string): void {
  try {
    storage()?.setItem(key, '1');
  } catch {
    // ignore
  }
}
