import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('unauthenticated user is redirected from /inbox to /login', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page shows the Continue with Google button', async ({ page }) => {
    await page.goto('/login');
    const googleButton = page.getByRole('button', { name: /google/i });
    await expect(googleButton).toBeVisible();
  });

  test('root path resolves and does not 500', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.ok()).toBeTruthy();
  });
});
