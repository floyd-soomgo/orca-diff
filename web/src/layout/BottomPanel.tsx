import type { ReactNode } from 'react';
import { type BottomPanel as Panel, useStore } from '../store.ts';

interface Props {
  usages: ReactNode;
  feedback: ReactNode;
  feedbackCount: number;
}

export function BottomPanel({ usages, feedback, feedbackCount }: Props) {
  const { bottomPanel, setBottomPanel } = useStore();
  const toggle = (p: Exclude<Panel, null>) => setBottomPanel(bottomPanel === p ? null : p);

  return (
    <div className="bottom-panel">
      <div className="bottom-tabs">
        <button className={bottomPanel === 'usages' ? 'active' : ''} onClick={() => toggle('usages')}>
          Find Usages
        </button>
        <button className={bottomPanel === 'feedback' ? 'active' : ''} onClick={() => toggle('feedback')}>
          Feedback ({feedbackCount})
        </button>
      </div>
      {bottomPanel && <div className="bottom-content">{bottomPanel === 'usages' ? usages : feedback}</div>}
    </div>
  );
}
