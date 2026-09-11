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

/** 좌측 패널의 3개 축 */
export const AXES = {
  languages: { label: 'Languages', hint: '언어별 학습 아카이브', tone: 'lang' },
  harness: { label: 'Harness', hint: '기록의 방식 (실험대)', tone: 'harness' },
  projects: { label: 'Projects', hint: '만든 것 아카이브', tone: 'project' },
} as const;

export type AxisKey = keyof typeof AXES;

/* ---------------------------------------------------------------- */
/* 글 조회                                                            */
/* ---------------------------------------------------------------- */

export async function getAllPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getRecentPosts(count = 4): Promise<Post[]> {
  return (await getAllPosts()).slice(0, count);
}

export async function getReviewQueue(): Promise<Post[]> {
  const posts = await getAllPosts();
  return posts
    .filter((post) => post.data.review)
    .sort((a, b) => {
      const aDue = a.data.reviewAfter?.valueOf() ?? a.data.date.valueOf();
      const bDue = b.data.reviewAfter?.valueOf() ?? b.data.date.valueOf();
      return aDue - bDue; // 오래된 것부터 = 복습 시급한 것부터
    });
}

/** 축(axis)별 글 개수 — 좌측 패널 카운트 */
export async function getAxisCounts(): Promise<Record<string, number>> {
  const posts = await getAllPosts();
  const counts: Record<string, number> = {};
  for (const post of posts) {
    for (const term of post.data.languages) counts[`languages:${term}`] = (counts[`languages:${term}`] ?? 0) + 1;
    for (const term of post.data.harness) counts[`harness:${term}`] = (counts[`harness:${term}`] ?? 0) + 1;
    for (const term of post.data.projects) counts[`projects:${term}`] = (counts[`projects:${term}`] ?? 0) + 1;
  }
  return counts;
}

/** 특정 축 값의 최근 갱신일 */
export async function getAxisLastUpdated(axis: AxisKey): Promise<Record<string, Date>> {
  const posts = await getAllPosts();
  const latest: Record<string, Date> = {};
  for (const post of posts) {
    for (const term of post.data[axis] ?? []) {
      const current = latest[term];
      const stamp = post.data.lastmod ?? post.data.date;
      if (!current || stamp.valueOf() > current.valueOf()) latest[term] = stamp;
    }
  }
  return latest;
}

export async function getPostsByAxis(axis: AxisKey, term: string): Promise<Post[]> {
  const posts = await getAllPosts();
  const target = term.toLowerCase();
  return posts.filter((post) =>
    (post.data[axis] ?? []).some((value) => value.toLowerCase() === target),
  );
}

/** 축 id → 표시 이름 (글 frontmatter 에는 id 만 쓴다) */
export interface AxisMaps {
  languages: Map<string, string>;
  harness: Map<string, string>;
  projects: Map<string, string>;
}

export async function getAxisMaps(): Promise<AxisMaps> {
  const [languages, harness, projects] = await Promise.all([
    getCollection('languages'),
    getCollection('harness'),
    getCollection('projects'),
  ]);
  return {
    languages: new Map(languages.map((entry) => [entry.id, entry.data.name])),
    harness: new Map(harness.map((entry) => [entry.id, entry.data.name])),
    projects: new Map(projects.map((entry) => [entry.id, entry.data.name])),
  };
}

export function axisLabel(maps: AxisMaps, axis: AxisKey, id: string): string {
  return maps[axis].get(id) ?? id;
}

/** 같은 harness 묶음에서 읽는 순서 (시리즈 카드용) */
export async function getHarnessBundle(post: Post): Promise<Post[]> {
  const term = post.data.harness[0];
  if (!term) return [];
  const bundle = await getPostsByAxis('harness', term);
  return bundle.sort((a, b) => {
    const ao = a.data.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.data.order ?? Number.MAX_SAFE_INTEGER;
    return ao !== bo ? ao - bo : a.data.date.valueOf() - b.data.date.valueOf();
  });
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

export function formatRelative(date: Date, now = new Date()): string {
  const days = Math.floor((now.valueOf() - date.valueOf()) / 86_400_000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

/** 읽는 시간: 한글 기준 분당 500자(공백 제외) */
export function readingTime(body: string): number {
  const chars = body.replace(/\s+/g, '').length;
  return Math.max(1, Math.round(chars / 500));
}

export function isDue(date?: Date): boolean {
  if (!date) return false;
  return date.valueOf() <= Date.now();
}

export function axisClass(tone: string): string {
  return `chip--${tone}`;
}

/** 태그 URL 슬러그 (한글 유지, 공백만 하이픈) */
export function slugifyTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
