import type { ExperimentConfig } from '@core/train/config';
import { validConfig } from './persist';

/** Hash parameter that carries a shared experiment: `#c=<payload>`. */
export const SHARE_PARAM = 'c';

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Drawn points are rounded to 3 decimals — plenty for a plot, and keeps links short. */
function compact(c: ExperimentConfig): ExperimentConfig {
  const d = c.dataset;
  if (d.id !== 'custom') {
    return { ...c, dataset: { id: d.id, samples: d.samples, noise: d.noise, trainRatio: d.trainRatio } };
  }
  return { ...c, dataset: { ...d, points: d.points?.map((v) => Math.round(v * 1000) / 1000) } };
}

/**
 * Settings + seed (+ drawn points) as a URL-safe string. The seed makes the same data and initial
 * weights, so the recipient can replay the identical run. Deflated when the browser supports it.
 */
export async function encodeConfig(config: ExperimentConfig): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(compact(config)));
  if (typeof CompressionStream !== 'undefined') {
    return 'z' + toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
  }
  return 'j' + toBase64Url(json);
}

export async function decodeConfig(payload: string): Promise<ExperimentConfig | null> {
  try {
    const kind = payload[0];
    let bytes: Uint8Array = fromBase64Url(payload.slice(1));
    if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (kind !== 'j') return null;
    return validConfig(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export async function shareUrl(config: ExperimentConfig): Promise<string> {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = `${SHARE_PARAM}=${await encodeConfig(config)}`;
  return url.toString();
}

/** The shared experiment in the current URL, if any. */
export async function readSharedConfig(): Promise<ExperimentConfig | null> {
  const m = window.location.hash.match(new RegExp(`[#&]${SHARE_PARAM}=([^&]+)`));
  return m ? decodeConfig(m[1]) : null;
}
