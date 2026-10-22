/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const r = (p: string) => resolve(import.meta.dirname, p);

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; Vercel and local dev use /.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@core': r('src/core'),
      '@worker': r('src/worker'),
      '@state': r('src/state'),
      '@viz': r('src/viz'),
      '@ui': r('src/ui'),
    },
  },
  build: {
    // The lab bundle (three.js + R3F) is ~270 KB gzip, inside the 500 KB budget in docs/02 §6.5.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      input: {
        main: r('index.html'),
        lab: r('lab/index.html'),
        learn: r('learn/index.html'),
      },
    },
  },
  worker: { format: 'es' },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: { include: ['src/core/**', 'src/viz/encoding.ts', 'src/viz/layout.ts'] },
  },
});
