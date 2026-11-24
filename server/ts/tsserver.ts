import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const IDLE_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 15 * 1000;
const require = createRequire(import.meta.url);

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

// 워크트리 하나당 tsserver 프로세스 하나. 유휴 10분이면 종료한다.
export class TsServer {
  static #instances = new Map<string, TsServer>();

  static forWorktree(wt: string): TsServer {
    let s = TsServer.#instances.get(wt);
    if (!s) {
      s = new TsServer(wt);
      TsServer.#instances.set(wt, s);
    }
    return s;
  }

  readonly wt: string;
  #proc: ChildProcess;
  #seq = 0;
  #pending = new Map<number, Pending>();
  #buffer = Buffer.alloc(0);
  #idle: NodeJS.Timeout | null = null;
  #queue: Promise<unknown> = Promise.resolve();
  #dead = false;

  private constructor(wt: string) {
    this.wt = wt;
    const local = join(wt, 'node_modules', 'typescript', 'lib', 'tsserver.js');
    const entry = existsSync(local) ? local : require.resolve('typescript/lib/tsserver.js');
    this.#proc = spawn(process.execPath, [entry, '--disableAutomaticTypingAcquisition'], {
      cwd: wt,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    this.#proc.stdout!.on('data', (chunk: Buffer) => this.#onData(chunk));
    const fail = (reason: string) => {
      for (const p of this.#pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error(reason));
      }
      this.#pending.clear();
      this.#dead = true;
      if (TsServer.#instances.get(wt) === this) TsServer.#instances.delete(wt);
    };
    this.#proc.on('exit', () => fail('tsserver가 종료되었습니다'));
    // 처리되지 않은 'error' 이벤트는 HTTP 서버까지 죽이므로 반드시 받는다
    this.#proc.on('error', (e) => fail(`tsserver 실행 실패: ${e.message}`));
    this.#proc.stdin!.on('error', (e) => fail(`tsserver 입력 실패: ${e.message}`));
    this.#touch();
  }

  // 응답은 "Content-Length: N\r\n\r\n<json>" 형식
  #onData(chunk: Buffer) {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    for (;;) {
      const headerEnd = this.#buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const match = /Content-Length: (\d+)/.exec(this.#buffer.subarray(0, headerEnd).toString());
      if (!match) {
        this.#buffer = this.#buffer.subarray(headerEnd + 4);
        continue;
      }
      const start = headerEnd + 4;
      const end = start + Number(match[1]);
      if (this.#buffer.length < end) return;
      const msg = JSON.parse(this.#buffer.subarray(start, end).toString('utf8'));
      this.#buffer = this.#buffer.subarray(end);
      if (msg.type !== 'response') continue;
      const p = this.#pending.get(msg.request_seq);
      if (!p) continue;
      this.#pending.delete(msg.request_seq);
      clearTimeout(p.timer);
      if (msg.success) p.resolve(msg.body);
      else p.reject(new Error(msg.message ?? `${msg.command} 실패`));
    }
  }

  #touch() {
    if (this.#idle) clearTimeout(this.#idle);
    this.#idle = setTimeout(() => this.dispose(), IDLE_MS);
    this.#idle.unref();
  }

  request<T>(command: string, args: object): Promise<T> {
    if (this.#dead) return Promise.reject(new Error('tsserver가 종료되었습니다'));
    this.#touch();
    const seq = ++this.#seq;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(seq);
        reject(new Error(`tsserver 응답 시간 초과: ${command}`));
      }, TIMEOUT_MS);
      this.#pending.set(seq, { resolve: resolve as (v: unknown) => void, reject, timer });
      this.#proc.stdin!.write(JSON.stringify({ seq, type: 'request', command, arguments: args }) + '\n');
    });
  }

  // 파일 내용 교체와 질의가 섞이지 않도록 한 번에 하나씩 실행한다
  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(fn, fn);
    this.#queue = run.catch(() => undefined);
    return run;
  }

  dispose() {
    this.#dead = true;
    if (this.#idle) clearTimeout(this.#idle);
    this.#proc.kill();
    if (TsServer.#instances.get(this.wt) === this) TsServer.#instances.delete(this.wt);
  }
}
