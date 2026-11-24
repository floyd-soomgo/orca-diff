import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useNavLoading, withLoading } from '../web/src/nav/loading.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('withLoading', () => {
  test('0.3초 안에 끝나면 로딩 표시를 띄우지 않는다', async () => {
    const p = withLoading('선언 찾는 중', () => new Promise((r) => setTimeout(() => r('ok'), 100)));
    await vi.advanceTimersByTimeAsync(100);
    expect(await p).toBe('ok');
    await vi.advanceTimersByTimeAsync(1000);
    expect(useNavLoading.getState().label).toBeNull();
  });

  test('오래 걸리면 표시하고, 끝나거나 실패하면 지운다', async () => {
    const p = withLoading('사용처 찾는 중', () => new Promise((_, reject) => setTimeout(() => reject(new Error('x')), 2000)));
    await vi.advanceTimersByTimeAsync(400);
    expect(useNavLoading.getState().label).toBe('사용처 찾는 중');
    const settled = p.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await settled).toBe('x');
    expect(useNavLoading.getState().label).toBeNull();
  });
});
