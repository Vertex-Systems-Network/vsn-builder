import { test, expect } from '@playwright/test';

const store = process.env.VSN_E2E_STORE_URL;
const editor = process.env.VSN_E2E_EDITOR_URL;
const pageId = process.env.VSN_E2E_PAGE_ID;

test.describe('VSN live Shopify production confidence', () => {
  test.skip(!store, 'VSN_E2E_STORE_URL is required for live storefront checks.');

  for (const path of ['/', '/collections/all', '/search?q=shirt']) {
    test(`storefront ${path} has no server failure`, async ({ page }) => {
      const response = await page.goto(new URL(path, store).toString(), { waitUntil: 'domcontentloaded' });
      expect(response?.status() || 200).toBeLessThan(500);
      const body = await page.locator('body').innerText();
      expect(body).not.toContain('Builder error 500');
      expect(body).not.toContain('This template could not be opened');
    });
  }

  test('VSN renderer survives desktop/tablet/mobile', async ({ page }) => {
    await page.goto(store, { waitUntil: 'networkidle' });
    for (const viewport of [{width:1440,height:900},{width:768,height:1024},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);
      expect(await page.locator('body').evaluate(el => el.scrollWidth <= Math.max(document.documentElement.clientWidth, window.innerWidth) + 2)).toBeTruthy();
    }
  });

  test('editor critical flow', async ({ page }) => {
    test.skip(!editor || !pageId, 'VSN_E2E_EDITOR_URL and VSN_E2E_PAGE_ID are required for authenticated editor flow.');
    await page.goto(`${editor.replace(/\/$/, '')}/app/builder/${encodeURIComponent(pageId)}`, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).not.toContainText('Builder error 500');
    await expect(page.locator('body')).not.toContainText('This template could not be opened');
    await expect(page.getByText('Publish', { exact: true }).first()).toBeVisible();
  });
});
