#!/usr/bin/env bash
# 에뮬레이터 + 빌드된 앱으로 교사 1명 + 학생 8명(1명은 정원 초과) 시나리오를 돌린다.
set -euo pipefail
cd "$(dirname "$0")/.."
npx vite build --mode emulator --outDir dist-e2e --emptyOutDir > /dev/null
bash ../scripts/emulators.sh "bash client/e2e/inner.sh"
