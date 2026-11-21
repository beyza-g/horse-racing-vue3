import { expect, type Page } from '@playwright/test';

export const SEED = 42;

/** Opens the app with a fixed seed and waits for the fonts, so layout is final. */
export async function openApp(
  page: Page,
  options: { theme?: 'dark' | 'light' } = {},
): Promise<void> {
  if (options.theme) {
    await page.addInitScript((theme) => {
      localStorage.setItem('hr-theme', theme);
    }, options.theme);
  }
  await page.goto(`/?seed=${SEED}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { name: 'HORSE RACING' })).toBeVisible();
}

export const header = (page: Page) => page.locator('header');

/** The header's Generate button (the empty-track card has a second one). */
export const generateButton = (page: Page) =>
  header(page).getByRole('button', { name: 'Generate Program' });

export const playbackButton = (page: Page) =>
  header(page).getByRole('button', { name: /^(Start|Pause|Resume)$/ });

export async function generateAndStart(page: Page, speed: 1 | 2 | 4 = 1): Promise<void> {
  await generateButton(page).click();
  await header(page)
    .getByRole('button', { name: `${speed}x` })
    .click();
  await playbackButton(page).click();
}

/** Fails when the page scrolls horizontally. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
