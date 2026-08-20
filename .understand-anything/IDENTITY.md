# Identity

## Product

**GamePoint** — Screen-only AI coaching for PC gameplay.

- **Owner:** APEX Business Systems LTD, Edmonton, AB
- **Repo:** `GamePointAgent/GPA-repo`
- **Version:** `0.1.0` (pre-release — backend coaching loop deployed + live-verified 2026-07-09; awaiting Windows hardware proof and evidence corpus)
- **Canonical Domain:** `gamepointagent.com`

## What It Does

1. User triggers a screen capture (single frame or region of interest).
2. Capture is sent through a Supabase Edge Function assist pipeline.
3. A coaching response (advice text, recommended action, confidence score) is returned.
4. A transparent Windows overlay renders the coaching on top of the game.

## What It Never Does

- No game memory injection, packet hooks, or code injection.
- No microphone or system audio capture.
- No Cloudflare-side frame streaming or processing.
- No raw frame storage beyond session-scoped ephemeral processing.
- No unsupported title activation without compliance clearance.

## Product Surfaces

| Surface | Purpose | Runtime |
|---------|---------|---------|
| `apps/web` | Public marketing + account portal | Cloudflare Pages (static) |
| `apps/overlay` | In-game transparent coaching overlay | Local Windows (Electron/Tauri TBD) |
| Supabase Edge Functions | Assist pipeline, auth, retrieval | Supabase (Deno runtime) |

## Consent Model

See → [`docs/consent.md`](../docs/consent.md)
