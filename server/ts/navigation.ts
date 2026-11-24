import { readFile, realpath } from 'node:fs/promises';
import { extname, relative } from 'node:path';
import { assertInside, BadRequest } from '../git/changes.ts';
import type { Location } from '../shared/types.ts';
import { TsServer } from './tsserver.ts';

export type NavQuery = { path: string; line: number; column: number; content?: string };

const TS_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);

interface Pos { line: number; offset: number }
interface FileSpan { file: string; start: Pos; end: Pos }
interface RefEntry extends FileSpan { lineText?: string; isDefinition?: boolean }

function validate(wt: string, q: NavQuery): string {
  if (!TS_EXT.has(extname(q.path).toLowerCase())) throw new BadRequest('TS/JS 파일만 탐색할 수 있습니다');
  if (!Number.isInteger(q.line) || !Number.isInteger(q.column) || q.line < 1 || q.column < 1) {
    throw new BadRequest('잘못된 위치입니다');
  }
  return assertInside(wt, q.path);
}

// 질의 파일을 주어진 내용(없으면 디스크 내용)으로 열어 두고 fn을 실행한다
async function withOpenFile<T>(wt: string, q: NavQuery, fn: (server: TsServer, file: string) => Promise<T>): Promise<T> {
  const file = validate(wt, q);
  const server = TsServer.forWorktree(wt);
  return server.exclusive(async () => {
    const fileContent = q.content ?? (await readFile(file, 'utf8'));
    await server.request('updateOpen', { openFiles: [{ file, fileContent, projectRootPath: wt }] });
    try {
      return await fn(server, file);
    } finally {
      // 열어 둔 내용이 남으면 이후 다른 파일 질의가 옛 내용을 기준으로 답한다
      await server.request('updateOpen', { closedFiles: [file] }).catch(() => undefined);
    }
  });
}

async function toLocations(wt: string, spans: RefEntry[], override: { file: string; content?: string }): Promise<Location[]> {
  const root = await realpath(wt);
  const cache = new Map<string, string[]>();
  const lineOf = async (file: string, line: number) => {
    if (!cache.has(file)) {
      const text = file === override.file && override.content !== undefined ? override.content : await readFile(file, 'utf8').catch(() => '');
      cache.set(file, text.split('\n'));
    }
    return cache.get(file)![line - 1] ?? '';
  };
  const result: Location[] = [];
  for (const s of spans) {
    const rel = relative(root, await realpath(s.file).catch(() => s.file));
    // 워크트리 밖(타입 정의 라이브러리 등)은 제외한다
    if (rel.startsWith('..')) continue;
    result.push({ path: rel, line: s.start.line, column: s.start.offset, preview: (s.lineText ?? (await lineOf(s.file, s.start.line))).trim() });
  }
  return result;
}

export function definition(wt: string, q: NavQuery): Promise<Location[]> {
  return withOpenFile(wt, q, async (server, file) => {
    const spans = await server.request<FileSpan[]>('definition', { file, line: q.line, offset: q.column });
    return toLocations(wt, spans ?? [], { file, content: q.content });
  });
}

const contains = (s: FileSpan, line: number, col: number) =>
  (s.start.line < line || (s.start.line === line && s.start.offset <= col)) &&
  (s.end.line > line || (s.end.line === line && s.end.offset >= col));

export function references(wt: string, q: NavQuery): Promise<Location[]> {
  return withOpenFile(wt, q, async (server, file) => {
    const body = await server.request<{ refs: RefEntry[] }>('references', { file, line: q.line, offset: q.column });
    // 질의한 선언 자체만 제외한다(import 등 다른 정의성 참조는 사용처로 남긴다)
    const refs = (body?.refs ?? []).filter((r) => !(r.isDefinition && r.file === file && contains(r, q.line, q.column)));
    return toLocations(wt, refs, { file, content: q.content });
  });
}
