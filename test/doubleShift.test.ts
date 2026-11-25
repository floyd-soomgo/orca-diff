import { describe, expect, test } from 'vitest';
import { createDoubleShiftDetector } from '../web/src/layout/doubleShift.ts';

const press = (detect: ReturnType<typeof createDoubleShiftDetector>, key: string, time: number) => {
  detect({ type: 'keydown', key, time });
  return detect({ type: 'keyup', key, time: time + 30 });
};

describe('Shift 두 번 감지', () => {
  test('Shift를 빠르게 두 번 누르면 열린다', () => {
    const detect = createDoubleShiftDetector();
    expect(press(detect, 'Shift', 0)).toBe(false);
    expect(press(detect, 'Shift', 200)).toBe(true);
  });

  test('간격이 길면 열리지 않는다', () => {
    const detect = createDoubleShiftDetector();
    press(detect, 'Shift', 0);
    expect(press(detect, 'Shift', 1000)).toBe(false);
  });

  test('Shift로 대문자를 입력한 뒤 Shift를 누르면 열리지 않는다', () => {
    const detect = createDoubleShiftDetector();
    detect({ type: 'keydown', key: 'Shift', time: 0 });
    detect({ type: 'keydown', key: 'A', time: 50 });
    detect({ type: 'keyup', key: 'Shift', time: 100 });
    expect(press(detect, 'Shift', 200)).toBe(false);
  });

  test('세 번째 Shift는 새로 세기 시작한다', () => {
    const detect = createDoubleShiftDetector();
    press(detect, 'Shift', 0);
    expect(press(detect, 'Shift', 100)).toBe(true);
    expect(press(detect, 'Shift', 200)).toBe(false);
  });
});
