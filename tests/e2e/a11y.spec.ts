import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('neural.welcomed', '1'));
});

for (const path of ['/', '/learn/', '/lab/']) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    if (path === '/lab/') await page.waitForFunction(() => !!document.querySelector('canvas'));
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const summary = results.violations.map(
      (v) => `${v.id}: ${v.nodes.length}× ${v.nodes[0]?.target.join(' ')}`,
    );
    expect(summary).toEqual([]);
  });
}

test('the network can be explored with the keyboard alone', async ({ page }) => {
  await page.goto('/lab/');
  await page.waitForFunction(() => !!document.querySelector('canvas'));
  await page.keyboard.press(']');
  await expect(page.getByTestId('inspector-title')).toHaveText('x₁');
  await page.keyboard.press(']');
  await page.keyboard.press(']');
  await expect(page.getByTestId('inspector-title')).toHaveText('은닉 1 · N1');
  await page.keyboard.press('[');
  await expect(page.getByTestId('inspector-title')).toHaveText('x₂');
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: '키보드 단축키' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '키보드 단축키' })).toHaveCount(0);
});

test('overlays stay accessible: inspector, backprop, experiments menu, lesson', async ({ page }) => {
  const scan = async () => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    return r.violations.map((v) => `${v.id}: ${v.nodes.length}× ${v.nodes[0]?.target.join(' ')}`);
  };
  await page.goto('/lab/?lesson=hidden-layer');
  await page.waitForFunction(() => !!document.querySelector('canvas'));
  await page.getByRole('button', { name: '1 에폭 진행' }).click();
  await page.keyboard.press(']');
  await page.keyboard.press(']');
  await page.keyboard.press(']');
  await page.getByRole('radio', { name: /역전파/ }).click();
  expect(await scan()).toEqual([]);
  await page.getByRole('button', { name: '내 실험' }).click();
  expect(await scan()).toEqual([]);
});

test('the first-visit welcome dialog is accessible', async ({ browser, baseURL }) => {
  // A fresh context without the "already welcomed" flag set in beforeEach.
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto('/lab/');
  await expect(page.getByRole('dialog')).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
  await context.close();
});
