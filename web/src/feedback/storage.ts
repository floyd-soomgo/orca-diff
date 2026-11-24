import { create } from 'zustand';
import { WT } from '../api.ts';
import { useStore } from '../store.ts';
import type { CommentTarget, ReviewComment } from './model.ts';

const commentsKey = (wt: string) => `orca-review:comments:${wt}`;
const targetKey = (wt: string) => `orca-review:target:${wt}`;

export function loadComments(wt: string): ReviewComment[] {
  try {
    const v = JSON.parse(localStorage.getItem(commentsKey(wt)) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveComments(wt: string, list: ReviewComment[]): boolean {
  try {
    localStorage.setItem(commentsKey(wt), JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function loadTarget(wt: string): string | null {
  try {
    return localStorage.getItem(targetKey(wt));
  } catch {
    return null;
  }
}

export function saveTarget(wt: string, handle: string): void {
  try {
    localStorage.setItem(targetKey(wt), handle);
  } catch {
    // 마지막 대상 기억은 편의 기능
  }
}

interface FeedbackState {
  comments: ReviewComment[];
  // 파일·커밋 코멘트 입력 대화상자(라인 코멘트는 에디터 안에서 입력)
  dialog: { target: CommentTarget; editId?: string; body: string } | null;
  add(target: CommentTarget, body: string): void;
  update(id: string, patch: Partial<Pick<ReviewComment, 'body' | 'target' | 'stale'>>): void;
  remove(id: string): void;
  markSent(ids: string[]): void;
  openDialog(target: CommentTarget, editId?: string, body?: string): void;
  closeDialog(): void;
}

export const useFeedback = create<FeedbackState>((set, get) => {
  const commit = (comments: ReviewComment[]) => {
    set({ comments });
    // 저장 실패(용량 초과 등)는 코멘트 유실로 이어지므로 알린다
    if (!saveComments(WT, comments)) useStore.getState().toast('코멘트를 브라우저 저장소에 저장하지 못했습니다. 새로고침하면 사라질 수 있습니다', 'error');
  };
  return {
    comments: loadComments(WT),
    dialog: null,
    add: (target, body) =>
      commit([...get().comments, { id: crypto.randomUUID(), target, body, createdAt: Date.now(), sentAt: null, stale: false }]),
    update: (id, patch) => commit(get().comments.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    remove: (id) => commit(get().comments.filter((c) => c.id !== id)),
    markSent: (ids) => commit(get().comments.map((c) => (ids.includes(c.id) ? { ...c, sentAt: Date.now() } : c))),
    openDialog: (target, editId, body = '') => set({ dialog: { target, editId, body } }),
    closeDialog: () => set({ dialog: null }),
  };
});
