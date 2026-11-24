# orca-review

에이전트가 만든 결과물을 검토하는 로컬 git 리뷰 도구입니다. WebStorm 내장 git 클라이언트처럼 커밋과 워킹트리 diff를 보고, TS/JS 코드를 탐색하고, 라인·파일·커밋 단위 피드백을 에이전트 입력창에 넣을 수 있습니다. 읽기 전용이라 git에 아무것도 쓰지 않습니다.

## 설치

```bash
npm i
npm run build
npm link        # orca-review 명령 등록
```

Node 22.18 이상이 필요합니다(TS 파일을 빌드 없이 직접 실행).

## 사용법

워크트리 안에서 실행합니다.

```bash
orca-review
```

- 로컬 서버(`127.0.0.1:4517`, `ORCA_REVIEW_PORT`로 변경)가 없으면 띄우고, 있으면 재사용합니다.
- Orca가 있으면 그 워크트리의 Orca 브라우저 탭으로, 없으면 기본 브라우저로 엽니다. Orca 탭은 하단/측면 스플릿으로 옮길 수 있습니다.
- 접속 키는 `~/.orca-review/key`, UI 설정(패널 크기·글꼴·diff 보기 방식, 마지막 피드백 대상)은 `~/.orca-review/prefs.json`, 리뷰 코멘트는 `~/.orca-review/comments.json`(워크트리별)에 저장되어 어느 탭·브라우저에서 열어도 같게 적용됩니다. 서버 로그는 `~/.orca-review/server.log`에 쌓입니다.
- 코드를 업데이트한 뒤에는 `npm run build`를 다시 하고 서버를 재시작하세요(`pkill -f orca-review/server/index.ts` 후 다시 `orca-review`).

## 화면

- **왼쪽 위 Commits**: 맨 위 `Working tree`와 선택한 브랜치의 커밋 목록. 기본값은 "기준 브랜치(`origin/HEAD`) 이후 커밋만"입니다. Shift+클릭으로 범위를 선택하면 합친 diff가 나옵니다. 우클릭하면 커밋 코멘트를 달 수 있습니다.
- **왼쪽 아래 Changes**: 변경 파일 트리. Working tree는 Unstaged/Staged로 나뉘고, 3초마다 다시 읽습니다.
- **가운데 탭**: diff 탭(Split/Unified, 변경 뭉치/전체)과 읽기 전용 파일 탭이 있습니다. 탭의 💬로 파일 전체에 코멘트를 답니다.
- **하단 도구 창**: Find Usages 결과와 Feedback 목록.

## 단축키

| 동작 | 키 |
|---|---|
| 선언으로 이동 (선언 위에서는 사용처 팝업) | Cmd+클릭, Cmd+B |
| Find Usages (하단 도구 창) | Alt+F7 |
| 뒤로 / 앞으로 | Alt+← / Alt+→, 마우스 뒤로/앞으로 버튼 (일반 브라우저에서는 Cmd+[ / Cmd+]도 동작) |
| 라인 코멘트 | diff 라인 번호 클릭, 드래그 또는 Shift+클릭으로 범위 |
| 코멘트 저장 / 취소 | Cmd+Enter / Esc |

코드 탐색은 TS/JS만 지원합니다. 워크트리에 `node_modules/typescript`가 있으면 그걸 쓰고, 없으면 내장 TypeScript 5.9로 tsserver를 띄웁니다. 큰 프로젝트에서는 첫 탐색이 몇 초 걸릴 수 있습니다.

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
