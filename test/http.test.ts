import { mkdir } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createApp } from '../server/http/app.ts';
import { gitFixture, type GitFixture } from './helpers/gitFixture.ts';

const KEY = 'a'.repeat(64);
let base = '';
let fx: GitFixture;
let close: () => void;

beforeAll(async () => {
  fx = await gitFixture();
  await fx.commit({ 'a.ts': '1' }, 'c1');
  await fx.commit({ 'a.ts': '2' }, 'c2');
  await mkdir(join(fx.dir, 'sub'));
  const server = createApp({ key: KEY, staticDir: null });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

const get = (path: string, params: Record<string, string>) =>
  fetch(`${base}${path}?${new URLSearchParams(params)}`);

describe('인증', () => {
  test('키가 없거나 틀리면 401', async () => {
    expect((await get('/api/health', {})).status).toBe(401);
    expect((await get('/api/health', { key: 'b'.repeat(64) })).status).toBe(401);
    expect((await get('/api/health', { key: KEY })).status).toBe(200);
  });
});

describe('wt 검증', () => {
  test('최상위가 아닌 하위 디렉터리나 없는 경로는 400', async () => {
    expect((await get('/api/commits', { key: KEY, wt: join(fx.dir, 'sub') })).status).toBe(400);
    expect((await get('/api/commits', { key: KEY, wt: '/no/such/dir' })).status).toBe(400);
    expect((await get('/api/commits', { key: KEY })).status).toBe(400);
  });

  test('워크트리 밖 path는 400', async () => {
    expect((await get('/api/file', { key: KEY, wt: fx.dir, path: '../secret' })).status).toBe(400);
  });
});

describe('라우트', () => {
  test('/api/commits는 커밋 배열을 반환한다', async () => {
    const res = await get('/api/commits', { key: KEY, wt: fx.dir, ref: 'main' });
    expect(res.status).toBe(200);
    expect((await res.json()).map((c: { subject: string }) => c.subject)).toEqual(['c2', 'c1']);
  });

  test('/api/changes는 Source JSON을 받는다', async () => {
    await fx.write({ 'a.ts': '3' });
    const res = await get('/api/changes', { key: KEY, wt: fx.dir, source: JSON.stringify({ kind: 'unstaged' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ path: 'a.ts', status: 'M', binary: false }]);
  });

  test('/api/file-pair와 /api/file', async () => {
    const pair = await get('/api/file-pair', {
      key: KEY, wt: fx.dir, source: JSON.stringify({ kind: 'unstaged' }), path: 'a.ts', status: 'M',
    });
    expect(await pair.json()).toMatchObject({ original: '2', modified: '3' });
    const file = await get('/api/file', { key: KEY, wt: fx.dir, path: 'a.ts' });
    expect(await file.json()).toEqual({ content: '3' });
  });

  test('잘못된 source는 400, git 실패는 500', async () => {
    expect((await get('/api/changes', { key: KEY, wt: fx.dir, source: '{"kind":"nope"}' })).status).toBe(400);
    expect((await get('/api/commits', { key: KEY, wt: fx.dir, ref: 'no-such-branch' })).status).toBe(500);
  });

  test('/api/definition은 POST 본문을 받고 비TS 파일은 400', async () => {
    const post = (body: object) =>
      fetch(`${base}/api/definition?key=${KEY}`, { method: 'POST', body: JSON.stringify({ wt: fx.dir, ...body }) });
    expect((await post({ path: 'Main.kt', line: 1, column: 1 })).status).toBe(400);
    const res = await post({ path: 'a.ts', line: 1, column: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('/api/branches는 base를 포함한다', async () => {
    const res = await get('/api/branches', { key: KEY, wt: fx.dir });
    expect(await res.json()).toMatchObject({ current: 'main', local: ['main'], base: 'main' });
  });
});
