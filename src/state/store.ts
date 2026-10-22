import { create } from 'zustand';
import { generateDataset, type Dataset, type DatasetConfig } from '@core/data/datasets';
import { DEFAULT_CONFIG, type ExperimentConfig, type Hyper, type NetworkConfig } from '@core/train/config';
import type { Metrics } from '@core/train/trainer';
import { TrainerClient } from '@worker/client';
import type { Speed, WorkerEvent } from '@worker/protocol';
import { History } from './history';
import { loadSavedConfig, saveConfig } from './persist';

const initialConfig = loadSavedConfig() ?? DEFAULT_CONFIG;

/** A neuron (layer 0 = input) or a weight from neuron `from` of layer l−1 to neuron `to` of layer l. */
export type Target =
  | { kind: 'neuron'; layer: number; index: number }
  | { kind: 'edge'; layer: number; from: number; to: number };

export type EdgeMode = 'weight' | 'contribution';

export interface Live {
  params: Float64Array | null;
  metrics: Metrics | null;
  running: boolean;
  boundary: Float32Array | null;
  boundaryRes: number;
  /** Measured training throughput (epochs/s), smoothed. */
  epochsPerSecond: number;
  /** Increments on every state received from the worker. */
  tick: number;
}

export interface Probe {
  /** Raw input point in [−1, 1]²; null until the first sample is chosen. */
  point: [number, number] | null;
  /** Cycle through training samples automatically. */
  auto: boolean;
  sampleIndex: number;
}

export interface CameraRequest {
  id: number;
  kind: 'preset' | 'focus';
  preset?: 1 | 2 | 3;
  target?: [number, number, number];
}

export interface LabState {
  config: ExperimentConfig;
  /** Increments whenever the model structure or data changes (requires re-init). */
  version: number;
  dataset: Dataset;
  live: Live;
  history: History;
  historyTick: number;
  probe: Probe;
  selection: Target | null;
  hover: Target | null;
  pointer: { x: number; y: number };
  edgeMode: EdgeMode;
  speed: Speed;
  camera: CameraRequest | null;
  error: string | null;
  /** UI state that lessons can drive. */
  advancedOpen: boolean;
  drawMode: boolean;
  drawClass: 0 | 1;

  connect(): () => void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  step(): void;
  reset(): void;
  newSeed(): void;
  setDataset(patch: Partial<DatasetConfig>): void;
  setNetwork(patch: Partial<NetworkConfig>): void;
  setHyper(patch: Partial<Hyper>): void;
  setSpeed(speed: Speed): void;
  setProbePoint(point: [number, number]): void;
  setProbeAuto(auto: boolean): void;
  advanceProbe(): void;
  select(target: Target | null): void;
  setHover(target: Target | null, pointer?: { x: number; y: number }): void;
  setEdgeMode(mode: EdgeMode): void;
  requestCamera(req: Omit<CameraRequest, 'id'>): void;
  /** Replaces the whole experiment (used by lessons): paused, fresh weights, nothing selected. */
  loadConfig(config: ExperimentConfig): void;
  /** Live data editing: swaps in user-drawn points without resetting the weights. */
  editPoints(points: number[], labels: number[]): void;
  setAdvancedOpen(open: boolean): void;
  setDrawMode(on: boolean): void;
  setDrawClass(c: 0 | 1): void;
}

let client: TrainerClient | null = null;
let lastStateAt = 0;
let lastStateEpoch = 0;

const emptyLive = (): Live => ({
  params: null,
  metrics: null,
  running: false,
  boundary: null,
  boundaryRes: 0,
  epochsPerSecond: 0,
  tick: 0,
});

/** Whether `t` still refers to an existing neuron/edge for layer sizes `sizes`. */
export function targetExists(t: Target, sizes: number[]): boolean {
  if (t.layer < 0 || t.layer >= sizes.length) return false;
  if (t.kind === 'neuron') return t.index < sizes[t.layer];
  return t.layer >= 1 && t.to < sizes[t.layer] && t.from < sizes[t.layer - 1];
}

export function layerSizesOf(config: ExperimentConfig): number[] {
  return [config.network.features.length, ...config.network.hidden, 1];
}

export const useLab = create<LabState>()((set, get) => {
  /** Applies a config change that needs new data/model, keeping the run going if it was. */
  const reinit = (config: ExperimentConfig, dataChanged: boolean, running = get().live.running) => {
    const s = get();
    const version = s.version + 1;
    const dataset = dataChanged ? generateDataset(config.dataset, config.seed) : s.dataset;
    const sizes = layerSizesOf(config);
    s.history.clear();
    set({
      config,
      version,
      dataset,
      live: { ...emptyLive(), running },
      historyTick: s.historyTick + 1,
      selection: s.selection && targetExists(s.selection, sizes) ? s.selection : null,
      hover: null,
      probe: dataChanged
        ? { ...s.probe, sampleIndex: 0, point: s.probe.auto ? null : s.probe.point }
        : s.probe,
    });
    client?.send({ type: 'init', config, version, running });
    if (get().probe.point === null) get().advanceProbe();
  };

  const onEvent = (e: WorkerEvent) => {
    if (e.type === 'error') {
      set({ error: e.message });
      return;
    }
    const s = get();
    if (e.version !== s.version) return;
    const now = performance.now();
    let eps = s.live.epochsPerSecond;
    if (e.running && lastStateAt > 0 && now > lastStateAt) {
      const inst = ((e.metrics.epoch - lastStateEpoch) / (now - lastStateAt)) * 1000;
      eps = eps === 0 ? inst : eps * 0.85 + inst * 0.15;
    } else if (!e.running) eps = 0;
    lastStateAt = now;
    lastStateEpoch = e.metrics.epoch;
    s.history.push(e.metrics, e.params);
    set({
      live: {
        params: e.params,
        metrics: e.metrics,
        running: e.running,
        boundary: e.boundary ?? s.live.boundary,
        boundaryRes: e.boundary ? e.boundaryRes : s.live.boundaryRes,
        epochsPerSecond: eps,
        tick: s.live.tick + 1,
      },
      historyTick: s.historyTick + 1,
    });
  };

  return {
    config: initialConfig,
    version: 1,
    dataset: generateDataset(initialConfig.dataset, initialConfig.seed),
    live: emptyLive(),
    history: new History(),
    historyTick: 0,
    probe: { point: null, auto: true, sampleIndex: 0 },
    selection: null,
    hover: null,
    pointer: { x: 0, y: 0 },
    edgeMode: 'weight',
    speed: 50,
    camera: null,
    error: null,
    advancedOpen: false,
    drawMode: false,
    drawClass: 1,

    connect() {
      client?.dispose();
      client = new TrainerClient(onEvent);
      const s = get();
      client.send({ type: 'setSpeed', speed: s.speed });
      client.send({ type: 'init', config: s.config, version: s.version, running: false });
      if (s.probe.point === null) s.advanceProbe();
      return () => {
        client?.dispose();
        client = null;
      };
    },
    play: () => client?.send({ type: 'play' }),
    pause: () => client?.send({ type: 'pause' }),
    togglePlay: () => (get().live.running ? get().pause() : get().play()),
    step: () => client?.send({ type: 'step', epochs: 1 }),
    reset: () => {
      get().history.clear();
      client?.send({ type: 'reset' });
    },
    newSeed() {
      const seed = Math.floor(Math.random() * 1e6);
      reinit({ ...get().config, seed }, true);
    },
    setDataset(patch) {
      const config = get().config;
      reinit({ ...config, dataset: { ...config.dataset, ...patch } }, true);
    },
    setNetwork(patch) {
      const config = get().config;
      reinit({ ...config, network: { ...config.network, ...patch } }, false);
    },
    setHyper(patch) {
      const config = get().config;
      set({ config: { ...config, hyper: { ...config.hyper, ...patch } } });
      client?.send({ type: 'setHyper', hyper: patch });
    },
    setSpeed(speed) {
      set({ speed });
      client?.send({ type: 'setSpeed', speed });
    },
    setProbePoint(point) {
      set({ probe: { ...get().probe, point, auto: false } });
    },
    setProbeAuto(auto) {
      set({ probe: { ...get().probe, auto } });
      if (auto) get().advanceProbe();
    },
    advanceProbe() {
      const { dataset, probe } = get();
      if (dataset.train.length === 0) return;
      const sampleIndex = (probe.sampleIndex + 1) % dataset.train.length;
      const s = dataset.train[sampleIndex];
      set({ probe: { ...probe, sampleIndex, point: [dataset.points[2 * s], dataset.points[2 * s + 1]] } });
    },
    select: (selection) => set({ selection }),
    setHover: (hover, pointer) => set(pointer ? { hover, pointer } : { hover }),
    setEdgeMode: (edgeMode) => set({ edgeMode }),
    requestCamera: (req) => set({ camera: { ...req, id: (get().camera?.id ?? 0) + 1 } }),
    loadConfig(config) {
      set({
        selection: null,
        hover: null,
        edgeMode: 'weight',
        drawMode: false,
        probe: { point: null, auto: true, sampleIndex: 0 },
      });
      reinit(config, true, false);
    },
    editPoints(points, labels) {
      const s = get();
      const dataset: DatasetConfig = { ...s.config.dataset, id: 'custom', points, labels };
      const config = { ...s.config, dataset };
      set({ config, dataset: generateDataset(dataset, config.seed) });
      client?.send({ type: 'setData', dataset });
      if (get().probe.auto) get().advanceProbe();
    },
    setAdvancedOpen: (advancedOpen) => set({ advancedOpen }),
    setDrawMode: (drawMode) => {
      set({ drawMode });
      // Start the drawing from whatever is on screen so the learner edits, not starts over.
      const s = get();
      if (drawMode && s.config.dataset.id !== 'custom') {
        const n = s.dataset.count;
        s.editPoints(Array.from(s.dataset.points.slice(0, n * 2)), Array.from(s.dataset.labels));
      }
    },
    setDrawClass: (drawClass) => set({ drawClass }),
  };
});

// Auto-save the experiment so a reload (or a later visit) picks up where the learner left off.
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useLab.subscribe((s, p) => {
  if (s.config === p.config) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveConfig(s.config), 300);
});
