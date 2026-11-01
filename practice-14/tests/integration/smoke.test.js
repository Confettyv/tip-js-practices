import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createApp } from '../../src/app.js';
import { createFakeStore } from '../support/fake-store.js';
import { startServer } from '../support/http.js';

const run = promisify(execFile);
const smokeScript = fileURLToPath(new URL('../../tools/smoke.mjs', import.meta.url));

// Smoke-скрипт запускается так же, как после развёртывания: отдельным процессом
// против работающего API. Иначе запрос, который API отклоняет, заметен только на сервере.
test('npm run smoke проходит против работающего API', async () => {
  const running = await startServer(
    createApp({ store: createFakeStore(), releaseVersion: '1.0.0' }),
  );
  try {
    const { stdout } = await run(process.execPath, [smokeScript], {
      env: { ...process.env, SMOKE_BASE_URL: running.origin },
    });
    assert.match(stdout, /завершена успешно/);
  } finally {
    await running.close();
  }
});
