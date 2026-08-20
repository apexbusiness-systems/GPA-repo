/**
 * User-shoes E2E test — GamePointAgent web app.
 *
 * Tests the full interaction surface of the production build:
 * - Landing page renders with correct h1
 * - Every sidebar nav item produces a visible DOM change
 * - All landing CTAs navigate and show an honest gate (sign-in form or
 *   auth-not-configured panel) — never a dead broken page
 * - No unfiltered console errors during any interaction
 *
 * Tests pass in two configurations:
 *   1. VITE_SUPABASE_* set at build time → auth-required views show Login form
 *   2. VITE_SUPABASE_* absent at build time → all /app routes show "Auth not configured" gate
 */

import { test, expect } from '@playwright/test';
import { collectErrors, expectHonestGate, NAV_ITEMS } from './helpers';

// ─── landing page ────────────────────────────────────────────────────────────

test.describe('Landing page', () => {
  test('h1 is visible and contains expected copy', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.locator('h1').first()).toContainText('AI Coach');
    expect(errors, 'unexpected console errors on landing').toHaveLength(0);
  });

  test('sidebar renders all 8 nav items', async ({ page }) => {
    await page.goto('/');
    const navLinks = page.locator('nav a');
    await expect(navLinks).toHaveCount(8);
  });
});

// ─── sidebar navigation ──────────────────────────────────────────────────────

test.describe('Sidebar navigation', () => {
  for (const { label, path, isLanding } of NAV_ITEMS) {
    test(`"${label}" → navigates and shows honest content`, async ({ page }) => {
      await page.goto('/');

      const link = page.locator('nav a', { hasText: label }).first();
      await expect(link, `sidebar link "${label}" should be visible`).toBeVisible();

      await link.click();

      // URL must contain the expected path after navigation
      await expect(page, `URL after clicking "${label}"`).toHaveURL(
        new RegExp(path.replace(/\//g, '\\/')),
      );

      if (isLanding) {
        // Home stays on landing — h1 must be visible
        await expect(page.locator('h1').first()).toBeVisible();
      } else {
        // App routes must show honest content — auth form or gate panel
        await expectHonestGate(page, `sidebar "${label}"`);
      }
    });
  }
});

// ─── landing CTAs ────────────────────────────────────────────────────────────

// Matches the actual buttons rendered by LiveCards in apps/web/src/main.tsx as of the
// "minimalist text reduction" / "elevate UI/UX to premium standard" redesign. The
// landing page no longer has separate "Go Live" / "Schedule a Session" primary CTAs
// (those were consolidated into these three panel-level buttons) — do not restore the
// old labels here without also restoring them in the app; the app copy is intentional.
const CTAS: Array<{ buttonText: string; expectedPath: string; desc: string }> = [
  { buttonText: 'View Overlay', expectedPath: '/app/overlay', desc: 'overlay gate or auth' },
  { buttonText: 'Join', expectedPath: '/app/sessions', desc: 'sessions gate or auth' },
  { buttonText: 'Report', expectedPath: '/app/insights', desc: 'insights gate or auth' },
];

test.describe('Landing CTAs', () => {
  for (const { buttonText, expectedPath, desc } of CTAS) {
    test(`"${buttonText}" → ${desc}`, async ({ page }) => {
      await page.goto('/');

      // Match button by partial text (some buttons include icons in the text node)
      const btn = page.locator(`button:has-text("${buttonText}")`).first();
      await expect(btn, `CTA button "${buttonText}" should be visible`).toBeVisible();

      await btn.click();

      await expect(page, `URL after "${buttonText}" click`).toHaveURL(
        new RegExp(expectedPath.replace(/\//g, '\\/')),
      );

      await expectHonestGate(page, `CTA "${buttonText}"`);
    });
  }
});
