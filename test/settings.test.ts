import { describe, expect, test } from 'vitest';
import { clampFontSize, fontStack } from '../web/src/settings/fontSettings.ts';

describe('폰트 설정', () => {
  test('크기는 10~24px 정수로 제한하고 잘못된 값은 기본값 13', () => {
    expect(clampFontSize(8)).toBe(10);
    expect(clampFontSize(30)).toBe(24);
    expect(clampFontSize(14.6)).toBe(15);
    expect(clampFontSize(Number.NaN)).toBe(13);
  });

  test('선택한 글꼴 뒤에 고정폭 대체 글꼴을 붙인다', () => {
    expect(fontStack('Fira Code')).toBe('"Fira Code", Menlo, monospace');
    expect(fontStack('Menlo')).toBe('Menlo, monospace');
  });
});
