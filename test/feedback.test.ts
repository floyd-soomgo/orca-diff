import { describe, expect, test } from 'vitest';
import { relocate } from '../web/src/feedback/anchor.ts';
import { formatFeedback } from '../web/src/feedback/format.ts';
import type { ReviewComment } from '../web/src/feedback/model.ts';

describe('relocate', () => {
  test('빈 줄 하나에 단 코멘트는 가장 가까운 빈 줄로 따라간다', () => {
    expect(relocate('', 'a\n\nb\nc\n\nd', 4)).toEqual({ startLine: 5, endLine: 5 });
    expect(relocate('', 'a\nb', 1)).toBeNull();
  });

  const content = ['a', 'b', 'target1', 'target2', 'c', 'd', 'target1', 'target2', 'e'].join('\n');

  test('발췌가 밀리면 새 라인 범위를 찾는다', () => {
    const shifted = ['x', 'y', 'z', 'a', 'b', 'only1', 'only2'].join('\n');
    expect(relocate('only1\nonly2', shifted, 3)).toEqual({ startLine: 6, endLine: 7 });
  });

  test('여러 곳이 일치하면 hint에 가까운 쪽을 고른다', () => {
    expect(relocate('target1\ntarget2', content, 2)).toEqual({ startLine: 3, endLine: 4 });
    expect(relocate('target1\ntarget2', content, 8)).toEqual({ startLine: 7, endLine: 8 });
  });

  test('발췌가 바뀌어 없으면 null', () => {
    expect(relocate('target1\nchanged', content, 3)).toBeNull();

  });
});

const base = { body: '', createdAt: 0, sentAt: null, stale: false };

describe('formatFeedback', () => {
  test('탭을 연 워크트리가 리뷰 대상과 다르면 경로의 기준 저장소를 적는다', () => {
    const comments: ReviewComment[] = [
      { ...base, id: '1', target: { kind: 'file', source: { kind: 'unstaged' }, path: 'src/a.ts' }, body: '확인해 주세요' },
    ];
    expect(formatFeedback(comments, { wt: '/other/repo', host: '/session/wt', branch: null }).split('\n\n').slice(0, 2)).toEqual([
      '## 코드 리뷰 피드백 (1건)',
      '아래 경로는 `/other/repo` 저장소 기준입니다.',
    ]);
    expect(formatFeedback(comments, { wt: '/repo', host: '/repo', branch: null })).not.toContain('저장소 기준');
  });

  test('라인·범위·파일·커밋 코멘트를 정해진 형식으로 만든다', () => {
    const comments: ReviewComment[] = [
      {
        ...base,
        id: '1',
        target: { kind: 'line', source: { kind: 'unstaged' }, path: 'src/a.ts', side: 'new', startLine: 12, endLine: 12, excerpt: 'const a = 1;' },
        body: '이름이 모호합니다',
      },
      {
        ...base,
        id: '2',
        target: {
          kind: 'line',
          source: { kind: 'commits', from: 'aaaaaaa1111', to: 'bbbbbbb2222' },
          path: 'src/b.tsx',
          side: 'old',
          startLine: 3,
          endLine: 5,
          excerpt: 'x();\ny();\nz();',
        },
        body: '이걸 왜 지웠나요?',
      },
      { ...base, id: '3', target: { kind: 'file', source: { kind: 'staged' }, path: 'README.md' }, body: '문서 전체를 다시 봐 주세요' },
      { ...base, id: '4', target: { kind: 'commit', sha: 'ccccccc3333', subject: 'fix: 토큰 갱신' }, body: '커밋을 나눠 주세요' },
    ];

    expect(formatFeedback(comments, { wt: '/repo', branch: 'feat/x' })).toBe(
      [
        '## 코드 리뷰 피드백 (feat/x, 4건)',
        '',
        '### 1. src/a.ts:12 (워킹트리 unstaged)',
        '```ts',
        'const a = 1;',
        '```',
        '이름이 모호합니다',
        '',
        '### 2. src/b.tsx:3-5 (커밋 aaaaaaa..bbbbbbb)',
        '(삭제된 코드)',
        '```tsx',
        'x();',
        'y();',
        'z();',
        '```',
        '이걸 왜 지웠나요?',
        '',
        '### 3. README.md (파일 전체, 워킹트리 staged)',
        '문서 전체를 다시 봐 주세요',
        '',
        '### 4. 커밋 ccccccc "fix: 토큰 갱신"',
        '커밋을 나눠 주세요',
      ].join('\n'),
    );
  });

  test('단일 커밋 라인 코멘트는 커밋 해시 하나만 쓴다', () => {
    const out = formatFeedback(
      [{ ...base, id: '1', target: { kind: 'line', source: { kind: 'commits', from: 'ddddddd4444', to: 'ddddddd4444' }, path: 'a.ts', side: 'new', startLine: 1, endLine: 2, excerpt: 'a\nb' }, body: 'x' }],
      { wt: '/repo', branch: null },
    );
    expect(out.split('\n').slice(0, 3)).toEqual(['## 코드 리뷰 피드백 (1건)', '', '### 1. a.ts:1-2 (커밋 ddddddd)']);
  });

  test('발췌에 ```가 있으면 더 긴 펜스를 쓰고, \\r과 끝 줄바꿈이 없다', () => {
    const out = formatFeedback(
      [{ ...base, id: '1', target: { kind: 'line', source: { kind: 'unstaged' }, path: 'doc.md', side: 'new', startLine: 1, endLine: 1, excerpt: '```js\r' }, body: '본문\r\n둘째 줄\n' }],
      { wt: '/repo', branch: 'main' },
    );
    expect(out).toContain('````md\n```js\n````');
    expect(out).not.toContain('\r');
    expect(out.endsWith('\n')).toBe(false);
  });
});
