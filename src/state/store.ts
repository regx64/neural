import { create } from 'zustand';
import { generateDataset, type Dataset, type DatasetConfig } from '@core/data/datasets';
import { DEFAULT_CONFIG, type ExperimentConfig, type Hyper, type NetworkConfig } from '@core/train/config';
import type { SnapshotMeta } from '@core/timeline';
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

export type EdgeMode = 'weight' | 'contribution' | 'gradient';

export interface Live {
  params: Float64Array | null;
  metrics: Metrics | null;
  running: boolean;
  boundary: Float32Array | null;
  boundaryRes: number;
  /** Mean ∂L/∂θ of the last epoch (same layout as params). */
  gradMean: Float32Array | null;
  /** Set while a past snapshot is shown instead of the live run. */
  preview: { id: number; epoch: number } | null;
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

/** A frozen copy of an experiment's result, for A/B comparison. */
export interface Pinned {
  label: string;
  config: ExperimentConfig;
  dataset: Dataset;
  boundary: Float32Array | null;
  boundaryRes: number;
  metrics: Metrics | null;
  history: {
    epochs: number[];
    trainLoss: number[];
    testLoss: number[];
    trainAccuracy: number[];
    testAccuracy: number[];
  };
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
  /** Recorded snapshots of the current run (Time Travel). */
  timeline: SnapshotMeta[];
  /** Snapshot most recently requested for preview (ahead of the worker's confirmation). */
  previewTarget: number | null;
  /** How many times the learner rewound and continued from a snapshot. */
  resumes: number;
  showPulses: boolean;
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
  /** Replaces the whole experiment (lessons, shared links, saved experiments): paused, nothing selected. */
  loadConfig(config: ExperimentConfig, weights?: { params: number[]; epoch: number }): void;
  /** Short confirmation message at the top of the lab. */
  toast: { id: number; text: string } | null;
  showToast(text: string): void;
  /** Experiment pinned for side-by-side comparison. */
  compareA: Pinned | null;
  /** The latest live (non-preview) result — what pinning while viewing the past refers to. */
  lastLive: { boundary: Float32Array | null; boundaryRes: number; metrics: Metrics | null };
  pinA(label: string): void;
  clearA(): void;
  /** Live data editing: swaps in user-drawn points without resetting the weights. */
  editPoints(points: number[], labels: number[]): void;
  setAdvancedOpen(open: boolean): void;
  setDrawMode(on: boolean): void;
  setDrawClass(c: 0 | 1): void;
  setShowPulses(on: boolean): void;
  /** Time Travel: show a recorded snapshot (pauses training). */
  previewSnapshot(id: number): void;
  exitPreview(): void;
  /** Continue training from the snapshot being previewed; later records are dropped. */
  resumeFromPreview(play: boolean): void;
  /** Move the preview to the previous (−1) or next (+1) snapshot. */
  stepSnapshot(dir: -1 | 1): void;
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
  gradMean: null,
  preview: null,
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
  const reinit = (
    config: ExperimentConfig,
    dataChanged: boolean,
    running = get().live.running,
    weights?: { params: number[]; epoch: number },
  ) => {
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
      timeline: [],
      previewTarget: null,
      hover: null,
      probe: dataChanged
        ? { ...s.probe, sampleIndex: 0, point: s.probe.auto ? null : s.probe.point }
        : s.probe,
    });
    client?.send({ type: 'init', config, version, running, weights });
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
    // A previewed past state is shown everywhere but must not be added to the history.
    if (!e.preview) s.history.push(e.metrics, e.params);
    set({
      live: {
        params: e.params,
        metrics: e.metrics,
        running: e.running,
        boundary: e.boundary ?? s.live.boundary,
        boundaryRes: e.boundary ? e.boundaryRes : s.live.boundaryRes,
        gradMean: e.gradMean,
        preview: e.preview,
        epochsPerSecond: eps,
        tick: s.live.tick + 1,
      },
      historyTick: s.historyTick + 1,
      ...(e.timeline ? { timeline: e.timeline } : {}),
      ...(!e.preview
        ? {
            lastLive: {
              boundary: e.boundary ?? s.lastLive.boundary,
              boundaryRes: e.boundary ? e.boundaryRes : s.lastLive.boundaryRes,
              metrics: e.metrics,
            },
          }
        : {}),
      ...(!e.preview && s.previewTarget !== null && e.running ? { previewTarget: null } : {}),
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
    timeline: [],
    previewTarget: null,
    resumes: 0,
    showPulses: true,
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
    togglePlay: () => {
      const s = get();
      if (s.live.preview) s.resumeFromPreview(true);
      else if (s.live.running) s.pause();
      else s.play();
    },
    step: () => {
      if (get().live.preview) get().resumeFromPreview(false);
      client?.send({ type: 'step', epochs: 1 });
    },
    reset: () => {
      get().history.clear();
      set({ previewTarget: null });
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
    loadConfig(config, weights) {
      set({
        selection: null,
        hover: null,
        edgeMode: 'weight',
        drawMode: false,
        probe: { point: null, auto: true, sampleIndex: 0 },
      });
      reinit(config, true, false, weights);
    },
    toast: null,
    showToast: (text) => set({ toast: { id: (get().toast?.id ?? 0) + 1, text } }),
    compareA: null,
    lastLive: { boundary: null, boundaryRes: 0, metrics: null },
    pinA(label) {
      const s = get();
      const h = s.history;
      const latest = s.lastLive;
      set({
        compareA: {
          label,
          config: s.config,
          dataset: s.dataset,
          boundary: latest.boundary ? latest.boundary.slice() : null,
          boundaryRes: latest.boundaryRes,
          metrics: latest.metrics,
          history: {
            epochs: h.epochs.slice(),
            trainLoss: h.trainLoss.slice(),
            testLoss: h.testLoss.slice(),
            trainAccuracy: h.trainAccuracy.slice(),
            testAccuracy: h.testAccuracy.slice(),
          },
        },
        historyTick: s.historyTick + 1,
      });
    },
    clearA: () => set({ compareA: null, historyTick: get().historyTick + 1 }),
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
    setShowPulses: (showPulses) => set({ showPulses }),
    previewSnapshot: (id) => {
      set({ previewTarget: id });
      client?.send({ type: 'preview', id });
    },
    exitPreview: () => {
      set({ previewTarget: null });
      client?.send({ type: 'exitPreview' });
    },
    resumeFromPreview(play) {
      const p = get().live.preview;
      if (!p) return;
      // Keep the abandoned branch so it can be compared with the new one.
      get().pinA(`되감기 전 (Epoch ${(get().history.epochs.at(-1) ?? 0).toLocaleString()}까지)`);
      get().history.truncate(p.epoch);
      set({ resumes: get().resumes + 1, previewTarget: null });
      get().showToast('이전 학습 기록을 A로 남겨 뒀어요. 학습 곡선 카드에서 비교할 수 있어요.');
      client?.send({ type: 'resume', id: p.id, play });
    },
    stepSnapshot(dir) {
      const { timeline, live, previewTarget } = get();
      if (timeline.length === 0) return;
      // Use the requested target so quick repeated presses keep moving before the worker replies.
      const viewing = previewTarget ?? live.preview?.id ?? null;
      const found = viewing === null ? -1 : timeline.findIndex((m) => m.id === viewing);
      const cur = found >= 0 ? found : timeline.length - 1;
      // From the live run, "back" first goes to the newest snapshot strictly before now.
      let k = cur + dir;
      if (found < 0 && dir === -1 && timeline[cur].epoch < (live.metrics?.epoch ?? 0)) k = cur;
      if (found < 0 && dir === 1) return;
      if (k < 0) k = 0;
      if (k >= timeline.length) {
        get().exitPreview();
        return;
      }
      get().previewSnapshot(timeline[k].id);
    },
  };
});

// Auto-save the experiment so a reload (or a later visit) picks up where the learner left off.
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useLab.subscribe((s, p) => {
  if (s.config === p.config) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveConfig(s.config), 300);
});
