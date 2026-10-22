import { expect, test } from '@playwright/test';

test.describe('first-time learner', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    (page as unknown as { errors: string[] }).errors = errors;
  });

  test.afterEach(async ({ page }) => {
    expect((page as unknown as { errors: string[] }).errors).toEqual([]);
  });

  test('first visit offers the tour, and the tour checks off tasks', async ({ page }) => {
    await page.goto('/lab/');
    await expect(page.getByRole('heading', { name: 'AI가 처음이신가요?' })).toBeVisible();
    await page.getByRole('button', { name: '3분 투어 시작' }).click();
    const card = page.getByTestId('lesson-card');
    await expect(card).toContainText('이것이 데이터예요');
    await card.getByRole('button', { name: '다음' }).click();
    await card.getByRole('button', { name: '다음' }).click();
    await expect(card).toContainText('학습을 시작해 볼까요?');
    await expect(card.getByRole('button', { name: '다음' })).toBeDisabled();
    await page.getByTestId('play').click();
    await expect(page.getByTestId('lesson-task')).toContainText('잘했어요');
    await expect(card.getByRole('button', { name: '다음' })).toBeEnabled();

    // The welcome is not shown again.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'AI가 처음이신가요?' })).toHaveCount(0);
  });

  test('a lesson link prepares the lab and follows the learner', async ({ page }) => {
    await page.goto('/lab/?lesson=hidden-layer');
    const card = page.getByTestId('lesson-card');
    await expect(card).toContainText('XOR 문제');
    await expect(page.getByTestId('network-card')).toContainText('2 – 1 · 파라미터 3개');
    await card.getByRole('button', { name: '다음' }).click();
    await page.getByRole('combobox', { name: '학습 속도' }).selectOption('max');
    await page.getByTestId('play').click();
    await expect(page.getByTestId('lesson-task')).toContainText('잘했어요', { timeout: 15_000 });
    // Without a hidden layer the narrator suggests adding capacity, and accuracy stays low.
    expect(parseFloat((await page.getByTestId('metric-train-acc').textContent()) ?? '100')).toBeLessThan(80);
    await card.getByRole('button', { name: '다음' }).click();
    await page.getByRole('button', { name: '은닉층 수 늘리기' }).click();
    await expect(page.getByTestId('lesson-task')).toContainText('잘했어요');
  });

  test('plain-language narration reacts to training', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('neural.welcomed', '1'));
    await page.goto('/lab/');
    await expect(page.getByTestId('narration')).toContainText('▶ 버튼을 누르면');
    await page.getByTestId('play').click();
    await expect(page.getByTestId('narration')).toContainText('거의 다 맞혀요', { timeout: 10_000 });
  });

  test('learners can draw their own data', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('neural.welcomed', '1'));
    await page.goto('/lab/');
    await page.getByRole('radio', { name: '직접' }).click();
    await expect(page.getByTestId('narration')).toContainText('점을 2개 이상');
    const box = (await page.getByTestId('boundary-canvas').boundingBox())!;
    await page.getByRole('radio', { name: '파란 점' }).click();
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25);
    await page.getByRole('radio', { name: '주황 점' }).click();
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.75);
    await expect(page.getByTestId('narration')).toContainText('▶ 버튼을 누르면');
  });

  test('the Learn page playground learns by itself', async ({ page }) => {
    await page.goto('/learn/');
    const playground = page.getByTestId('neuron-playground');
    await playground.scrollIntoViewIfNeeded();
    expect(parseFloat((await page.getByTestId('playground-accuracy').textContent()) ?? '100')).toBeLessThan(
      100,
    );
    await playground.getByRole('button', { name: '자동으로 배우기' }).click();
    await expect(page.getByTestId('playground-accuracy')).toHaveText('100%', { timeout: 10_000 });
    await page.getByTestId('lesson-link-features').click();
    await expect(page).toHaveURL(/lesson=features/);
    await expect(page.getByTestId('lesson-card')).toContainText('원 모양 데이터');
  });
});
