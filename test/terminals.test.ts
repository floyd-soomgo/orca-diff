import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createApp } from '../server/http/app.ts';
import { listTerminals, orcaAvailable, orcaRoutes, sendFeedback } from '../server/orca/terminals.ts';
import { gitFixture, type GitFixture } from './helpers/gitFixture.ts';

let fakeDir = '';
let argsLog = '';
let fx: GitFixture;

// 인자를 NUL 구분으로 기록하고 terminal list에는 고정 JSON을 돌려주는 가짜 orca
beforeAll(async () => {
  fakeDir = await mkdtemp(join(tmpdir(), 'fake-orca-'));
  argsLog = join(fakeDir, 'args');
  const script = `#!/bin/sh
printf '%s\\0' "$@" > "${argsLog}"
if [ "$1" = "terminal" ] && [ "$2" = "list" ]; then
  echo '{"ok":true,"result":{"terminals":[{"handle":"term_1","title":"claude"},{"handle":"term_2","title":"zsh"}]}}'
fi
`;
  await writeFile(join(fakeDir, 'orca'), script);
  await chmod(join(fakeDir, 'orca'), 0o755);
  process.env.ORCA_BIN = join(fakeDir, 'orca');
  fx = await gitFixture();
  await fx.commit({ 'a.ts': '1' }, 'init');
});
afterAll(() => {
  delete process.env.ORCA_BIN;
});

const loggedArgs = async () => (await readFile(argsLog, 'utf8')).split('\0').slice(0, -1);

describe('orca 터미널', () => {
  test('listTerminals는 handle과 title을 돌려주고 path 셀렉터를 쓴다', async () => {
    expect(await listTerminals('/some/wt')).toEqual([
      { handle: 'term_1', title: 'claude' },
      { handle: 'term_2', title: 'zsh' },
    ]);
    expect(await loggedArgs()).toEqual(['terminal', 'list', '--worktree', 'path:/some/wt', '--json']);
  });

  test('orca가 워크트리를 모르면 빈 목록', async () => {
    const saved = process.env.ORCA_BIN;
    process.env.ORCA_BIN = '/usr/bin/false';
    expect(await listTerminals('/x')).toEqual([]);
    process.env.ORCA_BIN = saved;
  });


  test('sendFeedback는 --enter 없이 원문 그대로 보낸다', async () => {
    const text = '## 리뷰\n\n```ts\nconst a = "x";\n```\n코멘트 $HOME `id`';
    await sendFeedback('term_1', text);
    const args = await loggedArgs();
    expect(args).not.toContain('--enter');
    expect(args).toEqual(['terminal', 'send', '--terminal', 'term_1', '--text', text]);
  });

  test('sendFeedback에 submit을 주면 --enter를 붙인다', async () => {
    await sendFeedback('term_1', 'hi', true);
    expect(await loggedArgs()).toEqual(['terminal', 'send', '--terminal', 'term_1', '--text', 'hi', '--enter']);
  });

  test('ORCA_BIN이 없는 경로면 orcaAvailable은 false', async () => {
    const saved = process.env.ORCA_BIN;
    process.env.ORCA_BIN = '/no/such/orca';
    expect(await orcaAvailable()).toBe(false);
    process.env.ORCA_BIN = saved;
    expect(await orcaAvailable()).toBe(true);
  });

  test('host를 주면 리뷰 대상이 아니라 탭을 연 워크트리의 터미널을 찾는다', async () => {
    const KEY = 'd'.repeat(64);
    const host = await gitFixture();
    const server = createApp({ key: KEY, staticDir: null, routes: orcaRoutes });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/terminals?key=${KEY}`;
    try {
      const res = await fetch(`${base}&${new URLSearchParams({ wt: fx.dir, host: host.dir })}`);
      expect(res.status).toBe(200);
      const selector = (await loggedArgs())[3];
      expect(selector).toMatch(/^path:/);
      expect(selector.endsWith(host.dir.split('/').at(-1)!)).toBe(true);
      // host가 사라져도 터미널 기능만 막히고 리뷰 화면은 그대로 동작합니다
      const gone = new URLSearchParams({ wt: fx.dir, host: '/no/such' });
      expect((await fetch(`${base}&${gone}`)).status).toBe(400);
      expect((await fetch(`${base.replace('/api/terminals', '/api/worktree-files')}&${gone}`)).status).toBe(200);
    } finally {
      server.close();
    }
  });

  test('/api/send는 목록에 없는 handle을 400으로 거부한다', async () => {
    const KEY = 'c'.repeat(64);
    const server = createApp({ key: KEY, staticDir: null, routes: orcaRoutes });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/send?key=${KEY}`;
    const post = (handle: string) => fetch(url, { method: 'POST', body: JSON.stringify({ wt: fx.dir, handle, text: 'hi' }) });
    try {
      expect((await post('term_999')).status).toBe(400);
      expect((await post('term_1')).status).toBe(200);
    } finally {
      server.close();
    }
  });
});
