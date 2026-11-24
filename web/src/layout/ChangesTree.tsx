import { useEffect, useMemo, useRef, useState } from 'react';
import type { Change, Source } from '../../../server/shared/types.ts';
import { getChanges } from '../api.ts';
import { copyText, useContextMenu } from '../contextMenu.tsx';
import { useFeedback } from '../feedback/storage.ts';
import { commitsSource, useStore } from '../store.ts';

const POLL_MS = 3000;

interface Group { title: string; source: Source; changes: Change[] }

function groupByDir(changes: Change[]): [string, Change[]][] {
  const map = new Map<string, Change[]>();
  for (const c of changes) {
    const dir = c.path.includes('/') ? c.path.slice(0, c.path.lastIndexOf('/')) : '';
    map.set(dir, [...(map.get(dir) ?? []), c]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function ChangesTree() {
  const { selection, openDiff, openFile, refreshTick, toast } = useStore();

  const openFileMenu = (source: Source, c: Change, e: React.MouseEvent) => {
    e.preventDefault();
    useContextMenu.getState().open(e.clientX, e.clientY, [
      { label: 'diff 열기', onSelect: () => openDiff(source, c) },
      { label: '현재 워크트리 파일 열기', disabled: source.kind === 'unstaged' && c.status === 'D', onSelect: () => openFile(c.path) },
      'separator',
      { label: '파일에 코멘트', onSelect: () => useFeedback.getState().openDialog({ kind: 'file', source, path: c.path }) },
      'separator',
      { label: '경로 복사', onSelect: () => copyText(c.path, '경로') },
    ]);
  };
  const [groups, setGroups] = useState<Group[]>([]);
  const lastJson = useRef('');

  const sources = useMemo<{ title: string; source: Source }[]>(() => {
    if (selection.mode === 'worktree') {
      return [
        { title: 'Unstaged', source: { kind: 'unstaged' } },
        { title: 'Staged', source: { kind: 'staged' } },
      ];
    }
    return [{ title: selection.shas.length > 1 ? `커밋 ${selection.shas.length}개` : 'Changes', source: commitsSource(selection.shas) }];
  }, [selection]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await Promise.all(sources.map(async (s) => ({ ...s, changes: await getChanges(s.source) })));
        const json = JSON.stringify(result);
        // 결과가 같으면 상태를 바꾸지 않는다(폴링 중 불필요한 렌더 방지)
        if (!cancelled && json !== lastJson.current) {
          lastJson.current = json;
          setGroups(result);
        }
      } catch (e) {
        if (!cancelled) toast(`변경 목록 실패: ${(e as Error).message}`, 'error');
      }
    };
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const timer = selection.mode === 'worktree' ? setInterval(load, POLL_MS) : null;
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      if (timer) clearInterval(timer);
    };
  }, [sources, selection.mode, refreshTick, toast]);

  return (
    <div className="changes-tree">
      <div className="panel-title">Changes</div>
      <div className="list">
        {groups.map((g) => (
          <details key={g.title} open>
            <summary className="group">
              {g.title} <span className="count">{g.changes.length}</span>
            </summary>
            {groupByDir(g.changes).map(([dir, changes]) => (
              <div key={dir}>
                {dir && <div className="dir">📁 {dir}</div>}
                {changes.map((c) => (
                  <div
                    key={c.path}
                    className={`row file s-${c.status} ${dir ? 'indented' : ''}`}
                    onClick={() => openDiff(g.source, c)}
                    onContextMenu={(e) => openFileMenu(g.source, c, e)}
                    title={c.oldPath ? `${c.oldPath} → ${c.path}` : c.path}
                  >
                    <span className="status">{c.status}</span>
                    <span className="name">{c.path.slice(dir ? dir.length + 1 : 0)}</span>
                  </div>
                ))}
              </div>
            ))}
            {g.changes.length === 0 && <div className="empty">변경 없음</div>}
          </details>
        ))}
      </div>
    </div>
  );
}
