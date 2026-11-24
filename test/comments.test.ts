import { mkdtemp } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { commentsRoutes } from '../server/comments.ts';
import { createApp } from '../server/http/app.ts';
import { gitFixture } from './helpers/gitFixture.ts';

const KEY = 'e'.repeat(64);
let base = '';
let wtA = '';
let wtB = '';
let dir = '';
let close: () => void;

const listen = async (d: string) => {
  const server = createApp({ key: KEY, staticDir: null, routes: commentsRoutes(d) });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
};

beforeAll(async () => {
  for (const name of ['a', 'b']) {
    const fx = await gitFixture();
    await fx.commit({ [`${name}.ts`]: '1' }, 'init');
    if (name === 'a') wtA = fx.dir;
    else wtB = fx.dir;
  }
  dir = await mkdtemp(join(tmpdir(), 'comments-'));
  const { server, url } = await listen(dir);
  base = url;
  close = () => server.close();
});
afterAll(() => close());

const save = (wt: string, comments: unknown) =>
  fetch(`${base}/api/comments?key=${KEY}`, { method: 'POST', body: JSON.stringify({ wt, comments }) });
const load = async (url: string, wt: string) => (await fetch(`${url}/api/comments?key=${KEY}&wt=${encodeURIComponent(wt)}`)).json();

describe('코멘트 저장', () => {
  test('워크트리별로 저장되고 새 서버에서도 읽힌다', async () => {
    expect(await load(base, wtA)).toEqual([]);
    const comment = { id: '1', body: '확인', target: { kind: 'commit', sha: 'abc', subject: 's' }, createdAt: 1, sentAt: null, stale: false };
    expect((await save(wtA, [comment])).status).toBe(200);
    expect(await load(base, wtA)).toEqual([comment]);
    expect(await load(base, wtB)).toEqual([]);

    const other = await listen(dir);
    expect(await load(other.url, wtA)).toEqual([comment]);
    other.server.close();
  });

  test('배열이 아니면 400', async () => {
    expect((await save(wtA, { nope: true })).status).toBe(400);
  });
});
