import { beforeEach, describe, expect, test } from 'vitest';
import { useStore } from '../web/src/store.ts';

const open = () => ['a.ts', 'b.ts', 'c.ts'].forEach((p) => useStore.getState().openFile(p));
const ids = () => useStore.getState().tabs.map((t) => t.id);

beforeEach(() => useStore.setState({ tabs: [], activeTabId: null }));

describe('탭 닫기', () => {
  test('다른 탭 모두 닫기는 그 탭만 남기고 활성화한다', () => {
    open();
    useStore.getState().closeOthers('file:b.ts');
    expect(ids()).toEqual(['file:b.ts']);
    expect(useStore.getState().activeTabId).toBe('file:b.ts');
  });

  test('모든 탭 닫기', () => {
    open();
    useStore.getState().closeAll();
    expect(ids()).toEqual([]);
    expect(useStore.getState().activeTabId).toBeNull();
  });
});
