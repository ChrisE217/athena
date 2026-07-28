import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 15_000,
  retries: 1,
  fullyParallel: true,
  expect: { timeout: 2_000 },
  reporter: [
    ['list'],
    ['athena-playwright-reporter', { outputFolder: 'athena-report', open: 'never', title: 'Athena Smoke' }],
  ],
  use: {
    testIdAttribute: 'data-test',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
