import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_DIR, loadOrCreateKey, PORT } from './config.ts';
import { createApp } from './http/app.ts';
import { orcaRoutes } from './orca/terminals.ts';
import { prefsRoutes } from './prefs.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = join(root, 'web', 'dist');

const server = createApp({
  key: loadOrCreateKey(),
  staticDir: existsSync(staticDir) ? staticDir : null,
  routes: { ...orcaRoutes, ...prefsRoutes(CONFIG_DIR) },
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`orca-review 서버: http://127.0.0.1:${PORT}`);
});
