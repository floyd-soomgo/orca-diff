import { SearchEverywhere } from './SearchEverywhere.tsx';
import { useEffect, useState } from 'react';
import { type Branches, getBranches, getWorktrees, HOST, KEY, WT } from '../api.ts';
import { FontSettingsButton } from '../settings/FontSettingsButton.tsx';
import { useStore } from '../store.ts';

export function TopBar() {
  const { branch, base, setBranch, toast } = useStore();
  const [worktrees, setWorktrees] = useState<{ path: string; branch: string | null }[]>([]);
  const [branches, setBranches] = useState<Branches | null>(null);

  useEffect(() => {
    getWorktrees().then(setWorktrees).catch((e: Error) => toast(`워크트리 목록 실패: ${e.message}`, 'error'));
    getBranches()
      .then((b) => {
        setBranches(b);
        const saved = useStore.getState().branch;
        if (saved && (saved === (b.current ?? 'HEAD') || b.local.includes(saved) || b.remote.includes(saved))) {
          useStore.setState({ base: b.base });
        } else {
          setBranch(b.current ?? 'HEAD', b.base);
        }
      })
      .catch((e: Error) => toast(`브랜치 목록 실패: ${e.message}`, 'error'));
  }, [setBranch, toast]);

  const switchWorktree = (path: string) => {
    location.search = `?${new URLSearchParams({ key: KEY, wt: path, ...(HOST ? { host: HOST } : {}) })}`;
  };

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
      <span className="topbar-spacer" />
      <SearchEverywhere />
      <FontSettingsButton />
    </div>
  );
}
