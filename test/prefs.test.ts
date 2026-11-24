import { mkdtemp } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createApp } from '../server/http/app.ts';
import { prefsRoutes } from '../server/prefs.ts';
import { gitFixture } from './helpers/gitFixture.ts';

const KEY = 'd'.repeat(64);
let base = '';
let wt = '';
let dir = '';
let close: () => void;

beforeAll(async () => {
  const fx = await gitFixture();
  await fx.commit({ 'a.ts': '1' }, 'init');
  wt = fx.dir;
  dir = await mkdtemp(join(tmpdir(), 'prefs-'));
  const server = createApp({ key: KEY, staticDir: null, routes: prefsRoutes(dir) });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

const post = (body: object) => fetch(`${base}/api/prefs?key=${KEY}`, { method: 'POST', body: JSON.stringify({ wt, ...body }) });
const getAll = async () => (await fetch(`${base}/api/prefs?key=${KEY}&wt=${encodeURIComponent(wt)}`)).json();

describe('UI 설정 저장', () => {
  test('저장한 값이 파일에 남아 새 서버에서도 읽힌다', async () => {
    expect(await getAll()).toEqual({});
    expect((await post({ key: 'size.left', value: 420 })).status).toBe(200);
    expect((await post({ key: 'font', value: { family: 'Fira Code', size: 15 } })).status).toBe(200);
    expect(await getAll()).toEqual({ 'size.left': 420, font: { family: 'Fira Code', size: 15 } });

    const other = createApp({ key: KEY, staticDir: null, routes: prefsRoutes(dir) });
    await new Promise<void>((r) => other.listen(0, '127.0.0.1', r));
    const res = await fetch(`http://127.0.0.1:${(other.address() as AddressInfo).port}/api/prefs?key=${KEY}&wt=${encodeURIComponent(wt)}`);
    expect(await res.json()).toMatchObject({ 'size.left': 420 });
    other.close();
  });

  test('잘못된 키는 400', async () => {
    expect((await post({ key: '../x', value: 1 })).status).toBe(400);
    expect((await post({ value: 1 })).status).toBe(400);
  });
});
