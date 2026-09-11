/**
 * RuneLab — TinyGo(Go) 문자열 바이트/룬 카운터
 *
 * Go 쪽은 syscall/js 로 함수를 전역에 노출한다.
 *  - wasm_exec.js 로 인스턴스화 → go.run() (main 이 블록되며 대기)
 *  - 이후 window.__anvilRuneCount(text) 호출
 * JS가 꺼져 있으면 프레임의 <noscript> 정적 대체물이 같은 정보를 전달한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { describeError, formatBytes, setLabState, type LabState } from './lab-utils';

interface RuneCountResult {
  bytes: number;
  runes: number;
}

/** Go 쪽은 JSON 문자열을 돌려준다 (js.Value 변환 이슈 회피) */
type RuneCounter = (text: string) => string;

function parseCount(raw: string): RuneCountResult {
  try {
    const parsed = JSON.parse(raw) as Partial<RuneCountResult>;
    return { bytes: Number(parsed.bytes ?? 0), runes: Number(parsed.runes ?? 0) };
  } catch {
    return { bytes: 0, runes: 0 };
  }
}

const SAMPLES = [
  'Golang',
  '한글',
  'Go 언어',
  '안녕, 世界 🌍',
];

declare global {
  interface Window {
    __anvilRuneCount?: RuneCounter;
    Go?: unknown;
  }
}

export default function RuneLab() {
  const rootRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<RuneCounter | null>(null);

  const [state, setState] = useState<LabState>('loading');
  const [error, setError] = useState('');
  const [moduleBytes, setModuleBytes] = useState(0);
  const [text, setText] = useState('Go 언어');
  const [result, setResult] = useState<RuneCountResult | null>(null);
  const [selfTest, setSelfTest] = useState('');

  /** TinyGo wasm 로드 */
  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        setLabState(rootRef.current, 'loading');
        const started = performance.now();

        const canvas = document.createElement('canvas');
        void canvas;

        const [wasmUrl, execUrl] = await Promise.all([
          import('@wasm/rune-counter/bin/rune_counter.wasm?url'),
          import('@wasm/rune-counter/bin/wasm_exec.js?url'),
        ]);

        // wasm_exec.js 는 전역 Go 런타임을 정의한다 (TinyGo 배포본 그대로 사용)
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = execUrl.default;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('wasm_exec.js 로드 실패'));
          document.head.appendChild(script);
        });

        const response = await fetch(wasmUrl.default);
        const buffer = await response.arrayBuffer();
        if (disposed) return;
        setModuleBytes(buffer.byteLength);

        const GoCtor = (window as unknown as { Go: new () => { importObject: WebAssembly.Imports; run: (i: WebAssembly.Instance) => Promise<unknown> } }).Go;
        if (!GoCtor) throw new Error('Go 런타임(wasm_exec.js)을 찾지 못했습니다');

        const go = new GoCtor();
        const { instance } = await WebAssembly.instantiate(buffer, go.importObject);
        void go.run(instance); // main() 은 채널에서 대기하며 살아 있다

        // Go 쪽에서 전역 함수가 등록될 때까지 짧게 대기
        const counter = await new Promise<RuneCounter>((resolve, reject) => {
          const deadline = performance.now() + 5000;
          const poll = (): void => {
            const fn = window.__anvilRuneCount as RuneCounter | undefined;
            if (fn) {
              resolve(fn);
              return;
            }
            if (performance.now() > deadline) {
              reject(new Error('Go 함수 노출 시간 초과'));
              return;
            }
            window.setTimeout(poll, 50);
          };
          poll();
        });

        counterRef.current = counter;
        if (disposed) return;

        /**
         * 자가검증 — 알려진 값과 대조한다.
         * "Go 언어" 는 UTF-8 로 9바이트(한글 3바이트 × 2 + ASCII 3), 룬은 5개.
         */
        const check = parseCount(counter('Go 언어'));
        const expected = { bytes: 9, runes: 5 };
        const ok = check.bytes === expected.bytes && check.runes === expected.runes;
        setSelfTest(
          `자가검증 · "Go 언어" → ${check.bytes}B / ${check.runes}룬 ${ok ? '✓ 기대값 일치' : '✗ 불일치'}`,
        );

        setResult(parseCount(counter(text)));
        setState('ready');
        setLabState(rootRef.current, 'ready', `실행중 · ${(performance.now() - started).toFixed(0)}ms`);
      } catch (caught) {
        if (disposed) return;
        setError(describeError(caught));
        setState('error');
        setLabState(rootRef.current, 'error');
      }
    })();

    return () => {
      disposed = true;
      delete window.__anvilRuneCount;
    };
    // text 는 첫 호출에만 사용한다 (이후에는 사용자 입력으로 갱신)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const measure = useCallback((value: string) => {
    setText(value);
    const counter = counterRef.current;
    if (!counter) return;
    try {
      setResult(parseCount(counter(value)));
    } catch (caught) {
      setError(describeError(caught));
      setState('error');
      setLabState(rootRef.current, 'error');
    }
  }, []);

  if (state === 'error') {
    return (
      <div className="wasm-lab__inner" ref={rootRef} data-lab-state="error">
        <pre className="lab-output" data-tone="error">
          Go(TinyGo) Wasm 모듈을 실행하지 못했습니다.{'\n'}
          {error}
        </pre>
        <p className="text-[0.8125rem] text-fg-muted">
          정적 결과: <code>"Go 언어"</code> → 바이트 9, 룬 5 (공백 1 포함).
        </p>
      </div>
    );
  }

  if (state !== 'ready' || !result) {
    return (
      <div className="lab-skeleton" ref={rootRef} data-lab-state="loading" aria-busy="true">
        <div className="lab-skeleton__bar" />
        <div className="lab-skeleton__row" />
        <div className="lab-skeleton__row lab-skeleton__row--short" />
        <div className="lab-skeleton__bar" />
        <p className="lab-skeleton__note">
          TinyGo 모듈(<code>rune_counter.wasm</code>)과 Go 런타임을 준비하는 중입니다. 영역 크기는
          결과와 동일하게 예약되어 있습니다.
        </p>
      </div>
    );
  }

  const probe = `go:ok bytes=${result.bytes} runes=${result.runes}`;

  return (
    <div className="wasm-lab__inner" ref={rootRef} data-lab-state="ready" data-lab-probe={probe} data-lab-selftest={selfTest}>
      <div className="lab-controls">
        <label className="lab-field">
          <span>입력</span>
          <input
            type="text"
            value={text}
            onChange={(event) => measure(event.target.value)}
            aria-label="바이트와 룬을 셀 문자열"
          />
        </label>
        {SAMPLES.map((sample) => (
          <button key={sample} type="button" className="lab-btn" onClick={() => measure(sample)}>
            {sample}
          </button>
        ))}
      </div>

      <div className="lab-metrics">
        <span className="lab-metric">
          <span className="lab-metric__key">len(s) 바이트</span>
          <span className="lab-metric__value">{result.bytes}</span>
        </span>
        <span className="lab-metric">
          <span className="lab-metric__key">룬 개수</span>
          <span className="lab-metric__value lab-metric__value--accent">{result.runes}</span>
        </span>
        <span className="lab-metric">
          <span className="lab-metric__key">차이</span>
          <span className="lab-metric__value">{result.bytes - result.runes}</span>
        </span>
        <span className="lab-metric">
          <span className="lab-metric__key">모듈</span>
          <span className="lab-metric__value">{moduleBytes > 0 ? formatBytes(moduleBytes) : '—'}</span>
        </span>
      </div>

      <pre className="lab-output" aria-live="polite">
        {`len("${text}") = ${result.bytes} bytes\nutf8.RuneCountInString("${text}") = ${result.runes} runes\n→ ${
          result.bytes === result.runes
            ? 'ASCII만 있어 바이트와 룬 수가 같습니다'
            : `한 글자가 여러 바이트(차이 ${result.bytes - result.runes})`
        }`}
      </pre>

      {selfTest && (
        <p className="text-[0.6875rem] leading-relaxed text-fg-caption" data-lab-selftest-line>
          {selfTest}
        </p>
      )}
    </div>
  );
}
