// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import sitemap from '@astrojs/sitemap';
import {
  transformerMetaHighlight,
  transformerNotationHighlight,
  transformerNotationDiff,
  transformerNotationFocus,
} from '@shikijs/transformers';

import { shikiMeta } from './src/plugins/shiki-meta';

import shikiLight from './src/styles/shiki-light.json';
import shikiDark from './src/styles/shiki-dark.json';

/**
 * Tailwind v4(@tailwindcss/vite) + wasm + top-level await 조합 메모
 * ---------------------------------------------------------------
 * 1. @tailwindcss/vite 는 CSS 변환만 담당하므로 wasm 플러그인과 실행 순서 충돌이 없다.
 *    플러그인 배열은 tailwindcss() → wasm() 순서로 둔다.
 * 2. wasm 모듈은 ESM 으로 import 되며 초기화에 top-level await 를 쓴다.
 *    → build.target='esnext' 로 TLA 를 네이티브 유지한다(폴리필 플러그인 불필요).
 *    → vite-plugin-top-level-await 은 rollup 을 CJS 로 require 해서 Vite 7 에서
 *      "Cannot find module 'rollup'" 로 설정 로딩 자체를 깨뜨리므로 쓰지 않는다.
 * 3. wasm 패키지는 optimizeDeps 에서 제외해야 dev 서버가 ESM 을 변환하지 않는다.
 */
const WASM_PACKAGES = ['@wasm/slice_capacity', 'anvil/rune-counter'];

export default defineConfig({
  site: 'https://felixbaek.github.io',
  trailingSlash: 'ignore',

  integrations: [mdx(), react(), sitemap()],

  vite: {
    plugins: [tailwindcss(), wasm()],
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
        '@components': new URL('./src/components', import.meta.url).pathname,
        '@layouts': new URL('./src/layouts', import.meta.url).pathname,
        '@lib': new URL('./src/lib', import.meta.url).pathname,
        '@scripts': new URL('./src/scripts', import.meta.url).pathname,
        '@styles': new URL('./src/styles', import.meta.url).pathname,
        '@wasm': new URL('./src/wasm', import.meta.url).pathname,
      },
    },
    build: {
      target: 'esnext', // TLA 유지
    },
    optimizeDeps: {
      // wasm 패키지는 사전 번들링에서 제외해야 dev 서버가 ESM 을 변환하지 않는다.
      exclude: WASM_PACKAGES,
      // 참고: Vite 7(rolldown 기반)에서는 optimizeDeps.esbuildOptions 가 deprecated 다.
      //      target 은 아래 build.target='esnext' 로 일원화한다.
    },
    worker: { format: 'es' },
  },

  markdown: {
    shikiConfig: {
      themes: {
        light: /** @type {any} */ (shikiLight),
        dark: /** @type {any} */ (shikiDark),
      },
      defaultColor: false, // 듀얼 테마: 색은 --shiki-light / --shiki-dark 로 내려온다
      wrap: false,
      transformers: [
        shikiMeta(), // file=, hl={}, numbers 메타 파싱
        transformerMetaHighlight(), // meta="{1,3}" 지원
        transformerNotationHighlight(), // // [!code highlight]
        transformerNotationDiff(), // // [!code ++] / --
        transformerNotationFocus(), // // [!code focus]
      ],
    },
    rehypePlugins: [],
  },
});
