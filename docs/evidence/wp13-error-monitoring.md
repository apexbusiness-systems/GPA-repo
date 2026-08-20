# WP-13 Evidence — Production Error Monitoring & Logging

## Status
- **Interim Baseline (Active):** Cloudflare Workers built-in exception logging and unhandled rejection tracking. Zero added cloud vendors, zero external SDK dependencies.
- **Sentry Status (Gated):** Pending explicit decision by JR Mendoza (Hard Do-Not-Do §2 vendor discipline). `@sentry/*` packages are NOT installed until authorized.

## Active Cloudflare Workers Logging Architecture
1. **Edge Exception Interception:**
   - Uncaught exceptions in Edge Functions and Cloudflare Workers handlers are caught by top-level error boundaries and logged to Cloudflare's runtime log stream.
2. **Privacy Enforcement:**
   - Error logs record HTTP status codes, function route names, deterministic error codes, and anonymized request correlation IDs (`request_id`).
   - Frame image bytes, OCR snippets, player usernames, and raw prompts are structurally barred from all telemetry and error paths.

## Sentry Implementation Blueprint (Upon JR Approval)
If approved by JR:
- Install `@sentry/browser` / `@sentry/react` in `apps/web` and `apps/overlay`.
- Environment variable `SENTRY_DSN` is env-gated (disabled when empty).
- Hook top-level React `ErrorBoundary` and sanitize `beforeSend` to strip PII and any payload buffers.
