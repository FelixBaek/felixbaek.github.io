#!/usr/bin/env bash
# Rust → Wasm (wasm-pack + wasm-bindgen)
set -euo pipefail
cd "$(dirname "$0")/.."

CRATE_DIR="src/wasm/slice_capacity"

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "wasm-pack 이 필요합니다: cargo install wasm-pack 또는 릴리스 바이너리 설치" >&2
  exit 1
fi

# 함정 1: wasm-pack 의 wasm-opt 단계는 bulk-memory feature 를 켜지 않으면 검증에 실패한다.
#          → src/wasm/slice_capacity/Cargo.toml 의 [package.metadata.wasm-pack.profile.release]
#            에서 --enable-bulk-memory 를 넘겨 해결한다.
# 함정 2: tinygo 는 자체(구버전) wasm-opt 를 bin/ 에 설치한다. PATH 앞에 있으면 그쪽이 잡혀
#          위와 같은 검증 실패가 나므로, wasm-pack 실행 동안은 tinygo 경로를 PATH 에서 제거한다.
CLEAN_PATH="$(printf '%s' "${PATH}" | tr ':' '\n' | grep -v 'tinygo' | paste -sd: -)"

echo "==> wasm-pack build ($CRATE_DIR)"
PATH="$CLEAN_PATH" wasm-pack build "$CRATE_DIR" \
  --target web \
  --release \
  --out-dir pkg \
  --out-name slice_capacity

# wasm-pack 가 넣는 package.json / .gitignore 는 저장소 산출물에 필요 없다
rm -f "$CRATE_DIR/pkg/package.json" "$CRATE_DIR/pkg/.gitignore" "$CRATE_DIR/pkg/README.md"

echo "==> 산출물"
ls -lh "$CRATE_DIR/pkg" | sed 's/^/    /'

RAW=$(stat -c%s "$CRATE_DIR/pkg/slice_capacity_bg.wasm")
GZ=$(gzip -c "$CRATE_DIR/pkg/slice_capacity_bg.wasm" | wc -c)
printf "==> wasm %s bytes / gzip %s bytes\n" "$RAW" "$GZ"

# 참고: 이 스크립트를 `| tail` 로 파이프하면 종료 코드가 가려져 wasm-opt 실패를 놓친다.
#       빌드 검증은 파이프 없이 실행할 것.
WASM_OPT_BIN="$(find "${HOME}/.cache/.wasm-pack" -type f -name wasm-opt -print -quit 2>/dev/null || true)"
if [ -n "$WASM_OPT_BIN" ]; then
  printf "==> optimizer: %s\n" "$WASM_OPT_BIN"
else
  echo "==> 경고: wasm-pack 자체 binaryen 을 찾지 못했다(최적화 생략 가능)" >&2
fi
