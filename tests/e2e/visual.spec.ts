import { expect, test, type Page } from '@playwright/test';
import { generateButton, openApp } from './helpers';

/** The canvas animates continuously; layout snapshots mask it and the track gets its own looser check. */
const layoutShot = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(name, { mask: [page.locator('canvas')], fullPage: true });

test.describe('visual', () => {
  test('desktop, dark, empty', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page);
    await layoutShot(page, 'desktop-dark-empty.png');
  });

  test('desktop, dark, program at the gates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page);
    await generateButton(page).click();
    await layoutShot(page, 'desktop-dark-ready.png');
  });

  test('desktop, light, following a horse in focus mode', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page, { theme: 'light' });
    await generateButton(page).click();
    await page.locator('.stable-table__row').nth(4).click();
    await page.keyboard.press('f');
    await layoutShot(page, 'desktop-light-focus.png');
  });

  test('tablet, program at the gates', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await openApp(page);
    await generateButton(page).click();
    await layoutShot(page, 'tablet-ready.png');
  });

  test('mobile, empty', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);
    await layoutShot(page, 'mobile-empty.png');
  });

  test('track canvas at the gates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page);
    await generateButton(page).click();
    await expect(page.locator('canvas')).toHaveScreenshot('track-ready.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
