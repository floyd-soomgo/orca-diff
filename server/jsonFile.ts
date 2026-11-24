import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// 객체 하나를 담은 JSON 파일. 없거나 깨졌으면 빈 객체.
export function readJsonObject(file: string): Record<string, unknown> {
  try {
    const v = JSON.parse(readFileSync(file, 'utf8'));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

// 쓰다 끊겨도 기존 파일이 깨지지 않게 임시 파일에 쓰고 바꿔 넣는다
export function writeJsonAtomic(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(`${file}.tmp`, file);
}
