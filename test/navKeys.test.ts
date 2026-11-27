import { describe, expect, test } from 'vitest';
import { navKeyAction } from '../web/src/nav/navKeys.ts';

describe('navKeyAction', () => {
  const key = (k: Partial<Parameters<typeof navKeyAction>[0]>) =>
    navKeyAction({ key: '', code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, inTextInput: false, ...k });

  test('Cmd+[ / Alt+←는 뒤로, Cmd+] / Alt+→는 앞으로', () => {
    expect(key({ metaKey: true, key: '[' })).toBe('back');
    expect(key({ altKey: true, key: 'ArrowLeft' })).toBe('back');
    expect(key({ metaKey: true, key: ']' })).toBe('forward');
    expect(key({ altKey: true, key: 'ArrowRight' })).toBe('forward');
    expect(key({ key: 'ArrowLeft' })).toBeNull();
  });

  test('코멘트 입력창·검색창 안에서는 가로채지 않는다(Option+← 단어 이동)', () => {
    expect(key({ altKey: true, key: 'ArrowLeft', inTextInput: true })).toBeNull();
    expect(key({ metaKey: true, key: '[', inTextInput: true })).toBeNull();
  });

  test('Ctrl+W만 뷰어 탭을 닫는다', () => {
    const w = { key: 'w', code: 'KeyW' };
    expect(key({ ...w, ctrlKey: true })).toBe('close-tab');
    expect(key(w)).toBeNull();
    expect(key({ ...w, metaKey: true })).toBeNull();
    expect(key({ ...w, ctrlKey: true, altKey: true })).toBeNull();
    expect(key({ ...w, ctrlKey: true, metaKey: true })).toBeNull();
    expect(key({ ...w, ctrlKey: true, shiftKey: true, key: 'W' })).toBeNull();
    expect(key({ ...w, ctrlKey: true, inTextInput: true })).toBeNull();
  });

  test('한글 입력 소스에서도 Ctrl+W로 뷰어 탭을 닫는다', () => {
    const koreanW = { key: 'ㅈ', code: 'KeyW', ctrlKey: true };
    expect(key(koreanW)).toBe('close-tab');
    expect(key({ ...koreanW, inTextInput: true })).toBeNull();
  });
});
