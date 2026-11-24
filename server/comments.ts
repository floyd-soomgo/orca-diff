import { join } from 'node:path';
import { BadRequest } from './git/changes.ts';
import type { Routes } from './http/app.ts';
import { readJsonObject, writeJsonAtomic } from './jsonFile.ts';

// 리뷰 코멘트를 워크트리별로 파일에 저장한다(브라우저 저장소가 지워져도, 다른 탭에서 열어도 남도록)
export function commentsRoutes(dir: string): Routes {
  const file = join(dir, 'comments.json');
  return {
    'GET /api/comments': async ({ wt }) => {
      const list = readJsonObject(file)[wt];
      return Array.isArray(list) ? list : [];
    },
    'POST /api/comments': async ({ wt, body }) => {
      const { comments } = (body ?? {}) as { comments?: unknown };
      if (!Array.isArray(comments)) throw new BadRequest('comments는 배열이어야 합니다');
      writeJsonAtomic(file, { ...readJsonObject(file), [wt]: comments });
      return { ok: true };
    },
  };
}
