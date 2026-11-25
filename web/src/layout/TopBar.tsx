import { SearchEverywhere } from './SearchEverywhere.tsx';
import { useEffect, useState } from 'react';
import { type Branches, getBranches, getWorktrees, KEY, WT } from '../api.ts';
import { FontSettingsButton } from '../settings/FontSettingsButton.tsx';
import { useTheme } from '../settings/theme.ts';
import { useStore } from '../store.ts';

const SUN_ICON = 'M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm5.657-8.157a.75.75 0 0 1 0 1.061l-1.061 1.06a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l1.06-1.06a.75.75 0 0 1 1.06 0Zm-9.193 9.193a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 1 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0ZM3 8a.75.75 0 0 1-.75.75H.75a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 3 8Zm13 0a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 16 8Zm-8 5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13Zm3.536-1.464a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 0 1-1.06 1.061l-1.061-1.06a.75.75 0 0 1 0-1.061ZM2.343 2.343a.75.75 0 0 1 1.061 0l1.06 1.061a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-1.06-1.06a.75.75 0 0 1 0-1.06Z';
const MOON_ICON = 'M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786Zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.499 5.499 0 1 0 7.678-7.678Z';

export function TopBar() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { branch, base, setBranch, refresh, toast } = useStore();
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
    location.search = `?${new URLSearchParams({ key: KEY, wt: path })}`;
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
      <button className="icon-button" onClick={refresh} title="새로고침" aria-label="새로고침">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"
          />
        </svg>
      </button>
      <SearchEverywhere />
      <button className="icon-button" onClick={toggleTheme} title={theme === 'dark' ? '라이트 테마로 전환' : '다크 테마로 전환'} aria-label="테마 전환">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path fill="currentColor" d={theme === 'dark' ? SUN_ICON : MOON_ICON} />
        </svg>
      </button>
      <FontSettingsButton />
    </div>
  );
}
