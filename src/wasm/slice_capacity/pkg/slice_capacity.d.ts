/* tslint:disable */
/* eslint-disable */

export class SliceSim {
    free(): void;
    [Symbol.dispose](): void;
    cap(): number;
    len(): number;
    /**
     * len 과 cap 을 따로 지정해 시작한다 (Go 의 make([]int, len, cap) 과 같은 상황).
     */
    constructor(len: number, cap: number);
    /**
     * append 한 칸. 재할당이 일어났으면 true 를 돌려준다.
     */
    push(value: number): boolean;
    reallocs(): number;
    /**
     * 현재 상태를 사람이 읽는 문자열로 (로컬 실험과 브라우저 결과를 비교하기 쉽게)
     */
    report(): string;
    /**
     * 초기 상태(len, cap)로 되돌린다.
     */
    reset(): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_slicesim_free: (a: number, b: number) => void;
    readonly slicesim_cap: (a: number) => number;
    readonly slicesim_len: (a: number) => number;
    readonly slicesim_new: (a: number, b: number) => number;
    readonly slicesim_push: (a: number, b: number) => number;
    readonly slicesim_reallocs: (a: number) => number;
    readonly slicesim_report: (a: number, b: number) => void;
    readonly slicesim_reset: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
