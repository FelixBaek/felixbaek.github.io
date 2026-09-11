/**
 * 전역 스크립트 (테마 · 드로어 · 코드 복사 · TOC 스크롤 추적 · 읽기 진행)
 * 인라인 핸들러 없이 addEventListener 로만 동작한다.
 */

type ThemePref = 'auto' | 'light' | 'dark';

const root = document.documentElement;
const THEME_KEY = 'anvil-theme';

interface RustTools {
  default: (input: { module_or_path: ArrayBuffer }) => Promise<unknown>;
  normalize_code: (input: string) => string;
  reading_progress: (scrollY: number, scrollHeight: number, viewportHeight: number) => number;
}

let rustTools: RustTools | undefined;
let rustToolsPromise: Promise<RustTools> | undefined;

function loadRustTools(): Promise<RustTools> {
  rustToolsPromise ??= (async () => {
    const [module, wasmUrl] = await Promise.all([
      import('@wasm/slice_capacity/pkg/slice_capacity.js'),
      import('@wasm/slice_capacity/pkg/slice_capacity_bg.wasm?url'),
    ]);
    const bytes = await fetch(wasmUrl.default).then((response) => response.arrayBuffer());
    await module.default({ module_or_path: bytes });
    rustTools = module;
    return module;
  })();
  return rustToolsPromise;
}

/* ---------------- 테마 ---------------- */

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncCommentsTheme(theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'): void {
  document.querySelector<HTMLIFrameElement>('iframe.giscus-frame')?.contentWindow?.postMessage(
    { giscus: { setConfig: { theme } } },
    'https://giscus.app',
  );
}

function applyTheme(pref: ThemePref): void {
  const theme = pref === 'auto' ? systemTheme() : pref;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-theme-pref', pref);
  syncCommentsTheme(theme);
  for (const el of document.querySelectorAll<HTMLElement>('[data-theme-label]')) {
    el.textContent = pref === 'auto' ? '시스템' : pref === 'dark' ? '다크' : '라이트';
  }
}

function initCommentsTheme(): void {
  const observer = new MutationObserver(() => {
    const frame = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
    if (!frame) return;
    frame.addEventListener('load', () => syncCommentsTheme(), { once: true });
    syncCommentsTheme();
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function currentPref(): ThemePref {
  return (root.getAttribute('data-theme-pref') as ThemePref) || 'auto';
}

export function cycleTheme(): ThemePref {
  const order: ThemePref[] = ['auto', 'light', 'dark'];
  const next = order[(order.indexOf(currentPref()) + 1) % order.length];
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* 저장 실패는 무시 (프라이빗 모드) */
  }
  applyTheme(next);
  return next;
}

/* ---------------- 좌측 드로어 ---------------- */

function initDrawer(): void {
  const drawer = document.querySelector<HTMLElement>('[data-drawer]');
  const scrim = document.querySelector<HTMLElement>('[data-scrim]');
  if (!drawer) return;

  const toggles = document.querySelectorAll<HTMLElement>('[data-drawer-toggle]');
  let opener: HTMLElement | null = null;

  const setOpen = (open: boolean, restoreFocus = true): void => {
    drawer.dataset.open = open ? 'true' : 'false';
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (scrim) scrim.hidden = !open;
    document.body.dataset.drawer = open ? 'open' : 'closed';
    toggles.forEach((btn) => btn.setAttribute('aria-expanded', open ? 'true' : 'false'));
    if (open) {
      drawer.querySelector<HTMLElement>('a, button')?.focus();
    } else if (restoreFocus) {
      opener?.focus();
    }
  };

  toggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = drawer.dataset.open !== 'true';
      if (open) opener = btn;
      setOpen(open);
    });
  });

  scrim?.addEventListener('click', () => setOpen(false));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  drawer.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a') && window.matchMedia('(max-width: 1023px)').matches) {
      setOpen(false);
    }
  });

  // 포커스 트랩
  drawer.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusables = drawer.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 1024px)').matches) setOpen(false, false);
  });
}

/* ---------------- 코드 복사 ---------------- */

function initCodeCopy(): void {
  if (document.querySelector('[data-code-copy]')) void loadRustTools().catch(() => undefined);

  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-code-copy]');
    if (!button) return;

    const block = button.closest('[data-code-block]');
    const code = block?.querySelector('pre code') ?? block?.querySelector('pre');
    if (!code) return;

    const label = button.querySelector<HTMLElement>('[data-copy-label], .code-block__copy-text');
    const raw = (code as HTMLElement).innerText;
    const value = rustTools?.normalize_code(raw) ?? raw.replace(/\r\n/g, '\n').replace(/\n$/, '');
    button.dataset.engine = rustTools ? 'rust-wasm' : 'javascript-fallback';

    const done = (ok: boolean): void => {
      button.dataset.copied = ok ? 'true' : 'false';
      if (label) label.textContent = ok ? '복사됨' : '실패';
      window.setTimeout(() => {
        button.dataset.copied = 'false';
        if (label) label.textContent = '복사';
      }, 1600);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(() => done(true)).catch(() => done(false));
      return;
    }

    done(false);
  });
}

/* ---------------- TOC 스크롤 추적 + 읽기 진행 ---------------- */

function initReading(): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'));
  const progress = document.querySelector<HTMLElement>('[data-progress-bar]');
  const railLabel = document.querySelector<HTMLElement>('[data-rail-label]');

  const targets: Array<{ id: string; el: HTMLElement; link?: HTMLAnchorElement }> = [];
  for (const link of links) {
    const id = decodeURIComponent(link.getAttribute('href')?.replace(/^#/, '') ?? '');
    if (!id) continue;
    const el = document.getElementById(id);
    if (el) targets.push({ id, el, link });
  }

  let active: string | null = null;
  let progressRatio = (scrollY: number, scrollHeight: number, viewportHeight: number): number => {
    const max = scrollHeight - viewportHeight;
    return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  };

  const setActive = (id: string): void => {
    if (active === id) return;
    active = id;
    for (const { id: targetId, link } of targets) {
      link?.classList.toggle('is-active', targetId === id);
      link?.setAttribute('aria-current', targetId === id ? 'true' : 'false');
    }
    const current = targets.find((t) => t.id === id);
    if (railLabel && current) railLabel.textContent = current.el.textContent?.trim() ?? '';
  };

  const update = (): void => {
    if (progress) {
      const ratio = progressRatio(window.scrollY, document.documentElement.scrollHeight, window.innerHeight);
      progress.style.transform = `scaleX(${ratio.toFixed(4)})`;
    }
    if (!targets.length) return;
    const line = window.scrollY + window.innerHeight * 0.28;
    let found = targets[0];
    for (const target of targets) {
      if (window.scrollY + target.el.getBoundingClientRect().top <= line) found = target;
      else break;
    }
    setActive(found.id);

    // 사이드바 TOC 자동 스크롤
    const activeLink = found.link;
    if (activeLink) {
      const scroller = activeLink.closest<HTMLElement>('[data-toc-scroll]');
      if (scroller && scroller.scrollHeight > scroller.clientHeight + 8) {
        const top = activeLink.offsetTop - scroller.clientHeight / 2;
        scroller.scrollTo({ top: top > 0 ? top : 0, behavior: 'smooth' });
      }
    }
  };

  let ticking = false;
  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();

  if (progress) {
    void (async () => {
      try {
        const module = await loadRustTools();
        progressRatio = module.reading_progress;
        progress.dataset.engine = 'rust-wasm';
        update();
      } catch {
        progress.dataset.engine = 'javascript-fallback';
      }
    })();
  }
}

/* ---------------- Go Wasm 읽기 시간 ---------------- */

function initReadingTime(): void {
  const body = document.querySelector<HTMLElement>('[data-post-body]');
  const output = document.querySelector<HTMLElement>('[data-reading-minutes]');
  if (!body || !output) return;

  void (async () => {
    try {
      const [wasmUrl, execUrl] = await Promise.all([
        import('@wasm/rune-counter/bin/rune_counter.wasm?url'),
        import('@wasm/rune-counter/bin/wasm_exec.js?url'),
      ]);

      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = execUrl.default;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Go runtime load failed'));
        document.head.appendChild(script);
      });

      const GoRuntime = (window as unknown as {
        Go?: new () => {
          importObject: WebAssembly.Imports;
          run: (instance: WebAssembly.Instance) => Promise<unknown>;
        };
      }).Go;
      if (!GoRuntime) throw new Error('Go runtime unavailable');

      const bytes = await fetch(wasmUrl.default).then((response) => response.arrayBuffer());
      const go = new GoRuntime();
      const { instance } = await WebAssembly.instantiate(bytes, go.importObject);
      void go.run(instance);

      const deadline = performance.now() + 5_000;
      let calculate: ((text: string, charsPerMinute: number) => number) | undefined;
      while (!calculate && performance.now() < deadline) {
        calculate = (window as unknown as {
          __anvilReadingMinutes?: (text: string, charsPerMinute: number) => number;
        }).__anvilReadingMinutes;
        if (!calculate) await new Promise((resolve) => window.setTimeout(resolve, 25));
      }
      if (!calculate) throw new Error('Go reading function unavailable');

      output.textContent = `약 ${calculate(body.innerText, 500)}분`;
      output.dataset.engine = 'go-wasm';
      output.title = 'Go WebAssembly로 본문을 계산한 읽기 시간';
    } catch {
      output.dataset.engine = 'static-fallback';
    }
  })();
}

/* ---------------- 접이식 상세 ---------------- */

function initTocInline(): void {
  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('.toc-inline a');
    if (!link) return;
    const details = link.closest('details');
    if (details) details.open = false;
  });
}

/* ---------------- 부트 ---------------- */

function boot(): void {
  applyTheme(currentPref());
  initDrawer();
  initCodeCopy();
  initReading();
  initReadingTime();
  initTocInline();
  initCommentsTheme();

  document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      cycleTheme();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-scroll-top]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
