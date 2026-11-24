// 코멘트를 단 코드 발췌를 새 내용에서 다시 찾는다. 여러 곳이면 hintLine에 가장 가까운 곳.
export function relocate(excerpt: string, content: string, hintLine: number): { startLine: number; endLine: number } | null {
  const want = excerpt.split('\n');
  const lines = content.split('\n');
  let best: number | null = null;
  for (let i = 0; i + want.length <= lines.length; i++) {
    if (want.every((w, k) => lines[i + k] === w) && (best === null || Math.abs(i + 1 - hintLine) < Math.abs(best + 1 - hintLine))) {
      best = i;
    }
  }
  return best === null ? null : { startLine: best + 1, endLine: best + want.length };
}
