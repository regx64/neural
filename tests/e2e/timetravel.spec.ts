import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('neural.welcomed', '1'));
  await page.goto('/lab/');
  await expect(page.getByTestId('metric-epoch')).toHaveText('0');
});

const epoch = async (page: import('@playwright/test').Page) =>
  Number(((await page.getByTestId('metric-epoch').textContent()) ?? '').replace(/,/g, ''));

test('scrubbing the learning curve shows a past state, and training resumes from it', async ({ page }) => {
  await page.getByTestId('play').click();
  await expect.poll(() => epoch(page), { timeout: 10_000 }).toBeGreaterThan(120);
  const box = (await page.getByTestId('metric-chart').boundingBox())!;
  await page.mouse.click(box.x + 40, box.y + box.height / 2); // left end of the curve

  const banner = page.getByTestId('time-banner');
  await expect(banner).toBeVisible();
  await expect.poll(() => epoch(page)).toBeLessThan(40);
  const past = await epoch(page);
  await expect(page.getByTestId('narration')).toContainText(`Epoch ${past}`);

  // Arrow keys step through recorded snapshots.
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => epoch(page)).toBeGreaterThan(past);

  await banner.getByRole('button', { name: '여기서 다시 학습' }).click();
  await expect(banner).toHaveCount(0);
  await expect.poll(() => epoch(page)).toBeGreaterThan(past);
  // The run continued from the past point instead of from where it had been.
  expect(await epoch(page)).toBeLessThan(400);
});

test('Esc returns from the past to the live run', async ({ page }) => {
  for (let k = 0; k < 12; k++) await page.keyboard.press('.');
  await expect.poll(() => epoch(page)).toBe(12);
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('time-banner')).toBeVisible();
  // The readout refreshes at 15 Hz, slightly after the banner.
  await expect.poll(() => epoch(page)).toBeLessThan(12);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('time-banner')).toHaveCount(0);
  await expect.poll(() => epoch(page)).toBe(12);
});

test('the change mode explains what the edges mean', async ({ page }) => {
  await page.getByRole('button', { name: '1 에폭 진행' }).click();
  await page.getByRole('radio', { name: '변화' }).click();
  await expect(page.getByTestId('legend')).toContainText('커지는 중');
  await expect(page.getByTestId('legend')).toContainText('고쳐진 양');
});
