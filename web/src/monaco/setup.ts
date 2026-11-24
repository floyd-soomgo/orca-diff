import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';

// diff 계산 등에 쓰는 기본 워커만 둔다. 언어 서비스 워커는 쓰지 않는다.
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

// Monaco 내장 TS/JS 언어 서비스(정의·참조·호버·진단 등)는 끄고 구문 강조만 쓴다.
// 탐색은 서버의 tsserver가 담당한다.
const OFF = {
  completionItems: false,
  hovers: false,
  documentSymbols: false,
  definitions: false,
  references: false,
  documentHighlights: false,
  rename: false,
  diagnostics: false,
  documentRangeFormattingEdits: false,
  signatureHelp: false,
  onTypeFormattingEdits: false,
  codeActions: false,
  inlayHints: false,
};
monaco.typescript.typescriptDefaults.setModeConfiguration(OFF);
monaco.typescript.javascriptDefaults.setModeConfiguration(OFF);

// WebStorm Darcula 계열
monaco.editor.defineTheme('darcula', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'CC7832' },
    { token: 'string', foreground: '6A8759' },
    { token: 'number', foreground: '6897BB' },
    { token: 'comment', foreground: '808080', fontStyle: 'italic' },
    { token: 'type', foreground: 'A9B7C6' },
    { token: 'identifier', foreground: 'A9B7C6' },
    { token: 'delimiter', foreground: 'CC7832' },
    { token: 'tag', foreground: 'E8BF6A' },
    { token: 'attribute.name', foreground: 'BABABA' },
  ],
  colors: {
    'editor.background': '#2B2B2B',
    'editor.foreground': '#A9B7C6',
    'editorLineNumber.foreground': '#606366',
    'editorLineNumber.activeForeground': '#A4A3A3',
    'editor.selectionBackground': '#214283',
    'editor.lineHighlightBackground': '#323232',
    'editorGutter.background': '#313335',
    'diffEditor.insertedLineBackground': '#29443680',
    'diffEditor.removedLineBackground': '#4A2C2C80',
    'diffEditor.insertedTextBackground': '#3C6B4A80',
    'diffEditor.removedTextBackground': '#7A3B3B80',
  },
});
monaco.editor.setTheme('darcula');

// 확장자 → Monaco 언어 id
export function languageOf(path: string): string {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  const byExt = monaco.languages.getLanguages().find((l) => l.extensions?.includes(ext));
  return byExt?.id ?? 'plaintext';
}

// 공통 읽기 전용 옵션(VSCode식 크롬 끄기)
export const READONLY_OPTIONS = {
  readOnly: true,
  domReadOnly: true,
  contextmenu: false,
  minimap: { enabled: false },
  automaticLayout: true,
  scrollBeyondLastLine: false,
  fontFamily: 'JetBrains Mono, Menlo, monospace',
  fontSize: 13,
  renderLineHighlight: 'line',
  occurrencesHighlight: 'off',
  links: false,
  hover: { enabled: 'off' },
  glyphMargin: true,
} satisfies monaco.editor.IEditorOptions;

export { monaco };
