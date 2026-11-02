#!/usr/bin/env bash
# Realtime DB 에뮬레이터(Java 직접 실행) + Auth 에뮬레이터(firebase CLI)를 띄우고 명령을 실행한 뒤 정리한다.
# 사용: scripts/emulators.sh "<명령>"   (명령 없이 실행하면 Ctrl+C 할 때까지 유지)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FB="$ROOT/client/node_modules/.bin/firebase"
JAR_DIR="$HOME/.cache/firebase/emulators"
JAR="$(ls "$JAR_DIR"/firebase-database-emulator-*.jar 2>/dev/null | tail -1 || true)"
if [ -z "$JAR" ]; then
  (cd "$ROOT" && "$FB" setup:emulators:database >/dev/null)
  JAR="$(ls "$JAR_DIR"/firebase-database-emulator-*.jar | tail -1)"
fi

java -jar "$JAR" --host 127.0.0.1 --port 9000 > "$ROOT/database-debug.log" 2>&1 &
DB_PID=$!
trap 'kill $DB_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  curl -s -o /dev/null "http://127.0.0.1:9000/.json?ns=demo-hideseek" && break
  sleep 0.5
done
curl -sS -X PUT -H "Authorization: Bearer owner" \
  "http://127.0.0.1:9000/.settings/rules.json?ns=demo-hideseek" \
  --data-binary "@$ROOT/database.rules.json" > /dev/null

cd "$ROOT"
if [ $# -gt 0 ]; then
  "$FB" emulators:exec --only auth --project demo-hideseek "$1"
else
  "$FB" emulators:start --only auth --project demo-hideseek
fi
