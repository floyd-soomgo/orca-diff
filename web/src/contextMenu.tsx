import { useEffect } from 'react';
import { create } from 'zustand';
import { useStore } from './store.ts';

export type MenuItem =
  | { label: string; shortcut?: string; disabled?: boolean; onSelect: () => void }
  | 'separator';

interface MenuState {
  menu: { x: number; y: number; items: MenuItem[] } | null;
  open(x: number, y: number, items: MenuItem[]): void;
  close(): void;
}

// 앱 전체에서 쓰는 우클릭 메뉴. 에디터·목록 어디서든 open으로 항목을 넘긴다.
export const useContextMenu = create<MenuState>((set) => ({
  menu: null,
  open: (x, y, items) => set({ menu: { x, y, items } }),
  close: () => set({ menu: null }),
}));

export function copyText(text: string, label: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => useStore.getState().toast(`복사했습니다 (${label})`))
    .catch((e: Error) => useStore.getState().toast(`복사 실패: ${e.message}`, 'error'));
}

const MENU_WIDTH = 260;

export function ContextMenu() {
  const { menu, close } = useContextMenu();

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.context-menu')) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', close);
    window.addEventListener('wheel', close, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', close);
      window.removeEventListener('wheel', close, true);
    };
  }, [menu, close]);

  if (!menu) return null;
  const height = menu.items.length * 26 + 8;
  const left = Math.min(menu.x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(menu.y, window.innerHeight - height - 8);
  return (
    <div className="context-menu" style={{ left, top, width: MENU_WIDTH }} onContextMenu={(e) => e.preventDefault()}>
      {menu.items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="menu-separator" />
        ) : (
          <div
            key={i}
            className={`menu-item ${item.disabled ? 'disabled' : ''}`}
            onClick={() => {
              if (item.disabled) return;
              close();
              item.onSelect();
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
          </div>
        ),
      )}
    </div>
  );
}
