import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.VSN_E2E_APP_URL || process.env.VSN_E2E_STORE_URL || 'http://127.0.0.1:3000';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
  ],
});
