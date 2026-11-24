import { execFile } from 'node:child_process';

export class GitError extends Error {
  code: number | null;
  stderr: string;
  constructor(code: number | null, stderr: string) {
    super(stderr.split('\n')[0] || `git exited with ${code}`);
    this.code = code;
    this.stderr = stderr;
  }
}

// 인자 배열로만 git을 실행한다(셸 미사용). 한글 경로가 이스케이프되지 않게 quotePath를 끈다.
export function git(cwd: string, args: string[], opts: { maxBuffer?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-c', 'core.quotePath=false', ...args],
      { cwd, maxBuffer: opts.maxBuffer ?? 64 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (err) {
          const code = typeof err.code === 'number' ? err.code : null;
          reject(new GitError(code, stderr || err.message));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

// 실패를 null로 바꾸는 조회용 헬퍼(ref 존재 확인 등)
export async function gitOrNull(cwd: string, args: string[]): Promise<string | null> {
  try {
    return await git(cwd, args);
  } catch (e) {
    if (e instanceof GitError) return null;
    throw e;
  }
}
