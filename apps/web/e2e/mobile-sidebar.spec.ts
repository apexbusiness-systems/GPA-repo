/**
 * Mobile sidebar drawer E2E test — GamePointAgent web app.
 *
 * Runs only in the `mobile-nav` Playwright project (375x812 viewport). Covers
 * the fix for the bug where every nav destination became unreachable below
 * 1180px (styles.css previously set `.sidebar nav, .player-card { display: none }`
 * with no replacement). Verifies the hamburger-drawer replacement instead:
 * all 8 destinations stay reachable, the player-card identity chip stays
 * visible, the drawer is keyboard/backdrop dismissible, background scroll is
 * locked while it's open, and Tab/Shift+Tab wrap within the drawer instead of
 * escaping to the page behind it.
 */

import { test, expect } from '@playwright/test';
import { expectHonestGate, NAV_ITEMS } from './helpers';

test.describe('Mobile nav toggle', () => {
  test('toggle is visible; nav links exist but are hidden until opened', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByRole('button', { name: 'Open navigation' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Links stay in the DOM (still 8, same as desktop) but aren't visible
    // until the drawer opens — proves nav destinations aren't just gone.
    await expect(page.locator('nav a')).toHaveCount(8);
    await expect(page.locator('nav a').first()).not.toBeVisible();
  });

  test('opening the drawer reveals nav links and the player-card', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Open navigation' }).click();

    await expect(page.locator('.sidebar')).toHaveClass(/is-open/);
    await expect(page.locator('nav a').first()).toBeVisible();
    await expect(page.locator('.player-card')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

test.describe('Mobile nav reachability', () => {
  for (const { label, path, isLanding } of NAV_ITEMS) {
    test(`"${label}" is reachable through the drawer`, async ({ page }) => {
      await page.goto('/');

      await page.getByRole('button', { name: 'Open navigation' }).click();

      const link = page.locator('nav a', { hasText: label }).first();
      await expect(link, `drawer link "${label}" should be visible`).toBeVisible();
      await link.click();

      await expect(page, `URL after clicking "${label}"`).toHaveURL(
        new RegExp(path.replace(/\//g, '\\/')),
      );

      if (isLanding) {
        await expect(page.locator('h1').first()).toBeVisible();
      } else {
        await expectHonestGate(page, `mobile drawer "${label}"`);
      }
    });
  }
});

test.describe('Mobile nav dismissal', () => {
  test('Escape closes the drawer and returns focus to the toggle', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByRole('button', { name: 'Open navigation' });
    await toggle.click();
    await expect(page.locator('.sidebar')).toHaveClass(/is-open/);

    await page.keyboard.press('Escape');

    await expect(page.locator('.sidebar')).not.toHaveClass(/is-open/);
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  });

  test('clicking the backdrop closes the drawer', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.locator('.sidebar')).toHaveClass(/is-open/);

    // Click the exposed strip of backdrop to the right of the 300px-wide drawer
    // (viewport is 375px) — clicking inside the drawer's own bounds would hit
    // the sidebar (z-index 1006), not the backdrop (z-index 1005), beneath it.
    await page.locator('.sidebar-backdrop').click({ position: { x: 350, y: 400 } });

    await expect(page.locator('.sidebar')).not.toHaveClass(/is-open/);
  });

  test('background scroll is locked while the drawer is open, restored on close', async ({ page }) => {
    await page.goto('/');

    const overflowWhileClosed = await page.evaluate(() => getComputedStyle(document.body).overflow);

    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.keyboard.press('Escape');
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .toBe(overflowWhileClosed);
  });
});

test.describe('Mobile nav focus trap', () => {
  // Mirrors the component's own scope (apps/web/src/lib.tsx Sidebar): focusable
  // elements inside the drawer, not the toggle button that opens it.
  const drawerFocusables = (page: import('@playwright/test').Page) =>
    page.locator('.sidebar a[href], .sidebar button:not([disabled])');

  test('Tab from the last focusable element wraps to the first', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open navigation' }).click();

    const focusables = drawerFocusables(page);
    const count = await focusables.count();
    expect(count, 'drawer should have at least one focusable element').toBeGreaterThan(0);

    await focusables.nth(count - 1).focus();
    await page.keyboard.press('Tab');

    await expect(focusables.first()).toBeFocused();
  });

  test('Shift+Tab from the first focusable element wraps to the last', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open navigation' }).click();

    const focusables = drawerFocusables(page);
    const count = await focusables.count();
    expect(count, 'drawer should have at least one focusable element').toBeGreaterThan(0);

    await focusables.first().focus();
    await page.keyboard.press('Shift+Tab');

    await expect(focusables.nth(count - 1)).toBeFocused();
  });
});
