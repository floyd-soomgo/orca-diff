import { useEffect, useMemo, useRef, useState } from 'react';
import { getWorktreeFiles } from '../api.ts';
import { useStore } from '../store.ts';

function score(path: string, query: string) {
  const lower = path.toLowerCase();
  const name = lower.slice(lower.lastIndexOf('/') + 1);
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (lower.includes(query)) return 3;
  let pos = -1;
  for (const char of query) {
    pos = lower.indexOf(char, pos + 1);
    if (pos < 0) return Infinity;
  }
  return 4;
}

export function FileFinder() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState('');
  const results = useMemo(() => paths.map(path => ({ path, rank: score(path, query.trim().toLowerCase()) }))
    .filter(r => Number.isFinite(r.rank)).sort((a,b) => a.rank - b.rank || a.path.length - b.path.length).slice(0, 80), [paths, query]);
  function open() {
      if (dialog.current?.open) return;
      dialog.current?.showModal();
      setQuery(''); setIndex(0); setPaths([]); setMessage('불러오는 중…');
      getWorktreeFiles().then(files => { setPaths(files); setMessage('검색 결과 없음'); }).catch(e => setMessage(e.message));
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.code === 'KeyP') { e.preventDefault(); open(); }
    };
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('keydown', key, true); };
  }, []);
  useEffect(() => { dialog.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' }); }, [index]);
  function choose(path: string) { useStore.getState().openFile(path); dialog.current?.close(); }
  return <><button onClick={open} title="워크트리 파일 찾기 (Ctrl+P)">파일 찾기</button>
    <dialog ref={dialog} className="file-finder" aria-label="워크트리 파일 찾기">
      <input autoFocus aria-label="파일명 또는 경로" placeholder="워크트리 파일명 또는 경로" value={query}
        onChange={e => { setQuery(e.target.value); setIndex(0); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') setIndex(i => Math.min(i + 1, Math.max(0, results.length - 1)));
          else if (e.key === 'ArrowUp') setIndex(i => Math.max(i - 1, 0));
          else if (e.key === 'Enter' && results[index]) choose(results[index].path);
          else return;
          e.preventDefault();
        }} />
      <button onClick={() => dialog.current?.close()}>닫기</button>
      <div className="finder-results">{results.length ? results.map(({path}, i) =>
        <button key={path} aria-current={i === index} onClick={() => choose(path)}>{path}</button>) : message}</div>
    </dialog></>;
}
