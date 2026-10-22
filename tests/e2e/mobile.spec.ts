import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __NEURAL__?: { neuronClientPosition(layer: number, index: number): { x: number; y: number } | null };
  }
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const path of ['/', '/learn/', '/lab/']) {
  test(`${path} fits the phone width`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('neural.welcomed', '1'));
    await page.goto(path);
    await page.waitForTimeout(500);
    expect(await noHorizontalScroll(page)).toBe(true);
  });
}

test('the lab is a single screen: swiping turns the network, never scrolls the page', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('neural.welcomed', '1'));
  await page.goto('/lab/');
  await page.waitForFunction(() => !!document.querySelector('canvas'));
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(
    true,
  );

  // Tabs open one panel at a time; tapping the open tab folds it away.
  await page.getByRole('button', { name: '네트워크' }).tap();
  await expect(page.getByTestId('network-card')).toBeVisible();
  await page.getByRole('button', { name: '데이터', exact: true }).tap();
  await expect(page.getByTestId('boundary-canvas')).toBeVisible();
  await expect(page.getByTestId('network-card')).toHaveCount(0);
  await page.getByRole('button', { name: '데이터', exact: true }).tap();
  await expect(page.getByTestId('mobile-sheet')).toHaveCount(0);
});

test('play, then tap a neuron to read its computation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('neural.welcomed', '1'));
  await page.goto('/lab/');
  await page.getByTestId('play').tap();
  await expect
    .poll(async () => parseFloat((await page.getByTestId('metric-train-acc').textContent()) ?? '0'), {
      timeout: 15_000,
    })
    .toBeGreaterThan(90);
  await page.getByTestId('play').tap();
  await page.waitForFunction(() => !!window.__NEURAL__?.neuronClientPosition(0, 0));
  await page.waitForTimeout(800);
  const pos = await page.evaluate(() => window.__NEURAL__!.neuronClientPosition(1, 1));
  await page.touchscreen.tap(pos!.x, pos!.y);
  await expect(page.getByTestId('inspector-title')).toHaveText('은닉 1 · N2');
  // The inspector card sits inside the 3D view on phones.
  const view = (await page.locator('[data-tour="viewport"]').boundingBox())!;
  const card = (await page.getByTestId('inspector').boundingBox())!;
  expect(card.y + card.height).toBeLessThanOrEqual(view.y + view.height + 1);
});

test('lessons open the panel their step points at', async ({ page }) => {
  await page.goto('/lab/?lesson=hidden-layer');
  const card = page.getByTestId('lesson-card');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: '다음' }).tap();
  await card.getByRole('button', { name: '건너뛰기' }).tap(); // step 3 targets the network card
  await expect(page.getByTestId('network-card')).toBeVisible();
  await expect(card).toBeInViewport();
});

test('the Learn playground works by touch', async ({ page }) => {
  await page.goto('/learn/');
  const playground = page.getByTestId('neuron-playground');
  await playground.scrollIntoViewIfNeeded();
  await playground.getByRole('button', { name: '자동으로 배우기' }).tap();
  await expect(page.getByTestId('playground-accuracy')).toHaveText('100%', { timeout: 15_000 });
});
