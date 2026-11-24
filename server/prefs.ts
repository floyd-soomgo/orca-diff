import { join } from 'node:path';
import { BadRequest } from './git/changes.ts';
import type { Routes } from './http/app.ts';
import { readJsonObject, writeJsonAtomic } from './jsonFile.ts';

// UI 설정(패널 크기·글꼴·diff 보기 방식)을 브라우저가 아닌 파일에 저장해 어느 탭·세션에서 열어도 같게 한다
export function prefsRoutes(dir: string): Routes {
  const file = join(dir, 'prefs.json');
  return {
    'GET /api/prefs': async () => readJsonObject(file),
    'POST /api/prefs': async ({ body }) => {
      const { key, value } = (body ?? {}) as { key?: unknown; value?: unknown };
      if (typeof key !== 'string' || !/^[\w.-]{1,64}$/.test(key) || value === undefined) throw new BadRequest('잘못된 설정입니다');
      writeJsonAtomic(file, { ...readJsonObject(file), [key]: value });
      return { ok: true };
    },
  };
}
