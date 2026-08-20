# Branch Protection & Release Policy

## `main`
- Require PR review (≥1) — no direct pushes.
- Required status checks: `gates-and-ts`, `ingest`, `rust`, `security` (all four CI jobs). Note: `gates-and-ts` strictly executes and requires `compliance-gate`, `license-gate`, `attestation-gate`, `copy-gate`, contract hash sync, `typecheck`, and unit test suites before bundle assembly.
- Require branches up to date before merge; linear history.

## Releases
- Tag `v*` triggers `release.yml` (Windows build + overlay bundle + SBOM).
- A release may not ship unsigned: configure `WINDOWS_SIGNING_CERT`/`WINDOWS_SIGNING_PASSWORD` and enable the signing step before the first public tag.
- Edge Function deploys are versioned by tag; rollback = `supabase functions deploy <name> --version <prev>` + migration down scripts in `docs/rollback/`.
- Every release attaches the evidence pack: CI run links, `docs/evidence/*`, GO/NO-GO report.

## Sentry
- `SENTRY_DSN` is env-gated (empty = disabled). Events must never include frame bytes, OCR text, usernames, or chat content — enforced by the telemetry schema having no content columns and by review of any new `captureException` call.
