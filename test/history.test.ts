import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { listBranches, listCommits, listWorktrees, resolveBaseRef } from '../server/git/history.ts';
import { gitFixture } from './helpers/gitFixture.ts';

describe('listCommits', () => {
  test('최신순으로 메시지·작성자·시각·본문을 반환한다', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'a.ts': '1' }, 'first');
    await fx.commit({ 'a.ts': '2' }, 'second');
    await fx.commit({ 'a.ts': '3' }, 'third\n\nline one\nline two');

    const commits = await listCommits(fx.dir, { ref: 'main', skip: 0, limit: 50 });

    expect(commits.map((c) => c.subject)).toEqual(['third', 'second', 'first']);
    expect(commits[0].body).toBe('line one\nline two');
    expect(commits[0].author).toBe('Tester');
    expect(commits[0].email).toBe('tester@example.com');
    expect(commits[0].sha).toMatch(/^[0-9a-f]{40}$/);
    expect(Math.abs(commits[0].time - Date.now() / 1000)).toBeLessThan(120);
  });

  test('base가 있으면 base 이후 커밋만 반환한다', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'a.ts': '1' }, 'base');
    await fx.run(['checkout', '-q', '-b', 'feat']);
    await fx.commit({ 'b.ts': '1' }, 'f1');
    await fx.commit({ 'b.ts': '2' }, 'f2');

    expect((await listCommits(fx.dir, { ref: 'feat', base: 'main', skip: 0, limit: 50 })).map((c) => c.subject)).toEqual(['f2', 'f1']);
    expect(await listCommits(fx.dir, { ref: 'main', base: 'main', skip: 0, limit: 50 })).toEqual([]);
  });

  test('skip/limit으로 페이지를 나눈다', async () => {
    const fx = await gitFixture();
    for (const n of ['1', '2', '3']) await fx.commit({ 'a.ts': n }, `c${n}`);
    expect((await listCommits(fx.dir, { ref: 'main', skip: 1, limit: 1 })).map((c) => c.subject)).toEqual(['c2']);
  });
});

describe('resolveBaseRef', () => {
  test('원격이 없고 main만 있으면 main', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'a.ts': '1' }, 'init');
    expect(await resolveBaseRef(fx.dir)).toBe('main');
  });

  test('후보 브랜치가 없으면 null', async () => {
    const fx = await gitFixture('trunk');
    await fx.commit({ 'a.ts': '1' }, 'init');
    expect(await resolveBaseRef(fx.dir)).toBeNull();
  });

  test('origin/HEAD가 가리키는 브랜치를 우선한다', async () => {
    const remote = await gitFixture('develop');
    await remote.commit({ 'a.ts': '1' }, 'init');
    const fx = await gitFixture();
    await fx.commit({ 'a.ts': '1' }, 'init');
    await fx.run(['remote', 'add', 'origin', remote.dir]);
    await fx.run(['fetch', '-q', 'origin']);
    await fx.run(['remote', 'set-head', 'origin', 'develop']);
    expect(await resolveBaseRef(fx.dir)).toBe('origin/develop');
  });
});

describe('listBranches', () => {
  test('current는 체크아웃 브랜치이고 로컬 목록을 포함한다', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'a.ts': '1' }, 'init');
    await fx.run(['branch', 'other']);
    const b = await listBranches(fx.dir);
    expect(b.current).toBe('main');
    expect(b.local.sort()).toEqual(['main', 'other']);
    expect(b.remote).toEqual([]);
  });
});

describe('listWorktrees', () => {
  test('추가 워크트리 경로와 브랜치를 포함한다', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'a.ts': '1' }, 'init');
    const extra = join(await realpath(tmpdir()), `orca-review-wt-${Date.now()}`);
    await fx.run(['worktree', 'add', '-q', '-b', 'wt-branch', extra]);
    const list = await listWorktrees(fx.dir);
    expect(list).toContainEqual({ path: extra, branch: 'wt-branch' });
    expect(list).toContainEqual({ path: await realpath(fx.dir), branch: 'main' });
  });
});
