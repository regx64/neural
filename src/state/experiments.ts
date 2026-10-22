import { DATASETS } from '@core/data/datasets';
import type { ExperimentConfig } from '@core/train/config';
import { readJSON, validConfig, writeJSON } from './persist';
import { layerSizesOf, useLab } from './store';

const KEY = 'neural.experiments.v1';
export const MAX_SAVED = 20;

export interface SavedExperiment {
  id: string;
  name: string;
  savedAt: number;
  config: ExperimentConfig;
  params: number[];
  epoch: number;
  trainAccuracy: number | null;
  testAccuracy: number | null;
}

export function listExperiments(): SavedExperiment[] {
  const all = readJSON<SavedExperiment[]>(KEY, []);
  return Array.isArray(all) ? all.filter((e) => validConfig(e.config)) : [];
}

/** A readable default name: dataset · structure · accuracy. */
export function suggestName(): string {
  const s = useLab.getState();
  const ds =
    s.config.dataset.id === 'custom'
      ? '직접 그림'
      : DATASETS.find((d) => d.id === s.config.dataset.id)?.label;
  const acc = s.live.metrics ? ` · ${Math.round(s.live.metrics.trainAccuracy * 100)}%` : '';
  return `${ds} · ${layerSizesOf(s.config).join('-')}${acc}`;
}

/** Saves the current experiment with its current weights. Returns false if storage is unavailable or full. */
export function saveCurrent(name: string): boolean {
  const s = useLab.getState();
  if (!s.live.params) return false;
  const entry: SavedExperiment = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || suggestName(),
    savedAt: Date.now(),
    config: s.config,
    params: Array.from(s.live.params),
    epoch: s.live.metrics?.epoch ?? 0,
    trainAccuracy: s.live.metrics?.trainAccuracy ?? null,
    testAccuracy: s.live.metrics?.testAccuracy ?? null,
  };
  return writeJSON(KEY, [entry, ...listExperiments()].slice(0, MAX_SAVED));
}

export function deleteExperiment(id: string): void {
  writeJSON(
    KEY,
    listExperiments().filter((e) => e.id !== id),
  );
}

export function openExperiment(e: SavedExperiment): void {
  useLab.getState().loadConfig(e.config, { params: e.params, epoch: e.epoch });
}
