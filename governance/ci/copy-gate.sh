#!/usr/bin/env bash
# Title-Copy CI Gate (WP-11 CI enforcement): ensures that shipped user-facing copy
# complies with docs/governance/title-copy-policy.md.
# Bans uncleared tactical-shooter jargon across public landing, web app, and overlay surfaces.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

status=0

# List of banned terms per title copy policy and app.test.mjs
banned_terms=(
  'overpeek'
  'bombsite'
  'plant safe'
  'rotation to a'
  'post-plant'
  'retake on b'
  'econ\.'
  'buy round'
  'headshot'
  ' awp'
  'haven ·'
  'bind\.'
  'clutch attempt'
  'mid control'
)

# Search user-facing frontend files only (excluding test files, node_modules, dist, etc.)
FILES=(
  apps/web/src/main.tsx
  apps/web/src/app.tsx
  apps/web/src/privacy.tsx
  apps/web/src/terms.tsx
  apps/overlay/src/App.tsx
  apps/overlay/src/main.tsx
)

EXISTING_FILES=()
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    EXISTING_FILES+=("$f")
  fi
done

for term in "${banned_terms[@]}"; do
  if matches="$(grep -inE -- "$term" "${EXISTING_FILES[@]}" 2>/dev/null)"; then
    echo "COPY_GATE_FAIL: banned tactical-shooter copy found matching pattern '$term'"
    echo "$matches"
    status=1
  fi
done

# Single engine disclosure check
if [ -f "apps/web/src/app.tsx" ]; then
  if ! grep -q "does not run four separate agents" apps/web/src/app.tsx; then
    echo "COPY_GATE_FAIL: apps/web/src/app.tsx is missing single-engine disclosure copy"
    status=1
  fi
fi

if [ "$status" -eq 0 ]; then
  echo "COPY_GATE_PASS: all user-facing copy adheres to title-copy policy"
fi

exit "$status"
