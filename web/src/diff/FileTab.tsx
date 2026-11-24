import { MarkdownPage } from './MarkdownPage.tsx';
import { rememberView } from './rememberView.ts';
import { useEffect, useRef, useState } from 'react';
import type { Change } from "../../../server/shared/types.ts";
import { getChanges, getFile } from '../api.ts';
import { languageOf, monaco, READONLY_OPTIONS } from '../monaco/setup.ts';
import { editorFontOptions, useFontSettings } from '../settings/fontSettings.ts';
import { useStore } from '../store.ts';

const statusLabel = { A: '새 파일', M: '수정', D: '삭제', R: '이름 변경' } as const;

interface Props {
  path: string;
  reveal?: { line: number; column: number };
  attach?: (editor: monaco.editor.ICodeEditor, path: string) => monaco.IDisposable | void;
}

export function FileTab({ path, reveal, attach }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const refreshTick = useStore((s) => s.refreshTick);
  const toast = useStore((s) => s.toast);
  const font = useFontSettings();

  const active = useStore(s => s.activeTabId === 'file:' + path);
  const openDiff = useStore(s => s.openDiff);
  const [changes, setChanges] = useState<{ kind: 'staged' | 'unstaged'; change: Change }[]>([]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const load = async () => {
      const groups = await Promise.all((['staged', 'unstaged'] as const).map(async kind => {
        const change = (await getChanges({ kind })).find(c => c.path === path);
        return change ? [{ kind, change }] : [];
      }));
      if (!cancelled) setChanges(groups.flat());
    };
    const refresh = () => load().catch(e => { if (!cancelled) toast(e.message, 'error'); });
    refresh();
    window.addEventListener('focus', refresh);
    return () => { cancelled = true; window.removeEventListener('focus', refresh); };
  }, [active, path, refreshTick, toast]);

  useEffect(() => {
    let cancelled = false;
    getFile(path)
      .then((r) => !cancelled && setContent(r.content))
      .catch((e: Error) => !cancelled && toast(`파일 로드 실패: ${e.message}`, 'error'));
    return () => {
      cancelled = true;
    };
  }, [path, refreshTick, toast]);

  useEffect(() => {
    if (!host.current) return;
    const editor = monaco.editor.create(host.current, {
      ...READONLY_OPTIONS,
      ...editorFontOptions(useFontSettings.getState()),
      model: monaco.editor.createModel('', languageOf(path)),
    });
    editorRef.current = editor;
    const disposable = attach?.(editor, path);
    return () => {
      disposable?.dispose();
      const model = editor.getModel();
      editor.dispose();
      model?.dispose();
      editorRef.current = null;
    };
  }, [path, attach]);

  useEffect(() => {
    editorRef.current?.updateOptions(editorFontOptions(font));
    monaco.editor.remeasureFonts();
  }, [font.family, font.size]);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (model && content !== null && model.getValue() !== content) model.setValue(content);
  }, [content]);

  // 탐색으로 열렸으면 해당 위치로 이동하고 잠깐 강조한다
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !reveal || content === null) return;
    const { line, column } = reveal;
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column });
    editor.focus();
    const deco = editor.createDecorationsCollection([
      { range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, className: 'reveal-line' } },
    ]);
    const timer = setTimeout(() => deco.clear(), 1500);
    return () => {
      clearTimeout(timer);
      deco.clear();
    };
  }, [reveal, content]);

  const [renderMarkdown, setRenderMarkdown] = useState(false);
  const ready = content !== null;
  useEffect(() => {
    if (ready && editorRef.current) return rememberView('file:' + path, editorRef.current);
  }, [ready, path]);

  return (
    <div className="diff-tab">
      <div className="diff-toolbar">
        <span className="path">{path}</span>
        {changes.map(({ kind, change }) => {
          const staged = kind === 'staged';
          const tip = staged
            ? '다음 커밋에 포함할 변경입니다. 클릭하면 마지막 커밋과 스테이징한 내용을 비교합니다.'
            : change.status === 'A'
              ? '아직 git add 하지 않은 새 파일입니다. 클릭하면 추가된 내용을 봅니다.'
              : '아직 스테이징하지 않은 변경입니다. 클릭하면 스테이징 영역과 현재 파일을 비교합니다.';
          return (
            <button key={kind} data-tip={tip} aria-description={tip} onClick={() => openDiff({ kind }, change)}>
              {statusLabel[change.status]} · {staged ? '스테이징됨' : '스테이징 전'}
            </button>
          );
        })}
        {/\.(md|markdown)$/i.test(path) && <button onClick={() => setRenderMarkdown(!renderMarkdown)}>{renderMarkdown ? '원문 보기' : '렌더 보기'}</button>}
        <span className="readonly">읽기 전용</span>
      </div>
      {renderMarkdown && content !== null && <div className="markdown-pages"><MarkdownPage text={content} /></div>}
      <div ref={host} className="monaco-host" style={{ display: renderMarkdown ? 'none' : 'block' }} />
    </div>
  );
}
