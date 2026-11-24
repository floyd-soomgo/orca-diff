import { describe, expect, test } from 'vitest';
import { assertInside, listChanges, readFilePair, readPatch } from '../server/git/changes.ts';
import { gitFixture } from './helpers/gitFixture.ts';

const byPath = <T extends { path: string }>(xs: T[]) => [...xs].sort((a, b) => a.path.localeCompare(b.path));

describe('listChanges', () => {
  test('unstaged: 수정 파일과 untracked(한글·공백 경로)를 포함한다', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'a.ts': '1' }, 'init');
    await fx.write({ 'a.ts': '2', '새 파일 이름.ts': 'x' });

    expect(byPath(await listChanges(fx.dir, { kind: 'unstaged' }))).toEqual([
      { path: 'a.ts', status: 'M', binary: false },
      { path: '새 파일 이름.ts', status: 'A', binary: false },
    ]);
  });

  test('staged: add된 파일만 나온다', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'a.ts': '1', 'b.ts': '1' }, 'init');
    await fx.write({ 'a.ts': '2', 'b.ts': '2' });
    await fx.run(['add', 'a.ts']);
    expect(await listChanges(fx.dir, { kind: 'staged' })).toEqual([{ path: 'a.ts', status: 'M', binary: false }]);
  });

  test('단일 커밋: 추가/삭제/이름변경', async () => {
    const fx = await gitFixture();
    const body = 'export const value = 1;\n'.repeat(20);
    await fx.commit({ 'del.ts': 'bye', 'a.ts': body }, 'init');
    const sha = await fx.commit({ 'new.ts': 'hi', 'del.ts': null, 'a.ts': null, 'b.ts': body }, 'change');

    expect(byPath(await listChanges(fx.dir, { kind: 'commits', from: sha, to: sha }))).toEqual([
      { path: 'b.ts', oldPath: 'a.ts', status: 'R', binary: false },
      { path: 'del.ts', status: 'D', binary: false },
      { path: 'new.ts', status: 'A', binary: false },
    ]);
  });

  test('커밋 범위: from~to 변경의 합', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'one.ts': '1' }, 'c1');
    const c2 = await fx.commit({ 'two.ts': '2' }, 'c2');
    await fx.commit({ 'three.ts': '3' }, 'c3');
    const c4 = await fx.commit({ 'four.ts': '4' }, 'c4');
    await fx.commit({ 'five.ts': '5' }, 'c5');

    const paths = (await listChanges(fx.dir, { kind: 'commits', from: c2, to: c4 })).map((c) => c.path).sort();
    expect(paths).toEqual(['four.ts', 'three.ts', 'two.ts']);
  });

  test('루트 커밋 단일: 모든 파일이 추가', async () => {
    const fx = await gitFixture();
    const root = await fx.commit({ 'a.ts': '1', 'b.ts': '2' }, 'root');
    expect((await listChanges(fx.dir, { kind: 'commits', from: root, to: root })).map((c) => c.status)).toEqual(['A', 'A']);
  });

  test('바이너리 파일을 표시한다', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'a.ts': '1' }, 'init');
    const sha = await fx.commit({ 'img.bin': 'a\0b\0c' }, 'bin');
    expect(await listChanges(fx.dir, { kind: 'commits', from: sha, to: sha })).toEqual([
      { path: 'img.bin', status: 'A', binary: true },
    ]);
  });
});

describe('readFilePair', () => {
  test('스테이징한 이미지와 작업 파일의 바이트를 따로 보존한다', async () => {
    const fx = await gitFixture();
    const { writeFile } = await import('node:fs/promises');
    const path = fx.dir + '/icon.png';
    await writeFile(path, Buffer.from([137, 80, 78, 71, 0, 255]));
    await fx.run(['add', 'icon.png']);
    await writeFile(path, Buffer.from([137, 80, 78, 71, 0, 254]));
    const pair = await readFilePair(fx.dir, { kind: 'unstaged' }, { path: 'icon.png', status: 'M', binary: true });
    expect(pair.original).toBe('data:image/png;base64,iVBORwD/');
    expect(pair.modified).toBe('data:image/png;base64,iVBORwD+');
  });

  test('삭제·추가·이름변경 커밋의 양쪽 내용', async () => {
    const fx = await gitFixture();
    const body = 'export const value = 1;\n'.repeat(20);
    await fx.commit({ 'del.ts': 'bye', 'a.ts': body }, 'init');
    const sha = await fx.commit({ 'new.ts': 'hi', 'del.ts': null, 'a.ts': null, 'b.ts': body + 'x\n' }, 'change');
    const source = { kind: 'commits', from: sha, to: sha } as const;

    expect(await readFilePair(fx.dir, source, { path: 'del.ts', status: 'D', binary: false })).toEqual({
      original: 'bye', modified: '', tooLarge: false, binary: false,
    });
    expect(await readFilePair(fx.dir, source, { path: 'new.ts', status: 'A', binary: false })).toMatchObject({
      original: '', modified: 'hi',
    });
    expect(await readFilePair(fx.dir, source, { path: 'b.ts', oldPath: 'a.ts', status: 'R', binary: false })).toMatchObject({
      original: body, modified: body + 'x\n',
    });
  });

  test('unstaged: 인덱스 대 디스크, untracked는 원본이 빈 문자열', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'a.ts': 'old' }, 'init');
    await fx.write({ 'a.ts': 'new', 'u.ts': 'untracked' });
    expect(await readFilePair(fx.dir, { kind: 'unstaged' }, { path: 'a.ts', status: 'M', binary: false })).toMatchObject({
      original: 'old', modified: 'new',
    });
    expect(await readFilePair(fx.dir, { kind: 'unstaged' }, { path: 'u.ts', status: 'A', binary: false })).toMatchObject({
      original: '', modified: 'untracked',
    });
  });

  test('staged: HEAD 대 인덱스', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'a.ts': 'head' }, 'init');
    await fx.write({ 'a.ts': 'index' });
    await fx.run(['add', 'a.ts']);
    await fx.write({ 'a.ts': 'disk' });
    expect(await readFilePair(fx.dir, { kind: 'staged' }, { path: 'a.ts', status: 'M', binary: false })).toMatchObject({
      original: 'head', modified: 'index',
    });
  });

  test('1 MiB 초과 파일은 tooLarge이고 내용을 비운다', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'a.ts': '1' }, 'init');
    const sha = await fx.commit({ 'big.ts': 'x'.repeat(1024 * 1024 + 1) }, 'big');
    expect(await readFilePair(fx.dir, { kind: 'commits', from: sha, to: sha }, { path: 'big.ts', status: 'A', binary: false })).toEqual({
      original: '', modified: '', tooLarge: true, binary: false,
    });
  });

  test('binary 변경은 내용을 읽지 않는다', async () => {
    const fx = await gitFixture();
    const sha = await fx.commit({ 'img.bin': 'a\0b' }, 'bin');
    expect(await readFilePair(fx.dir, { kind: 'commits', from: sha, to: sha }, { path: 'img.bin', status: 'A', binary: true })).toEqual({
      original: '', modified: '', tooLarge: false, binary: true,
    });
  });
});

describe('assertInside', () => {
  test('워크트리 밖이나 절대경로를 거부한다', () => {
    expect(() => assertInside('/repo', '../x')).toThrow();
    expect(() => assertInside('/repo', 'a/../../x')).toThrow();
    expect(() => assertInside('/repo', '/etc/passwd')).toThrow();
    expect(assertInside('/repo', 'src/a.ts')).toBe('/repo/src/a.ts');
  });
});

describe('readPatch', () => {
  test('큰 파일은 변경된 부분만 담은 패치를 돌려준다', async () => {
    const fx = await gitFixture();
    const lines = Array.from({ length: 60000 }, (_, i) => `line ${i}`);
    await fx.commit({ 'big.json': lines.join('\n') + '\n' }, 'init');
    lines[30000] = 'changed line';
    const sha = await fx.commit({ 'big.json': lines.join('\n') + '\n' }, 'change');

    const { patch, truncated } = await readPatch(fx.dir, { kind: 'commits', from: sha, to: sha }, { path: 'big.json', status: 'M', binary: false });
    expect(truncated).toBe(false);
    expect(patch).toContain('@@');
    expect(patch).toContain('-line 30000');
    expect(patch).toContain('+changed line');
    expect(patch.length).toBeLessThan(2000);
  });

  test('unstaged 수정도 패치로 읽는다', async () => {
    const fx = await gitFixture();
    await fx.commit({ 'a.txt': 'old\n' }, 'init');
    await fx.write({ 'a.txt': 'new\n' });
    const { patch } = await readPatch(fx.dir, { kind: 'unstaged' }, { path: 'a.txt', status: 'M', binary: false });
    expect(patch).toContain('-old');
    expect(patch).toContain('+new');
  });
});
