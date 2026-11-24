// JSON을 2칸 들여쓰기로 정리한다. 빈 내용은 그대로, JSON이 아니면 null.
export function formatJson(text: string): string | null {
  if (!text.trim()) return text;
  try {
    return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
  } catch {
    return null;
  }
}
