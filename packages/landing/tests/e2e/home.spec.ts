import { expect, test } from '@playwright/test';

test('home renders hero, providers, footer link to privacy', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText(/speech.to.text/i);
    await expect(page.getByText('AssemblyAI').first()).toBeVisible();
    await expect(page.locator('footer a[href="/privacy"]')).toBeVisible();
});
