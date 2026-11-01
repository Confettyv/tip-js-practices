import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../src/app.js';
import { request, startServer } from '../support/http.js';

async function withApi(store, run) {
  const running = await startServer(createApp({ store, releaseVersion: '1.0.0' }));
  try {
    await run(running.origin);
  } finally {
    await running.close();
  }
}

// Любое обращение к хранилищу — ошибка теста: liveness не должен трогать базу.
function exploding() {
  return new Proxy(
    {},
    {
      get(target, name) {
        return () => {
          throw new Error(`liveness обратился к store.${String(name)}`);
        };
      },
    },
  );
}

test('GET /health/live отвечает 200 без обращения к PostgreSQL', async () => {
  await withApi(exploding(), async (origin) => {
    const { response, body } = await request(origin, '/health/live');
    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: 'ok' });
  });
});

test('GET /health/ready отвечает 200 и сообщает версию при доступной базе', async () => {
  let pings = 0;
  const store = {
    async ping() {
      pings += 1;
      return true;
    },
  };
  await withApi(store, async (origin) => {
    const { response, body } = await request(origin, '/health/ready');
    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: 'ready', version: '1.0.0' });
    assert.equal(pings, 1);
  });
});

test('GET /health/ready отвечает 503 без внутренних деталей при отказе базы', async () => {
  const failure = Object.assign(
    new Error('connect ECONNREFUSED 10.0.0.5:5432 password=secret user=tip_app'),
    { code: 'ECONNREFUSED', stack: 'at Pool.connect (/app/node_modules/pg/lib/index.js)' },
  );
  const store = {
    async ping() {
      throw failure;
    },
  };
  await withApi(store, async (origin) => {
    const { response, body } = await request(origin, '/health/ready');
    const raw = JSON.stringify(body);
    assert.equal(response.status, 503);
    assert.deepEqual(body, { status: 'not_ready', version: '1.0.0' });
    for (const leak of ['ECONNREFUSED', '10.0.0.5', '5432', 'secret', 'tip_app', 'node_modules']) {
      assert.equal(raw.includes(leak), false, leak);
    }
  });
});
