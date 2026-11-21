import { defineConfig, devices } from '@playwright/test';

/**
 * Not Vite's default preview port (4173): with `reuseExistingServer`, a
 * manually started `npm run preview` on that port would be reused, serving a
 * stale build or disappearing mid-run (seen once as ERR_CONNECTION_REFUSED).
 */
const PORT = 4183;

/**
 * End-to-end and visual tests against the production build. Every test opens
 * the app with `?seed=` so horses, programs and results are reproducible.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    colorScheme: 'dark',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
