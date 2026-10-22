import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __NEURAL__?: { neuronClientPosition(layer: number, index: number): { x: number; y: number } | null };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('neural.welcomed', '1'));
});

const epoch = async (page: Page) =>
  Number(((await page.getByTestId('metric-epoch').textContent()) ?? '').replace(/,/g, ''));

test('a share link reproduces the experiment in another tab', async ({ page, context }) => {
  await page.goto('/lab/');
  await page.getByRole('button', { name: '은닉층 수 늘리기' }).click();
  await page.getByRole('radio', { name: 'ReLU' }).click();
  await page.getByRole('button', { name: '내 실험' }).click();
  await page.getByRole('button', { name: '링크 복사' }).click();
  const link = await page.getByTestId('share-link').inputValue();
  expect(link).toContain('#c=');

  const other = await context.newPage();
  // The link is decoded once the lab has mounted. Under the software GPU used in CI, the first
  // WebGL shader compile blocks the main thread for seconds (2–3.5 s measured with parallel
  // workers), so allow more than the default 5 s before the confirmation appears.
  await other.goto(link, { waitUntil: 'commit' });
  await expect(other.getByTestId('toast')).toContainText('공유받은 실험', { timeout: 15_000 });
  await expect(other.getByTestId('network-card')).toContainText('2 – 4 – 4 – 1');
  await expect(other.getByRole('radio', { name: 'ReLU' })).toHaveAttribute('aria-checked', 'true');
});

test('saving keeps the weights; reopening restores them', async ({ page }) => {
  await page.goto('/lab/');
  for (let k = 0; k < 30; k++) await page.keyboard.press('.');
  await expect.poll(() => epoch(page)).toBe(30);
  const acc = await page.getByTestId('metric-train-acc').textContent();
  await page.getByRole('button', { name: '내 실험' }).click();
  await page.getByRole('textbox', { name: '실험 이름' }).fill('나의 첫 실험');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.keyboard.press('Escape');

  await page.keyboard.press('r'); // start over
  await expect.poll(() => epoch(page)).toBe(0);

  await page.getByRole('button', { name: '내 실험' }).click();
  await page.getByRole('button', { name: /^나의 첫 실험(?! 삭제)/ }).click();
  await expect.poll(() => epoch(page)).toBe(30);
  await expect(page.getByTestId('metric-train-acc')).toHaveText(acc!);
});

test('the inspector explains backpropagation for the selected neuron', async ({ page }) => {
  await page.goto('/lab/');
  await page.getByRole('button', { name: '1 에폭 진행' }).click();
  await page.waitForFunction(() => !!window.__NEURAL__?.neuronClientPosition(0, 0));
  await page.waitForTimeout(600);
  const pos = await page.evaluate(() => window.__NEURAL__!.neuronClientPosition(2, 0)); // output
  await page.mouse.click(pos!.x, pos!.y);
  await page.getByRole('radio', { name: /역전파/ }).click();
  await expect(page.getByTestId('inspector')).toContainText('δ = p − y');
  await expect(page.getByTestId('backprop-table')).toBeVisible();
  // Flipping the correct answer flips the sign of the error signal.
  const d1 = await page.getByTestId('backprop-delta').textContent();
  const flip =
    (await page.getByRole('radio', { name: '파랑 (1)' }).getAttribute('aria-checked')) === 'true'
      ? '주황 (0)'
      : '파랑 (1)';
  await page.getByRole('radio', { name: flip }).click();
  const d2 = await page.getByTestId('backprop-delta').textContent();
  expect(d1?.[0]).not.toBe(d2?.[0]);
});

test('pinning A compares two settings side by side', async ({ page }) => {
  await page.goto('/lab/');
  for (let k = 0; k < 10; k++) await page.keyboard.press('.');
  await page.getByTestId('pin-a').click();
  await expect(page.getByTestId('compare-card')).toBeVisible();
  await page.getByRole('button', { name: '은닉층 수 늘리기' }).click();
  await expect(page.getByTestId('compare-changes')).toContainText('은닉층 4 → 4, 4');
  await page.getByTestId('compare-card').getByRole('button', { name: '지우기' }).click();
  await expect(page.getByTestId('compare-card')).toHaveCount(0);
});
