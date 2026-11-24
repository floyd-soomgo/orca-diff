import { type DiffAttachContext, DiffTab } from './diff/DiffTab.tsx';
import { FileTab } from './diff/FileTab.tsx';
import { BottomPanel } from './layout/BottomPanel.tsx';
import { ChangesTree } from './layout/ChangesTree.tsx';
import { CommitList } from './layout/CommitList.tsx';
import { EditorTabs } from './layout/EditorTabs.tsx';
import { Splitter, usePanelSize } from './layout/Splitter.tsx';
import { TopBar } from './layout/TopBar.tsx';
import { useState } from 'react';
import type { Commit } from '../../server/shared/types.ts';
import { attachComments } from './feedback/commentZones.ts';
import { CommentDialog, FeedbackPanel } from './feedback/FeedbackPanel.tsx';
import { useFeedback } from './feedback/storage.ts';
import { FindUsagesPanel } from './nav/FindUsagesPanel.tsx';
import { UsagesPopup } from './nav/UsagesPopup.tsx';
import { attachNavigation, useGlobalNavKeys } from './nav/useNavigation.ts';
import { monaco } from './monaco/setup.ts';
import { type Tab, useStore } from './store.ts';

// diff에서는 수정본(오른쪽)에서만 탐색한다. 워킹트리 unstaged가 아니면 diff에 보이는 내용 기준으로 질의한다.
function attachDiff(ctx: DiffAttachContext): monaco.IDisposable {
  const comments = attachComments({
    source: ctx.source,
    change: ctx.change,
    editors: { old: ctx.editors.original, new: ctx.editors.modified },
    contents: { old: ctx.pair.original, new: ctx.pair.modified },
  });
  if (ctx.change.status === 'D') return comments;
  const override = ctx.source.kind === 'unstaged' ? undefined : ctx.pair.modified;
  const nav = attachNavigation(ctx.editors.modified, { path: ctx.change.path, contentOverride: () => override });
  return {
    dispose() {
      comments.dispose();
      nav.dispose();
    },
  };
}

function fileCommentButton(tab: Tab) {
  if (tab.kind !== 'diff') return null;
  return (
    <button
      className="close"
      title="파일 전체에 코멘트"
      onClick={(e) => {
        e.stopPropagation();
        useFeedback.getState().openDialog({ kind: 'file', source: tab.source, path: tab.change.path });
      }}
    >
      💬
    </button>
  );
}

// 커밋 우클릭 메뉴(앱 자체 메뉴)
function CommitMenu({ menu, onClose }: { menu: { x: number; y: number; commit: Commit } | null; onClose: () => void }) {
  if (!menu) return null;
  return (
    <div className="dialog-backdrop transparent" onMouseDown={onClose}>
      <div className="context-menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
        <div
          className="row"
          onClick={() => {
            useFeedback.getState().openDialog({ kind: 'commit', sha: menu.commit.sha, subject: menu.commit.subject });
            onClose();
          }}
        >
          커밋에 코멘트 달기
        </div>
      </div>
    </div>
  );
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
  const unsentCount = useFeedback((s) => s.comments.filter((c) => !c.sentAt).length);
  const [menu, setMenu] = useState<{ x: number; y: number; commit: Commit } | null>(null);

  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <div className="left" style={{ width: leftWidth }}>
          <div style={{ height: commitsHeight, display: 'flex' }}>
            <CommitList onCommitContextMenu={(commit, e) => setMenu({ x: e.clientX, y: e.clientY, commit })} />
          </div>
          <Splitter direction="horizontal" size={commitsHeight} onResize={setCommitsHeight} />
          <ChangesTree />
        </div>
        <Splitter direction="vertical" size={leftWidth} onResize={setLeftWidth} min={200} />
        <div className="center">
          <EditorTabs renderTab={renderTab} tabActions={fileCommentButton} />
          {bottomOpen && <Splitter direction="horizontal" size={bottomHeight} onResize={setBottomHeight} invert />}
          <div style={{ height: bottomOpen ? bottomHeight : 'auto', display: 'flex' }}>
            <BottomPanel usages={<FindUsagesPanel />} feedback={<FeedbackPanel />} feedbackCount={unsentCount} />
          </div>
        </div>
      </div>
      <UsagesPopup />
      <CommentDialog />
      <CommitMenu menu={menu} onClose={() => setMenu(null)} />
      <Toasts />
    </div>
  );
}
