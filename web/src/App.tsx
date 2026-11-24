import { BottomPanel } from './layout/BottomPanel.tsx';
import { ChangesTree } from './layout/ChangesTree.tsx';
import { CommitList } from './layout/CommitList.tsx';
import { EditorTabs } from './layout/EditorTabs.tsx';
import { Splitter, usePanelSize } from './layout/Splitter.tsx';
import { TopBar } from './layout/TopBar.tsx';
import { type Tab, useStore } from './store.ts';

function renderTab(tab: Tab) {
  return <div className="editor-empty">{tab.kind === 'diff' ? tab.change.path : tab.path}</div>;
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>{t.message}</div>
      ))}
    </div>
  );
}

export function App() {
  const [leftWidth, setLeftWidth] = usePanelSize('left', 360);
  const [commitsHeight, setCommitsHeight] = usePanelSize('commits', 320);
  const [bottomHeight, setBottomHeight] = usePanelSize('bottom', 220);
  const bottomOpen = useStore((s) => s.bottomPanel !== null);

  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <div className="left" style={{ width: leftWidth }}>
          <div style={{ height: commitsHeight, display: 'flex' }}>
            <CommitList />
          </div>
          <Splitter direction="horizontal" size={commitsHeight} onResize={setCommitsHeight} />
          <ChangesTree />
        </div>
        <Splitter direction="vertical" size={leftWidth} onResize={setLeftWidth} min={200} />
        <div className="center">
          <EditorTabs renderTab={renderTab} />
          {bottomOpen && <Splitter direction="horizontal" size={bottomHeight} onResize={setBottomHeight} invert />}
          <div style={{ height: bottomOpen ? bottomHeight : 'auto', display: 'flex' }}>
            <BottomPanel usages={<div className="empty">Alt+F7로 사용처를 찾으세요</div>} feedback={<div className="empty">피드백 없음</div>} feedbackCount={0} />
          </div>
        </div>
      </div>
      <Toasts />
    </div>
  );
}
