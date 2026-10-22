import { expect, test } from '@playwright/test';

test('landing page links into the lab', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('See how it thinks.');
  await page.getByTestId('enter-lab').click();
  await expect(page).toHaveURL(/\/lab\/$/);
  await expect(page.getByTestId('play')).toBeVisible();
});
