import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const PORT = Number(process.env.ORCA_REVIEW_PORT ?? 4517);
export const CONFIG_DIR = join(homedir(), '.orca-review');

// 키는 한 번 만들어 재사용한다(저장된 URL과 브라우저 저장소가 유지되도록)
export function loadOrCreateKey(dir = CONFIG_DIR): string {
  const file = join(dir, 'key');
  try {
    const key = readFileSync(file, 'utf8').trim();
    if (/^[0-9a-f]{64}$/.test(key)) return key;
  } catch {
    // 없으면 아래에서 생성
  }
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const key = randomBytes(32).toString('hex');
  writeFileSync(file, key, { mode: 0o600 });
  return key;
}
