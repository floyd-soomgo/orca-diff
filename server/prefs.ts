import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequest } from './git/changes.ts';
import type { Routes } from './http/app.ts';

// UI 설정(패널 크기·글꼴·diff 보기 방식)을 브라우저가 아닌 파일에 저장해 어느 탭·세션에서 열어도 같게 한다
export function prefsRoutes(dir: string): Routes {
  const file = join(dir, 'prefs.json');

  const read = (): Record<string, unknown> => {
    try {
      const v = JSON.parse(readFileSync(file, 'utf8'));
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch {
      return {};
    }
  };

  return {
    'GET /api/prefs': async () => read(),
    'POST /api/prefs': async ({ body }) => {
      const { key, value } = (body ?? {}) as { key?: unknown; value?: unknown };
      if (typeof key !== 'string' || !/^[\w.-]{1,64}$/.test(key) || value === undefined) throw new BadRequest('잘못된 설정입니다');
      const next = { ...read(), [key]: value };
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      // 쓰다 끊겨도 기존 파일이 깨지지 않게 임시 파일에 쓰고 바꿔 넣는다
      writeFileSync(`${file}.tmp`, JSON.stringify(next, null, 2));
      renameSync(`${file}.tmp`, file);
      return { ok: true };
    },
  };
}
