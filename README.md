# orca-diff

에이전트가 만든 결과물을 검토하는 로컬 git 리뷰 도구입니다. WebStorm 내장 git 클라이언트처럼 커밋과 워킹트리 diff를 보고, TS/JS 코드를 탐색하고, 라인·파일·커밋 단위 피드백을 에이전트 입력창에 넣을 수 있습니다. 읽기 전용이라 git에 아무것도 쓰지 않습니다.

## 설치

Node.js 22.18 이상이 설치된 Mac에서 이 저장소를 복제한 뒤, 저장소 루트에서 한 번 실행하세요.

```bash
npm ci && npm run build && npm link
```

## 사용법

워크트리 안에서 실행합니다.

```bash
orca-diff
```

- 로컬 서버(`127.0.0.1:4517`, `ORCA_REVIEW_PORT`로 변경)가 없으면 띄우고, 있으면 재사용합니다.
- Orca가 있으면 그 워크트리의 Orca 브라우저 탭으로, 없으면 기본 브라우저로 엽니다. Orca 탭은 하단/측면 스플릿으로 옮길 수 있습니다.
- 접속 키는 `~/.orca-review/key`, UI 설정(패널 크기·글꼴·diff 보기 방식, 마지막 피드백 대상)은 `~/.orca-review/prefs.json`, 리뷰 코멘트는 `~/.orca-review/comments.json`(워크트리별)에 저장되어 어느 탭·브라우저에서 열어도 같게 적용됩니다. 서버 로그는 `~/.orca-review/server.log`에 쌓입니다.

기존 명령 `orca-review`도 같은 CLI를 실행합니다.

## 업데이트

처음 설치한 `orca-diff` 저장소에서 최신 코드를 받고 다시 빌드합니다. 같은 폴더와 Node.js 환경을 계속 쓰면 `npm link`는 처음 한 번이면 됩니다.

```bash
git pull --ff-only && npm ci && npm run build
```

빌드가 끝나면 실행 중인 리뷰 서버를 종료하고, 리뷰할 워크트리에서 `orca-diff`를 다시 실행하세요. 서버가 실행 중이지 않으면 종료 단계는 건너뜁니다.

```bash
pkill -f 'orca-diff/server/index[.]ts'
```

## 화면

- **왼쪽 위 Commits**: 맨 위 `Working tree`와 선택한 브랜치의 커밋 목록. 제목 줄의 돋보기로 메시지/작성자 필터를 엽니다(Esc로 닫기). 제목 줄의 "이 브랜치만" 브랜치 아이콘을 켜면(기본값) 기준 브랜치 `origin/HEAD`에는 없는 커밋만 보입니다. Shift+클릭으로 범위를 선택하면 합친 diff가 나옵니다. 우클릭하면 커밋 코멘트를 달 수 있습니다.
- **왼쪽 아래 Changes**: 변경 파일 트리. Working tree는 Unstaged/Staged로 나뉘고, 3초마다 다시 읽습니다.
- **가운데 탭**: diff 탭(Split/Unified, 변경 뭉치/전체)과 읽기 전용 파일 탭이 있습니다. 탭의 💬로 파일 전체에 코멘트를 답니다.
- **하단 도구 창**: Find Usages 결과, Find in Files 결과, Feedback 목록.

## 단축키

| 동작 | 키 |
|---|---|
| 선언으로 이동 (선언 위에서는 사용처 팝업) | Cmd+클릭, Cmd+B |
| Find in Files (하단 도구 창) | Cmd+Shift+F, Orca 단축키와 겹치면 Ctrl+Shift+F |
| Find Usages (하단 도구 창) | fn+⌥+F7 (Mac은 F7이 미디어 키라 fn 필요), 또는 우클릭 → 사용처 찾기 |
| 뒤로 / 앞으로 | Alt+← / Alt+→, 마우스 뒤로/앞으로 버튼 (일반 브라우저에서는 Cmd+[ / Cmd+]도 동작) |
| 라인 코멘트 | diff 라인 번호 클릭, 드래그 또는 Shift+클릭으로 범위 |
| 코멘트 저장 / 취소 | Cmd+Enter / Esc |
| 선택한 코드 복사 | Ctrl+C (Cmd+C는 Orca 단축키와 함께 실행됨), 또는 우클릭 → 선택한 텍스트 복사 |
| 우클릭 메뉴 | 에디터(선언 이동·사용처·코멘트·경로 복사), 변경 파일(diff·워크트리 파일 열기·코멘트·경로 복사), 커밋(코멘트·해시·메시지 복사) |

코드 탐색은 TS/JS만 지원합니다. 워크트리에 `node_modules/typescript`가 있으면 그걸 쓰고, 없으면 내장 TypeScript 5.9로 tsserver를 띄웁니다. 큰 프로젝트에서는 첫 탐색이 몇 초 걸릴 수 있습니다.

코드 내용 검색은 `git grep`으로 하므로 커밋된 파일과 `.gitignore`에 걸리지 않은 새 파일만 찾고, 바이너리 파일은 건너뜁니다. 정규식은 PCRE 문법이며, 결과는 2000건에서 끊습니다.

## 피드백 보내기

Feedback 탭에서 대상 터미널을 고르고 [입력창에 넣기]를 누르면, 쌓인 코멘트를 마크다운 메시지 하나로 만들어 `orca terminal send`로 에이전트 입력창에 넣습니다. **Enter는 누르지 않으니** 확인한 뒤 직접 제출하세요. Orca가 없거나 그 워크트리에 터미널이 없으면 클립보드로 복사합니다.

코멘트는 `~/.orca-review/comments.json`에 워크트리별로 보관합니다(예전 버전이 브라우저 저장소에 남긴 코멘트는 처음 열 때 옮겨집니다). 에이전트가 파일을 바꾸면 코드 발췌로 위치를 다시 찾고, 못 찾으면 "코드가 바뀌었을 수 있음"으로 표시합니다.

## 스파이크 결과 요약

- 여러 줄 텍스트를 `orca terminal send`로 보내면 Claude Code 입력창에 초안 하나로 들어가고 제출되지 않습니다.
- Orca 브라우저 탭은 Cmd+[ / Cmd+]를 페이지로 넘기지 않습니다. Cmd+B, Alt+F7, Alt+←/→는 넘깁니다.

## 개발

```bash
npm test          # vitest (git·HTTP·tsserver·피드백 포맷)
npm run typecheck # 서버 + 웹
npm run dev       # Vite 개발 서버(5173, /api는 4517로 프록시)
```

## 라이선스

[MIT](LICENSE)
