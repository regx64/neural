import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /mobile\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          // Allows using a preinstalled Chromium instead of downloading one.
          executablePath: process.env.PW_CHROMIUM_PATH || undefined,
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
    // Phone layout: touch input, mobile viewport and UA. Run in Chromium (the preinstalled browser);
    // iOS Safari itself still needs a check on a real device.
    ...(['iPhone 13', 'iPhone SE'] as const).map((device) => ({
      name: `mobile ${device}`,
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices[device],
        browserName: 'chromium' as const,
        defaultBrowserType: 'chromium' as const,
        launchOptions: {
          executablePath: process.env.PW_CHROMIUM_PATH || undefined,
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    })),
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
