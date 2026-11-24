import type { ReactNode } from 'react';
import { useContextMenu } from '../contextMenu.tsx';
import { type Tab, useStore } from '../store.ts';

const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1);

export function tabTitle(tab: Tab): string {
  return tab.kind === 'diff' ? baseName(tab.change.path) : baseName(tab.path);
}

interface Props {
  renderTab: (tab: Tab) => ReactNode;
  tabActions?: (tab: Tab) => ReactNode;
}

// 탭은 모두 마운트해 두고 비활성 탭은 숨긴다(스크롤 위치·에디터 상태 유지)
export function EditorTabs({ renderTab, tabActions }: Props) {
  const { tabs, activeTabId, setActiveTab, closeTab, closeOthers, closeAll } = useStore();

  const openTabMenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    useContextMenu.getState().open(e.clientX, e.clientY, [
      { label: '이 탭 닫기', onSelect: () => closeTab(id) },
      { label: '다른 탭 모두 닫기', disabled: tabs.length < 2, onSelect: () => closeOthers(id) },
      { label: '모든 탭 닫기', onSelect: closeAll },
    ]);
  };

  if (tabs.length === 0) {
    return <div className="editor-empty">왼쪽에서 커밋과 파일을 선택하세요</div>;
  }
  return (
    <div className="editor-tabs">
      <div className="tab-bar">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`tab ${t.id === activeTabId ? 'active' : ''}`}
            title={t.kind === 'diff' ? t.change.path : t.path}
            onClick={() => setActiveTab(t.id)}
            onAuxClick={(e) => e.button === 1 && closeTab(t.id)}
            onContextMenu={(e) => openTabMenu(t.id, e)}
          >
            {t.kind === 'diff' ? '◐ ' : ''}
            {tabTitle(t)}
            {tabActions?.(t)}
            <button
              className="close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(t.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="tab-content">
        {tabs.map((t) => (
          <div key={t.id} className="tab-pane" style={{ display: t.id === activeTabId ? 'flex' : 'none' }}>
            {renderTab(t)}
          </div>
        ))}
      </div>
    </div>
  );
}
