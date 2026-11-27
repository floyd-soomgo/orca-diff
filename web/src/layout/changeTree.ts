export interface DirNode<File extends { path: string }> {
  name: string; // 화면에 보이는 이름(합쳐진 경우 'a/b')
  path: string; // 저장소 기준 전체 경로(루트는 '')
  dirs: DirNode<File>[];
  files: File[];
}

// 변경 파일 목록을 디렉터리 트리로. 하위 폴더 하나뿐이고 파일이 없는 단계는 한 줄로 합친다(WebStorm처럼).
export function buildFileTree<File extends { path: string }>(files: File[]): DirNode<File> {
  const root: DirNode<File> = { name: '', path: '', dirs: [], files: [] };
  const index = new Map<string, DirNode<File>>([['', root]]);
  for (const c of files) {
    const parts = c.path.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      const path = node.path ? `${node.path}/${part}` : part;
      let child = index.get(path);
      if (!child) {
        child = { name: part, path, dirs: [], files: [] };
        index.set(path, child);
        node.dirs.push(child);
      }
      node = child;
    }
    node.files.push(c);
  }
  const finish = (node: DirNode<File>): DirNode<File> => {
    node.dirs = node.dirs.map((d) => {
      let cur = d;
      while (cur.files.length === 0 && cur.dirs.length === 1) {
        const only = cur.dirs[0];
        cur = { ...only, name: `${cur.name}/${only.name}` };
      }
      return finish(cur);
    });
    node.dirs.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.path.localeCompare(b.path));
    return node;
  };
  return finish(root);
}

export function collectDirPaths(node: DirNode<{ path: string }>): string[] {
  return node.dirs.flatMap((d) => [d.path, ...collectDirPaths(d)]);
}
