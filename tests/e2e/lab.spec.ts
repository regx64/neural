import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __NEURAL__?: { neuronClientPosition(layer: number, index: number): { x: number; y: number } | null };
  }
}

const percent = async (page: Page, id: string) =>
  parseFloat((await page.getByTestId(`metric-${id}`).textContent()) ?? 'NaN');

async function clickNeuron(page: Page, layer: number, index: number) {
  await page.waitForFunction(() => !!window.__NEURAL__?.neuronClientPosition(0, 0));
  // Wait for the layout animation to settle before reading positions.
  await page.waitForTimeout(600);
  const pos = await page.evaluate(([l, i]) => window.__NEURAL__!.neuronClientPosition(l, i), [layer, index]);
  expect(pos).not.toBeNull();
  await page.mouse.move(pos!.x, pos!.y);
  await page.mouse.click(pos!.x, pos!.y);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  (page as unknown as { errors: string[] }).errors = errors;
  // Returning visitor: skip the first-visit welcome dialog (covered in beginner.spec.ts).
  await page.addInitScript(() => localStorage.setItem('neural.welcomed', '1'));
  await page.goto('/lab/');
  await expect(page.getByTestId('metric-epoch')).toHaveText('0');
});

test.afterEach(async ({ page }) => {
  expect((page as unknown as { errors: string[] }).errors).toEqual([]);
});

test('trains XOR to ≥ 98% training accuracy within 5 seconds of pressing play', async ({ page }) => {
  await page.getByTestId('play').click();
  const start = Date.now();
  await expect
    .poll(() => percent(page, 'train-acc'), { timeout: 10_000, intervals: [100] })
    .toBeGreaterThanOrEqual(98);
  // CI runners are slower than the reference laptop; allow headroom but record the real time.
  const elapsed = Date.now() - start;
  test.info().annotations.push({ type: 'xor-converge-ms', description: String(elapsed) });
  expect(elapsed).toBeLessThan(process.env.CI ? 10_000 : 5_000);
});

test('pause and single-step advance exactly one epoch', async ({ page }) => {
  await page.getByRole('button', { name: '1 에폭 진행' }).click();
  await expect(page.getByTestId('metric-epoch')).toHaveText('1');
  await page.keyboard.press('.');
  await expect(page.getByTestId('metric-epoch')).toHaveText('2');
  await page.keyboard.press('r');
  await expect(page.getByTestId('metric-epoch')).toHaveText('0');
});

test('clicking a hidden neuron shows its computation, consistent with a = tanh(z)', async ({ page }) => {
  await page.getByRole('button', { name: '1 에폭 진행' }).click();
  await clickNeuron(page, 1, 2);
  await expect(page.getByTestId('inspector-title')).toHaveText('은닉 1 · N3');
  await expect(page.getByTestId('breakdown').locator('tbody tr')).toHaveCount(3); // x₁, x₂, bias
  const num = async (id: string) =>
    parseFloat(((await page.getByTestId(id).textContent()) ?? '').replace('−', '-'));
  const z = await num('inspector-z');
  const a = await num('inspector-a');
  expect(Math.abs(Math.tanh(z) - a)).toBeLessThan(2e-3);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inspector')).toHaveCount(0);
});

test('changing the architecture updates the network summary', async ({ page }) => {
  await page.getByRole('button', { name: '은닉층 수 늘리기' }).click();
  await page.getByRole('button', { name: '은닉 2 뉴런 수 늘리기' }).click();
  // 2·4+4 + 4·5+5 + 5·1+1 = 43
  await expect(page.getByTestId('network-card')).toContainText('2 – 4 – 5 – 1 · 파라미터 43개');
});

test('clicking the data plot pins the probe input', async ({ page }) => {
  await expect(page.getByText('샘플 순회 중')).toBeVisible();
  const box = (await page.getByTestId('boundary-canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);
  await expect(page.getByRole('button', { name: '샘플 순회' })).toBeVisible();
  await expect(page.getByText('(0.50, 0.50)')).toBeVisible();
});
