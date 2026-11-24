import { describe, expect, test } from 'vitest';
import { appendBlock } from '../web/src/feedback/appendBlock.ts';

describe('appendBlock', () => {
  test('비어 있으면 그대로 넣는다', () => {
    expect(appendBlock('', 'feat: 제목\n\n본문')).toBe('feat: 제목\n\n본문');
    expect(appendBlock('  \n', 'feat: 제목')).toBe('feat: 제목');
  });

  test('입력된 내용이 있으면 지우지 않고 한 줄 띄워 뒤에 붙인다', () => {
    expect(appendBlock('이 커밋 쪼개 주세요', 'feat: 제목')).toBe('이 커밋 쪼개 주세요\n\nfeat: 제목');
    expect(appendBlock('끝에 줄바꿈\n\n\n', 'feat: 제목')).toBe('끝에 줄바꿈\n\nfeat: 제목');
  });
});
