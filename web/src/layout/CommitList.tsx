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

const fullMessage = (c: Commit) => (c.body ? `${c.subject}\n\n${c.body}` : c.subject);

function openCommitDialog(c: Commit) {
  useFeedback.getState().openDialog({ kind: 'commit', sha: c.sha, subject: c.subject }, undefined, '', fullMessage(c));
}

function openCommitMenu(c: Commit, e: React.MouseEvent) {
  e.preventDefault();
  useContextMenu.getState().open(e.clientX, e.clientY, [
    { label: '커밋에 코멘트', onSelect: () => openCommitDialog(c) },
    'separator',
    { label: '해시 복사', onSelect: () => copyText(c.sha, '해시') },
    { label: '메시지 복사', onSelect: () => copyText(fullMessage(c), '메시지') },
  ]);
}

export function CommitList() {
  const { branch, base, baseOnly, setBaseOnly, filter, setFilter, selection, select, refresh, refreshTick, toast } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  // 상세를 × 로 닫은 커밋(다시 고르면 다시 보인다)
  const [closedSha, setClosedSha] = useState<string | null>(null);
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
    setClosedSha(null);
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
      {searchOpen ? (
        <div className="panel-title panel-search">
          <input
            autoFocus
            placeholder="커밋 메시지/작성자 필터"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setFilter('');
                setSearchOpen(false);
              }
            }}
          />
          <button
            className="icon-button small"
            title="필터 닫기 (Esc)"
            aria-label="필터 닫기"
            onClick={() => {
              setFilter('');
              setSearchOpen(false);
            }}
          >
            ×
          </button>
        </div>
      ) : (
        <div className="panel-title panel-title-row">
          <span>Commits</span>
          <span className="panel-actions">
          <button
            className="icon-button small"
            title="커밋과 변경사항 새로고침"
            aria-label="커밋과 변경사항 새로고침"
            onClick={refresh}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"
              />
            </svg>
          </button>
          <button
            className={`chip ${baseOnly && base && branch !== base ? 'active' : ''}`}
            aria-label="이 브랜치만"
            aria-pressed={Boolean(baseOnly && base && branch !== base)}
            disabled={!base || branch === base}
            title={
              base
                ? `켜면 ${base}에는 없고 선택한 브랜치에만 있는 커밋만 보여줍니다(git log ${base}..브랜치).\n에이전트가 이 브랜치에서 새로 만든 커밋만 리뷰할 때 씁니다.\n끄면 브랜치 전체 히스토리를 보여줍니다.`
                : '기준 브랜치(origin/HEAD, main, master)를 찾지 못해 쓸 수 없습니다'
            }
            onClick={() => setBaseOnly(!baseOnly)}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="4" cy="3" r="1.6" />
              <circle cx="4" cy="13" r="1.6" />
              <circle cx="12" cy="4" r="1.6" />
              <path d="M4 4.6v6.8m0-.4c0-4 8-1 8-5.4" />
            </svg>
          </button>
          <button
            className={`icon-button small ${filter ? 'active' : ''}`}
            title="커밋 메시지/작성자 필터"
            aria-label="커밋 메시지/작성자 필터"
            onClick={() => setSearchOpen(true)}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"
              />
            </svg>
          </button>
          </span>
        </div>
      )}
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
      {detail && detail.sha !== closedSha && (
        <div className="commit-detail" key={detail.sha}>
          <div className="commit-detail-header">
            <span className="commit-detail-who">
              {detail.sha.slice(0, 10)} · {detail.author} &lt;{detail.email}&gt;
            </span>
            <button className="icon-button small" title="커밋 상세 닫기" aria-label="커밋 상세 닫기" onClick={() => setClosedSha(detail.sha)}>
              ×
            </button>
          </div>
          <pre>{detail.subject}{detail.body ? `\n\n${detail.body}` : ''}</pre>
          <div className="commit-detail-footer">
            <span className="meta">{new Date(detail.time * 1000).toLocaleString('ko-KR')}</span>
            <button onClick={() => openCommitDialog(detail)}>
              💬 커밋에 코멘트
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
