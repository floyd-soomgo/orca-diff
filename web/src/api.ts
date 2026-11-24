import type { Change, Commit, FilePair, Location, Source, Terminal } from '../../server/shared/types.ts';
import type { ReviewComment } from './feedback/model.ts';

const params = new URLSearchParams(location.search);
export const KEY = params.get('key') ?? '';
export const WT = params.get('wt') ?? '';

async function request<T>(method: 'GET' | 'POST', path: string, query: Record<string, string> = {}, body?: object): Promise<T> {
  const qs = new URLSearchParams({ key: KEY, ...(method === 'GET' ? { wt: WT } : {}), ...query });
  const res = await fetch(`${path}?${qs}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify({ wt: WT, ...body }) : undefined,
  });
  const data = await res.json().catch(() => ({ error: `응답을 읽을 수 없습니다 (${res.status})` }));
  if (!res.ok) throw new Error(data?.error ?? `요청 실패 (${res.status})`);
  return data as T;
}

export interface Branches { current: string | null; local: string[]; remote: string[]; base: string | null }
export type NavQuery = { path: string; line: number; column: number; content?: string };

export const getWorktrees = () => request<{ path: string; branch: string | null }[]>('GET', '/api/worktrees');
export const getBranches = () => request<Branches>('GET', '/api/branches');
export const getCommits = (q: { ref: string; base: string | null; skip: number; limit: number }) =>
  request<Commit[]>('GET', '/api/commits', {
    ref: q.ref,
    skip: String(q.skip),
    limit: String(q.limit),
    ...(q.base ? { base: q.base } : {}),
  });
export const getChanges = (source: Source) => request<Change[]>('GET', '/api/changes', { source: JSON.stringify(source) });
export const getFilePair = (source: Source, change: Change) =>
  request<FilePair>('GET', '/api/file-pair', {
    source: JSON.stringify(source),
    path: change.path,
    status: change.status,
    binary: change.binary ? '1' : '0',
    ...(change.oldPath ? { oldPath: change.oldPath } : {}),
  });
export const getFile = (path: string) => request<{ content: string }>('GET', '/api/file', { path });
export const getDefinition = (q: NavQuery) => request<Location[]>('POST', '/api/definition', {}, q);
export const getReferences = (q: NavQuery) => request<Location[]>('POST', '/api/references', {}, q);
export const getOrca = () => request<{ available: boolean }>('GET', '/api/orca');
export const getTerminals = () => request<Terminal[]>('GET', '/api/terminals');
export const send = (handle: string, text: string) => request<{ ok: true }>('POST', '/api/send', {}, { handle, text });
export const getComments = () => request<ReviewComment[]>('GET', '/api/comments');
export const saveComments = (comments: ReviewComment[]) => request<{ ok: true }>('POST', '/api/comments', {}, { comments });
export const getPatch = (source: Source, change: Change) =>
  request<{ patch: string; truncated: boolean }>('GET', '/api/patch', {
    source: JSON.stringify(source),
    path: change.path,
    status: change.status,
    binary: change.binary ? '1' : '0',
    ...(change.oldPath ? { oldPath: change.oldPath } : {}),
  });
