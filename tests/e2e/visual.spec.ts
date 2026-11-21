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

  test('track canvas with a hovered lane next to the followed lane', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page);
    await generateButton(page).click();
    const canvas = page.locator('canvas');
    const box = (await canvas.boundingBox())!;
    const laneHeight = (box.height - 46 - 16) / 10;
    await canvas.click({ position: { x: 24, y: 46 + laneHeight * 4.5 } });
    await canvas.hover({ position: { x: 24, y: 46 + laneHeight * 6.5 } });
    await expect(canvas).toHaveAttribute('data-hovered-lane', '6');
    await expect(canvas).toHaveScreenshot('track-hover.png', { maxDiffPixelRatio: 0.02 });
  });

  test('standings tab and full table after round 2, with movement', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page);
    await generateButton(page).click();
    await page.locator('header').getByRole('button', { name: '4x' }).click();
    await page.locator('header').getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByText('2 / 6')).toBeVisible({ timeout: 45_000 });
    await page.locator('header').getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('tab', { name: 'Standings' }).click();
    await page.mouse.move(0, 0);
    await expect(page.locator('aside').filter({ hasText: 'Stable' })).toHaveScreenshot(
      'standings-tab.png',
    );
    await page.getByRole('button', { name: 'Full table' }).click();
    await page.mouse.move(0, 0);
    await expect(page.getByRole('dialog', { name: 'Standings' })).toHaveScreenshot(
      'standings-table.png',
    );
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
