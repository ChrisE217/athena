import { expect, test } from '@playwright/test';

const SEARCH = `
  <main>
    <input data-test="search" placeholder="Search players" />
    <ul data-test="results">
      <li data-test="result">Marta Silva</li>
      <li data-test="result">Sam Kerr</li>
      <li data-test="result">Alex Morgan</li>
      <li data-test="result">Lucy Bronze</li>
    </ul>
    <p data-test="result-count">4 results</p>
  </main>
`;

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(SEARCH);
  });

  test('shows the placeholder', async ({ page }) => {
    await expect(page.getByTestId('search')).toHaveAttribute('placeholder', 'Search players');
  });

  test('lists initial results', async ({ page }) => {
    await expect(page.getByTestId('result')).toHaveCount(4);
  });

  test('accepts typed input', async ({ page }) => {
    await page.getByTestId('search').fill('Kerr');
    await expect(page.getByTestId('search')).toHaveValue('Kerr');
  });

  test('result count matches the list', async ({ page }) => {
    const count = await page.getByTestId('result').count();
    await expect(page.getByTestId('result-count')).toHaveText(`${count} results`);
  });

  test('results are alphabetised', async ({ page }) => {
    const names = await page.getByTestId('result').allTextContents();
    expect(names).toEqual([...names].sort());
  });

  test('clears with the escape key', async ({ page }) => {
    await page.getByTestId('search').fill('Marta');
    await page.getByTestId('search').press('Escape');
    await expect(page.getByTestId('search')).toHaveValue('');
  });

  test('shows an empty state for no matches', async ({ page }) => {
    await test.step('search for a missing player', async () => {
      await page.getByTestId('search').fill('Zzzz');
    });
    await test.step('expect empty state', async () => {
      await expect(page.getByTestId('empty-state')).toBeVisible({ timeout: 1200 });
    });
  });

  test('debounces the request', async ({ page }) => {
    await page.getByTestId('search').pressSequentially('Bronze', { delay: 20 });
    await expect(page.getByTestId('request-count')).toHaveText('1', { timeout: 1200 });
  });

  test('keeps focus in the field while typing', async ({ page }) => {
    await page.getByTestId('search').fill('Sam');
    await expect(page.getByTestId('search')).toBeFocused();
  });
});
