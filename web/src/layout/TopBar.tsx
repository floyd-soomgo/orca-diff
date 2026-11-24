import { useEffect, useState } from 'react';
import { type Branches, getBranches, getWorktrees, KEY, WT } from '../api.ts';
import { FontSettingsButton } from '../settings/FontSettingsButton.tsx';
import { useStore } from '../store.ts';

export function TopBar() {
  const { branch, base, baseOnly, filter, setBranch, setBaseOnly, setFilter, refresh, toast } = useStore();
  const [worktrees, setWorktrees] = useState<{ path: string; branch: string | null }[]>([]);
  const [branches, setBranches] = useState<Branches | null>(null);

  useEffect(() => {
    getWorktrees().then(setWorktrees).catch((e: Error) => toast(`워크트리 목록 실패: ${e.message}`, 'error'));
    getBranches()
      .then((b) => {
        setBranches(b);
        setBranch(b.current ?? 'HEAD', b.base);
      })
      .catch((e: Error) => toast(`브랜치 목록 실패: ${e.message}`, 'error'));
  }, [setBranch, toast]);

  const switchWorktree = (path: string) => {
    location.search = `?${new URLSearchParams({ key: KEY, wt: path })}`;
  };
  const baseDisabled = !base || branch === base;

  return (
    <div className="topbar">
      <label>
        워크트리
        <select value={WT} onChange={(e) => switchWorktree(e.target.value)}>
          {worktrees.length === 0 && <option value={WT}>{WT}</option>}
          {worktrees.map((w) => (
            <option key={w.path} value={w.path}>
              {w.branch ?? '(detached)'} — {w.path}
            </option>
          ))}
        </select>
      </label>
      <label>
        브랜치
        <select value={branch ?? ''} onChange={(e) => setBranch(e.target.value, base)}>
          {branches?.current === null && <option value="HEAD">HEAD (detached)</option>}
          <optgroup label="Local">
            {branches?.local.map((b) => <option key={b} value={b}>{b}</option>)}
          </optgroup>
          <optgroup label="Remote">
            {branches?.remote.map((b) => <option key={b} value={b}>{b}</option>)}
          </optgroup>
        </select>
      </label>
      <label title={base ? `${base} 이후 커밋만 보여줍니다` : '기준 브랜치를 찾지 못했습니다'}>
        <input type="checkbox" checked={baseOnly && !baseDisabled} disabled={baseDisabled} onChange={(e) => setBaseOnly(e.target.checked)} />
        기준 브랜치({base ?? '없음'}) 이후만
      </label>
      <input className="search" placeholder="메시지/작성자 검색" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <button className="icon-button" onClick={refresh} title="새로고침" aria-label="새로고침">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"
          />
        </svg>
      </button>
      <FontSettingsButton />
    </div>
  );
}
