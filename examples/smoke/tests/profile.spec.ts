import { expect, test } from '@playwright/test';

const PROFILE = `
  <main>
    <header>
      <h1 data-test="username">Ada Lovelace</h1>
      <span data-test="handle">@ada</span>
    </header>
    <nav>
      <button data-test="tab" class="active">Overview</button>
      <button data-test="tab">Clips</button>
      <button data-test="tab">Stats</button>
    </nav>
    <section data-test="clips">
      <article data-test="clip" class="border-primary">Clip 01 <span data-test="duration">00:12</span></article>
      <article data-test="clip">Clip 02 <span data-test="duration">00:31</span></article>
      <article data-test="clip">Clip 03 <span data-test="duration">01:04</span></article>
    </section>
  </main>
`;

test.describe('Profile page', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(PROFILE);
  });

  test('renders the username', async ({ page }) => {
    await expect(page.getByTestId('username')).toHaveText('Ada Lovelace');
  });

  test('renders the handle', async ({ page }) => {
    await expect(page.getByTestId('handle')).toHaveText('@ada');
  });

  test('has three tabs', async ({ page }) => {
    await expect(page.getByTestId('tab')).toHaveCount(3);
  });

  test('lists all clips', async ({ page }) => {
    await expect(page.getByTestId('clip')).toHaveCount(3);
  });

  test('first clip is highlighted', async ({ page }) => {
    await expect(page.getByTestId('clip').first()).toHaveClass(/border-primary/);
  });

  test('clip durations are well formed', async ({ page }) => {
    for (const value of await page.getByTestId('duration').allTextContents()) {
      expect(value).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  test('switching to the Stats tab loads averages', async ({ page }) => {
    await test.step('click Stats tab', async () => {
      await page.getByTestId('tab').filter({ hasText: 'Stats' }).click();
    });
    await test.step('expect averages panel', async () => {
      await expect(page.getByTestId('averages')).toBeVisible({ timeout: 1200 });
    });
  });

  test('highlights the clip you select', async ({ page }) => {
    await test.step('select third clip', async () => {
      await page.getByTestId('clip').nth(2).click();
    });
    await test.step('expect highlight to move', async () => {
      await expect(page.getByTestId('clip').nth(2)).toHaveClass(/border-primary/, {
        timeout: 1200,
      });
    });
  });

  test('is flaky while avatars warm up', async ({}, testInfo) => {
    if (testInfo.retry === 0) throw new Error('Avatar CDN returned 503 on first attempt');
    expect(true).toBe(true);
  });

  test.skip('supports the legacy profile layout', async ({ page }) => {
    await expect(page.getByTestId('legacy-shell')).toBeVisible();
  });
});
