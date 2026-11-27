export interface NavKeyInput {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  inTextInput: boolean;
}

// 텍스트 입력 중에는 Option+← 같은 단어 이동을 가로채지 않는다.
export function navKeyAction(e: NavKeyInput): 'back' | 'forward' | 'close-tab' | null {
  if (e.inTextInput) return null;
  if (e.code === 'KeyW' && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) return 'close-tab';
  if ((e.metaKey && e.key === '[') || (e.altKey && e.key === 'ArrowLeft')) return 'back';
  if ((e.metaKey && e.key === ']') || (e.altKey && e.key === 'ArrowRight')) return 'forward';
  return null;
}
