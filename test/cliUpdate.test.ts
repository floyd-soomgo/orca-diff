import { execFile } from 'node:child_process';
import { readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { gitFixture, type GitFixture } from './helpers/gitFixture.ts';

const exec = promisify(execFile);
let installation: GitFixture;
let review: GitFixture;
let command: string;

beforeEach(async () => {
  installation = await gitFixture();
  review = await gitFixture();
  await installation.commit({
    'bin/orca-diff.ts': await readFile(new URL('../bin/orca-diff.ts', import.meta.url), 'utf8'),
    'server/config.ts': await readFile(new URL('../server/config.ts', import.meta.url), 'utf8'),
    'package.json': JSON.stringify({ type: 'module', scripts: { update: 'node -p "process.cwd()"' } }),
  }, '설치 클론 준비');
  await installation.run(['remote', 'add', 'origin', '.']);
  await installation.run(['fetch', 'origin']);
  await installation.run(['remote', 'set-head', 'origin', 'main']);
  await installation.run(['branch', '--set-upstream-to=origin/main']);
  command = join(review.dir, 'orca-diff');
  await symlink(join(installation.dir, 'bin/orca-diff.ts'), command);
});

afterEach(async () => {
  await Promise.all([installation, review].map(({ dir }) => rm(dir, { recursive: true, force: true })));
});

const update = () => exec(process.execPath, [command, '--update'], { cwd: review.dir });

test('다른 저장소에서 실행해도 설치 클론을 업데이트한다', async () => {
  const { stdout } = await update();
  const root = (await installation.run(['rev-parse', '--show-toplevel'])).trim();
  expect(stdout.trim().split('\n').at(-1)).toBe(root);
});

test('설치 클론에 로컬 변경이 있으면 업데이트를 중단한다', async () => {
  await installation.write({ 'draft.txt': '작업 중' });
  await expect(update()).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('로컬 변경') });
});

test('설치 클론이 기본 브랜치가 아니면 업데이트를 중단한다', async () => {
  await installation.run(['switch', '-c', 'feature', '--track', 'origin/main']);
  await expect(update()).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('기본 브랜치') });
});
