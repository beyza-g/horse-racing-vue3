import { expect, test } from '@playwright/test';
import { generateAndStart, generateButton, header, openApp, playbackButton } from './helpers';

test.describe('race flow', () => {
  test('before a program: empty track card and a disabled Start', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('heading', { name: 'No program yet' })).toBeVisible();
    await expect(playbackButton(page)).toBeDisabled();
    await expect(header(page).getByRole('status')).toContainText('No program');
    await page.keyboard.press('Space');
    await expect(header(page).getByRole('status')).toContainText('No program');
  });

  test('generate, start, and watch the first result become official', async ({ page }) => {
    await openApp(page);
    await generateAndStart(page, 4);
    await expect(header(page).getByRole('status')).toContainText(/Starting|Live/);
    await expect(page.getByText('Live order')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('1 / 6')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.completed__row').first()).toContainText('R1');
  });

  test('Space pauses and resumes; the status reflects it', async ({ page }) => {
    await openApp(page);
    await generateAndStart(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await expect(playbackButton(page)).toHaveText('Resume');
    await expect(header(page).getByRole('status')).toContainText('Paused');
    await page.keyboard.press('Space');
    await expect(playbackButton(page)).toHaveText('Pause');
  });

  test('regenerating mid-race asks first; keeping resumes, discarding resets', async ({ page }) => {
    await openApp(page);
    await generateAndStart(page, 4);
    await expect(page.getByText('Live order')).toBeVisible({ timeout: 15_000 });
    await generateButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Discard the current program?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('will be discarded');
    await expect(dialog.getByRole('button', { name: 'Keep this program' })).toBeFocused();
    await expect(header(page).getByRole('status')).toContainText('Paused');

    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(playbackButton(page)).toHaveText('Pause');

    await generateButton(page).click();
    await dialog.getByRole('button', { name: 'Discard and generate' }).click();
    await expect(header(page).getByRole('status')).toContainText('Round 1 · 1200m');
    await expect(header(page).getByRole('status')).toContainText('At the gates');
    await expect(playbackButton(page)).toHaveText('Start');
  });

  test('standings tab and full table after the first round', async ({ page }) => {
    await openApp(page);
    await generateAndStart(page, 4);
    await expect(page.getByText('1 / 6')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: 'Standings' }).click();
    const list = page.getByRole('list', { name: 'Program standings' });
    await expect(list.getByRole('button')).toHaveCount(20);
    await expect(list.getByRole('button').first()).toHaveAccessibleName(
      /rank 1, 10 points from 1 run/,
    );
    await expect(page.getByText('After 1 of 6 rounds')).toBeVisible();
    const truncated = await page
      .locator('.standings-list__name')
      .evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth).length);
    expect(truncated).toBe(0);

    await page.getByRole('button', { name: 'Full table' }).click();
    const dialog = page.getByRole('dialog', { name: 'Standings' });
    await expect(dialog).toBeVisible();
    await expect(header(page).getByRole('status')).toContainText('Paused');
    await expect(dialog.getByRole('table')).toBeVisible();
    await expect(dialog.getByRole('row')).toHaveCount(21);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Full table' })).toBeFocused();
    await expect(header(page).getByRole('status')).not.toContainText('Paused');
  });

  test('the track offers Start race at the gates, focused after generating', async ({ page }) => {
    await openApp(page);
    await page.getByRole('heading', { name: 'No program yet' }).waitFor();
    await page.locator('.empty-program').getByRole('button', { name: 'Generate Program' }).click();
    const start = page.getByRole('button', { name: 'Start round 1' });
    await expect(start).toBeVisible();
    await expect(start).toBeFocused();
    await page.keyboard.press('Space');
    await expect(header(page).getByRole('status')).toContainText(/Starting|Live/);
    await expect(start).toBeHidden();
  });

  test('hovering a track lane highlights it without changing the race', async ({ page }) => {
    await openApp(page);
    await generateButton(page).click();
    const canvas = page.locator('canvas');
    const box = (await canvas.boundingBox())!;
    // Lane 3 (0-based 2): header band 46 px, ten lanes below it; x near the
    // left edge stays clear of the horses and of the Start race card.
    const laneHeight = (box.height - 46 - 16) / 10;
    const point = { x: 24, y: 46 + laneHeight * 2.5 };
    const brightness = () =>
      canvas.evaluate((el: HTMLCanvasElement, p) => {
        const [r, g, b] = el.getContext('2d')!.getImageData(p.x, p.y, 1, 1).data;
        return r! + g! + b!;
      }, point);

    const before = await brightness();
    await canvas.hover({ position: point });
    await expect(canvas).toHaveAttribute('data-hovered-lane', '2');
    await expect(canvas).toHaveCSS('cursor', 'pointer');
    await expect.poll(brightness).toBeGreaterThan(before);

    await page.mouse.move(box.x + box.width / 2, box.y - 30);
    await expect(canvas).not.toHaveAttribute('data-hovered-lane', /.*/);
    await expect.poll(brightness).toBe(before);
    await expect(header(page).getByRole('status')).toContainText('At the gates');

    await canvas.click({ position: point });
    await expect(page.getByText('Following')).toBeVisible();
  });

  test('clicking outside controls stops following', async ({ page }) => {
    await openApp(page);
    await page.locator('.stable-table__row').nth(2).click();
    await expect(page.getByText('Following')).toBeVisible();
    await header(page).getByRole('button', { name: '2x' }).click();
    await expect(page.getByText('Following')).toBeVisible();
    await page.getByRole('heading', { name: 'Program', exact: true }).click();
    await expect(page.getByText('Following')).toBeHidden();
  });

  test('the live pill pulses, and holds still under reduced motion', async ({ page }) => {
    const animation = () =>
      page
        .locator('header .status-pill__pulse')
        .evaluate((el) => getComputedStyle(el, '::after').animationName);
    await openApp(page);
    await generateAndStart(page, 4);
    await expect(header(page).locator('.status-pill--live')).toBeVisible({ timeout: 15_000 });
    expect(await animation()).toMatch(/^live-pulse/); // Vue suffixes scoped keyframes with a hash
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await animation()).toBe('none');
  });

  test('follow a horse from the stable and stop with Escape', async ({ page }) => {
    await openApp(page);
    await page.locator('.stable-table__row').nth(2).click();
    await expect(page.getByText('Following')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Following')).toBeHidden();
  });

  test('clicking a lane on the track follows that horse', async ({ page }) => {
    await openApp(page);
    await generateButton(page).click();
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box === null) throw new Error('Canvas not laid out');
    await canvas.click({ position: { x: box.width / 2, y: 46 + 10 } });
    await expect(page.getByText('Following')).toBeVisible();
    const firstRunner = page.locator('.round-card__row').first();
    await expect(firstRunner).toHaveAttribute('aria-pressed', 'true');
  });

  test('stable shows every condition with its body-condition band and a key', async ({ page }) => {
    await openApp(page);
    const badges = page.locator('.stable-table .condition-badge');
    await expect(badges).toHaveCount(20);
    const labels = await badges.evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-label') ?? ''),
    );
    for (const label of labels) {
      expect(label).toMatch(
        /^Condition \d{1,3} of 100 · (Underweight|Lean|Race fit|Fleshy|Overweight) · body condition \d\.\d of 9/,
      );
    }
    expect(labels.some((label) => label.includes('Race fit'))).toBe(true);
    await expect(page.getByRole('list', { name: 'Condition key' })).toContainText('Race fit');
  });

  test('official times read like real races: about 1:10 over 1200 m', async ({ page }) => {
    await openApp(page);
    await generateAndStart(page, 4);
    await expect(page.getByText('1 / 6')).toBeVisible({ timeout: 30_000 });
    const time = await page
      .locator('.completed__row')
      .first()
      .locator('.completed__time')
      .innerText();
    const [minutes, seconds] = time.split(':');
    const total = Number(minutes) * 60 + Number(seconds);
    expect(total).toBeGreaterThan(62);
    expect(total).toBeLessThan(80);
  });

  test('theme toggles with T and persists across reloads', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('t');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('speed shortcuts select 1x, 2x and 4x', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('4');
    await expect(header(page).getByRole('button', { name: '4x' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.keyboard.press('3');
    await expect(header(page).getByRole('button', { name: '4x' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.keyboard.press('2');
    await expect(header(page).getByRole('button', { name: '2x' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

test.describe('program completion', () => {
  test.setTimeout(180_000);

  test('blocking dialog, single new-program path, keyboard handling', async ({ page }) => {
    await openApp(page);
    await generateAndStart(page, 4);
    const dialog = page.getByRole('dialog', { name: 'All six rounds are official' });
    await expect(dialog).toBeVisible({ timeout: 150_000 });
    await expect(dialog.locator('li')).toHaveCount(6);
    await expect(dialog.getByRole('button', { name: 'Generate new program' })).toBeFocused();
    await expect(page.locator('#app')).toHaveAttribute('inert', '');
    await expect(playbackButton(page)).toHaveCount(0);

    await page.keyboard.press('t');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Final standings steps in front of the summary; closing it returns there.
    await page.mouse.move(0, 0);
    await expect(dialog).toHaveScreenshot('completion-summary.png');
    await dialog.getByRole('button', { name: 'Final standings' }).click();
    const finalStandings = page.getByRole('dialog', { name: 'Standings' });
    await expect(finalStandings).toContainText('Final standings after all six rounds');
    await expect(
      finalStandings.getByRole('button', { name: 'Generate new program' }),
    ).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(finalStandings.locator('.standings__footer')).toHaveScreenshot(
      'final-standings-footer.png',
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Final standings' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Final standings' }).click();
    await finalStandings
      .locator('.standings__actions')
      .getByRole('button', { name: 'Back to summary' })
      .click();
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(header(page).getByRole('status')).toContainText('Program complete');
    await expect(page.getByText('6 / 6')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(header(page).getByRole('status')).toContainText('Program complete');

    await page.getByRole('tab', { name: 'Standings' }).click();
    await page.getByRole('button', { name: 'Full table' }).click();
    const standings = page.getByRole('dialog', { name: 'Standings' });
    await expect(standings).toContainText('Final standings after all six rounds');
    const points = await standings.locator('tbody td.is-points').allInnerTexts();
    expect(points.map(Number).reduce((a, b) => a + b, 0)).toBe(234);
    await page.keyboard.press('Escape');

    await generateButton(page).click();
    await expect(header(page).getByRole('status')).toContainText('At the gates');
    await expect(page.getByText('0 / 6')).toBeVisible();
  });
});
