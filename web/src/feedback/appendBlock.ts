// 입력 중인 내용을 지우지 않고 뒤에 한 줄 띄워 덧붙인다
export function appendBlock(current: string, block: string): string {
  const head = current.replace(/\s+$/, '');
  return head ? `${head}\n\n${block}` : block;
}
