import { spawn } from 'node:child_process';
import { BadRequest } from './git/changes.ts';
import type { Location } from './shared/types.ts';

export interface SearchQuery {
  query: string;
  caseSensitive: boolean;
  regex: boolean;
  wholeWord: boolean;
}

export interface SearchResult {
  locations: Location[];
  truncated: boolean;
}

const MAX_RESULTS = 2000;
const MAX_PREVIEW = 300;

// git grep의 --column은 바이트 위치(1부터)라서 글자 위치로 바꿉니다
function charColumn(text: string, byteColumn: number): number {
  return Buffer.from(text, 'utf8').subarray(0, byteColumn - 1).toString('utf8').length + 1;
}

// "경로\0줄\0열\0본문" 한 줄을 Location으로 바꿉니다
function parseLine(line: string): Location | null {
  const parts = line.split('\0');
  if (parts.length < 4) return null;
  const [path, lineNo, byteColumn] = parts;
  const text = parts.slice(3).join('\0');
  const column = charColumn(text, Number(byteColumn));
  // 긴 줄(번들·minified)은 일치 위치 근처만 미리보기로 남깁니다
  const start = column - 1 > MAX_PREVIEW / 2 ? column - 1 - MAX_PREVIEW / 2 : 0;
  const preview = text.slice(start, start + MAX_PREVIEW).trim();
  return { path, line: Number(lineNo), column, preview };
}

// 추적 중인 파일과 무시되지 않은 새 파일에서 텍스트를 찾습니다. 바이너리 파일은 건너뜁니다.
export function searchCode(wt: string, q: SearchQuery): Promise<SearchResult> {
  const args = ['-c', 'core.quotePath=false', 'grep', '-n', '--column', '-I', '-z', '--untracked', '--exclude-standard', '--no-color'];
  if (!q.caseSensitive) args.push('-i');
  if (q.wholeWord) args.push('-w');
  // -e 뒤에 두어 검색어가 -로 시작해도 옵션으로 해석되지 않게 합니다
  args.push(q.regex ? '-P' : '-F', '-e', q.query);

  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: wt });
    const locations: Location[] = [];
    let truncated = false;
    let rest = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (truncated) return;
      const lines = (rest + chunk).split('\n');
      rest = lines.pop() ?? '';
      for (const line of lines) {
        const loc = parseLine(line);
        if (!loc) continue;
        if (locations.length === MAX_RESULTS) {
          // 결과가 너무 많으면 더 읽지 않고 멈춥니다
          truncated = true;
          child.kill();
          return;
        }
        locations.push(loc);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      // 종료 코드 1은 일치 항목 없음입니다
      if (truncated || code === 0 || code === 1) return resolve({ locations, truncated });
      const message = stderr.split('\n')[0].replace(/^fatal: /, '') || `git grep 실패 (${code})`;
      reject(new BadRequest(q.regex ? `정규식 오류: ${message}` : message));
    });
  });
}
