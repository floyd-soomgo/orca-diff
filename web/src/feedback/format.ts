import type { Source } from '../../../server/shared/types.ts';
import type { ReviewComment } from './model.ts';

const short = (sha: string) => sha.slice(0, 7);
const clean = (s: string) => s.replace(/\r/g, '').replace(/\n+$/, '');

function sourceLabel(source: Source): string {
  if (source.kind === 'unstaged') return '워킹트리 unstaged';
  if (source.kind === 'staged') return '워킹트리 staged';
  return source.from === source.to ? `커밋 ${short(source.from)}` : `커밋 ${short(source.from)}..${short(source.to)}`;
}

function fence(code: string, path: string): string {
  const ext = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : '';
  // 발췌 안의 가장 긴 백틱 연속보다 길게
  const longest = Math.max(2, ...(code.match(/`+/g) ?? []).map((m) => m.length));
  const marks = '`'.repeat(longest + 1);
  return `${marks}${ext}\n${code}\n${marks}`;
}

function formatOne(c: ReviewComment, n: number): string {
  const t = c.target;
  const parts: string[] = [];
  if (t.kind === 'line') {
    const range = t.startLine === t.endLine ? `${t.startLine}` : `${t.startLine}-${t.endLine}`;
    parts.push(`### ${n}. ${t.path}:${range} (${sourceLabel(t.source)})`);
    if (t.side === 'old') parts.push('(삭제된 코드)');
    parts.push(fence(clean(t.excerpt), t.path));
  } else if (t.kind === 'file') {
    parts.push(`### ${n}. ${t.path} (파일 전체, ${sourceLabel(t.source)})`);
  } else {
    parts.push(`### ${n}. 커밋 ${short(t.sha)} "${t.subject}"`);
  }
  parts.push(clean(c.body));
  return parts.join('\n');
}

// 에이전트 입력창에 한 덩어리로 넣을 마크다운 메시지
export function formatFeedback(comments: ReviewComment[], ctx: { wt: string; branch: string | null }): string {
  const header = `## 코드 리뷰 피드백 (${ctx.branch ? `${ctx.branch}, ` : ''}${comments.length}건)`;
  return [header, ...comments.map((c, i) => formatOne(c, i + 1))].join('\n\n');
}
