import './monaco/setup.ts';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KEY, WT } from './api.ts';
import { App } from './App.tsx';

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    {KEY && WT ? <App /> : <div className="editor-empty">터미널에서 orca-review로 여세요 (key/wt 없음)</div>}
  </StrictMode>,
);
