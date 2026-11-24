import { create } from 'zustand';
import type { Change, Source } from '../../server/shared/types.ts';

export type Tab =
  | { id: string; kind: 'diff'; source: Source; change: Change }
  | { id: string; kind: 'file'; path: string; reveal?: { line: number; column: number } };

export type CommitSelection = { mode: 'worktree' } | { mode: 'commits'; shas: string[] }; // shas: 최신 → 오래된 순
export type BottomPanel = 'usages' | 'feedback' | null;
export interface NavEntry { path: string; line: number; column: number; tabId?: string | null }
export interface Toast { id: number; message: string; tone: 'info' | 'error' }

export const sourceKey = (s: Source) => (s.kind === 'commits' ? `commits:${s.from}..${s.to}` : s.kind);
const diffTabId = (source: Source, change: Change) => `diff:${sourceKey(source)}:${change.path}`;

interface State {
  branch: string | null; // null이면 아직 로드 전
  base: string | null;
  baseOnly: boolean;
  filter: string;
  selection: CommitSelection;
  tabs: Tab[];
  activeTabId: string | null;
  bottomPanel: BottomPanel;
  toasts: Toast[];
  navBack: NavEntry[];
  navForward: NavEntry[];
  refreshTick: number;

  setBranch(branch: string, base: string | null): void;
  setBaseOnly(baseOnly: boolean): void;
  setFilter(filter: string): void;
  select(selection: CommitSelection): void;
  openDiff(source: Source, change: Change): void;
  openFile(path: string, reveal?: { line: number; column: number }): void;
  closeTab(id: string): void;
  setActiveTab(id: string): void;
  setBottomPanel(panel: BottomPanel): void;
  toast(message: string, tone?: Toast['tone']): void;
  refresh(): void;
  pushNav(from: NavEntry): void;
  goBack(current: NavEntry | null): void;
  goForward(current: NavEntry | null): void;
  revealNav(entry: NavEntry): void;
}

let toastSeq = 0;

export const useStore = create<State>((set, get) => ({
  branch: null,
  base: null,
  baseOnly: true,
  filter: '',
  selection: { mode: 'worktree' },
  tabs: [],
  activeTabId: null,
  bottomPanel: null,
  toasts: [],
  navBack: [],
  navForward: [],
  refreshTick: 0,

  setBranch: (branch, base) => set({ branch, base, selection: { mode: 'worktree' } }),
  setBaseOnly: (baseOnly) => set({ baseOnly }),
  setFilter: (filter) => set({ filter }),
  select: (selection) => set({ selection }),

  openDiff: (source, change) => {
    const id = diffTabId(source, change);
    if (!get().tabs.some((t) => t.id === id)) set((s) => ({ tabs: [...s.tabs, { id, kind: 'diff', source, change }] }));
    set({ activeTabId: id });
  },

  openFile: (path, reveal) => {
    const id = `file:${path}`;
    const tab: Tab = { id, kind: 'file', path, reveal };
    set((s) => ({
      tabs: s.tabs.some((t) => t.id === id) ? s.tabs.map((t) => (t.id === id ? tab : t)) : [...s.tabs, tab],
      activeTabId: id,
    }));
  },

  closeTab: (id) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      const tabs = s.tabs.filter((t) => t.id !== id);
      const activeTabId = s.activeTabId === id ? (tabs[Math.min(idx, tabs.length - 1)]?.id ?? null) : s.activeTabId;
      return { tabs, activeTabId };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),
  setBottomPanel: (bottomPanel) => set({ bottomPanel }),

  toast: (message, tone = 'info') => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },

  refresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),

  pushNav: (from) => set((s) => ({ navBack: [...s.navBack, from], navForward: [] })),
  goBack: (current) => {
    const { navBack, navForward } = get();
    const target = navBack.at(-1);
    if (!target) return;
    set({ navBack: navBack.slice(0, -1), navForward: current ? [...navForward, current] : navForward });
    get().revealNav(target);
  },
  // 기록된 탭(예: diff 탭)이 아직 열려 있으면 그 탭으로, 아니면 파일 탭으로 돌아간다
  revealNav: (entry) => {
    const tab = get().tabs.find((t) => t.id === entry.tabId);
    if (tab && tab.kind === 'diff') set({ activeTabId: tab.id });
    else get().openFile(entry.path, { line: entry.line, column: entry.column });
  },
  goForward: (current) => {
    const { navBack, navForward } = get();
    const target = navForward.at(-1);
    if (!target) return;
    set({ navForward: navForward.slice(0, -1), navBack: current ? [...navBack, current] : navBack });
    get().revealNav(target);
  },
}));

// 선택된 커밋들을 Source로 바꾼다(연속 범위 가정: 가장 오래된 → 가장 최신)
export function commitsSource(shas: string[]): Source {
  return { kind: 'commits', from: shas[shas.length - 1], to: shas[0] };
}
