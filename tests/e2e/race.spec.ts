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

  test('regenerating mid-race goes back to round 1 at the gates', async ({ page }) => {
    await openApp(page);
    await generateAndStart(page, 4);
    await expect(page.getByText('Live order')).toBeVisible({ timeout: 15_000 });
    await generateButton(page).click();
    await expect(header(page).getByRole('status')).toContainText('Round 1 · 1200m');
    await expect(header(page).getByRole('status')).toContainText('At the gates');
    await expect(playbackButton(page)).toHaveText('Start');
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

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(header(page).getByRole('status')).toContainText('Program complete');
    await expect(page.getByText('6 / 6')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(header(page).getByRole('status')).toContainText('Program complete');

    await generateButton(page).click();
    await expect(header(page).getByRole('status')).toContainText('At the gates');
    await expect(page.getByText('0 / 6')).toBeVisible();
  });
});
