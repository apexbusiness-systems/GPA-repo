import { expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * Network errors that are expected when Supabase env vars are not configured.
 * These arise from the placeholder `https://unconfigured.invalid` client.
 */
export function isExpectedNetworkError(text: string): boolean {
  return (
    text.includes('unconfigured.invalid') ||
    text.includes('net::ERR_NAME_NOT_RESOLVED') ||
    text.includes('ERR_NAME_NOT_RESOLVED') ||
    text.includes('Failed to fetch') ||
    text.includes('NetworkError when attempting to fetch resource') ||
    // Supabase SDK logs when network is unavailable
    text.includes('AuthRetryableFetchError') ||
    text.includes('FetchError')
  );
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  const onConsole = (msg: ConsoleMessage): void => {
    if (msg.type() === 'error' && !isExpectedNetworkError(msg.text())) {
      errors.push(`console.error: ${msg.text()}`);
    }
  };
  const onPageError = (err: Error): void => {
    if (!isExpectedNetworkError(err.message)) {
      errors.push(`pageerror: ${err.message}`);
    }
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  return errors;
}

/**
 * Assert that the current page shows an honest auth gate:
 * either the sign-in/sign-up form (.auth-wrap) or the auth-not-configured
 * panel (#auth-not-configured / .gate-panel), or the NOT-YET-AVAILABLE gate.
 * Never a blank page or an unhandled crash.
 */
export async function expectHonestGate(page: Page, context: string): Promise<void> {
  const gate = page.locator('.auth-wrap, .gate-panel, #auth-not-configured');
  await expect(gate.first(), `${context}: expected honest gate`).toBeVisible({ timeout: 6000 });
}

export const NAV_ITEMS: Array<{ label: string; path: string; isLanding: boolean }> = [
  { label: 'Home', path: '/', isLanding: true },
  { label: 'Live Overlay', path: '/app/overlay', isLanding: false },
  { label: 'Sessions', path: '/app/sessions', isLanding: false },
  { label: 'Replay Review', path: '/app/replay', isLanding: false },
  { label: 'Coach Squad', path: '/app/coaches', isLanding: false },
  { label: 'Community', path: '/app/community', isLanding: false },
  { label: 'Insights', path: '/app/insights', isLanding: false },
  { label: 'Settings', path: '/app/settings', isLanding: false },
];
