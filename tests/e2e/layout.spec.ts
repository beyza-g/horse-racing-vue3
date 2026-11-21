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

for (const viewport of [VIEWPORTS[1]!, VIEWPORTS[4]!]) {
  test(`switching Roster and Standings never shifts layout at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openApp(page);
    await header(page).getByRole('button', { name: 'Generate Program' }).click();
    const boxes = () =>
      page.evaluate(() =>
        ['header', 'canvas', 'aside', '.results-panel', '.stable-table, .standings-list']
          .map((selector) => [...document.querySelectorAll(selector)])
          .flat()
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => {
            // Page coordinates: clicking a tab may scroll it into view.
            const r = el.getBoundingClientRect();
            return [r.x + window.scrollX, r.y + window.scrollY, r.width, r.height]
              .map(Math.round)
              .join(',');
          }),
      );
    const roster = await boxes();
    await page.getByRole('tab', { name: 'Standings' }).click();
    expect(await boxes()).toEqual(roster);
    await page.getByRole('button', { name: 'Full table' }).click();
    await expect(page.getByRole('dialog', { name: 'Standings' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

for (const width of [320, 375, 820, 1180, 1280, 1440]) {
  test(`following a horse moves nothing and covers neither header nor track at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page);
    await header(page).getByRole('button', { name: 'Generate Program' }).click();
    const content = [
      'header',
      '.app-header__title',
      '.round-progress',
      '.status-indicator',
      '.app-header__controls',
      '.race-track',
      '.results-panel',
    ];
    const boxes = () =>
      page.evaluate(
        (selectors) =>
          selectors.map((selector) => {
            const r = document.querySelector(selector)!.getBoundingClientRect();
            return [r.x + window.scrollX, r.y + window.scrollY, r.width, r.height]
              .map(Math.round)
              .join(',');
          }),
        content,
      );
    const chip = page.locator('.follow-badge .follow-chip');
    await expect(chip).toHaveCount(0);
    const idle = await boxes();
    await page.locator('.stable-table__row').nth(10).click();
    await expect(chip).toBeVisible();
    // Nothing moves, horizontally or vertically.
    expect(await boxes()).toEqual(idle);
    // Scrolled to the end, the badge never covers the header, the track or
    // any panel content: below 1180 px it rests in the page's bottom
    // clearance, on desktop in the empty lower part of the Program panel.
    const geometry = await page.evaluate(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const badge = document.querySelector('.follow-chip')!.getBoundingClientRect();
      const overlaps = (b: DOMRect) =>
        !(
          badge.right <= b.left ||
          b.right <= badge.left ||
          badge.bottom <= b.top ||
          b.bottom <= badge.top
        );
      const desktop = window.innerWidth >= 1180;
      const blockers = desktop
        ? ['header', '.race-track', '.dashboard__area--program .round-card']
        : ['header', '.race-track', '.panel-card'];
      const hits = blockers.filter((selector) =>
        [...document.querySelectorAll(selector)].some((el) => overlaps(el.getBoundingClientRect())),
      );
      const program = document.querySelector('.dashboard__area--program')!.getBoundingClientRect();
      return {
        desktop,
        hits,
        insideViewport:
          badge.left >= 0 && badge.right <= window.innerWidth && badge.bottom <= window.innerHeight,
        insideProgram:
          badge.left >= program.left &&
          badge.right <= program.right &&
          badge.bottom <= program.bottom,
      };
    });
    expect(geometry.hits).toEqual([]);
    expect(geometry.insideViewport).toBe(true);
    if (geometry.desktop) expect(geometry.insideProgram).toBe(true);
    await chip.getByRole('button', { name: 'Stop following' }).click();
    await expect(chip).toHaveCount(0);
    expect(await boxes()).toEqual(idle);
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
