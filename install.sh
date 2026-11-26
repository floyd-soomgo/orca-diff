#!/usr/bin/env bash
set -euo pipefail

main() {
  local repo_url=https://github.com/floydkim/orca-diff.git
  local install_dir="$HOME/.local/share/orca-diff"
  local bin_dir="$HOME/.local/bin"
  local entrypoint="$install_dir/bin/orca-diff.ts"
  local command_path="$bin_dir/orca-diff"

  if ! command -v git >/dev/null || ! command -v node >/dev/null || ! command -v npm >/dev/null ||
    ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 18) ? 0 : 1)'; then
    printf '%s\n' '설치하려면 Git, Node.js 22.18 이상, npm이 필요합니다.' >&2
    return 1
  fi

  if [[ -e "$command_path" || -L "$command_path" ]]; then
    if [[ ! -L "$command_path" || "$(readlink "$command_path")" != "$entrypoint" ]]; then
      printf '다른 파일이 %s에 있습니다. 파일을 확인한 뒤 다시 실행하세요.\n' "$command_path" >&2
      return 1
    fi
  fi

  if [[ -d "$install_dir/.git" ]]; then
    if [[ "$(git -C "$install_dir" remote get-url origin)" != "$repo_url" ]]; then
      printf '다른 저장소가 %s에 있습니다. 설치 경로를 확인하세요.\n' "$install_dir" >&2
      return 1
    fi
  else
    mkdir -p "$(dirname "$install_dir")"
    git clone "$repo_url" "$install_dir"
  fi

  if [[ ! -f "$install_dir/web/dist/index.html" ]]; then
    (cd "$install_dir" && npm ci && npm run build)
  fi

  mkdir -p "$bin_dir"
  if [[ ! -L "$command_path" ]]; then
    ln -s "$entrypoint" "$command_path"
  fi
  printf 'orca-diff를 %s에 설치했습니다.\n' "$install_dir"

  case ":$PATH:" in
    *":$bin_dir:"*)
      if [[ "$(command -v orca-diff)" != "$command_path" ]]; then
        printf '다른 orca-diff 명령이 먼저 검색됩니다. %s를 직접 실행하거나 PATH 순서를 바꾸세요.\n' "$command_path"
      fi
      ;;
    *) printf '%s\n' 'orca-diff 명령을 쓰려면 셸의 PATH에 ~/.local/bin을 추가하세요.' ;;
  esac
  printf '%s\n' '리뷰할 저장소에서 orca-diff를 실행하세요. 업데이트는 orca-diff --update로 실행합니다.'
}

main "$@"
