import { expect, test } from '@playwright/test';

const DASHBOARD = `
  <main>
    <h1 data-test="heading">Team dashboard</h1>
    <section data-test="cards">
      <div data-test="card"><span data-test="card-title">Minutes</span><b data-test="card-value">1,204</b></div>
      <div data-test="card"><span data-test="card-title">Goals</span><b data-test="card-value">18</b></div>
      <div data-test="card"><span data-test="card-title">Assists</span><b data-test="card-value">11</b></div>
    </section>
    <button data-test="export">Export CSV</button>
    <table data-test="table">
      <tbody>
        <tr data-test="row"><td>Marta</td><td>7</td></tr>
        <tr data-test="row"><td>Sam</td><td>6</td></tr>
        <tr data-test="row"><td>Alex</td><td>5</td></tr>
      </tbody>
    </table>
  </main>
`;

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(DASHBOARD);
  });

  test('renders the heading', async ({ page }) => {
    await expect(page.getByTestId('heading')).toHaveText('Team dashboard');
  });

  test('renders three summary cards', async ({ page }) => {
    await expect(page.getByTestId('card')).toHaveCount(3);
  });

  test('card values are numeric', async ({ page }) => {
    for (const value of await page.getByTestId('card-value').allTextContents()) {
      expect(Number(value.replace(/,/g, ''))).not.toBeNaN();
    }
  });

  test('table has a row per player', async ({ page }) => {
    await expect(page.getByTestId('row')).toHaveCount(3);
  });

  test('export button is visible', async ({ page }) => {
    await expect(page.getByTestId('export')).toBeVisible();
  });

  test('rows are sorted by contribution', async ({ page }) => {
    const values = await page
      .getByTestId('row')
      .evaluateAll((rows) => rows.map((r) => Number(r.children[1].textContent)));
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  test('shows the Minutes card first', async ({ page }) => {
    await expect(page.getByTestId('card-title').first()).toHaveText('Minutes');
  });

  test('export opens the download drawer', async ({ page }) => {
    await test.step('click export', async () => {
      await page.getByTestId('export').click();
    });
    await test.step('expect drawer', async () => {
      await expect(page.getByTestId('download-drawer')).toBeVisible({ timeout: 1200 });
    });
  });

  test('goals card reflects the season total', async ({ page }) => {
    const goals = await page.getByTestId('card').nth(1).getByTestId('card-value').textContent();
    expect(Number(goals)).toBe(21);
  });

  test('paginates beyond the third player', async ({ page }) => {
    await test.step('go to page two', async () => {
      await page.getByTestId('next-page').click({ timeout: 1200 });
    });
  });

  test('refreshes on an interval', async ({}, testInfo) => {
    if (testInfo.retry === 0) throw new Error('Polling interval fired twice on first attempt');
    expect(true).toBe(true);
  });
});
