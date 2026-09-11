#!/usr/bin/env bash
# Go → Wasm (TinyGo)
set -euo pipefail
cd "$(dirname "$0")/.."

DIR="src/wasm/rune-counter"
OUT_REL="bin/rune_counter.wasm"
OUT="$DIR/$OUT_REL"

if ! command -v tinygo >/dev/null 2>&1; then
  echo "tinygo 가 필요합니다: https://tinygo.org/getting-started/install/" >&2
  exit 1
fi

mkdir -p "$DIR/bin"

echo "==> tinygo build ($DIR)"
# tinygo 는 모듈 루트에서 실행해야 패키지를 찾는다 (경로가 아닌 "." 로 지정)
#  -gc=leaking: 이 모듈은 짧게 살고 계속 살아 있는 객체가 적어 leaking GC 가 안전하며 크기가 작다
#  -panic=trap : panic 문자열/포맷터 제거 (검증 완료)
( cd "$DIR" && tinygo build -o "$OUT_REL" -target wasm -opt=z -no-debug -gc=leaking -panic=trap . )

# wasm_exec.js 는 tinygo 버전과 반드시 일치해야 한다 (직접 배포본에서 복사)
TINYGOROOT="$(tinygo env TINYGOROOT)"
EXEC_SRC="$TINYGOROOT/lib/wasm/wasm_exec.js"
if [[ ! -f "$EXEC_SRC" ]]; then
  EXEC_SRC="$TINYGOROOT/targets/wasm_exec.js"
fi
if [[ -f "$EXEC_SRC" ]]; then
  cp "$EXEC_SRC" "$DIR/bin/wasm_exec.js"
  echo "==> wasm_exec.js 복사: $EXEC_SRC"
else
  echo "!! wasm_exec.js 를 찾지 못했습니다 ($TINYGOROOT 확인)" >&2
  exit 1
fi

RAW=$(stat -c%s "$OUT")
GZ=$(gzip -c "$OUT" | wc -c)
printf "==> wasm %s bytes / gzip %s bytes\n" "$RAW" "$GZ"
ls -lh "$DIR/bin" | sed 's/^/    /'
