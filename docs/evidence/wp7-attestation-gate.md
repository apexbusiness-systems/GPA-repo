# WP-7 Evidence — Credential Rotation Attestation Gate

## Status
- **Gate Status:** PASSED (RAN)
- **Attestation File:** `governance/attestation/credential-rotation.md`
- **CI Integration:** `.github/workflows/ci.yml` (step in `gates-and-ts` job)
- **Branch Protection Policy:** `docs/release/branch-protection.md`

## Verifiable Evidence (RAN)
```
$ bash governance/ci/attestation-gate.sh
ATTESTATION_GATE_PASS: credential rotation verified (dated 2026-08-20, status CONFIRMED_ROTATED)
Exit code: 0
```

## Planted Violation Verification
1. **Outdated Date (2026-07-08):**
   - Result: `ATTESTATION_GATE_FAIL: attestation date (2026-07-08) must postdate baseline incident (2026-07-09)`
   - Exit code: 1
2. **Pending Status (PENDING_ROTATION):**
   - Result: `ATTESTATION_GATE_FAIL: status is 'PENDING_ROTATION' (expected CONFIRMED_ROTATED)`
   - Exit code: 1
