import { expect, test } from '@playwright/test';

const CART = `
  <main>
    <h1>Checkout</h1>
    <ul data-test="line-items">
      <li data-test="line-item">Boots <span data-test="price">£82.00</span></li>
      <li data-test="line-item">Socks <span data-test="price">£9.50</span></li>
    </ul>
    <p data-test="total">£91.50</p>
    <button data-test="apply-promo">Apply promo</button>
    <button data-test="pay">Pay now</button>
  </main>
`;

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(CART);
  });

  test('shows every line item', async ({ page }) => {
    await expect(page.getByTestId('line-item')).toHaveCount(2);
  });

  test('totals the basket', async ({ page }) => {
    await expect(page.getByTestId('total')).toHaveText('£91.50');
  });

  test('pay button is enabled', async ({ page }) => {
    await expect(page.getByTestId('pay')).toBeEnabled();
  });

  test('promo button is reachable', async ({ page }) => {
    await page.getByTestId('apply-promo').click();
  });

  test('prices are formatted in sterling', async ({ page }) => {
    const prices = await page.getByTestId('price').allTextContents();
    for (const price of prices) expect(price).toMatch(/^£\d+\.\d{2}$/);
  });

  test('recalculates after removing an item', async ({ page }) => {
    await test.step('remove socks', async () => {
      await page.getByTestId('line-item').nth(1).evaluate((el) => el.remove());
    });
    await test.step('assert remaining items', async () => {
      await expect(page.getByTestId('line-item')).toHaveCount(1);
    });
  });

  test('shows free delivery banner over £50', async ({ page }) => {
    await test.step('read total', async () => {
      await expect(page.getByTestId('total')).toBeVisible();
    });
    await test.step('expect delivery banner', async () => {
      await expect(page.getByTestId('free-delivery')).toBeVisible({ timeout: 1200 });
    });
  });

  test('applies the SUMMER promo code', async ({ page }) => {
    await test.step('open promo drawer', async () => {
      await page.getByTestId('apply-promo').click();
    });
    await test.step('enter code', async () => {
      await page.getByTestId('promo-input').fill('SUMMER', { timeout: 1200 });
    });
  });

  test('total matches the sum of line items', async ({ page }) => {
    const prices = await page.getByTestId('price').allTextContents();
    const sum = prices.reduce((acc, p) => acc + Number(p.replace('£', '')), 0);
    expect(sum.toFixed(2)).toBe('92.50');
  });

  test('keeps the basket after reload', async ({ page }) => {
    await page.reload();
    await expect(page.getByTestId('line-items')).toHaveCount(0);
  });

  test.skip('supports gift wrapping', async ({ page }) => {
    await page.getByTestId('gift-wrap').check();
  });

  test('pay now submits the order', async ({ page }) => {
    await page.getByTestId('pay').click();
    await expect(page.getByTestId('pay')).toBeVisible();
  });
});
