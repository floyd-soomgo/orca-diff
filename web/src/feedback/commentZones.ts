import type { Change, Source } from '../../../server/shared/types.ts';
import { monaco } from '../monaco/setup.ts';
import { sourceKey } from '../store.ts';
import { relocate } from './anchor.ts';
import type { ReviewComment } from './model.ts';
import { useFeedback } from './storage.ts';

type Side = 'old' | 'new';
type LineComment = ReviewComment & { target: Extract<ReviewComment['target'], { kind: 'line' }> };

interface Ctx {
  source: Source;
  change: Change;
  editors: Record<Side, monaco.editor.ICodeEditor>;
  contents: Record<Side, string>;
}

const LINE_PX = 19;
const composers = new Map<string, Composer>();

function isFor(c: ReviewComment, ctx: Ctx): c is LineComment {
  return c.target.kind === 'line' && c.target.path === ctx.change.path && sourceKey(c.target.source) === sourceKey(ctx.source);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// view zone 안의 입력이 에디터 단축키·선택으로 새지 않게 막는다
function isolate(node: HTMLElement) {
  for (const type of ['keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'click', 'wheel', 'paste', 'copy']) {
    node.addEventListener(type, (e) => e.stopPropagation());
  }
}

interface Composer { side: Side; startLine: number; endLine: number; editId?: string; body: string }

// diff의 양쪽 에디터에 라인 코멘트를 그리고, 라인 번호 클릭/드래그로 새 코멘트를 받는다
export function attachComments(ctx: Ctx): monaco.IDisposable {
  const zoneIds: Record<Side, string[]> = { old: [], new: [] };
  const zoneNodes: Record<Side, HTMLElement[]> = { old: [], new: [] };
  // 입력 중인 코멘트는 탭 단위로 보관해 diff가 다시 로드(재부착)돼도 유지한다
  const composerKey = `${sourceKey(ctx.source)}:${ctx.change.path}`;
  let composer: Composer | null = composers.get(composerKey) ?? null;
  const setComposer = (next: Composer | null) => {
    composer = next;
    if (next) composers.set(composerKey, next);
    else composers.delete(composerKey);
  };

  // view zone은 스크롤 폭 전체로 펼쳐지므로, 박스를 보이는 본문 폭에 맞춰야 Split 보기에서 반대쪽 패널에 가려지지 않는다
  const fitWidth = (side: Side, node: HTMLElement) => {
    const { contentWidth, verticalScrollbarWidth } = ctx.editors[side].getLayoutInfo();
    node.style.width = `${Math.max(160, Math.min(640, contentWidth - verticalScrollbarWidth - 24))}px`;
  };

  const clearZones = () => {
    for (const side of ['old', 'new'] as const) {
      ctx.editors[side].changeViewZones((acc) => zoneIds[side].forEach((id) => acc.removeZone(id)));
      zoneIds[side] = [];
      zoneNodes[side] = [];
    }
  };

  const addZone = (side: Side, afterLineNumber: number, domNode: HTMLElement, lines: number) => {
    isolate(domNode);
    fitWidth(side, domNode);
    zoneNodes[side].push(domNode);
    // Monaco가 zone의 바깥 노드 폭을 100%로 덮어쓰므로 폭은 안쪽 박스에 준다
    const outer = el('div', 'comment-zone-outer');
    outer.append(domNode);
    ctx.editors[side].changeViewZones((acc) => {
      zoneIds[side].push(acc.addZone({ afterLineNumber, heightInPx: lines * LINE_PX + 16, domNode: outer }));
    });
  };

  const commentNode = (c: LineComment) => {
    const box = el('div', 'comment-zone');
    box.append(el('div', 'comment-body', c.body));
    const actions = el('div', 'comment-actions');
    const edit = el('button', '', '편집');
    edit.onclick = () => {
      setComposer({ side: c.target.side, startLine: c.target.startLine, endLine: c.target.endLine, editId: c.id, body: c.body });
      render();
    };
    const del = el('button', '', '삭제');
    del.onclick = () => useFeedback.getState().remove(c.id);
    if (c.sentAt) actions.append(el('span', 'sent', '보냄'));
    actions.append(edit, del);
    box.append(actions);
    return box;
  };

  const composerNode = (cmp: Composer) => {
    const box = el('div', 'comment-zone composer');
    const range = cmp.startLine === cmp.endLine ? `${cmp.startLine}` : `${cmp.startLine}-${cmp.endLine}`;
    box.append(el('div', 'comment-label', `${cmp.side === 'old' ? '삭제된 코드' : ''} ${range}행 코멘트 (Cmd+Enter 저장, Esc 취소)`.trim()));
    const textarea = el('textarea', 'comment-input');
    textarea.value = cmp.body;
    // 다시 그려져도 입력 중인 내용이 남도록
    textarea.addEventListener('input', () => {
      cmp.body = textarea.value;
    });
    const save = () => {
      const body = textarea.value.trim();
      if (!body) return;
      const { add, update } = useFeedback.getState();
      if (cmp.editId) update(cmp.editId, { body });
      else {
        const excerpt = ctx.contents[cmp.side].split('\n').slice(cmp.startLine - 1, cmp.endLine).join('\n');
        add({ kind: 'line', source: ctx.source, path: ctx.change.path, side: cmp.side, startLine: cmp.startLine, endLine: cmp.endLine, excerpt }, body);
      }
      setComposer(null);
      render();
    };
    const cancel = () => {
      setComposer(null);
      render();
    };
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
      else if (e.key === 'Escape') cancel();
    });
    const actions = el('div', 'comment-actions');
    const ok = el('button', 'primary', '저장');
    ok.onclick = save;
    const no = el('button', '', '취소');
    no.onclick = cancel;
    actions.append(ok, no);
    box.append(textarea, actions);
    // view zone은 다음 렌더 프레임에 DOM에 붙으므로 붙은 뒤에 포커스한다
    const focusWhenAttached = (tries: number) => {
      if (textarea.isConnected) textarea.focus();
      else if (tries > 0) requestAnimationFrame(() => focusWhenAttached(tries - 1));
    };
    requestAnimationFrame(() => focusWhenAttached(20));
    return box;
  };

  function render() {
    clearZones();
    for (const c of useFeedback.getState().comments) {
      if (!isFor(c, ctx) || c.stale || c.id === composer?.editId) continue;
      addZone(c.target.side, c.target.endLine, commentNode(c), Math.max(1, c.body.split('\n').length) + 1);
    }
    if (composer) addZone(composer.side, composer.endLine, composerNode(composer), 6);
  }

  // 내용이 바뀌었으면 발췌로 위치를 다시 찾고, 못 찾으면 stale로 표시
  const { comments, update } = useFeedback.getState();
  for (const c of comments) {
    if (!isFor(c, ctx)) continue;
    const found = relocate(c.target.excerpt, ctx.contents[c.target.side], c.target.startLine);
    if (!found) {
      if (!c.stale) update(c.id, { stale: true });
    } else if (c.stale || found.startLine !== c.target.startLine) {
      update(c.id, { stale: false, target: { ...c.target, ...found } });
    }
  }

  // 라인 번호 영역을 클릭/드래그/Shift+클릭하면 선택된 라인 범위로 입력창을 연다
  const gutterListeners = (['old', 'new'] as const).map((side) =>
    ctx.editors[side].onMouseUp((e) => {
      if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) return;
      const sel = ctx.editors[side].getSelection();
      if (!sel) return;
      const start = sel.startLineNumber;
      // 줄 단위 선택은 다음 줄 1열에서 끝나므로 한 줄 뺀다
      const end = sel.endColumn === 1 && sel.endLineNumber > start ? sel.endLineNumber - 1 : sel.endLineNumber;
      setComposer({ side, startLine: start, endLine: end, body: '' });
      render();
    }),
  );

  const layoutListeners = (['old', 'new'] as const).map((side) =>
    ctx.editors[side].onDidLayoutChange(() => zoneNodes[side].forEach((node) => fitWidth(side, node))),
  );

  render();
  const unsubscribe = useFeedback.subscribe((s, prev) => {
    if (s.comments !== prev.comments) render();
  });

  return {
    dispose() {
      unsubscribe();
      gutterListeners.forEach((d) => d.dispose());
      layoutListeners.forEach((d) => d.dispose());
      clearZones();
    },
  };
}
