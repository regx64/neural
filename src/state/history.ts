import type { Metrics } from '@core/train/trainer';

const MAX_POINTS = 2000;
const MAX_PARAM_SNAPSHOTS = 200;

/**
 * Metric series and parameter snapshots for charts and sparklines. Kept outside React state
 * (mutated in place, ≤ 30 Hz) — consumers watch `historyTick` in the store to redraw.
 */
export class History {
  epochs: number[] = [];
  trainLoss: number[] = [];
  testLoss: number[] = [];
  trainAccuracy: number[] = [];
  testAccuracy: number[] = [];
  paramEpochs: number[] = [];
  params: Float32Array[] = [];

  clear(): void {
    for (const arr of this.series()) arr.length = 0;
    this.paramEpochs.length = 0;
    this.params.length = 0;
  }

  /** Drops everything recorded after `epoch` (rewinding to a snapshot). */
  truncate(epoch: number): void {
    let n = this.epochs.length;
    while (n > 0 && this.epochs[n - 1] > epoch) n--;
    for (const arr of this.series()) arr.length = n;
    let p = this.paramEpochs.length;
    while (p > 0 && this.paramEpochs[p - 1] > epoch) p--;
    this.paramEpochs.length = p;
    this.params.length = p;
  }

  push(m: Metrics, params: Float64Array): void {
    const last = this.epochs[this.epochs.length - 1];
    if (last !== undefined && m.epoch < last) this.truncate(m.epoch - 1); // reset or rewind
    if (last === m.epoch) {
      // Same epoch re-emitted (e.g. pause): replace instead of duplicating the point.
      for (const arr of this.series()) arr.pop();
      this.paramEpochs.pop();
      this.params.pop();
    }
    this.epochs.push(m.epoch);
    this.trainLoss.push(m.trainLoss);
    this.testLoss.push(m.testLoss);
    this.trainAccuracy.push(m.trainAccuracy);
    this.testAccuracy.push(m.testAccuracy);
    if (this.epochs.length > MAX_POINTS) for (const arr of this.series()) halve(arr);
    this.paramEpochs.push(m.epoch);
    this.params.push(Float32Array.from(params));
    if (this.params.length > MAX_PARAM_SNAPSHOTS) {
      halve(this.paramEpochs);
      halve(this.params);
    }
  }

  private series(): number[][] {
    return [this.epochs, this.trainLoss, this.testLoss, this.trainAccuracy, this.testAccuracy];
  }
}

/** Keeps every other element, always retaining the newest one. */
function halve<T>(arr: T[]): void {
  const last = arr[arr.length - 1];
  let w = 0;
  for (let r = 0; r < arr.length; r += 2) arr[w++] = arr[r];
  arr.length = w;
  if (arr[w - 1] !== last) arr.push(last);
}
