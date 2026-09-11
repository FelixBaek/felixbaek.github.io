import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * 콘텐츠 스키마
 *  posts     : MDX 글 (Wasm 컴포넌트 임베드 가능)
 *  languages : 언어 아카이브 메타 (Go, Rust, …)
 *  harness   : 기록 방식 (개념정리, 실험기록, 트러블슈팅, 회고)
 *  projects  : 프로젝트 아카이브
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
    harness: z.array(z.string()).default([]),
    projects: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),

    /** 학습 루프: true면 좌측 '복습 대기'에 노출 */
    review: z.boolean().default(false),
    /** 복습 예정일 (지나면 '복습 지연'으로 표시) */
    reviewAfter: z.coerce.date().optional(),

    /** 이 글에 임베드된 Wasm 모듈 (사이드바/배지·검증에 사용) */
    wasm: z.array(z.string()).default([]),

    /** 순서가 있는 묶음(같은 harness 안에서 읽는 순서) */
    order: z.number().optional(),

    /** SEO/OG */
    cover: z.string().optional(),
    noindex: z.boolean().default(false),
  }),
});

const languages = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/languages' }),
  schema: z.object({
    name: z.string(),
    /** learning | active | archived */
    status: z.enum(['learning', 'active', 'archived']).default('active'),
    /** 좌측 패널 정렬 순서 */
    order: z.number().default(100),
    summary: z.string().default(''),
    /** 이 언어를 배우기 시작한 시점 (선택) */
    since: z.string().optional(),
    /** 대표 저장소 (선택) */
    repo: z.url().optional(),
  }),
});

const harness = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/harness' }),
  schema: z.object({
    name: z.string(),
    order: z.number().default(100),
    /** 한 줄 정의 — 좌측 패널 툴팁과 분류 페이지 상단에 쓰인다 */
    definition: z.string(),
    summary: z.string().default(''),
    /** 글 작성 시 기본 frontmatter로 쓰이는지 */
    defaultTags: z.array(z.string()).default([]),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    name: z.string(),
    status: z.enum(['active', 'paused', 'archived', 'planned']).default('planned'),
    summary: z.string().default(''),
    stack: z.array(z.string()).default([]),
    started: z.string().optional(),
    repo: z.url().optional(),
    demo: z.url().optional(),
    order: z.number().default(100),
  }),
});

export const collections = { posts, languages, harness, projects };
