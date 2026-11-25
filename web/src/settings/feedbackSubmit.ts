import { create } from 'zustand';
import { getPref, setPref } from '../prefs.ts';

// 피드백을 입력창에 넣고 바로 제출(Enter)할지. 설정 팝오버와 Feedback 패널이 함께 본다.
export const useFeedbackSubmit = create<{ submit: boolean; setSubmit(v: boolean): void }>((set) => ({
  submit: getPref('feedbackSubmit', false),
  setSubmit: (submit) => {
    set({ submit });
    setPref('feedbackSubmit', submit, { immediate: true });
  },
}));
