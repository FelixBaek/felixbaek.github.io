// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
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

export default defineConfig({
  site: 'https://felixbaek.github.io',
  trailingSlash: 'ignore',

  integrations: [mdx(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
        '@components': new URL('./src/components', import.meta.url).pathname,
        '@layouts': new URL('./src/layouts', import.meta.url).pathname,
        '@lib': new URL('./src/lib', import.meta.url).pathname,
        '@scripts': new URL('./src/scripts', import.meta.url).pathname,
        '@styles': new URL('./src/styles', import.meta.url).pathname,
      },
    },
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
