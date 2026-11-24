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

async function openUrl(url: string, wt: string): Promise<void> {
  try {
    await exec('orca', ['tab', 'create', '--url', url, '--worktree', `path:${wt}`, '--focus']);
    return;
  } catch {
    // Orca가 없거나 실패하면 기본 브라우저로 연다
  }
  await exec('open', [url]);
}

async function main() {
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
