import type { ShikiTransformer } from 'shiki';
import type { Element, ElementContent, Properties, Text } from 'hast';

/**
 * 코드 펜스 메타 파서 + 코드 블록 크롬 래퍼
 *
 *   ```rust file=src/main.rs hl={3,6-7} numbers
 *   ```rust title="src/main.rs" hl=[3,6-7]
 *
 * 지원 키: file / title / hl / numbers
 *
 * 왜 rehype 플러그인이 아니라 Shiki transformer 인가
 *  - Astro 7 부터 MDX 는 자체 remark/rehype 파이프라인을 쓰고, 기본 Markdown 처리기는
 *    Sätteri 로 바뀌었다. 사용자 rehypePlugins 는 파이프라인/버전에 따라 순서가 흔들린다.
 *  - Shiki transformer 의 `root` 훅은 하이라이팅이 끝난 <pre> 를 그 자리에서 잡을 수 있어
 *    "하이라이팅 → 크롬(헤더/복사) 래핑" 을 한 단계로 확정할 수 있다.
 */

export interface CodeMeta {
  file?: string;
  numbers: boolean;
  hl: Array<[number, number]>;
}

export function parseCodeMeta(raw?: string): CodeMeta {
  const meta: CodeMeta = { numbers: false, hl: [] };
  if (!raw) return meta;

  const fileMatch = raw.match(/\b(?:file|title)=(?:"([^"]+)"|'([^']+)'|([^\s{}]+))/);
  if (fileMatch) meta.file = fileMatch[1] ?? fileMatch[2] ?? fileMatch[3];

  if (/\bnumbers\b|\blinenos\b/.test(raw)) meta.numbers = true;

  const hlMatch = raw.match(/\bhl=(\{[^}]*\}|\[[^\]]*\])/);
  if (hlMatch) {
    const body = hlMatch[1].replace(/[{}\[\]"\s]/g, '');
    for (const part of body.split(',')) {
      if (!part) continue;
      const range = part.split('-');
      const start = Number.parseInt(range[0], 10);
      if (Number.isNaN(start)) continue;
      const end = range.length > 1 ? Number.parseInt(range[1], 10) : start;
      meta.hl.push([start, Number.isNaN(end) ? start : end]);
    }
  }

  return meta;
}

function inHighlightRanges(line: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => line >= start && line <= end);
}

/* ---------------------------------------------------------------- */
/* hast 헬퍼                                                          */
/* ---------------------------------------------------------------- */

function el(tagName: string, properties: Properties, children: ElementContent[] = []): Element {
  return { type: 'element', tagName, properties, children };
}

function text(value: string): Text {
  return { type: 'text', value };
}

/** <pre> 를 코드 블록 크롬으로 감싼다 (헤더: 언어 · 파일명 · 복사 버튼) */
function wrapPre(pre: Element, meta: CodeMeta, lang: string): Element {
  const head: ElementContent[] = [el('span', { className: ['code-block__lang'] }, [text(lang || 'text')])];

  if (meta.file) head.push(el('span', { className: ['code-block__file'] }, [text(meta.file)]));

  head.push(
    el('span', { className: ['code-block__meta'] }, [
      el(
        'button',
        {
          type: 'button',
          className: ['code-block__copy'],
          'data-code-copy': 'true',
          title: meta.file ? `${meta.file} 코드 복사` : '코드 복사',
        },
        [el('span', { className: ['code-block__copy-text'] }, [text('복사')])],
      ),
    ]),
  );

  const wrapperClasses = ['code-block'];
  if (meta.numbers) wrapperClasses.push('code-block--numbered');

  return el('div', { className: wrapperClasses, 'data-code-block': 'true' }, [
    el('div', { className: ['code-block__head'] }, head),
    el('div', { className: ['code-block__body'] }, [pre]),
  ]);
}

/* ---------------------------------------------------------------- */

export function shikiMeta(): ShikiTransformer {
  return {
    name: 'anvil:code-meta',

    pre(node) {
      const meta = parseCodeMeta(this.options.meta?.__raw);
      const lang = (this.options.lang ?? '').toString();

      node.properties = node.properties ?? {};
      node.properties['data-lang'] = lang;
      if (meta.file) node.properties['data-file'] = meta.file;
      if (meta.numbers) node.properties['data-numbers'] = 'true';
    },

    line(node, line) {
      const meta = parseCodeMeta(this.options.meta?.__raw);
      if (meta.hl.length && inHighlightRanges(line, meta.hl)) {
        const existing = node.properties?.class;
        const classes = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : [];
        classes.push('highlighted');
        node.properties = { ...(node.properties ?? {}), class: classes };
      }
    },

    /** 하이라이팅이 끝난 뒤 <pre> 를 크롬으로 감싼다 */
    root(node) {
      const meta = parseCodeMeta(this.options.meta?.__raw);
      const lang = (this.options.lang ?? '').toString();

      const index = (node.children ?? []).findIndex(
        (child) => child.type === 'element' && child.tagName === 'pre',
      );
      if (index < 0) return;

      const pre = node.children![index];
      if (pre.type !== 'element') return;
      node.children![index] = wrapPre(pre, meta, lang);
    },
  };
}
