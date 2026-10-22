/** What the main thread needs to draw a timeline marker; the heavy state stays in the worker. */
export interface SnapshotMeta {
  id: number;
  epoch: number;
  trainLoss: number;
  trainAccuracy: number;
  testAccuracy: number;
  /** Recorded because the loss dropped sharply, not on the regular schedule. */
  event: boolean;
}

/** Relative loss drop since the last snapshot that triggers an extra "event" snapshot. */
export const EVENT_DROP = 0.2;

/**
 * Snapshot recording policy for Time Travel. Records every `interval` epochs (starting at 5);
 * when more than `max` snapshots exist, every other scheduled one is dropped and the interval
 * doubles, so coverage stays even over the whole run at bounded memory. Sharp loss drops are
 * recorded as events and kept through thinning.
 */
export class Timeline<T> {
  interval = 5;
  private items: { meta: SnapshotMeta; data: T }[] = [];
  private nextId = 1;

  constructor(readonly max = 200) {}

  /** Should the state after `epoch` (with mini-batch loss `loss`) be recorded, and why? */
  wants(epoch: number, loss: number): 'scheduled' | 'event' | null {
    if (epoch % this.interval === 0) return 'scheduled';
    const last = this.items[this.items.length - 1]?.meta;
    if (last && Number.isFinite(loss) && epoch - last.epoch >= 2 && loss < last.trainLoss * (1 - EVENT_DROP))
      return 'event';
    return null;
  }

  add(meta: Omit<SnapshotMeta, 'id'>, data: T): SnapshotMeta {
    const full = { ...meta, id: this.nextId++ };
    this.items.push({ meta: full, data });
    if (this.items.length > this.max) this.thin();
    return full;
  }

  private thin(): void {
    const last = this.items.length - 1;
    let scheduled = 0;
    this.items = this.items.filter((it, k) => {
      if (k === 0 || k === last || it.meta.event) return true;
      return scheduled++ % 2 === 1;
    });
    // Fallback if events alone overflow: keep every other event too.
    if (this.items.length > this.max) this.items = this.items.filter((_, k) => k % 2 === 0 || k === last);
    this.interval *= 2;
  }

  get(id: number): T | undefined {
    return this.items.find((it) => it.meta.id === id)?.data;
  }

  metaOf(id: number): SnapshotMeta | undefined {
    return this.items.find((it) => it.meta.id === id)?.meta;
  }

  /** Drops everything recorded after snapshot `id` (branching from the past). */
  truncateAfter(id: number): void {
    const meta = this.metaOf(id);
    if (meta) this.items = this.items.filter((it) => it.meta.epoch <= meta.epoch);
  }

  clear(): void {
    this.items = [];
    this.interval = 5;
  }

  metas(): SnapshotMeta[] {
    return this.items.map((it) => it.meta);
  }
}
