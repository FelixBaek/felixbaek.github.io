/**
 * Wasm Lab 공통 유틸
 * 상태 머신(idle → loading → ready → error)과 상태 표시 갱신을 한 곳에서 처리한다.
 */

export type LabState = 'idle' | 'loading' | 'ready' | 'error';

export const LAB_STATE_TEXT: Record<LabState, string> = {
  idle: '대기',
  loading: '모듈 로드중',
  ready: '실행중',
  error: '실패',
};

/** 무대(stage) 안에서 상태를 갱신한다. 아일랜드 트리 밖의 프레임 상태 바까지 함께 갱신. */
export function setLabState(root: HTMLElement | null, state: LabState, detail?: string): void {
  if (!root) return;
  const frame = root.closest('[data-wasm-lab]');
  const status = frame?.querySelector<HTMLElement>('[data-lab-status]');
  if (status) {
    status.dataset.state = state;
    status.textContent = detail ?? LAB_STATE_TEXT[state];
  }
  root.dataset.labState = state;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
