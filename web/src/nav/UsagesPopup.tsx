import { useEffect, useState } from 'react';
import { useStore } from '../store.ts';
import { jumpTo, useNavUi } from './useNavigation.ts';

// 커서 근처에 뜨는 선언/사용처 목록(WebStorm 팝업)
export function UsagesPopup() {
  const { popup, setPopup, setUsages } = useNavUi();
  const setBottomPanel = useStore((s) => s.setBottomPanel);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [popup]);

  useEffect(() => {
    if (!popup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopup(null);
      else if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, popup.locations.length - 1));
      else if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0));
      else if (e.key === 'Enter') {
        setPopup(null);
        jumpTo(popup.locations[index]);
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.usages-popup')) setPopup(null);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [popup, index, setPopup]);

  if (!popup) return null;
  const top = Math.min(popup.y, window.innerHeight - 320);
  const left = Math.min(popup.x, window.innerWidth - 520);
  return (
    <div className="usages-popup" style={{ top, left }}>
      <div className="popup-title">
        {popup.title}
        <button
          className="link"
          onClick={() => {
            setUsages({ title: popup.title, locations: popup.locations });
            setBottomPanel('usages');
            setPopup(null);
          }}
        >
          도구 창에서 보기
        </button>
      </div>
      <div className="popup-list">
        {popup.locations.map((l, i) => (
          <div
            key={`${l.path}:${l.line}:${l.column}`}
            className={`row ${i === index ? 'selected' : ''}`}
            onMouseEnter={() => setIndex(i)}
            onClick={() => {
              setPopup(null);
              jumpTo(l);
            }}
          >
            <span className="loc">{l.path}:{l.line}</span>
            <span className="preview">{l.preview}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
