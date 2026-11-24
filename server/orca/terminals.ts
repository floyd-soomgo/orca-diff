import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BadRequest } from '../git/changes.ts';
import type { Routes } from '../http/app.ts';
import type { Terminal } from '../shared/types.ts';

const exec = promisify(execFile);
const orcaBin = () => process.env.ORCA_BIN ?? 'orca';

async function orca(args: string[]): Promise<string> {
  return (await exec(orcaBin(), args, { maxBuffer: 16 * 1024 * 1024 })).stdout;
}

export async function orcaAvailable(): Promise<boolean> {
  try {
    await orca(['--help']);
    return true;
  } catch {
    return false;
  }
}

export async function listTerminals(wt: string): Promise<Terminal[]> {
  const out = JSON.parse(await orca(['terminal', 'list', '--worktree', `path:${wt}`, '--json']));
  const terminals: { handle: string; title?: string }[] = out?.result?.terminals ?? [];
  return terminals.map((t) => ({ handle: t.handle, title: t.title ?? t.handle }));
}

// 입력창에 넣기만 한다. 제출(Enter)은 사용자가 한다 — 절대 --enter를 붙이지 않는다.
// 여러 줄 텍스트는 한 덩어리 초안으로 들어간다.
export async function sendFeedback(handle: string, text: string): Promise<void> {
  await orca(['terminal', 'send', '--terminal', handle, '--text', text]);
}

export const orcaRoutes: Routes = {
  'GET /api/orca': async () => ({ available: await orcaAvailable() }),
  'GET /api/terminals': ({ wt }) => listTerminals(wt),
  'POST /api/send': async ({ wt, body }) => {
    const { handle, text } = (body ?? {}) as { handle?: unknown; text?: unknown };
    if (typeof handle !== 'string' || typeof text !== 'string' || !text) throw new BadRequest('handle과 text가 필요합니다');
    // 이 워크트리의 터미널에만 보낼 수 있다
    if (!(await listTerminals(wt)).some((t) => t.handle === handle)) throw new BadRequest('이 워크트리의 터미널이 아닙니다');
    await sendFeedback(handle, text);
    return { ok: true };
  },
};
