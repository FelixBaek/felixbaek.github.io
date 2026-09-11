# Anvil — FelixBaek 기술 블로그

Astro 7 + Tailwind CSS v4 + WebAssembly(Rust/Go) 기반 개인 기술 블로그.
3단 레이아웃(좌측 기록 패널 · 중앙 본문 · 우측 목차)으로 읽기 중심을 유지하고,
Rust Wasm은 글의 읽기 진행률을, Go Wasm은 본문 읽기 시간을 브라우저에서 계산합니다.

- 사이트: <https://felixbaek.github.io/>
- 배포: GitHub Actions → GitHub Pages (`main` 브랜치 push)

## 스택

| 영역 | 사용 |
| --- | --- |
| 프레임워크 | Astro 7 (정적 출력, 아일랜드) |
| 스타일 | Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first `@theme` 토큰) |
| 콘텐츠 | MDX + Astro Content Collections(zod 스키마) |
| 코드 하이라이트 | Shiki (커스텀 라이트/다크 테마 + transformers) |
| 검색 | Pagefind (빌드 후 인덱싱, `force_language: ko`) |
| Wasm | Rust(wasm-pack) 읽기 진행률 · Go(TinyGo) 읽기 시간 |

## 명령

```bash
npm install            # 의존성
npm run dev            # 개발 서버 (http://localhost:4321)
npm run build          # astro build + pagefind 인덱싱 → dist/
npm run preview        # 빌드 결과 미리보기 (검색 포함)
npm run wasm:rust      # Rust Wasm 재빌드 (wasm-pack)
npm run wasm:go        # Go Wasm 재빌드 (TinyGo)
npm run new:post "제목" # 새 글 생성
```

Wasm 도구가 없으면 `wasm:*` 는 건너뛰어도 됩니다 — 산출물이 저장소에 커밋되어 있습니다.

## 글 쓰기

`src/content/posts/<slug>.mdx` 를 만들고 front matter를 채웁니다.

```yaml
---
title: "새 글 제목"
description: "목록·검색·OG에 쓰이는 한 줄 요약"
date: 2026-09-10T23:10:00+09:00
languages: []              # 언어 카테고리 id
tags: []
draft: true              # 작성 중이면 비공개
wasm: []                 # 임베드한 Wasm 모듈 이름
---
```

언어 카테고리는 필요할 때 `src/content/languages/<id>.md`로 추가합니다. 글이 없는 언어도
사이드바에 표시되며, 언어 페이지에는 `아직 공부 중이에요.`라고 안내합니다.

### 코드 블록 메타

````md
```rust file=src/main.rs hl={3,6-7} numbers
fn main() {}
```
````

| 메타 | 효과 |
| --- | --- |
| `file=` / `title=` | 블록 상단에 파일명 표시 |
| `hl={3,6-7}` | 해당 줄 강조 |
| `numbers` | 줄 번호 표시 |
| `// [!code ++]` · `// [!code --]` | diff 줄 |
| `// [!code highlight]` | 줄 강조 (Shiki 표기) |

모든 블록에는 복사 버튼이 자동으로 붙습니다.

### Wasm 실험 임베드

```mdx
import SliceLab from '@components/wasm/SliceLab.tsx';
import WasmLabFrame from '@components/wasm/WasmLabFrame.astro';

<WasmLabFrame module="slice_capacity.wasm" compiler="rust" size="20.7KB · gz 9.1KB" minHeight="19rem" label="슬라이스 시뮬레이터">
  <SliceLab client:visible />
  <div slot="fallback">…JS가 없을 때 보여줄 정적 내용…</div>
</WasmLabFrame>
```

## 폴더 구조

```
src/
├─ components/
│  ├─ nav/    Sidebar                      좌측 기록 패널
│  ├─ toc/    Toc, ReadingRail            우측 목차 / 모바일 진행선
│  ├─ post/   PostCard, PostMeta, PostNav, TagChip
│  ├─ page/   AxisPage                     언어 아카이브 공용 레이아웃
│  └─ wasm/   WasmLabFrame, SliceLab, RuneLab, lab-utils
├─ layouts/   SiteShell(3단 골격), PostLayout
├─ lib/       site.ts (콘텐츠 조회·집계·포맷)
├─ plugins/   shiki-meta.ts
├─ scripts/   site.ts (테마·드로어·복사·스크롤 추적)
├─ styles/    tokens.css, layout.css, prose.css, code.css, lab.css, shiki-*.json
├─ content/   posts(MDX) · languages
├─ pages/     index, posts/[...slug], languages/[slug], tags/[slug], archives,
│             search, 404, rss.xml
└─ wasm/      slice_capacity(Rust) · rune-counter(Go)
```

## Wasm 모듈

| 모듈 | 언어 | 크기 | 쓰이는 곳 |
| --- | --- | --- | --- |
| `slice_capacity` | Rust (wasm-bindgen) | 18.5KB · gz 8.3KB | 슬라이스 len/cap 재할당 시뮬레이터 |
| `rune_counter` | Go (TinyGo, syscall/js) | 179.4KB · gz 79.9KB | 문자열 바이트/룬 카운터 |

두 모듈 모두 `client:visible` 로 하이드레이션되므로, 본문 끝의 실험 영역까지
스크롤해야 로드됩니다. 로딩 동안에는 스켈레톤이 결과와 같은 `min-height` 를
차지해 레이아웃 이동(CLS)이 0 입니다.

### 브라우저 실행 검증

두 랩은 로드 직후 **자가검증**을 돌려 결과를 DOM 에 남깁니다(회귀 확인용).

```bash
npm run build && npm run preview
# Rust 랩
#   data-lab-state="ready"  data-lab-selftest="자가검증 · append 5회에서 재할당 (cap → 16)"
# Go 랩
#   data-lab-probe="go:ok bytes=9 runes=5"
curl -s localhost:4321/posts/go-string-runes/ | grep -o 'data-lab-selftest="[^"]*"'
```

## 라이선스

코드: MIT · 글: CC BY-NC 4.0
