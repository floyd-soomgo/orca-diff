import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getWorktreeFiles } from '../api.ts';
import { useStore } from '../store.ts';
import { ChangesTree, TreeSearchIcon, Twisty } from './ChangesTree.tsx';
import { buildFileTree, type DirNode } from './changeTree.ts';

export function ChangesAndFiles() {
  const [showFiles, setShowFiles] = useState(false);
  const panelTabs = (
    <div className="bottom-tabs" role="group" aria-label="저장소 탐색">
      <button className={showFiles ? '' : 'active'} aria-pressed={!showFiles} onClick={() => setShowFiles(false)}>Changes</button>
      <button className={showFiles ? 'active' : ''} aria-pressed={showFiles} onClick={() => setShowFiles(true)}>Files</button>
    </div>
  );

  return (
    <div className="changes-and-files">
      <div className="file-browser-pane" hidden={showFiles}><ChangesTree panelTabs={panelTabs} /></div>
      <div className="file-browser-pane" hidden={!showFiles}><ProjectFiles active={showFiles} panelTabs={panelTabs} /></div>
    </div>
  );
}

function ProjectFiles({ active, panelTabs }: { active: boolean; panelTabs: ReactNode }) {
  const openFile = useStore((s) => s.openFile);
  const refreshTick = useStore((s) => s.refreshTick);
  const activePath = useStore(({ tabs, activeTabId }) => {
    const tab = tabs.find(({ id }) => id === activeTabId);
    return tab?.kind === 'diff' ? tab.change.path : tab?.path;
  });
  const [paths, setPaths] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filteredCollapsed, setFilteredCollapsed] = useState<Set<string>>(new Set());
  const query = filter.trim().toLowerCase();

  const closeSearch = () => {
    setSearchOpen(false);
    setFilter('');
    setFilteredCollapsed(new Set());
  };

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    getWorktreeFiles()
      .then((files) => {
        if (cancelled) return;
        setPaths(files);
        setError('');
      })
      .catch((e: Error) => { if (!cancelled) setError(`파일 목록을 불러오지 못했습니다. ${e.message}`); });
    return () => { cancelled = true; };
  }, [active, refreshTick]);

  const tree = useMemo(() => {
    if (!paths) return null;
    const matches = query ? paths.filter((path) => path.toLowerCase().includes(query)) : paths;
    return buildFileTree(matches.map((path) => ({ path })));
  }, [paths, query]);

  const toggle = (path: string) => {
    const update = query ? setFilteredCollapsed : setExpanded;
    update((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderTree = (node: DirNode<{ path: string }>, depth: number) => (
    <>
      {node.dirs.map((dir) => {
        const open = query ? !filteredCollapsed.has(dir.path) : expanded.has(dir.path);
        return (
          <div key={dir.path}>
            <button className="row dir" title={dir.path} aria-expanded={open} onClick={() => toggle(dir.path)} style={{ paddingLeft: 8 + depth * 14 }}>
              <Twisty collapsed={!open} />
              <span className="name">📁 {dir.name}</span>
            </button>
            {open && renderTree(dir, depth + 1)}
          </div>
        );
      })}
      {node.files.map(({ path }) => (
        <button
          key={path}
          className="row file"
          aria-current={path === activePath || undefined}
          title={path}
          onClick={() => openFile(path)}
          style={{ paddingLeft: 24 + depth * 14 }}
        >
          <span className="name">{path.slice(path.lastIndexOf('/') + 1)}</span>
        </button>
      ))}
    </>
  );

  return (
    <div className="project-files">
      <div className="tree-panel-toolbar">
        {panelTabs}
        {!searchOpen && (
          <span className="panel-actions">
            <button className="icon-button small" title="프로젝트 파일 필터" aria-label="프로젝트 파일 필터 열기" onClick={() => setSearchOpen(true)}>
              <TreeSearchIcon />
            </button>
          </span>
        )}
      </div>
      {searchOpen && (
        <div className="panel-title panel-search">
          <input
            autoFocus
            aria-label="프로젝트 파일 필터"
            placeholder="파일명 또는 폴더 경로"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setFilteredCollapsed(new Set());
            }}
            onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
          />
          <button className="icon-button small" title="필터 닫기 (Esc)" aria-label="필터 닫기" onClick={closeSearch}>×</button>
        </div>
      )}
      <div className="list">
        {error && <div className="empty" role="status">{error}</div>}
        {!tree && !error && <div className="empty">불러오는 중…</div>}
        {tree && (tree.dirs.length || tree.files.length
          ? renderTree(tree, 0)
          : <div className="empty">{query ? '일치하는 파일 없음' : '표시할 파일 없음'}</div>)}
      </div>
    </div>
  );
}
