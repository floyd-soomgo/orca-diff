// 서버(~/.orca-review/prefs.json)에 저장하는 UI 설정. 시작할 때 한 번 읽어 두고 동기적으로 쓴다.
let cache: Record<string, unknown> = {};
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const SAVE_DELAY_MS = 300;

function query(): URLSearchParams {
  const p = new URLSearchParams(location.search);
  return new URLSearchParams({ key: p.get('key') ?? '', wt: p.get('wt') ?? '' });
}

export async function loadPrefs(): Promise<void> {
  try {
    const res = await fetch(`/api/prefs?${query()}`);
    if (res.ok) cache = await res.json();
  } catch {
    // 읽기 실패 시 기본값으로 시작(설정은 편의 기능)
  }
}

export function getPref<T>(key: string, fallback: T): T {
  return key in cache ? (cache[key] as T) : fallback;
}

// 드래그처럼 연속으로 바뀌는 값은 마지막 값만 저장한다
export function setPref(key: string, value: unknown): void {
  cache[key] = value;
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      const q = query();
      fetch(`/api/prefs?${new URLSearchParams({ key: q.get('key') ?? '' })}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wt: q.get('wt'), key, value }),
      }).catch(() => undefined);
    }, SAVE_DELAY_MS),
  );
}
