import { create } from 'zustand';
import { getPref, setPref } from '../prefs.ts';

const STORAGE_KEY = 'orca-review:font';
const DEFAULT = { family: 'Menlo', size: 13 };
const MIN_SIZE = 10;
const MAX_SIZE = 24;

// 흔히 쓰는 고정폭 글꼴 후보. 실제로 설치된 것만 목록에 보여준다.
const CANDIDATES = [
  'JetBrains Mono', 'Fira Code', 'Fira Mono', 'SF Mono', 'Menlo', 'Monaco', 'D2Coding', 'Source Code Pro',
  'Cascadia Code', 'Hack', 'IBM Plex Mono', 'Roboto Mono', 'Ubuntu Mono', 'Consolas', 'Courier New',
];

export function clampFontSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT.size;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(size)));
}

export function fontStack(family: string): string {
  const quoted = /\s/.test(family) ? `"${family}"` : family;
  return family === 'Menlo' ? 'Menlo, monospace' : `${quoted}, Menlo, monospace`;
}

// 대체 글꼴과 폭이 다르게 측정되면 설치된 것으로 본다
export function detectInstalledFonts(): string[] {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return [DEFAULT.family];
  const sample = 'mmmmmmmmmmlli0O_{}=>';
  const width = (font: string) => {
    ctx.font = `16px ${font}`;
    return ctx.measureText(sample).width;
  };
  const fallbacks = ['monospace', 'serif'].map((f) => ({ f, w: width(f) }));
  return CANDIDATES.filter((name) => fallbacks.some(({ f, w }) => width(`"${name}", ${f}`) !== w));
}

interface FontState {
  family: string;
  size: number;
  set(patch: Partial<{ family: string; size: number }>): void;
}

function load(): { family: string; size: number } {
  try {
    const v = getPref<{ family?: unknown; size?: unknown }>('font', JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'));
    return { family: typeof v.family === 'string' ? v.family : DEFAULT.family, size: clampFontSize(Number(v.size ?? DEFAULT.size)) };
  } catch {
    return DEFAULT;
  }
}

export const useFontSettings = create<FontState>((set, get) => ({
  ...load(),
  set: (patch) => {
    set({ ...patch, ...(patch.size !== undefined ? { size: clampFontSize(patch.size) } : {}) });
    const { family, size } = get();
    setPref('font', { family, size });
  },
}));

// Monaco 에디터 옵션으로 변환
export function editorFontOptions(s: { family: string; size: number }) {
  return { fontFamily: fontStack(s.family), fontSize: s.size, lineHeight: Math.round(s.size * 1.5) };
}
