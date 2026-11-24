import type { Commit } from '../shared/types.ts';
import { git, gitOrNull } from './run.ts';

const LOG_FORMAT = '%H%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%b%x1e';

export async function listCommits(
  wt: string,
  opts: { ref: string; base?: string | null; skip: number; limit: number },
): Promise<Commit[]> {
  const range = opts.base ? `${opts.base}..${opts.ref}` : opts.ref;
  const out = await git(wt, [
    'log',
    `--format=${LOG_FORMAT}`,
    `--skip=${opts.skip}`,
    `--max-count=${opts.limit}`,
    '--end-of-options',
    range,
    '--',
  ]);
  return out
    .split('\x1e')
    .map((r) => r.replace(/^\n/, ''))
    .filter((r) => r.length > 0)
    .map((r) => {
      const [sha, author, email, time, subject, body] = r.split('\x1f');
      return { sha, author, email, time: Number(time), subject, body: body.trim() };
    });
}

export async function listBranches(wt: string): Promise<{ current: string | null; local: string[]; remote: string[] }> {
  const [cur, refs] = await Promise.all([
    gitOrNull(wt, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
    git(wt, ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes']),
  ]);
  const local: string[] = [];
  const remote: string[] = [];
  for (const ref of refs.split('\n').filter(Boolean)) {
    if (ref.startsWith('refs/heads/')) local.push(ref.slice('refs/heads/'.length));
    else if (!ref.endsWith('/HEAD')) remote.push(ref.slice('refs/remotes/'.length));
  }
  return { current: cur?.trim() || null, local, remote };
}

export async function listWorktrees(wt: string): Promise<{ path: string; branch: string | null }[]> {
  const out = await git(wt, ['worktree', 'list', '--porcelain']);
  return out
    .split('\n\n')
    .filter((block) => block.startsWith('worktree '))
    .map((block) => {
      const lines = block.split('\n');
      const path = lines[0].slice('worktree '.length);
      const branchLine = lines.find((l) => l.startsWith('branch '));
      return { path, branch: branchLine ? branchLine.slice('branch refs/heads/'.length) : null };
    });
}

const BASE_CANDIDATES = ['origin/main', 'origin/master', 'main', 'master'];

export async function resolveBaseRef(wt: string): Promise<string | null> {
  const originHead = await gitOrNull(wt, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (originHead?.trim()) return originHead.trim();
  for (const ref of BASE_CANDIDATES) {
    if (await gitOrNull(wt, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) return ref;
  }
  return null;
}
