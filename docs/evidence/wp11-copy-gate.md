# WP-11 Evidence — Title-Copy CI Gate

## Status
- **Gate Script:** `governance/ci/copy-gate.sh`
- **CI Integration:** `.github/workflows/ci.yml` (invoked in `gates-and-ts` job)
- **Policy Standard:** `docs/governance/title-copy-policy.md`

## Verifiable Evidence (RAN)
```
$ bash governance/ci/copy-gate.sh
COPY_GATE_PASS: all user-facing copy adheres to title-copy policy
Exit code: 0
```
