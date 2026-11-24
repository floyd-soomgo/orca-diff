import { useState } from 'react';

const STORAGE_PREFIX = 'orca-review:size:';

function readSize(id: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_PREFIX + id));
    return v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

// 드래그로 조절하고 브라우저에 기억하는 패널 크기(px)
export function usePanelSize(id: string, fallback: number) {
  const [size, setSize] = useState(() => readSize(id, fallback));
  const save = (v: number) => {
    setSize(v);
    try {
      localStorage.setItem(STORAGE_PREFIX + id, String(v));
    } catch {
      // 저장 실패는 무시(크기 기억은 편의 기능)
    }
  };
  return [size, save] as const;
}

interface Props {
  direction: 'vertical' | 'horizontal'; // vertical: 좌우 경계, horizontal: 상하 경계
  size: number;
  onResize: (size: number) => void;
  invert?: boolean; // 아래/오른쪽 패널 크기를 조절할 때
  min?: number;
}

export function Splitter({ direction, size, onResize, invert = false, min = 80 }: Props) {
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const start = direction === 'vertical' ? e.clientX : e.clientY;
    const startSize = size;
    const move = (ev: PointerEvent) => {
      const delta = (direction === 'vertical' ? ev.clientX : ev.clientY) - start;
      onResize(Math.max(min, startSize + (invert ? -delta : delta)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return <div className={`splitter ${direction}`} onPointerDown={onPointerDown} />;
}
