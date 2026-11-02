#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."
node node_modules/.bin/vite preview --mode emulator --outDir dist-e2e --port 5276 --strictPort > /dev/null 2>&1 &
PREVIEW=$!
for _ in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:5276/ && break; sleep 0.25; done
E2E_DEBUG=${E2E_DEBUG:-} node e2e/fullRound.spec.mjs
STATUS=$?
kill $PREVIEW 2>/dev/null
exit $STATUS
