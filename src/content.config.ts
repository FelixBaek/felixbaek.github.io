import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * 콘텐츠 스키마
 *  posts     : MDX 글
 *  languages : 언어 카테고리 메타
 */

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(200),
    date: z.coerce.date(),
    lastmod: z.coerce.date().optional(),
    draft: z.boolean().default(false),

    /** 기록 축 */
    languages: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),

    /** SEO/OG */
    cover: z.string().optional(),
    noindex: z.boolean().default(false),
  }),
});

const languages = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/languages' }),
  schema: z.object({
    name: z.string(),
    /** 좌측 패널 정렬 순서 */
    order: z.number().default(100),
    summary: z.string().default(''),
  }),
});

export const collections = { posts, languages };
