import { expect, test } from '@playwright/test';

test('privacy page mentions OS keychain backends', async ({ page }) => {
    await page.goto('/privacy/');
    await expect(page.getByText('Keychain').first()).toBeVisible();
    await expect(page.getByText('Credential Manager').first()).toBeVisible();
    await expect(page.getByText('Secret Service').first()).toBeVisible();
});
