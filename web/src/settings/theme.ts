import markdownDark from 'github-markdown-css/github-markdown-dark.css?inline';
import markdownLight from 'github-markdown-css/github-markdown-light.css?inline';
import highlightDark from 'highlight.js/styles/github-dark.css?inline';
import highlightLight from 'highlight.js/styles/github.css?inline';
import { monaco } from '../monaco/setup.ts';

type Theme = 'light' | 'dark';

const MARKDOWN_CSS: Record<Theme, string> = { light: markdownLight + highlightLight, dark: markdownDark + highlightDark };
const markdownStyle = document.head.appendChild(document.createElement('style'));

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  markdownStyle.textContent = MARKDOWN_CSS[theme];
  monaco.editor.setTheme(`github-${theme}`);
}

const systemDark = matchMedia('(prefers-color-scheme: dark)');
const applySystemTheme = () => apply(systemDark.matches ? 'dark' : 'light');

applySystemTheme();
systemDark.addEventListener('change', applySystemTheme);
