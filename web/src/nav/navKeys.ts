export interface NavKeyInput { key: string; metaKey: boolean; altKey: boolean; inTextInput: boolean }

// 뒤로/앞으로 단축키 판정. 텍스트 입력 중에는 Option+← 같은 단어 이동을 가로채지 않는다.
export function navKeyAction(e: NavKeyInput): 'back' | 'forward' | null {
  if (e.inTextInput) return null;
  if ((e.metaKey && e.key === '[') || (e.altKey && e.key === 'ArrowLeft')) return 'back';
  if ((e.metaKey && e.key === ']') || (e.altKey && e.key === 'ArrowRight')) return 'forward';
  return null;
}
