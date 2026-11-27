import { describe, expect, test } from 'vitest';
import type { Change } from '../server/shared/types.ts';
import { buildFileTree, collectDirPaths } from '../web/src/layout/changeTree.ts';

const ch = (path: string): Change => ({ path, status: 'M', binary: false });

describe('buildFileTree', () => {
  test('디렉터리를 중첩하고, 하위 폴더 하나뿐인 경로는 한 줄로 합친다', () => {
    const tree = buildFileTree([
      ch('README.md'),
      ch('html/pr-review-analysis/a.md'),
      ch('html/pr-review-analysis/data/b.json'),
      ch('html/pr-review-analysis/data/c.json'),
    ]);
    expect(tree.files.map((f) => f.path)).toEqual(['README.md']);
    expect(tree.dirs.map((d) => d.name)).toEqual(['html/pr-review-analysis']);
    const pr = tree.dirs[0];
    expect(pr.path).toBe('html/pr-review-analysis');
    expect(pr.files.map((f) => f.path)).toEqual(['html/pr-review-analysis/a.md']);
    expect(pr.dirs.map((d) => [d.name, d.path, d.files.length])).toEqual([['data', 'html/pr-review-analysis/data', 2]]);
  });

  test('디렉터리와 파일을 이름순으로 정렬한다', () => {
    const tree = buildFileTree([ch('b/x.ts'), ch('a/y.ts'), ch('z.ts'), ch('c.ts')]);
    expect(tree.dirs.map((d) => d.name)).toEqual(['a', 'b']);
    expect(tree.files.map((f) => f.path)).toEqual(['c.ts', 'z.ts']);
  });

  test('모든 디렉터리 경로를 모은다(모두 접기용)', () => {
    const tree = buildFileTree([ch('a/b/c/x.ts'), ch('a/d/y.ts')]);
    expect(collectDirPaths(tree).sort()).toEqual(['a', 'a/b/c', 'a/d']);
  });
});
