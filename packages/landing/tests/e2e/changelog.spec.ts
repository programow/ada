import { expect, test } from '@playwright/test';

test('changelog page renders heading', async ({ page }) => {
    await page.goto('/changelog/');
    await expect(page.locator('h1')).toContainText('Changelog');
});
