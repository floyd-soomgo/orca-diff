import { beforeAll, describe, expect, test } from 'vitest';
import { searchCode } from '../server/search.ts';
import { gitFixture, type GitFixture } from './helpers/gitFixture.ts';

let fx: GitFixture;
const base = { caseSensitive: false, regex: false, wholeWord: false };

beforeAll(async () => {
  fx = await gitFixture();
  await fx.write({ '.gitignore': 'dist/\n' });
  await fx.commit({ 'src/a.ts': 'const 한글 = useFoo();\nfoo.bar()\n', 'src/b.ts': 'export const FOOBAR = 1;\n' }, 'c1');
  await fx.write({ 'src/new.ts': 'useFoo()\n', 'dist/out.js': 'useFoo()\n' });
});

describe('코드 검색', () => {
  test('커밋된 파일과 새 파일에서 찾고 무시된 파일은 건너뛴다', async () => {
    const { locations } = await searchCode(fx.dir, { ...base, query: 'useFoo' });
    expect(locations.map((l) => l.path).sort()).toEqual(['src/a.ts', 'src/new.ts']);
  });

  test('한글이 앞에 있어도 글자 기준 열 위치를 돌려준다', async () => {
    const { locations } = await searchCode(fx.dir, { ...base, query: 'useFoo' });
    expect(locations.find((l) => l.path === 'src/a.ts')).toMatchObject({ line: 1, column: 12, preview: 'const 한글 = useFoo();' });
  });

  test('대소문자 구분과 단어 단위 옵션을 따른다', async () => {
    const insensitive = await searchCode(fx.dir, { ...base, query: 'foo' });
    expect(insensitive.locations).toHaveLength(4);
    const sensitive = await searchCode(fx.dir, { ...base, caseSensitive: true, query: 'FOO' });
    expect(sensitive.locations.map((l) => l.path)).toEqual(['src/b.ts']);
    const word = await searchCode(fx.dir, { ...base, wholeWord: true, query: 'foo' });
    expect(word.locations.map((l) => `${l.path}:${l.line}`)).toEqual(['src/a.ts:2']);
  });

  test('정규식 검색과 잘못된 정규식 오류', async () => {
    const { locations } = await searchCode(fx.dir, { ...base, regex: true, query: 'use[A-Z]\\w+\\(' });
    expect(locations).toHaveLength(2);
    await expect(searchCode(fx.dir, { ...base, regex: true, query: 'a(' })).rejects.toThrow('정규식 오류');
  });

  test('-로 시작하는 검색어도 옵션이 아닌 검색어로 다룬다', async () => {
    const { locations } = await searchCode(fx.dir, { ...base, query: '--help' });
    expect(locations).toEqual([]);
  });
});
