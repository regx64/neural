/// <reference lib="webworker" />
import { predictGrid } from '@core/nn/grid';
import { Trainer } from '@core/train/trainer';
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

function emit(forceBoundary: boolean): void {
  if (!trainer) return;
  const now = performance.now();
  lastEmit = now;
  let boundary: Float32Array | null = null;
  if (forceBoundary || now - lastBoundary >= BOUNDARY_INTERVAL_MS) {
    boundary = predictGrid(trainer.model, trainer.config.network.features, BOUNDARY_RES);
    lastBoundary = now;
  }
  const params = trainer.model.params.slice();
  const transfer: Transferable[] = [params.buffer];
  if (boundary) transfer.push(boundary.buffer);
  post(
    {
      type: 'state',
      version,
      running,
      metrics: trainer.metrics(),
      params,
      boundary,
      boundaryRes: BOUNDARY_RES,
    },
    transfer,
  );
}

function tick(): void {
  if (!running || !trainer) return;
  const start = performance.now();
  if (speed === 'max') {
    do trainer.trainEpoch();
    while (performance.now() - start < SLICE_MS);
  } else {
    owed += ((start - lastTick) / 1000) * speed;
    let n = Math.floor(owed);
    owed -= n;
    while (n-- > 0) {
      trainer.trainEpoch();
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
        version = cmd.version;
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
        for (let k = 0; k < cmd.epochs; k++) trainer.trainEpoch();
        emit(true);
        break;
      case 'reset':
        trainer?.reset();
        emit(true);
        break;
      case 'setHyper':
        trainer?.setHyper(cmd.hyper);
        break;
      case 'setData':
        trainer?.setData(cmd.dataset);
        emit(true);
        break;
      case 'setSpeed':
        speed = cmd.speed;
        owed = 0;
        break;
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
