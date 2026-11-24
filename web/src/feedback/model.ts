import type { Source } from '../../../server/shared/types.ts';

export type CommentTarget =
  | { kind: 'line'; source: Source; path: string; side: 'old' | 'new'; startLine: number; endLine: number; excerpt: string }
  | { kind: 'file'; source: Source; path: string }
  | { kind: 'commit'; sha: string; subject: string };

export interface ReviewComment {
  id: string;
  target: CommentTarget;
  body: string;
  createdAt: number;
  sentAt: number | null;
  stale: boolean; // 발췌를 다시 찾지 못함(코드가 바뀌었을 수 있음)
}
