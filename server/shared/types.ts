// 서버와 웹이 함께 쓰는 타입
export type Source =
  | { kind: 'unstaged' }
  | { kind: 'staged' }
  | { kind: 'commits'; from: string; to: string }; // 단일 커밋이면 from === to

export type ChangeStatus = 'A' | 'M' | 'D' | 'R';

export interface Change {
  path: string;
  oldPath?: string;
  status: ChangeStatus;
  binary: boolean;
}

export interface Commit {
  sha: string;
  subject: string;
  body: string;
  author: string;
  email: string;
  time: number; // epoch sec
}

export interface FilePair {
  original: string;
  modified: string;
  tooLarge: boolean;
  binary: boolean;
}

export interface Location {
  path: string; // 워크트리 기준 상대 경로
  line: number;
  column: number;
  preview: string;
}

export interface Terminal {
  handle: string;
  title: string;
}
