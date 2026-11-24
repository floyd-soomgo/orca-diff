import { useEffect, useState } from 'react';
import { useNavLoading } from './loading.ts';

const SLOW_HINT_MS = 3000;

// 선언 이동·사용처 찾기가 오래 걸릴 때 화면 아래에 띄우는 표시
export function NavLoadingIndicator() {
  const { label, startedAt } = useNavLoading();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!label) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [label]);

  if (!label) return null;
  const slow = now - startedAt > SLOW_HINT_MS;
  return (
    <div className="nav-loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}…</span>
      {slow && <span className="hint">처음 실행이면 프로젝트를 읽느라 시간이 걸릴 수 있습니다</span>}
    </div>
  );
}
