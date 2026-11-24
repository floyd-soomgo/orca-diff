import { useCallback, useEffect, useState } from 'react';
import type { Terminal } from '../../../server/shared/types.ts';
import { getBranches, getChanges, getOrca, getTerminals, send, WT } from '../api.ts';
import { useStore } from '../store.ts';
import { formatFeedback } from './format.ts';
import type { ReviewComment } from './model.ts';
import { loadTarget, saveTarget, useFeedback } from './storage.ts';

export function describeTarget(c: ReviewComment): string {
  const t = c.target;
  if (t.kind === 'commit') return `커밋 ${t.sha.slice(0, 7)} "${t.subject}"`;
  if (t.kind === 'file') return `${t.path} (파일)`;
  return `${t.path}:${t.startLine === t.endLine ? t.startLine : `${t.startLine}-${t.endLine}`}${t.side === 'old' ? ' (삭제된 코드)' : ''}`;
}

export function FeedbackPanel() {
  const { comments, remove, markSent, openDialog } = useFeedback();
  const { toast, openDiff, select } = useStore();
  const [showSent, setShowSent] = useState(false);
  const [orca, setOrca] = useState<boolean | null>(null);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [target, setTarget] = useState<string>(() => loadTarget(WT) ?? '');
  const [branch, setBranch] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadTerminals = useCallback(async () => {
    try {
      const list = await getTerminals();
      setTerminals(list);
      setTarget((t) => (list.some((x) => x.handle === t) ? t : (list[0]?.handle ?? '')));
    } catch (e) {
      toast(`터미널 목록 실패: ${(e as Error).message}`, 'error');
    }
  }, [toast]);

  useEffect(() => {
    getBranches()
      .then((b) => setBranch(b.current))
      .catch(() => setBranch(null));
    getOrca()
      .then(({ available }) => {
        setOrca(available);
        if (available) loadTerminals();
      })
      .catch(() => setOrca(false));
  }, [loadTerminals]);

  const unsent = comments.filter((c) => !c.sentAt);
  const visible = showSent ? comments : unsent;

  // Orca가 있고 대상 터미널이 있으면 입력창에 넣고, 아니면 클립보드에 복사한다
  const canSend = orca === true && target !== '';
  const deliver = async () => {
    if (unsent.length === 0) return;
    const text = formatFeedback(unsent, { wt: WT, branch });
    setSending(true);
    try {
      if (canSend) {
        await send(target, text);
        saveTarget(WT, target);
        toast('에이전트 입력창에 넣었습니다. 확인 후 Enter를 눌러 보내세요');
      } else {
        await navigator.clipboard.writeText(text);
        toast('클립보드에 복사했습니다');
      }
      markSent(unsent.map((c) => c.id));
    } catch (e) {
      toast(`보내기 실패: ${(e as Error).message}`, 'error');
    } finally {
      setSending(false);
    }
  };

  const reveal = async (c: ReviewComment) => {
    const t = c.target;
    if (t.kind === 'commit') return;
    try {
      const change = (await getChanges(t.source)).find((x) => x.path === t.path);
      if (!change) {
        toast('해당 변경을 더 이상 찾을 수 없습니다');
        return;
      }
      if (t.source.kind === 'commits') select({ mode: 'commits', shas: t.source.from === t.source.to ? [t.source.to] : [t.source.to, t.source.from] });
      else select({ mode: 'worktree' });
      openDiff(t.source, change);
    } catch (e) {
      toast(`열기 실패: ${(e as Error).message}`, 'error');
    }
  };

  return (
    <div className="feedback-panel">
      <div className="feedback-bar">
        {orca && (
          <>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {terminals.length === 0 && <option value="">이 워크트리에 터미널 없음</option>}
              {terminals.map((t) => (
                <option key={t.handle} value={t.handle}>{t.title}</option>
              ))}
            </select>
            <button onClick={loadTerminals} title="터미널 목록 새로고침">⟳</button>
          </>
        )}
        <button className="primary" disabled={unsent.length === 0 || sending} onClick={deliver}>
          {canSend ? `입력창에 넣기 (${unsent.length})` : `클립보드에 복사 (${unsent.length})`}
        </button>
        <label>
          <input type="checkbox" checked={showSent} onChange={(e) => setShowSent(e.target.checked)} />
          보낸 항목 보기
        </label>
      </div>
      {visible.length === 0 && <div className="empty">diff의 라인 번호를 클릭하거나 드래그해서 코멘트를 다세요</div>}
      {visible.map((c) => (
        <div key={c.id} className={`feedback-item ${c.sentAt ? 'sent' : ''}`} onClick={() => reveal(c)}>
          <div className="feedback-loc">
            {describeTarget(c)}
            {c.stale && <span className="badge warn">코드가 바뀌었을 수 있음</span>}
            {c.sentAt && <span className="badge">보냄</span>}
          </div>
          <div className="feedback-body">{c.body}</div>
          <div className="comment-actions">
            {c.target.kind !== 'line' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openDialog(c.target, c.id, c.body);
                }}
              >
                편집
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                remove(c.id);
              }}
            >
              삭제
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// 파일·커밋 코멘트 입력 대화상자
export function CommentDialog() {
  const { dialog, closeDialog, add, update } = useFeedback();
  const [body, setBody] = useState('');
  useEffect(() => setBody(dialog?.body ?? ''), [dialog]);
  if (!dialog) return null;
  const t = dialog.target;
  const title = t.kind === 'commit' ? `커밋 ${t.sha.slice(0, 7)} "${t.subject}"` : t.kind === 'file' ? `${t.path} (파일 전체)` : t.path;
  const save = () => {
    const text = body.trim();
    if (!text) return;
    if (dialog.editId) update(dialog.editId, { body: text });
    else add(dialog.target, text);
    closeDialog();
  };
  return (
    <div className="dialog-backdrop" onMouseDown={closeDialog}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="comment-label">{title} 코멘트 (Cmd+Enter 저장, Esc 취소)</div>
        <textarea
          autoFocus
          className="comment-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
            else if (e.key === 'Escape') closeDialog();
          }}
        />
        <div className="comment-actions">
          <button className="primary" onClick={save}>저장</button>
          <button onClick={closeDialog}>취소</button>
        </div>
      </div>
    </div>
  );
}
