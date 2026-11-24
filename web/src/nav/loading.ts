import { create } from 'zustand';

// 짧게 끝나는 요청은 깜빡이지 않도록 이 시간 뒤에만 표시한다
const SHOW_AFTER_MS = 300;

export const useNavLoading = create<{ label: string | null; startedAt: number }>(() => ({ label: null, startedAt: 0 }));

let seq = 0;

// 탐색 요청이 오래 걸리면 로딩 표시를 띄운다. 가장 최근 요청의 표시만 남긴다.
export async function withLoading<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const id = ++seq;
  const timer = setTimeout(() => {
    if (id === seq) useNavLoading.setState({ label, startedAt: Date.now() });
  }, SHOW_AFTER_MS);
  try {
    return await fn();
  } finally {
    clearTimeout(timer);
    if (id === seq) useNavLoading.setState({ label: null });
  }
}
