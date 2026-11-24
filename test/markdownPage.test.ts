import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { MarkdownPage } from '../web/src/diff/MarkdownPage.tsx';
import { markdownChanges } from '../web/src/diff/markdownChanges.ts';

test('접기 요소 안의 코드에서 변경된 줄과 구문을 함께 강조한다', () => {
  const before = '<details open><summary>예제</summary>\n\n```js\nconst x = 1;\nconst y = 2;\n```\n\n</details>';
  const after = before.replace('x = 1', 'x = 3');
  const html = renderToStaticMarkup(createElement(MarkdownPage, { text: after, changes: markdownChanges(before, after).modified }));
  expect(html).toContain('<details open="">');
  expect(html).toContain('<summary>예제</summary>');
  expect(html).toMatch(/class="md-change-line"><span class="hljs-keyword">const<\/span> x/);
  expect(html.match(/class="md-change-line"/g)).toHaveLength(1);
});
