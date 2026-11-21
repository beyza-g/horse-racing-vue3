import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  generateAndStart,
  header,
  openApp,
  playbackButton,
} from './helpers';

const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 700 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'laptop', width: 1180, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test(`no horizontal overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openApp(page);
    await expectNoHorizontalOverflow(page);
    await header(page).getByRole('button', { name: 'Generate Program' }).click();
    await expectNoHorizontalOverflow(page);
  });
}

for (const viewport of VIEWPORTS) {
  test(`horse names are never truncated at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openApp(page);
    await header(page).getByRole('button', { name: 'Generate Program' }).click();
    const truncated = await page
      .locator('.stable-table__name, .round-card__name')
      .evaluateAll((elements) =>
        elements.filter((el) => el.scrollWidth > el.clientWidth).map((el) => el.textContent),
      );
    expect(truncated).toEqual([]);
  });
}

test('desktop uses the three-column grid', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page);
  const stable = await page.getByRole('heading', { name: 'Stable', exact: true }).boundingBox();
  const program = await page.getByRole('heading', { name: 'Program', exact: true }).boundingBox();
  const track = await page.locator('canvas').boundingBox();
  expect(stable!.x).toBeLessThan(track!.x);
  expect(program!.x).toBeGreaterThan(track!.x + track!.width - 1);
});

test('no layout shift when playback state changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page);
  await header(page).getByRole('button', { name: 'Generate Program' }).click();
  const measure = () =>
    page.evaluate(() =>
      ['header', 'canvas', '.leaderboard__rows', '.completed', 'aside']
        .map((selector) => document.querySelector(selector)?.getBoundingClientRect())
        .map((r) => (r ? [r.x, r.y, r.width, r.height].map(Math.round).join(',') : 'missing')),
    );
  const playbackBox = async () => (await playbackButton(page).boundingBox())!;
  const before = await measure();
  const buttonBefore = await playbackBox();
  await playbackButton(page).click();
  await expect(playbackButton(page)).toHaveText('Pause');
  expect(await measure()).toEqual(before);
  expect((await playbackBox()).width).toBe(buttonBefore.width);
  await playbackButton(page).click();
  await expect(playbackButton(page)).toHaveText('Resume');
  expect(await measure()).toEqual(before);
  expect((await playbackBox()).width).toBe(buttonBefore.width);
});

test('mobile stacks track, results, program and stable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openApp(page);
  const order = await Promise.all(
    [
      page.locator('canvas'),
      page.getByRole('region', { name: 'Results', exact: true }),
      page.getByRole('heading', { name: 'Program', exact: true }),
      page.getByRole('heading', { name: 'Stable', exact: true }),
    ].map(async (locator) => (await locator.boundingBox())!.y),
  );
  expect([...order].sort((a, b) => a - b)).toEqual(order);
});

test('generate is primary only before a program and after completion', async ({ page }) => {
  await openApp(page);
  const generate = header(page).getByRole('button', { name: 'Generate Program' });
  await expect(generate).toHaveClass(/app-button--primary/);
  await generateAndStart(page);
  await expect(generate).toHaveClass(/app-button--secondary/);
});
