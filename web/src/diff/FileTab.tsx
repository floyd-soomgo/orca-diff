import { useEffect, useRef, useState } from 'react';
import { getFile } from '../api.ts';
import { languageOf, monaco, READONLY_OPTIONS } from '../monaco/setup.ts';
import { useStore } from '../store.ts';

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

  return (
    <div className="diff-tab">
      <div className="diff-toolbar">
        <span className="path">{path}</span>
        <span className="readonly">읽기 전용</span>
      </div>
      <div ref={host} className="monaco-host" />
    </div>
  );
}
