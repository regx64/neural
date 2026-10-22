import type { Command, WorkerEvent } from './protocol';

export class TrainerClient {
  private worker: Worker;

  constructor(onEvent: (event: WorkerEvent) => void) {
    this.worker = new Worker(new URL('./trainer.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<WorkerEvent>) => onEvent(e.data);
    this.worker.onerror = (e) => onEvent({ type: 'error', message: e.message });
  }

  send(cmd: Command): void {
    this.worker.postMessage(cmd);
  }

  dispose(): void {
    this.worker.terminate();
  }
}
