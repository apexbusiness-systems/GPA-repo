# WP-8 Evidence — Native Desktop Distribution Shell & Download UI

## Status
- **Tauri Shell Scaffold:** `apps/overlay/src-tauri/` (`Cargo.toml`, `tauri.conf.json`, `src/main.rs`)
- **Download UI Gating:** `apps/web/src/app.tsx` (`/app/overlay` route)
- **Unit Test Coverage:** `apps/web/src/app.test.mjs` (dual state validation)

## Verifiable Evidence (RAN)
1. **Unset Download URL (`VITE_GAMEPOINT_DOWNLOAD_URL` empty):**
   - Renders exact honest refusal copy: `"The live overlay is a desktop application that captures your screen with consent and renders coach callouts in a PiP HUD. It is not yet distributed — no download is offered because none is ready."`
2. **Set Download URL (`VITE_GAMEPOINT_DOWNLOAD_URL` configured):**
   - Renders active download link CTA: `"Download Windows Overlay (.exe) ↓"` pointing to the artifact URL.
3. **Automated Test Run:**
```
$ pnpm --filter web test
ok 11 - overlay download UI correctly supports honest refusal when unset and download CTA when set
Exit code: 0
```
