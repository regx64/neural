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

/** Accepts only configs this version of the app can build (structure, limits, data). */
export function validConfig(value: unknown): ExperimentConfig | null {
  try {
    const c = value as ExperimentConfig;
    if (
      !Array.isArray(c?.network?.hidden) ||
      c.network.hidden.length > LIMITS.maxHiddenLayers ||
      c.network.hidden.some((n) => !(n >= 1 && n <= LIMITS.maxNeurons)) ||
      !c.network.features?.length ||
      typeof c.hyper?.learningRate !== 'number' ||
      typeof c.seed !== 'number'
    )
      return null;
    createModel(toModelSpec(c.network));
    generateDataset(c.dataset, c.seed);
    return c;
  } catch {
    return null;
  }
}

/** The saved experiment, or null if there is none or it no longer fits the current app. */
export function loadSavedConfig(): ExperimentConfig | null {
  try {
    const raw = storage()?.getItem(KEY);
    return raw ? validConfig(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** JSON value under `key`, or `fallback` if missing/unreadable. */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Returns false if the browser refused to store it (quota, privacy mode). */
export function writeJSON(key: string, value: unknown): boolean {
  try {
    const st = storage();
    if (!st) return false;
    st.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
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
