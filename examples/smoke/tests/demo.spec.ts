import { expect, test } from '@playwright/test';

test.describe('Athena smoke suite', () => {
  test('passes quickly', async () => {
    expect(1 + 1).toBe(2);
  });

  test('is flaky then passes', async ({}, testInfo) => {
    if (testInfo.retry === 0) {
      throw new Error('Intentional flake on first attempt');
    }
    expect(true).toBe(true);
  });

  test('fails with a useful error', async ({ page }) => {
    await page.setContent(`
      <main>
        <h1>Demo</h1>
        <button data-test="action-button">Off Ball</button>
      </main>
    `);

    await test.step('Click On Ball action', async () => {
      await page
        .locator('[data-test="action-button"]')
        .filter({ hasText: 'On Ball' })
        .click({ timeout: 2000 });
    });
  });

  test.skip('skipped on purpose', async () => {
    expect(true).toBe(false);
  });

  test('another pass', async () => {
    await new Promise((r) => setTimeout(r, 50));
    expect('athena').toContain('the');
  });
});
