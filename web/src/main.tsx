import './monaco/setup.ts';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KEY, WT } from './api.ts';
import { loadPrefs } from './prefs.ts';

const root = createRoot(document.getElementById('root')!);

async function start() {
  if (!KEY || !WT) {
    root.render(<div className="editor-empty">터미널에서 orca-review로 여세요 (key/wt 없음)</div>);
    return;
  }
  // 패널 크기·글꼴 등 설정을 먼저 읽은 뒤 앱 모듈을 불러온다(모듈 초기화 때 설정을 읽음)
  await loadPrefs();
  const { App } = await import('./App.tsx');
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

start();
