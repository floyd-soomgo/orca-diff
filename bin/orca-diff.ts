#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
      const shown = new URL(existing.url).searchParams.get('wt');
      if (shown !== wt) await exec('orca', ['goto', '--url', url, '--page', existing.page]);
      return;
    }
    await exec('orca', ['tab', 'create', '--url', url, '--worktree', `path:${wt}`]);
    return;
  } catch {
    // Orca가 없거나 실패하면 기본 브라우저로 연다
  }
  await exec('open', [url]);
}

async function main() {
  if (process.argv.includes('--restart')) {
    await restartServer(loadOrCreateKey());
    console.log(`서버를 새 코드로 다시 띄웠습니다 (포트 ${PORT}). 열려 있는 탭은 새로 고치세요.`);
    return;
  }
  let wt: string;
  try {
    wt = (await exec('git', ['rev-parse', '--show-toplevel'])).stdout.trim();
  } catch {
    console.error('git 워크트리 안에서 실행하세요.');
    process.exit(1);
  }
  const key = loadOrCreateKey();
  await ensureServer(key);
  const url = `http://127.0.0.1:${PORT}/?${new URLSearchParams({ key, wt })}`;
  await openUrl(url, wt);
  console.log(url);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
