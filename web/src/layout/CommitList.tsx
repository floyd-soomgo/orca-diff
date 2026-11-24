import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Commit } from '../../../server/shared/types.ts';
import { getCommits } from '../api.ts';
import { copyText, useContextMenu } from '../contextMenu.tsx';
import { useFeedback } from '../feedback/storage.ts';
import { useStore } from '../store.ts';

const PAGE = 200;
const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60],
];

export function relativeTime(epochSec: number): string {
  const diff = epochSec - Date.now() / 1000;
  for (const [unit, sec] of UNITS) {
    if (Math.abs(diff) >= sec) return rtf.format(Math.round(diff / sec), unit);
  }
  return '방금 전';
}

function openCommitMenu(c: Commit, e: React.MouseEvent) {
  e.preventDefault();
  useContextMenu.getState().open(e.clientX, e.clientY, [
    { label: '커밋에 코멘트', onSelect: () => useFeedback.getState().openDialog({ kind: 'commit', sha: c.sha, subject: c.subject }) },
    'separator',
    { label: '해시 복사', onSelect: () => copyText(c.sha, '해시') },
    { label: '메시지 복사', onSelect: () => copyText(c.body ? `${c.subject}\n\n${c.body}` : c.subject, '메시지') },
  ]);
}

export function CommitList() {
  const { branch, base, baseOnly, filter, selection, select, refreshTick, toast } = useStore();
  const [commits, setCommits] = useState<Commit[]>([]);
  const [done, setDone] = useState(false);
  const loading = useRef(false);
  const requestId = useRef(0);
  const anchor = useRef<number | null>(null);
  const effectiveBase = baseOnly && base && branch !== base ? base : null;

  const load = useCallback(
    async (skip: number) => {
      if (!branch) return;
      // 다음 페이지 로드는 중복 요청만 막고, 첫 페이지(브랜치·기준 변경)는 항상 새로 요청한다
      if (skip > 0 && loading.current) return;
      const id = ++requestId.current;
      loading.current = true;
      try {
        const page = await getCommits({ ref: branch, base: effectiveBase, skip, limit: PAGE });
        if (id !== requestId.current) return; // 더 새 요청이 있으면 이 응답은 버린다
        setCommits((prev) => (skip === 0 ? page : [...prev, ...page]));
        setDone(page.length < PAGE);
      } catch (e) {
        if (id === requestId.current) toast(`커밋 목록 실패: ${(e as Error).message}`, 'error');
      } finally {
        if (id === requestId.current) loading.current = false;
      }
    },
    [branch, effectiveBase, toast],
  );

  useEffect(() => {
    load(0);
  }, [load, refreshTick]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return commits;
    return commits.filter((c) => `${c.subject}\n${c.body}\n${c.author}\n${c.email}`.toLowerCase().includes(q));
  }, [commits, filter]);

  const selectedShas = selection.mode === 'commits' ? selection.shas : [];

  const onClick = (idx: number, e: React.MouseEvent) => {
    if (e.shiftKey && anchor.current !== null) {
      const [a, b] = [Math.min(anchor.current, idx), Math.max(anchor.current, idx)];
      select({ mode: 'commits', shas: visible.slice(a, b + 1).map((c) => c.sha) });
    } else {
      anchor.current = idx;
      select({ mode: 'commits', shas: [visible[idx].sha] });
    }
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!done && el.scrollTop + el.clientHeight > el.scrollHeight - 200) load(commits.length);
  };

  const detail = selectedShas.length === 1 ? commits.find((c) => c.sha === selectedShas[0]) : undefined;

  return (
    <div className="commit-list">
      <div className="panel-title">Commits</div>
      <div className="list" onScroll={onScroll}>
        <div
          className={`row ${selection.mode === 'worktree' ? 'selected' : ''}`}
          onClick={() => {
            anchor.current = null;
            select({ mode: 'worktree' });
          }}
        >
          <span className="dot worktree">●</span>
          <span className="subject">Working tree</span>
        </div>
        {visible.map((c, idx) => (
          <div
            key={c.sha}
            className={`row ${selectedShas.includes(c.sha) ? 'selected' : ''}`}
            onClick={(e) => onClick(idx, e)}
            onContextMenu={(e) => openCommitMenu(c, e)}
          >
            <span className="dot">●</span>
            <span className="subject">{c.subject}</span>
            <span className="meta" title={new Date(c.time * 1000).toLocaleString('ko-KR')}>
              {c.author} · {relativeTime(c.time)}
            </span>
          </div>
        ))}
        {visible.length === 0 && <div className="empty">{commits.length === 0 ? '커밋이 없습니다' : '검색 결과가 없습니다'}</div>}
      </div>
      {detail && (
        <details className="commit-detail" open key={detail.sha}>
          <summary>{detail.sha.slice(0, 10)} · {detail.author} &lt;{detail.email}&gt;</summary>
          <pre>{detail.subject}{detail.body ? `\n\n${detail.body}` : ''}</pre>
          <div className="commit-detail-footer">
            <span className="meta">{new Date(detail.time * 1000).toLocaleString('ko-KR')}</span>
            <button onClick={() => useFeedback.getState().openDialog({ kind: 'commit', sha: detail.sha, subject: detail.subject })}>
              💬 커밋에 코멘트
            </button>
          </div>
        </details>
      )}
    </div>
  );
}
