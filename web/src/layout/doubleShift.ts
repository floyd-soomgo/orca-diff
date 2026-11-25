export const DOUBLE_SHIFT_MS = 400;

interface KeyInput { type: 'keydown' | 'keyup'; key: string; repeat?: boolean; time: number }

// Shift만 눌렀다 떼는 동작이 짧은 간격으로 두 번 이어지면 true를 돌려줍니다.
// 사이에 다른 키를 누르면(Shift+A로 대문자 입력 등) 처음부터 다시 셉니다.
export function createDoubleShiftDetector() {
  let shiftOnly = false;
  let lastShiftUp = -Infinity;
  return (e: KeyInput): boolean => {
    if (e.type === 'keydown') {
      if (e.key !== 'Shift') {
        shiftOnly = false;
        lastShiftUp = -Infinity;
      } else if (!e.repeat) {
        shiftOnly = true;
      }
      return false;
    }
    if (e.key !== 'Shift' || !shiftOnly) return false;
    shiftOnly = false;
    if (e.time - lastShiftUp <= DOUBLE_SHIFT_MS) {
      lastShiftUp = -Infinity;
      return true;
    }
    lastShiftUp = e.time;
    return false;
  };
}
