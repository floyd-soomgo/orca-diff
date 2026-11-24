import { useEffect, useState } from 'react';
import { type Branches, getBranches, getWorktrees, KEY, WT } from '../api.ts';
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
      <button onClick={refresh} title="새로고침">⟳</button>
    </div>
  );
}
