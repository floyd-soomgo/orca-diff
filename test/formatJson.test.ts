import { describe, expect, test } from 'vitest';
import { formatJson } from '../web/src/diff/formatJson.ts';

describe('formatJson', () => {
  test('압축된 JSON을 2칸 들여쓰기로 정리하고 끝 줄바꿈을 붙인다', () => {
    expect(formatJson('{"a":1,"b":[1,2]}')).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}\n');
  });

  test('빈 내용(추가·삭제 파일의 빈 쪽)은 그대로', () => {
    expect(formatJson('')).toBe('');
  });

  test('JSON이 아니면 null', () => {
    expect(formatJson('{"a":')).toBeNull();
  });
});
