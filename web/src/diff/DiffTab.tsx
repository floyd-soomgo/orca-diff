import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import type { Change, FilePair, Source } from '../../../server/shared/types.ts';
import { getFilePair } from '../api.ts';
import { getPref, setPref } from '../prefs.ts';
import { languageOf, monaco, READONLY_OPTIONS } from '../monaco/setup.ts';
import { editorFontOptions, useFontSettings } from '../settings/fontSettings.ts';
import { useStore } from '../store.ts';

const POLL_MS = 3000;
const PREFS_KEY = 'orca-review:diff-prefs';

interface DiffPrefs { sideBySide: boolean; hunksOnly: boolean }

function loadPrefs(): DiffPrefs {
  let legacy: Partial<DiffPrefs> = {};
  try {
    legacy = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
  } catch {
    // 예전 값이 없거나 깨졌으면 무시
  }
  return { sideBySide: true, hunksOnly: true, ...getPref<Partial<DiffPrefs>>('diff', legacy) };
}

// Split/Unified, Hunks/전체 토글은 모든 diff 탭이 공유하고 마지막 선택을 기억한다
const usePrefs = create<DiffPrefs & { set(p: Partial<DiffPrefs>): void }>((set, get) => ({
  ...loadPrefs(),
  set: (p) => {
    set(p);
    const { sideBySide, hunksOnly } = get();
    setPref('diff', { sideBySide, hunksOnly });
  },
}));

export interface DiffEditors {
  original: monaco.editor.ICodeEditor;
  modified: monaco.editor.ICodeEditor;
}

export interface DiffAttachContext {
  editors: DiffEditors;
  // 새 파일('new')/삭제 파일('old')은 한쪽만 보여주며 editors의 두 값이 같은 에디터다
  single?: 'old' | 'new';
  pair: FilePair;
  source: Source;
  change: Change;
}

interface Props {
  source: Source;
  change: Change;
  // 에디터가 준비되거나 내용이 바뀔 때마다 호출된다. 반환한 disposable은 다음 호출 전에 정리된다.
  attach?: (ctx: DiffAttachContext) => monaco.IDisposable | void;
}

export function DiffTab({ source, change, attach }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const singleRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  // 새 파일/삭제 파일은 한쪽이 비어 있어 diff로 그리면 '빈 줄 1개 → 전체' 변경으로 보인다. 한쪽만 그린다.
  const single = change.status === 'A' ? 'new' : change.status === 'D' ? 'old' : undefined;
  const [pair, setPair] = useState<FilePair | null>(null);
  const { sideBySide, hunksOnly, set } = usePrefs();
  const refreshTick = useStore((s) => s.refreshTick);
  const toast = useStore((s) => s.toast);
  const font = useFontSettings();

  // 내용 로드(워킹트리 기준이면 주기적으로 다시 읽는다)
  useEffect(() => {
    let cancelled = false;
    let last = '';
    const load = async () => {
      try {
        const next = await getFilePair(source, change);
        const json = JSON.stringify(next);
        if (!cancelled && json !== last) {
          last = json;
          setPair(next);
        }
      } catch (e) {
        if (!cancelled) toast(`diff 로드 실패: ${(e as Error).message}`, 'error');
      }
    };
    load();
    const timer = source.kind !== 'commits' ? setInterval(load, POLL_MS) : null;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [source, change, refreshTick, toast]);

  // 에디터 생성
  const showEditor = pair !== null && !pair.binary && !pair.tooLarge;
  useEffect(() => {
    if (!showEditor || !host.current || !single) return;
    const editor = monaco.editor.create(host.current, {
      ...READONLY_OPTIONS,
      ...editorFontOptions(useFontSettings.getState()),
      model: monaco.editor.createModel('', languageOf(change.path)),
    });
    singleRef.current = editor;
    return () => {
      const model = editor.getModel();
      editor.dispose();
      model?.dispose();
      singleRef.current = null;
    };
  }, [showEditor, single, change.path]);

  useEffect(() => {
    if (!showEditor || !host.current || single) return;
    const editor = monaco.editor.createDiffEditor(host.current, {
      ...READONLY_OPTIONS,
      ...editorFontOptions(useFontSettings.getState()),
      originalEditable: false,
      renderSideBySide: usePrefs.getState().sideBySide,
      useInlineViewWhenSpaceIsLimited: false,
      renderOverviewRuler: true,
      hideUnchangedRegions: { enabled: usePrefs.getState().hunksOnly, contextLineCount: 3, minimumLineCount: 3, revealLineCount: 20 },
    });
    const lang = languageOf(change.path);
    editor.setModel({
      original: monaco.editor.createModel('', lang),
      modified: monaco.editor.createModel('', lang),
    });
    editorRef.current = editor;
    return () => {
      const model = editor.getModel();
      editor.dispose();
      model?.original.dispose();
      model?.modified.dispose();
      editorRef.current = null;
    };
  }, [showEditor, single, change.path]);

  // 내용 반영 + 부착(탐색·코멘트)
  useEffect(() => {
    const ed = singleRef.current;
    if (!single || !ed || !pair) return;
    const content = single === 'new' ? pair.modified : pair.original;
    if (ed.getModel()?.getValue() !== content) ed.getModel()?.setValue(content);
    const lineCount = ed.getModel()?.getLineCount() ?? 1;
    const deco = ed.createDecorationsCollection([
      {
        range: new monaco.Range(1, 1, lineCount, 1),
        options: {
          isWholeLine: true,
          className: single === 'new' ? 'full-insert-line' : 'full-delete-line',
          marginClassName: single === 'new' ? 'full-insert-margin' : 'full-delete-margin',
        },
      },
    ]);
    const disposable = attach?.({ editors: { original: ed, modified: ed }, single, pair, source, change });
    return () => {
      deco.clear();
      disposable?.dispose();
    };
  }, [pair, attach, source, change, showEditor, single]);

  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || !pair) return;
    if (model.original.getValue() !== pair.original) model.original.setValue(pair.original);
    if (model.modified.getValue() !== pair.modified) model.modified.setValue(pair.modified);
    const disposable = attach?.({
      editors: { original: editor.getOriginalEditor(), modified: editor.getModifiedEditor() },
      pair,
      source,
      change,
    });
    return () => disposable?.dispose();
  }, [pair, attach, source, change, showEditor]);

  useEffect(() => {
    editorRef.current?.updateOptions(editorFontOptions(font));
    singleRef.current?.updateOptions(editorFontOptions(font));
    monaco.editor.remeasureFonts();
  }, [font.family, font.size, showEditor, single]);

  useEffect(() => {
    editorRef.current?.updateOptions({ renderSideBySide: sideBySide, hideUnchangedRegions: { enabled: hunksOnly } });
  }, [sideBySide, hunksOnly, showEditor]);

  return (
    <div className="diff-tab">
      <div className="diff-toolbar">
        <span className="path">
          {change.oldPath ? `${change.oldPath} → ` : ''}
          {change.path}
        </span>
        {single && <span className={`file-badge ${single}`}>{single === 'new' ? '새 파일' : '삭제된 파일'}</span>}
        {!single && (
        <>
        <div className="toggle">
          <button className={sideBySide ? 'active' : ''} onClick={() => set({ sideBySide: true })}>Split</button>
          <button className={!sideBySide ? 'active' : ''} onClick={() => set({ sideBySide: false })}>Unified</button>
        </div>
        <div className="toggle">
          <button className={hunksOnly ? 'active' : ''} onClick={() => set({ hunksOnly: true })}>변경 뭉치</button>
          <button className={!hunksOnly ? 'active' : ''} onClick={() => set({ hunksOnly: false })}>전체</button>
        </div>
        </>
        )}
      </div>
      {pair?.binary && <div className="editor-empty">바이너리 파일은 diff를 표시하지 않습니다</div>}
      {pair?.tooLarge && <div className="editor-empty">파일이 너무 커서(1 MiB 초과) diff를 표시하지 않습니다</div>}
      {!pair && <div className="editor-empty">불러오는 중…</div>}
      <div ref={host} className="monaco-host" style={{ display: showEditor ? 'block' : 'none' }} />
    </div>
  );
}
