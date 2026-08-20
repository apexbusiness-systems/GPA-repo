#!/usr/bin/env bash
# Compliance gate (§1.1 CI enforcement): bans process-memory/injection/input-automation
# APIs and audio-capture surfaces repo-wide. Uses POSIX grep only — no optional tooling,
# so the gate can never silently pass because a scanner binary is missing (which is
# exactly what happened with ripgrep on the CI runner, 2026-07-08).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# grep -r flags: -I skip binaries, -n line numbers, -E extended regex.
GREP=(grep -rInE
  --exclude-dir=.git
  --exclude-dir=node_modules
  --exclude-dir=target
  --exclude-dir=docs
  --exclude-dir=governance
  --exclude-dir=.agents
  --exclude-dir=.understand-anything
  --exclude-dir=.claude
  --exclude=ENV.example
)

banned_patterns=(
  'ReadProcessMemory'
  'WriteProcessMemory'
  'CreateRemoteThread'
  'SetWindowsHookEx'
  'MinHook'
  'detours'
  '\\\\Device\\\\'
  'SendInput'
  'WASAPI'
  'Opus'
)

status=0
for pattern in "${banned_patterns[@]}"; do
  if matches="$("${GREP[@]}" -- "$pattern" . 2>/dev/null)"; then
    echo "COMPLIANCE_GATE_FAIL pattern=$pattern"
    echo "$matches"
    status=1
  fi
done

# ADR-003 structural check: the canonical contract must pin audio to null.
if ! grep -q 'audio_opus_bytes: z\.null()' packages/contracts/src/index.ts; then
  echo "COMPLIANCE_GATE_FAIL contracts no longer pin audio_opus_bytes to null (ADR-003)"
  status=1
fi

# Obvious service-role secret values in tracked files.
if matches="$(grep -rInE --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=target \
    --exclude-dir=governance --exclude=ENV.example \
    'SUPABASE_SERVICE_ROLE_KEY=.*[A-Za-z0-9_-]{12,}' . 2>/dev/null)"; then
  echo "COMPLIANCE_GATE_FAIL service role key-like value found"
  echo "$matches"
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "COMPLIANCE_GATE_PASS no banned runtime patterns or obvious service-role values found"
fi
exit "$status"
