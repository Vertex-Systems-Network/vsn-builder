import { test, expect } from '@playwright/test';
const editor = process.env.VSN_E2E_EDITOR_URL;
const pageId = process.env.VSN_E2E_PAGE_ID;

test.describe('Canvas / Preview visual regression', () => {
  test.skip(!editor || !pageId, 'Authenticated VSN editor URL/page ID are required.');
  for (const item of [
    ['desktop', 1440, 900],
    ['tablet', 768, 1024],
    ['mobile', 390, 844],
  ]) {
    test(`${item[0]} editor baseline`, async ({ page }) => {
      await page.setViewportSize({ width: item[1], height: item[2] });
      await page.goto(`${editor.replace(/\/$/, '')}/app/builder/${encodeURIComponent(pageId)}`, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).not.toContainText('Builder error 500');
      const canvas = page.locator('.vsn-canvas-page').first();
      if (await canvas.count()) await expect(canvas).toHaveScreenshot(`vsn-canvas-${item[0]}.png`, { animations: 'disabled', maxDiffPixelRatio: 0.02 });
      await expect(page).toHaveScreenshot(`vsn-editor-${item[0]}.png`, { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.02 });
    });
  }
});
