import { useMemo } from 'react';
import type { Location } from '../../../server/shared/types.ts';
import { jumpTo, useNavUi } from './useNavigation.ts';

// 하단 도구 창: 사용처를 파일별 트리로
export function FindUsagesPanel() {
  const usages = useNavUi((s) => s.usages);

  const byFile = useMemo(() => {
    const map = new Map<string, Location[]>();
    for (const l of usages?.locations ?? []) map.set(l.path, [...(map.get(l.path) ?? []), l]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [usages]);

  if (!usages) return <div className="empty">TS/JS 코드에서 Alt+F7로 사용처를 찾으세요</div>;
  return (
    <div className="usages-panel">
      <div className="panel-title">
        {usages.title} — 사용처 {usages.locations.length}건
      </div>
      {byFile.map(([path, locs]) => (
        <details key={path} open>
          <summary className="group">
            {path} <span className="count">{locs.length}</span>
          </summary>
          {locs.map((l) => (
            <div key={`${l.line}:${l.column}`} className="row file" onClick={() => jumpTo(l)}>
              <span className="meta">{l.line}</span>
              <span className="preview">{l.preview}</span>
            </div>
          ))}
        </details>
      ))}
    </div>
  );
}
