import markdownDark from 'github-markdown-css/github-markdown-dark.css?inline';
import markdownLight from 'github-markdown-css/github-markdown-light.css?inline';
import highlightDark from 'highlight.js/styles/github-dark.css?inline';
import highlightLight from 'highlight.js/styles/github.css?inline';
import { create } from 'zustand';
import { monaco } from '../monaco/setup.ts';
import { getPref, setPref } from '../prefs.ts';

export type Theme = 'light' | 'dark';

const MARKDOWN_CSS: Record<Theme, string> = { light: markdownLight + highlightLight, dark: markdownDark + highlightDark };
const markdownStyle = document.head.appendChild(document.createElement('style'));

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  markdownStyle.textContent = MARKDOWN_CSS[theme];
  monaco.editor.setTheme(`github-${theme}`);
}

// 저장한 값이 없으면 시스템 설정을 따른다
function load(): Theme {
  const saved = getPref<unknown>('theme', null);
  if (saved === 'light' || saved === 'dark') return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useTheme = create<{ theme: Theme; toggle(): void }>((set, get) => {
  const theme = load();
  apply(theme);
  return {
    theme,
    toggle: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      apply(next);
      set({ theme: next });
      setPref('theme', next);
    },
  };
});
