import { type DiffAttachContext, DiffTab } from './diff/DiffTab.tsx';
import { FileTab } from './diff/FileTab.tsx';
import { BottomPanel } from './layout/BottomPanel.tsx';
import { ChangesTree } from './layout/ChangesTree.tsx';
import { CommitList } from './layout/CommitList.tsx';
import { EditorTabs } from './layout/EditorTabs.tsx';
import { Splitter, usePanelSize } from './layout/Splitter.tsx';
import { TopBar } from './layout/TopBar.tsx';
import { FindUsagesPanel } from './nav/FindUsagesPanel.tsx';
import { UsagesPopup } from './nav/UsagesPopup.tsx';
import { attachNavigation, useGlobalNavKeys } from './nav/useNavigation.ts';
import { monaco } from './monaco/setup.ts';
import { type Tab, useStore } from './store.ts';

// diff에서는 수정본(오른쪽)에서만 탐색한다. 워킹트리 unstaged가 아니면 diff에 보이는 내용 기준으로 질의한다.
function attachDiff(ctx: DiffAttachContext): monaco.IDisposable | void {
  if (ctx.change.status === 'D') return;
  const override = ctx.source.kind === 'unstaged' ? undefined : ctx.pair.modified;
  return attachNavigation(ctx.editors.modified, { path: ctx.change.path, contentOverride: () => override });
}

function attachFile(editor: monaco.editor.ICodeEditor, path: string) {
  return attachNavigation(editor, { path, contentOverride: () => undefined });
}

function renderTab(tab: Tab) {
  return tab.kind === 'diff' ? (
    <DiffTab source={tab.source} change={tab.change} attach={attachDiff} />
  ) : (
    <FileTab path={tab.path} reveal={tab.reveal} attach={attachFile} />
  );
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
  useGlobalNavKeys();

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
            <BottomPanel usages={<FindUsagesPanel />} feedback={<div className="empty">피드백 없음</div>} feedbackCount={0} />
          </div>
        </div>
      </div>
      <UsagesPopup />
      <Toasts />
    </div>
  );
}
