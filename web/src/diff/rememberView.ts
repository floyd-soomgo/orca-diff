import { WT } from '../api.ts';

// 모델에 내용을 채운 다음 복원해야 Monaco가 줄 위치를 파일 범위로 잘라내지 않는다.
export function rememberView<T>(id: string, editor: { saveViewState(): T | null; restoreViewState(state: T): void }) {
  const key = JSON.stringify(['review-view.v1', WT, id]);
  try {
    const raw = localStorage.getItem(key);
    if (raw) editor.restoreViewState(JSON.parse(raw));
  } catch { /* 이전 모델의 위치를 복원하지 못하면 기본 위치를 쓴다. */ }
  const save = () => {
    const state = editor.saveViewState();
    try { if (state) localStorage.setItem(key, JSON.stringify(state)); } catch { /* 저장 공간 부족 */ }
  };
  window.addEventListener('pagehide', save);
  return () => window.removeEventListener('pagehide', save);
}
