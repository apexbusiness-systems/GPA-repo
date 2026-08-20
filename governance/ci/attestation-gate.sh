#!/usr/bin/env bash
# Attestation gate (WP-7 CI enforcement): verifies that a valid credential rotation
# attestation exists postdating the 2026-07-09 exposure event.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

ATTESTATION_FILE="governance/attestation/credential-rotation.md"

if [ ! -f "$ATTESTATION_FILE" ]; then
  echo "ATTESTATION_GATE_FAIL: missing attestation record at $ATTESTATION_FILE"
  exit 1
fi

# Check STATUS
status_line=$(grep -E '^\s*-\s*\*\*STATUS:\*\*\s*' "$ATTESTATION_FILE" || true)
if [ -z "$status_line" ]; then
  echo "ATTESTATION_GATE_FAIL: no STATUS line found in $ATTESTATION_FILE"
  exit 1
fi

status_val=$(echo "$status_line" | sed -E 's/.*STATUS:\*\*[[:space:]]*//' | tr -d '\r\n[:space:]')
if [ "$status_val" != "CONFIRMED_ROTATED" ]; then
  echo "ATTESTATION_GATE_FAIL: status is '$status_val' (expected CONFIRMED_ROTATED)"
  exit 1
fi

# Check ATTESTATION_DATE
date_line=$(grep -E '^\s*-\s*\*\*ATTESTATION_DATE:\*\*\s*' "$ATTESTATION_FILE" || true)
if [ -z "$date_line" ]; then
  echo "ATTESTATION_GATE_FAIL: no ATTESTATION_DATE line found in $ATTESTATION_FILE"
  exit 1
fi

attest_date=$(echo "$date_line" | sed -E 's/.*ATTESTATION_DATE:\*\*[[:space:]]*//' | tr -d '\r\n[:space:]')
baseline_date="2026-07-09"

# Validate date format YYYY-MM-DD
if ! echo "$attest_date" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "ATTESTATION_GATE_FAIL: invalid date format '$attest_date' (expected YYYY-MM-DD)"
  exit 1
fi

# Lexicographical comparison works for ISO-8601 YYYY-MM-DD
if [[ "$attest_date" < "$baseline_date" || "$attest_date" == "$baseline_date" ]]; then
  echo "ATTESTATION_GATE_FAIL: attestation date ($attest_date) must postdate baseline incident ($baseline_date)"
  exit 1
fi

echo "ATTESTATION_GATE_PASS: credential rotation verified (dated $attest_date, status $status_val)"
exit 0
