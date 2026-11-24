import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface GitFixture {
  dir: string;
  commit(files: Record<string, string | null>, msg: string): Promise<string>;
  write(files: Record<string, string | null>): Promise<void>;
  run(args: string[]): Promise<string>;
}

// 테스트용 임시 git 저장소. files 값이 null이면 파일 삭제.
export async function gitFixture(branch = 'main'): Promise<GitFixture> {
  const dir = await mkdtemp(join(tmpdir(), 'orca-review-'));
  const run = async (args: string[]) =>
    (await exec('git', args, { cwd: dir, maxBuffer: 64 * 1024 * 1024 })).stdout;
  await run(['init', '-q', '-b', branch]);
  await run(['config', 'user.name', 'Tester']);
  await run(['config', 'user.email', 'tester@example.com']);
  await run(['config', 'commit.gpgsign', 'false']);

  const write = async (files: Record<string, string | null>) => {
    for (const [path, content] of Object.entries(files)) {
      const abs = join(dir, path);
      if (content === null) {
        await rm(abs, { force: true });
      } else {
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, content);
      }
    }
  };

  const commit = async (files: Record<string, string | null>, msg: string) => {
    await write(files);
    await run(['add', '-A']);
    await run(['commit', '-q', '--allow-empty', '-m', msg]);
    return (await run(['rev-parse', 'HEAD'])).trim();
  };

  return { dir, commit, write, run };
}
