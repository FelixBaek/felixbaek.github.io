/**
 * SliceLab — Rust(wasm-pack) 슬라이스 용량 시뮬레이터
 *
 * Astro Island 규칙
 *  - 기본 하이드레이션은 client:visible (뷰포트 진입 시 모듈 fetch)
 *  - wasm 초기화는 마운트 이후 동적 import 로 수행 → 초기 JS 번들에 wasm 바이트가 실리지 않는다
 *  - 로딩 동안 스켈레톤이 stage 의 min-height 를 그대로 채워 CLS = 0
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { describeError, formatBytes, setLabState, type LabState } from './lab-utils';

interface SliceSimHandle {
  len(): number;
  cap(): number;
  push(value: number): boolean;
  reallocs(): number;
  report(): string;
  reset(): void;
  free(): void;
}

type SimCtor = new (len: number, cap: number) => SliceSimHandle;

export default function SliceLab() {
  const rootRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<SliceSimHandle | null>(null);

  const [state, setState] = useState<LabState>('loading');
  const [error, setError] = useState<string>('');
  const [moduleBytes, setModuleBytes] = useState<number>(0);
  const [len, setLen] = useState(4);
  const [cap, setCap] = useState(8);
  const [reallocs, setReallocs] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [flash, setFlash] = useState<'none' | 'realloc'>('none');
  const [selfTest, setSelfTest] = useState('');

  const syncFromSim = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    setLen(sim.len());
    setCap(sim.cap());
    setReallocs(sim.reallocs());
  }, []);

  /** wasm 로드 + 초기화 (Rust) */
  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        setLabState(rootRef.current, 'loading');
        const started = performance.now();

        const [mod, wasmUrl] = await Promise.all([
          import('@wasm/slice_capacity/pkg/slice_capacity.js'),
          import('@wasm/slice_capacity/pkg/slice_capacity_bg.wasm?url'),
        ]);

        const response = await fetch(wasmUrl.default);
        const buffer = await response.arrayBuffer();
        if (disposed) return;
        setModuleBytes(buffer.byteLength);

        await mod.default({ module_or_path: buffer });
        if (disposed) return;

        const Sim = mod.SliceSim as unknown as SimCtor;
        simRef.current = new Sim(4, 8);

        /**
         * 자가검증 — 모듈이 실제로 도는지 스스로 확인한다.
         * len=4 cap=8 에서 append 를 반복하면 5번째(len=9)에서 재할당되어 cap 이 16 이 되어야 한다.
         */
        const sim = simRef.current;
        let steps = 0;
        let reallocated = false;
        while (steps < 64 && !reallocated) {
          reallocated = sim.push(steps);
          steps += 1;
        }
        const capAfter = sim.cap();
        sim.reset();
        syncFromSim();
        setSelfTest(`자가검증 · append ${steps}회에서 재할당 (cap → ${capAfter})`);

        setState('ready');
        setLabState(rootRef.current, 'ready', `실행중 · ${(performance.now() - started).toFixed(0)}ms`);
        setLog([
          `len=${simRef.current.len()} cap=${simRef.current.cap()} 로 시작`,
          '여유(cap) 안에서 append하면 같은 배열을 수정합니다. 넘으면 재할당됩니다.',
        ]);
      } catch (caught) {
        if (disposed) return;
        const message = describeError(caught);
        setError(message);
        setState('error');
        setLabState(rootRef.current, 'error');
      }
    })();

    return () => {
      disposed = true;
      try {
        simRef.current?.free();
      } catch {
        /* noop */
      }
    };
  }, [syncFromSim]);

  const append = useCallback(
    (count = 1) => {
      const sim = simRef.current;
      if (!sim) return;

      let reallocated = false;
      for (let i = 0; i < count; i += 1) {
        const didRealloc = sim.push(sim.len() + 1);
        reallocated = reallocated || didRealloc;
      }

      syncFromSim();
      setFlash(reallocated ? 'realloc' : 'none');
      setLog((prev) =>
        [
          reallocated
            ? `append ${count} → 재할당 발생 (cap ${sim.cap()})`
            : `append ${count} → 같은 배열 (cap ${sim.cap()})`,
          ...prev,
        ].slice(0, 6),
      );
    },
    [syncFromSim],
  );

  const reset = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.reset();
    syncFromSim();
    setFlash('none');
    setLog([`초기화: len=${sim.len()} cap=${sim.cap()}`]);
  }, [syncFromSim]);

  const report = useMemo(() => {
    if (state !== 'ready') return '';
    return `len=${len} cap=${cap} realloc=${reallocs}`;
  }, [state, len, cap, reallocs]);

  const cells = useMemo(() => {
    const total = Math.max(cap, len);
    return Array.from({ length: total }, (_, index) => {
      if (index < len) return 'used' as const;
      if (index < cap) return 'free' as const;
      return 'new' as const;
    });
  }, [cap, len]);

  if (state === 'error') {
    return (
      <div className="wasm-lab__inner" ref={rootRef} data-lab-state="error">
        <pre className="lab-output" data-tone="error">
          Rust Wasm 모듈을 불러오지 못했습니다.{'\n'}
          {error}
        </pre>
        <p className="text-[0.8125rem] text-fg-muted">
          아래 코드 블록의 결과와 동일합니다: <code>len=4 cap=8</code> 에서 append를 반복하면
          cap이 8→16→32로 두 배씩 늘어납니다.
        </p>
      </div>
    );
  }

  if (state !== 'ready') {
    return (
      <div className="lab-skeleton" ref={rootRef} data-lab-state="loading" aria-busy="true">
        <div className="lab-skeleton__bar" />
        <div className="lab-skeleton__row" />
        <div className="lab-skeleton__row lab-skeleton__row--short" />
        <div className="lab-skeleton__bar" />
        <p className="lab-skeleton__note">
          Rust 모듈(<code>slice_capacity.wasm</code>)을 내려받아 인스턴스화하는 중입니다. 화면 크기는
          결과와 동일하게 예약되어 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="wasm-lab__inner" ref={rootRef} data-lab-state="ready" data-lab-probe={report} data-lab-selftest={selfTest}>
      <div className="lab-controls">
        <button type="button" className="lab-btn lab-btn--primary" onClick={() => append(1)}>
          append 1개
        </button>
        <button type="button" className="lab-btn" onClick={() => append(3)}>
          append 3개
        </button>
        <button type="button" className="lab-btn" onClick={reset}>
          초기화
        </button>
        <span className="lab-field">
          <span>모듈</span>
          <span className="font-mono text-[0.75rem] text-fg">
            {moduleBytes > 0 ? formatBytes(moduleBytes) : '—'}
          </span>
        </span>
      </div>

      <div className="lab-metrics">
        <span className="lab-metric">
          <span className="lab-metric__key">len</span>
          <span className="lab-metric__value">{len}</span>
        </span>
        <span className="lab-metric">
          <span className="lab-metric__key">cap</span>
          <span className="lab-metric__value">{cap}</span>
        </span>
        <span className="lab-metric">
          <span className="lab-metric__key">재할당</span>
          <span className="lab-metric__value lab-metric__value--accent">{reallocs}</span>
        </span>
        <span className="lab-metric">
          <span className="lab-metric__key">직전 append</span>
          <span
            className="lab-metric__value"
            style={{ color: flash === 'realloc' ? 'var(--color-danger)' : 'var(--color-petrol)' }}
          >
            {flash === 'realloc' ? '재할당됨' : '같은 배열'}
          </span>
        </span>
      </div>

      <div className="lab-track" aria-hidden="true">
        {cells.map((kind, index) => (
          <span key={index} className="lab-cell" data-kind={kind} />
        ))}
      </div>

      <pre className="lab-output" aria-live="polite">
        {log.join('\n')}
      </pre>

      {selfTest && (
        <p className="text-[0.6875rem] leading-relaxed text-fg-caption" data-lab-selftest-line>
          {selfTest}
        </p>
      )}
    </div>
  );
}
