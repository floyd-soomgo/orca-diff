import { create } from 'zustand';
import { getComments, saveComments as saveCommentsApi, WT } from '../api.ts';
import { getPref, setPref } from '../prefs.ts';
import { useStore } from '../store.ts';
import type { CommentTarget, ReviewComment } from './model.ts';

const legacyCommentsKey = (wt: string) => `orca-review:comments:${wt}`;
const legacyTargetKey = (wt: string) => `orca-review:target:${wt}`;

// 예전 버전이 브라우저 저장소에 남긴 코멘트(서버로 옮길 때만 읽는다)
function legacyComments(wt: string): ReviewComment[] {
  try {
    const v = JSON.parse(localStorage.getItem(legacyCommentsKey(wt)) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// 마지막으로 고른 피드백 대상 터미널(워크트리별)도 서버 설정에 둔다
export function loadTarget(wt: string): string | null {
  const saved = getPref<Record<string, string>>('feedbackTargets', {})[wt];
  if (saved) return saved;
  try {
    return localStorage.getItem(legacyTargetKey(wt));
  } catch {
    return null;
  }
}

export function saveTarget(wt: string, handle: string): void {
  setPref('feedbackTargets', { ...getPref<Record<string, string>>('feedbackTargets', {}), [wt]: handle });
}

// 저장 요청이 순서대로 가도록 한 줄로 세운다(늦게 도착한 옛 목록이 새 목록을 덮지 않게)
let saveQueue: Promise<unknown> = Promise.resolve();
function persist(comments: ReviewComment[]) {
  saveQueue = saveQueue
    .then(() => saveCommentsApi(comments))
    .catch((e: Error) => useStore.getState().toast(`코멘트 저장 실패: ${e.message}. 새로고침하면 사라질 수 있습니다`, 'error'));
}

// 앱 시작 전에 서버에서 코멘트를 읽는다. 서버에 없고 브라우저에 예전 코멘트가 있으면 서버로 옮긴다.
export async function preloadComments(): Promise<void> {
  try {
    let comments = await getComments();
    if (comments.length === 0) {
      const legacy = legacyComments(WT);
      if (legacy.length > 0) {
        await saveCommentsApi(legacy);
        comments = legacy;
      }
    }
    useFeedback.setState({ comments });
  } catch (e) {
    useStore.getState().toast(`코멘트를 불러오지 못했습니다: ${(e as Error).message}`, 'error');
  }
}

interface FeedbackState {
  comments: ReviewComment[];
  // 파일·커밋 코멘트 입력 대화상자(라인 코멘트는 에디터 안에서 입력)
  // commitMessage: 커밋 코멘트 창의 '커밋 메시지 붙여넣기'에 쓸 전체 메시지
  dialog: { target: CommentTarget; editId?: string; body: string; commitMessage?: string } | null;
  add(target: CommentTarget, body: string): void;
  update(id: string, patch: Partial<Pick<ReviewComment, 'body' | 'target' | 'stale'>>): void;
  remove(id: string): void;
  markSent(ids: string[]): void;
  openDialog(target: CommentTarget, editId?: string, body?: string, commitMessage?: string): void;
  closeDialog(): void;
}

export const useFeedback = create<FeedbackState>((set, get) => {
  const commit = (comments: ReviewComment[]) => {
    set({ comments });
    persist(comments);
  };
  return {
    comments: [],
    dialog: null,
    add: (target, body) =>
      commit([...get().comments, { id: crypto.randomUUID(), target, body, createdAt: Date.now(), sentAt: null, stale: false }]),
    update: (id, patch) => commit(get().comments.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    remove: (id) => commit(get().comments.filter((c) => c.id !== id)),
    markSent: (ids) => commit(get().comments.map((c) => (ids.includes(c.id) ? { ...c, sentAt: Date.now() } : c))),
    openDialog: (target, editId, body = '', commitMessage) => set({ dialog: { target, editId, body, commitMessage } }),
    closeDialog: () => set({ dialog: null }),
  };
});
