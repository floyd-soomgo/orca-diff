import { readFile } from 'node:fs/promises';
import { isAbsolute, join, normalize, sep } from 'node:path';
import type { Change, ChangeStatus, FilePair, Source } from '../shared/types.ts';
import { git, gitOrNull } from './run.ts';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const MAX_BYTES = 1024 * 1024;

export class BadRequest extends Error {}

// rel이 wt 안쪽 상대경로인지 확인하고 절대경로를 반환한다
export function assertInside(wt: string, rel: string): string {
  if (isAbsolute(rel)) throw new BadRequest(`절대경로는 허용되지 않습니다: ${rel}`);
  const root = normalize(wt);
  const abs = normalize(join(root, rel));
  if (abs !== root && !abs.startsWith(root.endsWith(sep) ? root : root + sep)) {
    throw new BadRequest(`워크트리 밖 경로입니다: ${rel}`);
  }
  return abs;
}

async function parentOf(wt: string, sha: string): Promise<string> {
  const parent = await gitOrNull(wt, ['rev-parse', '--verify', '--quiet', `${sha}^`]);
  return parent?.trim() || EMPTY_TREE;
}

// diff 계열 명령에 넘길 범위 인자
async function diffArgs(wt: string, source: Source): Promise<string[]> {
  if (source.kind === 'unstaged') return [];
  if (source.kind === 'staged') return ['--cached'];
  return [await parentOf(wt, source.from), source.to];
}

function parseNameStatus(out: string): Omit<Change, 'binary'>[] {
  const parts = out.split('\0');
  const result: Omit<Change, 'binary'>[] = [];
  for (let i = 0; i < parts.length - 1; ) {
    const code = parts[i++];
    if (!code) continue;
    const letter = code[0];
    if (letter === 'R' || letter === 'C') {
      const oldPath = parts[i++];
      const path = parts[i++];
      // 복사(C)는 새 파일 추가로 취급한다
      result.push(letter === 'R' ? { path, oldPath, status: 'R' } : { path, status: 'A' });
    } else {
      const path = parts[i++];
      const status: ChangeStatus = letter === 'A' || letter === 'D' ? letter : 'M';
      result.push({ path, status });
    }
  }
  return result;
}

// numstat -z에서 바이너리('-\t-') 경로 집합을 만든다
function parseBinaryPaths(out: string): Set<string> {
  const parts = out.split('\0');
  const binary = new Set<string>();
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i];
    if (!rec) continue;
    const [added, deleted, path] = rec.split('\t');
    const isBinary = added === '-' && deleted === '-';
    if (path === '') {
      // 이름 변경: 다음 두 토큰이 old, new
      const newPath = parts[i + 2];
      i += 2;
      if (isBinary) binary.add(newPath);
    } else if (isBinary) {
      binary.add(path);
    }
  }
  return binary;
}

function looksBinary(buf: Buffer): boolean {
  return buf.subarray(0, 8000).includes(0);
}

export async function listChanges(wt: string, source: Source): Promise<Change[]> {
  const range = await diffArgs(wt, source);
  const [nameStatus, numstat] = await Promise.all([
    git(wt, ['diff', '--name-status', '-z', '-M', ...range]),
    git(wt, ['diff', '--numstat', '-z', '-M', ...range]),
  ]);
  const binary = parseBinaryPaths(numstat);
  const changes: Change[] = parseNameStatus(nameStatus).map((c) => ({ ...c, binary: binary.has(c.path) }));

  if (source.kind === 'unstaged') {
    const untracked = (await git(wt, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean);
    const extra = await Promise.all(
      untracked.map(async (path): Promise<Change> => {
        const buf = await readFile(join(wt, path)).catch(() => Buffer.alloc(0));
        return { path, status: 'A', binary: looksBinary(buf) };
      }),
    );
    changes.push(...extra);
  }
  return changes;
}

async function readBlob(wt: string, spec: string): Promise<string> {
  return (await gitOrNull(wt, ['cat-file', 'blob', spec])) ?? '';
}

export async function readFilePair(wt: string, source: Source, change: Change): Promise<FilePair> {
  if (change.binary) return { original: '', modified: '', tooLarge: false, binary: true };
  const oldPath = change.oldPath ?? change.path;
  const hasOriginal = change.status !== 'A';
  const hasModified = change.status !== 'D';

  let original = '';
  let modified = '';
  if (source.kind === 'unstaged') {
    if (hasOriginal) original = await readBlob(wt, `:${oldPath}`);
    if (hasModified) modified = await readFile(assertInside(wt, change.path), 'utf8').catch(() => '');
  } else if (source.kind === 'staged') {
    if (hasOriginal) original = await readBlob(wt, `HEAD:${oldPath}`);
    if (hasModified) modified = await readBlob(wt, `:${change.path}`);
  } else {
    if (hasOriginal) original = await readBlob(wt, `${await parentOf(wt, source.from)}:${oldPath}`);
    if (hasModified) modified = await readBlob(wt, `${source.to}:${change.path}`);
  }

  if (Buffer.byteLength(original) > MAX_BYTES || Buffer.byteLength(modified) > MAX_BYTES) {
    return { original: '', modified: '', tooLarge: true, binary: false };
  }
  return { original, modified, tooLarge: false, binary: false };
}
