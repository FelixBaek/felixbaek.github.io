import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export const SITE = {
  title: 'FelixBaek',
  tagline: '직접 만들고 확인한 개발 기록',
  description: '개발 과정에서 배운 내용과 직접 실행해 확인한 결과를 정리하는 기술 블로그입니다.',
  author: 'Seungyong Baek',
  github: 'https://github.com/FelixBaek',
  email: '',
} as const;

/* ---------------------------------------------------------------- */
/* 글 조회                                                            */
/* ---------------------------------------------------------------- */

export async function getAllPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getPostsByLanguage(term: string): Promise<Post[]> {
  const posts = await getAllPosts();
  const target = term.toLowerCase();
  return posts.filter((post) =>
    post.data.languages.some((value) => value.toLowerCase() === target),
  );
}

/** 언어 id → 표시 이름 (글 frontmatter 에는 id 만 쓴다) */
export async function getLanguageNames(): Promise<Map<string, string>> {
  const languages = await getCollection('languages');
  return new Map(languages.map((entry) => [entry.id, entry.data.name]));
}

export function languageLabel(names: Map<string, string>, id: string): string {
  return names.get(id) ?? id;
}

/* ---------------------------------------------------------------- */
/* 표시 유틸                                                          */
/* ---------------------------------------------------------------- */

const DATE_KO: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
const DATE_SHORT: Intl.DateTimeFormatOptions = { month: '2-digit', day: '2-digit' };

export function formatDate(date: Date, style: 'long' | 'short' = 'long'): string {
  const formatter = new Intl.DateTimeFormat('ko-KR', style === 'long' ? DATE_KO : DATE_SHORT);
  return formatter.format(date);
}

/** 읽는 시간: 한글 기준 분당 500자(공백 제외) */
export function readingTime(body: string): number {
  const chars = body.replace(/\s+/g, '').length;
  return Math.max(1, Math.round(chars / 500));
}

/** 태그 URL 슬러그 (한글 유지, 공백만 하이픈) */
export function slugifyTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
