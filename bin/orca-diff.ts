#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { CONFIG_DIR, loadOrCreateKey, PORT } from '../server/config.ts';

const exec = promisify(execFile);
const serverEntry = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'index.ts');

async function isHealthy(key: string): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health?key=${key}`);
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer(key: string): Promise<void> {
  if (await isHealthy(key)) return;
  const log = openSync(join(CONFIG_DIR, 'server.log'), 'a');
  spawn(process.execPath, [serverEntry], { detached: true, stdio: ['ignore', log, log] }).unref();
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (await isHealthy(key)) return;
  }
  throw new Error(`서버가 시작되지 않았습니다. ${join(CONFIG_DIR, 'server.log')}를 확인하세요 (포트 ${PORT}).`);
}

// 실행 중인 서버를 끄고, 내려간 것을 확인한 뒤 새 코드로 다시 띄웁니다
async function restartServer(key: string): Promise<void> {
  await exec('pkill', ['-f', 'orca-diff/server/index[.]ts']).catch(() => {
    // 실행 중인 서버가 없으면 pkill이 1로 끝나므로 무시합니다
  });
  for (let i = 0; i < 50 && (await isHealthy(key)); i++) await new Promise((r) => setTimeout(r, 100));
  await ensureServer(key);
}

// 이 워크트리에 이미 열린 orca-diff 탭이 있으면 그 탭의 페이지 id
async function findExistingTab(wt: string): Promise<{ page: string; url: string } | null> {
  try {
    const out = JSON.parse((await exec('orca', ['tab', 'list', '--worktree', `path:${wt}`, '--json'])).stdout);
    const tabs: { url?: string; browserPageId?: string }[] = out?.result?.tabs ?? [];
    const tab = tabs.find((t) => t.url?.startsWith(`http://127.0.0.1:${PORT}/`) && t.browserPageId);
    return tab ? { page: tab.browserPageId!, url: tab.url! } : null;
  } catch {
    return null;
  }
}

async function openUrl(url: string, wt: string): Promise<void> {
  try {
    const existing = await findExistingTab(wt);
    if (existing) {
      await exec('orca', ['tab', 'switch', '--page', existing.page, '--worktree', `path:${wt}`, '--focus']);
      // 탭이 다른 워크트리를 보고 있으면 이 워크트리로 이동한다(탭 안의 경로는 그대로 두고)
      const shown = new URL(existing.url).searchParams;
      const wanted = new URL(url).searchParams;
      if (shown.get('wt') !== wanted.get('wt') || shown.get('host') !== wanted.get('host')) {
        await exec('orca', ['goto', '--url', url, '--page', existing.page]);
      }
      return;
    }
    await exec('orca', ['tab', 'create', '--url', url, '--worktree', `path:${wt}`]);
    return;
  } catch {
    // Orca가 없거나 실패하면 기본 브라우저로 연다
  }
  await exec('open', [url]);
}

async function toplevel(dir: string): Promise<string | null> {
  try {
    return (await exec('git', ['-C', dir, 'rev-parse', '--show-toplevel'])).stdout.trim();
  } catch {
    return null;
  }
}

const USAGE = `사용법: orca-diff [경로] [--restart] [--help]

에이전트가 만든 변경을 리뷰하는 로컬 git 리뷰 화면을 엽니다. 읽기 전용이라 git에 아무것도 쓰지 않습니다.

  orca-diff              지금 폴더의 저장소를 리뷰합니다. 탭은 지금 워크트리의 Orca 탭으로 엽니다.
  orca-diff <경로>       <경로>의 저장소를 리뷰합니다. 탭은 지금 워크트리의 Orca 탭으로 엽니다.
                         리뷰 피드백은 지금 워크트리의 에이전트 터미널로 보내고,
                         파일 경로가 어느 저장소 기준인지 피드백 머리글에 적습니다.
  orca-diff --restart    실행 중인 리뷰 서버를 새 코드로 다시 띄웁니다. 탭은 열지 않습니다.
  orca-diff --help, -h   이 도움말을 출력합니다.

Orca가 없으면 기본 브라우저로 엽니다. 서버 포트는 ${PORT}이고 ORCA_REVIEW_PORT로 바꿀 수 있습니다.`;

async function main() {
  const flags = process.argv.slice(2).filter((a) => a.startsWith('-'));
  if (flags.includes('--help') || flags.includes('-h')) {
    console.log(USAGE);
    return;
  }
  // 모르는 옵션이 오면 사용법을 보여 주고 종료합니다. 오타 난 옵션을 무시한 채 서버를 띄우고 탭을 여는 일을 막습니다.
  const unknown = flags.find((f) => f !== '--restart');
  if (unknown) {
    console.error(`알 수 없는 옵션입니다: ${unknown}\n\n${USAGE}`);
    process.exit(1);
  }
  if (flags.includes('--restart')) {
    await restartServer(loadOrCreateKey());
    console.log(`서버를 새 코드로 다시 띄웠습니다 (포트 ${PORT}). 열려 있는 탭은 새로 고치세요.`);
    return;
  }
  // 인자로 준 경로의 저장소를 리뷰하고, 탭은 지금 폴더의 Orca 워크트리에 엽니다
  const target = process.argv.slice(2).find((a) => !a.startsWith('-'));
  const host = await toplevel(process.cwd());
  const wt = target ? await toplevel(resolve(target)) : host;
  if (!wt) {
    console.error(target ? `${target}는 git 저장소가 아닙니다.` : 'git 워크트리 안에서 실행하거나, 리뷰할 저장소 경로를 인자로 주세요.');
    process.exit(1);
  }
  const key = loadOrCreateKey();
  await ensureServer(key);
  const url = `http://127.0.0.1:${PORT}/?${new URLSearchParams({ key, wt, ...(host && host !== wt ? { host } : {}) })}`;
  await openUrl(url, host ?? wt);
  console.log(url);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
