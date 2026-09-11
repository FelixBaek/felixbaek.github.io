#!/usr/bin/env node
/**
 * 새 글 생성기
 *   npm run new:post "글 제목"
 *   npm run new:post "글 제목" -- --lang language-id --tags 주제
 *
 * 파일명은 제목을 슬러그로 바꿔 src/content/posts/<slug>.mdx 로 만든다.
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const title = args.find((arg) => !arg.startsWith('--'));

function option(name, fallback = '') {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

if (!title) {
  console.error('제목이 필요합니다. 예) npm run new:post "새 글 제목"');
  process.exit(1);
}

const slug = title
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-+|-+$/g, '');

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:00+09:00`;

const langs = option('lang')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const tags = option('tags')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const frontmatter = `---
title: ${JSON.stringify(title)}
description: ""            # 목록·검색·OG에 쓰이는 한 줄 요약 (필수)
date: ${iso}
lastmod: ${iso}
languages: ${JSON.stringify(langs)}
tags: ${JSON.stringify(tags)}
wasm: []                   # 임베드한 Wasm 모듈 이름
---

## 왜

## 무엇을 했나

## 관찰

## 다시 볼 것
`;

const target = resolve(root, 'src/content/posts', `${slug}.mdx`);

try {
  await access(target);
  console.error(`이미 존재합니다: ${target}`);
  process.exit(1);
} catch {
  /* 없으면 생성 진행 */
}

await mkdir(dirname(target), { recursive: true });
await writeFile(target, frontmatter, 'utf8');

console.log(`생성: src/content/posts/${slug}.mdx`);
console.log('언어 id 는 src/content/languages 의 파일명과 맞춰야 합니다.');
