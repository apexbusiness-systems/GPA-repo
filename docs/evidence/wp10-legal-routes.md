# WP-10 Evidence — Public Legal Routes & Marketing Landing Shell

## Status
- **Routes Live:** `/privacy` (`apps/web/src/privacy.tsx`), `/terms` (`apps/web/src/terms.tsx`)
- **Unauthenticated Dispatch:** Handled at top-level `Root()` in `apps/web/src/main.tsx` as sibling to `MarketingLanding` and `AppRoot` (bypasses auth wall completely).
- **Marketing Page Footer:** Real `<footer>` on `MarketingLanding` with working `RouteLink`s to `/privacy` and `/terms`.
- **Inert Boundary Preservation:** Demo surface `<div className="demo-surface" inert>` inside `DashboardMockup` remains 100% untouched and non-interactive.
- **Disclosure Status:** Labeled with `UNCERTAIN: draft legal disclosure pending qualified legal review before public traffic`.

## Verifiable Evidence (RAN)
```
$ pnpm --filter web test
ok 9 - public legal routes exist, dispatch without auth gate, and disclose draft review status
ok 10 - marketing landing renders real footer with legal route links outside inert container
Exit code: 0
```
