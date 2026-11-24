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

// GitHub light (Primer prettylights) 구문 강조
monaco.editor.defineTheme('github-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: '', foreground: '1F2328' },
    { token: 'keyword', foreground: 'CF222E' },
    { token: 'storage', foreground: 'CF222E' },
    { token: 'string', foreground: '0A3069' },
    { token: 'string.escape', foreground: '0A3069' },
    { token: 'regexp', foreground: '0A3069' },
    { token: 'comment', foreground: '59636E' },
    { token: 'number', foreground: '0550AE' },
    { token: 'constant', foreground: '0550AE' },
    { token: 'type', foreground: '953800' },
    { token: 'type.identifier', foreground: '953800' },
    { token: 'identifier', foreground: '1F2328' },
    { token: 'variable', foreground: '953800' },
    { token: 'delimiter', foreground: '1F2328' },
    { token: 'tag', foreground: '116329' },
    { token: 'metatag', foreground: '116329' },
    { token: 'attribute.name', foreground: '0550AE' },
    { token: 'attribute.value', foreground: '0A3069' },
    { token: 'key', foreground: '0550AE' },
    { token: 'string.key.json', foreground: '0550AE' },
    { token: 'string.value.json', foreground: '0A3069' },
    { token: 'annotation', foreground: '8250DF' },
  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#1F2328',
    'editorLineNumber.foreground': '#8C959F',
    'editorLineNumber.activeForeground': '#1F2328',
    'editor.selectionBackground': '#B6E3FF',
    'editor.inactiveSelectionBackground': '#DDF4FF',
    'editor.lineHighlightBackground': '#F6F8FA',
    'editorGutter.background': '#FFFFFF',
    'editorIndentGuide.background1': '#EAEEF2',
    'editorWhitespace.foreground': '#D0D7DE',
    'diffEditor.insertedLineBackground': '#DAFBE1',
    'diffEditor.removedLineBackground': '#FFEBE9',
    'diffEditor.insertedTextBackground': '#ABF2BC',
    'diffEditor.removedTextBackground': '#FF818266',
    'diffEditorGutter.insertedLineBackground': '#CCFFD8',
    'diffEditorGutter.removedLineBackground': '#FFD7D5',
    'diffEditor.unchangedRegionBackground': '#DDF4FF',
    'diffEditor.unchangedRegionForeground': '#0969DA',
    'diffEditor.diagonalFill': '#EAEEF2',
    'scrollbarSlider.background': '#8C959F33',
  },
});
monaco.editor.setTheme('github-light');

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
  renderLineHighlight: 'line',
  occurrencesHighlight: 'off',
  links: false,
  hover: { enabled: 'off' },
  glyphMargin: true,
} satisfies monaco.editor.IEditorOptions;

export { monaco };
