import { useEffect, useRef, useState } from 'react';
import type { Change, Source } from '../../../server/shared/types.ts';
import { getPatch } from '../api.ts';
import { monaco, READONLY_OPTIONS } from '../monaco/setup.ts';
import { editorFontOptions, useFontSettings } from '../settings/fontSettings.ts';
import { useStore } from '../store.ts';

// 줄 앞 글자로 패치 줄 종류를 나눠 색을 입힌다
function lineClass(line: string): string | null {
  if (line.startsWith('@@')) return 'patch-hunk-line';
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')) return 'patch-meta-line';
  if (line.startsWith('+')) return 'full-insert-line';
  if (line.startsWith('-')) return 'full-delete-line';
  return null;
}

// 1 MiB를 넘는 파일: 전체 diff 대신 변경된 부분만 담은 패치를 읽기 전용으로 보여준다
export function PatchView({ source, change }: { source: Source; change: Change }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ patch: string; truncated: boolean } | null>(null);
  const refreshTick = useStore((s) => s.refreshTick);
  const toast = useStore((s) => s.toast);
  const font = useFontSettings();

  useEffect(() => {
    let cancelled = false;
    getPatch(source, change)
      .then((r) => !cancelled && setState(r))
      .catch((e: Error) => !cancelled && toast(`패치 로드 실패: ${e.message}`, 'error'));
    return () => {
      cancelled = true;
    };
  }, [source, change, refreshTick, toast]);

  useEffect(() => {
    if (!host.current || !state?.patch) return;
    const editor = monaco.editor.create(host.current, {
      ...READONLY_OPTIONS,
      ...editorFontOptions(useFontSettings.getState()),
      glyphMargin: false,
      model: monaco.editor.createModel(state.patch, 'plaintext'),
    });
    const lines = state.patch.split('\n');
    editor.createDecorationsCollection(
      lines.flatMap((line, i) => {
        const className = lineClass(line);
        return className ? [{ range: new monaco.Range(i + 1, 1, i + 1, 1), options: { isWholeLine: true, className } }] : [];
      }),
    );
    return () => {
      const model = editor.getModel();
      editor.dispose();
      model?.dispose();
    };
  }, [state, font.family, font.size]);

  if (!state) return <div className="editor-empty">불러오는 중…</div>;
  if (!state.patch) {
    return <div className="editor-empty">파일이 커서(1 MiB 초과) 전체 diff 대신 변경 부분만 보여주는데, 표시할 패치가 없습니다(새로 추가된 파일 등).</div>;
  }
  return (
    <>
      <div className="patch-notice">
        파일이 커서(1 MiB 초과) 변경된 부분만 패치로 보여줍니다. 이 보기에서는 라인 코멘트와 코드 탐색을 쓸 수 없습니다.
        {state.truncated && ' 패치가 2 MiB를 넘어 뒷부분이 잘렸습니다.'}
      </div>
      <div ref={host} className="monaco-host" />
    </>
  );
}
