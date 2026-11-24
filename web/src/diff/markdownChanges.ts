import { diffLines } from 'diff';
import type { Element, ElementContent, Root } from 'hast';

export function markdownChanges(before: string, after: string) {
  const original = new Set<number>(), modified = new Set<number>();
  let left = 1, right = 1;
  for (const chunk of diffLines(before, after, { timeout: 200 }) ?? []) {
    for (let i = 0; i < chunk.count; i++) {
      if (chunk.removed) original.add(left++);
      else if (chunk.added) modified.add(right++);
      else { left++; right++; }
    }
  }
  return { original, modified };
}

// 여러 줄에 걸친 구문 강조 span도 줄마다 같은 색을 유지한다.
function splitLines(nodes: ElementContent[]): ElementContent[][] {
  const lines: ElementContent[][] = [[]];
  for (const node of nodes) {
    const parts = node.type === 'text'
      ? node.value.split('\n').map(value => [{ type: 'text' as const, value }])
      : node.type === 'element'
        ? splitLines(node.children).map(children => [{ ...node, children }])
        : [[node]];
    parts.forEach((part, i) => {
      if (i) lines.push([]);
      lines[lines.length - 1].push(...part);
    });
  }
  return lines;
}

export function markMarkdownChanges(lines?: Set<number>) {
  return (tree: Root) => {
    if (!lines?.size) return;
    function visit(node: Element) {
      const pos = node.position;
      if (node.tagName === 'pre' && pos) {
        const code = node.children.find(child => child.type === 'element' && child.tagName === 'code');
        if (code?.type !== 'element') return;
        const parts = splitLines(code.children);
        const start = pos.start.line + (pos.end.line - pos.start.line >= parts.length ? 1 : 0);
        code.children = parts.flatMap((children, i): ElementContent[] => [
          ...(i ? [{ type: 'text' as const, value: '\n' }] : []),
          { type: 'element', tagName: 'span', properties: { className: lines!.has(start + i) ? ['md-change-line'] : [] }, children },
        ]);
        return;
      }
      if (pos && /^(p|h[1-6]|li|tr|summary)$/.test(node.tagName)) {
        for (let i = pos.start.line; i <= pos.end.line; i++) {
          if (lines!.has(i)) { node.properties.className = [...(Array.isArray(node.properties.className) ? node.properties.className : []), 'md-change']; break; }
        }
      }
      node.children.forEach(child => { if (child.type === 'element') visit(child); });
    }
    tree.children.forEach(node => { if (node.type === 'element') visit(node); });
  };
}
