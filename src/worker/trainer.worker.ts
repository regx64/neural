/// <reference lib="webworker" />
import { predictGrid } from '@core/nn/grid';
import { createModel } from '@core/nn/model';
import { Timeline } from '@core/timeline';
import { toModelSpec } from '@core/train/config';
import { Trainer, type TrainerState } from '@core/train/trainer';
import {
  BOUNDARY_INTERVAL_MS,
  BOUNDARY_RES,
  STATE_INTERVAL_MS,
  type Command,
  type Speed,
  type WorkerEvent,
} from './protocol';

declare const self: DedicatedWorkerGlobalScope;

/** Max time per slice spent training before yielding to process incoming commands. */
const SLICE_MS = 10;

let trainer: Trainer | null = null;
let version = 0;
let running = false;
let speed: Speed = 50;
let owed = 0;
let lastTick = 0;
let lastEmit = 0;
let lastBoundary = 0;
let scheduled = false;
const timeline = new Timeline<TrainerState>();
let timelineDirty = true;
let previewId: number | null = null;

// MessageChannel schedules faster than setTimeout(0), which browsers clamp to ≥ 4ms.
const channel = new MessageChannel();
channel.port1.onmessage = () => {
  scheduled = false;
  tick();
};

function schedule(): void {
  if (scheduled || !running) return;
  scheduled = true;
  if (speed === 'max') channel.port2.postMessage(null);
  else
    setTimeout(() => {
      scheduled = false;
      tick();
    }, 8);
}

function post(event: WorkerEvent, transfer: Transferable[] = []): void {
  self.postMessage(event, transfer);
}

function record(t: Trainer, event: boolean, loss?: number): void {
  const m = t.metrics();
  timeline.add(
    {
      epoch: t.epoch,
      trainLoss: loss ?? m.trainLoss,
      trainAccuracy: m.trainAccuracy,
      testAccuracy: m.testAccuracy,
      event,
    },
    t.snapshot(),
  );
  timelineDirty = true;
}

/** Starts a fresh timeline whose first entry is the current (usually untrained) state. */
function restartTimeline(): void {
  timeline.clear();
  if (trainer) record(trainer, false);
}

/** One epoch, recording a snapshot when the timeline policy asks for it. */
function trainOne(t: Trainer): void {
  const loss = t.trainEpoch();
  const why = timeline.wants(t.epoch, loss);
  if (why) record(t, why === 'event', loss);
}

function emit(forceBoundary: boolean): void {
  if (!trainer) return;
  const now = performance.now();
  lastEmit = now;
  const snap = previewId !== null ? timeline.get(previewId) : undefined;
  const params = snap ? snap.params.slice() : trainer.model.params.slice();
  let boundary: Float32Array | null = null;
  if (forceBoundary || snap || now - lastBoundary >= BOUNDARY_INTERVAL_MS) {
    const model = snap ? createModel(toModelSpec(trainer.config.network), params) : trainer.model;
    boundary = predictGrid(model, trainer.config.network.features, BOUNDARY_RES);
    lastBoundary = now;
  }
  const metrics = snap ? { ...trainer.metricsFor(snap.params), epoch: snap.epoch } : trainer.metrics();
  const gradMean = Float32Array.from(snap ? snap.gradMean : trainer.gradMean);
  const transfer: Transferable[] = [params.buffer, gradMean.buffer];
  if (boundary) transfer.push(boundary.buffer);
  post(
    {
      type: 'state',
      version,
      running,
      metrics,
      params,
      boundary,
      boundaryRes: BOUNDARY_RES,
      gradMean,
      preview: snap && previewId !== null ? { id: previewId, epoch: snap.epoch } : null,
      timeline: timelineDirty ? timeline.metas() : undefined,
    },
    transfer,
  );
  timelineDirty = false;
}

function tick(): void {
  if (!running || !trainer) return;
  const t = trainer;
  const start = performance.now();
  if (speed === 'max') {
    do trainOne(t);
    while (performance.now() - start < SLICE_MS);
  } else {
    owed += ((start - lastTick) / 1000) * speed;
    let n = Math.floor(owed);
    owed -= n;
    while (n-- > 0) {
      trainOne(t);
      // Can't keep up with the requested speed: drop the backlog instead of freezing.
      if (performance.now() - start > SLICE_MS) {
        owed = 0;
        break;
      }
    }
  }
  lastTick = start;
  if (performance.now() - lastEmit >= STATE_INTERVAL_MS) emit(false);
  schedule();
}

function setRunning(next: boolean): void {
  if (next) previewId = null;
  running = next;
  owed = 0;
  lastTick = performance.now();
  emit(true);
  schedule();
}

self.onmessage = (e: MessageEvent<Command>) => {
  const cmd = e.data;
  try {
    switch (cmd.type) {
      case 'init':
        trainer = new Trainer(cmd.config);
        if (cmd.weights && cmd.weights.params.length === trainer.model.params.length) {
          trainer.model.params.set(cmd.weights.params);
          trainer.epoch = cmd.weights.epoch;
        }
        version = cmd.version;
        previewId = null;
        restartTimeline();
        setRunning(cmd.running);
        break;
      case 'play':
        setRunning(true);
        break;
      case 'pause':
        setRunning(false);
        break;
      case 'step':
        if (!trainer) break;
        running = false;
        previewId = null;
        for (let k = 0; k < cmd.epochs; k++) trainOne(trainer);
        emit(true);
        break;
      case 'reset':
        trainer?.reset();
        previewId = null;
        restartTimeline();
        emit(true);
        break;
      case 'setHyper':
        trainer?.setHyper(cmd.hyper);
        break;
      case 'setData':
        trainer?.setData(cmd.dataset);
        previewId = null;
        // Past snapshots were measured on the old data; start the record again from here.
        restartTimeline();
        emit(true);
        break;
      case 'setSpeed':
        speed = cmd.speed;
        owed = 0;
        break;
      case 'preview':
        if (!timeline.get(cmd.id)) break;
        running = false;
        previewId = cmd.id;
        emit(true);
        break;
      case 'exitPreview':
        previewId = null;
        emit(true);
        break;
      case 'resume': {
        const snap = timeline.get(cmd.id);
        if (!trainer || !snap) break;
        trainer.restore(snap);
        timeline.truncateAfter(cmd.id);
        timelineDirty = true;
        previewId = null;
        setRunning(cmd.play);
        break;
      }
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
