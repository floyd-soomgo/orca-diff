import { useEffect, useState } from 'react';

const SHOW_DELAY_MS = 400;
const MAX_WIDTH = 360;

// title 속성의 툴팁을 앱이 직접 그린다(Orca 내장 브라우저는 OS 기본 툴팁을 띄우지 않음).
// 처음 올라갈 때 title을 data-tip으로 옮겨 기본 툴팁과 겹치지 않게 한다.
export function Tooltip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; above: boolean } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: HTMLElement | null = null;

    const hide = () => {
      clearTimeout(timer);
      current = null;
      setTip(null);
    };

    const onOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[title], [data-tip]');
      if (el === current) return;
      hide();
      if (!el) return;
      const title = el.getAttribute('title');
      if (title) {
        el.setAttribute('data-tip', title);
        el.removeAttribute('title');
      }
      const text = el.getAttribute('data-tip');
      if (!text) return;
      current = el;
      timer = setTimeout(() => {
        if (current !== el || !el.isConnected) return;
        const r = el.getBoundingClientRect();
        const above = r.bottom + 60 > window.innerHeight;
        const x = Math.min(Math.max(8, r.left + r.width / 2 - MAX_WIDTH / 2), window.innerWidth - MAX_WIDTH - 8);
        setTip({ text, x, y: above ? r.top - 6 : r.bottom + 6, above });
      }, SHOW_DELAY_MS);
    };

    const onOut = (e: MouseEvent) => {
      if (current && !current.contains(e.relatedTarget as Node | null)) hide();
    };

    window.addEventListener('mouseover', onOver);
    window.addEventListener('mouseout', onOut);
    window.addEventListener('mousedown', hide, true);
    window.addEventListener('wheel', hide, true);
    window.addEventListener('keydown', hide, true);
    return () => {
      hide();
      window.removeEventListener('mouseover', onOver);
      window.removeEventListener('mouseout', onOut);
      window.removeEventListener('mousedown', hide, true);
      window.removeEventListener('wheel', hide, true);
      window.removeEventListener('keydown', hide, true);
    };
  }, []);

  if (!tip) return null;
  return (
    <div className={`tooltip ${tip.above ? 'above' : ''}`} style={{ left: tip.x, top: tip.y, maxWidth: MAX_WIDTH }} role="tooltip">
      <span>{tip.text}</span>
    </div>
  );
}
